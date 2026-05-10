"""
backend/routes/recommendations.py

FastAPI router for recommendation and learning endpoints.

Routes:
  GET    /recommendations/{user_id}
  GET    /recommendations/{user_id}/trajectory
  POST   /recommendations/{user_id}/pre-submission-check
  GET    /recommendations/{user_id}/analysis
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.services.recommendation_engine import (
    RecommendationEngine,
    get_recommendation_engine,
)
from backend.evaluation.learning_loop import LearningLoop, get_learning_loop

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


# ---------------------------------------------------------------------------
# Dependency providers
# ---------------------------------------------------------------------------


def _get_engine() -> RecommendationEngine:
    return get_recommendation_engine()


def _get_loop() -> LearningLoop:
    return get_learning_loop()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class SuccessMetricsSchema(BaseModel):
    success_rate:           float
    improvement_trend:      float
    keyword_coverage_trend: float
    tone_effectiveness:     Dict[str, float] = Field(default_factory=dict)


class RecommendationResponse(BaseModel):
    user_id:                str
    top_keywords:           List[str]
    success_metrics:        SuccessMetricsSchema
    improvement_suggestions: List[str]
    failed_patterns:        List[str]
    trend:                  str = Field(
        ...,
        description="One of: improving | stable | declining | insufficient_data",
    )


class TrajectoryResponse(BaseModel):
    user_id:          str
    dates:            List[str]
    scores:           List[float]
    improvement_rate: float
    learning_curve:   str
    analysis:         str = Field(..., description="Human-readable summary of the trajectory")


class PreSubmissionRequest(BaseModel):
    resume_text: str  = Field(..., min_length=50)
    jd_text:     str  = Field(..., min_length=30)
    parsed_jd:   Optional[Dict[str, Any]] = Field(
        default=None,
        description="Pre-parsed JD dict (ats_keywords, seniority_level, etc.). "
                    "If omitted, basic heuristics are applied to jd_text.",
    )

    model_config = {"str_strip_whitespace": True}


class PreSubmissionResponse(BaseModel):
    user_id:          str
    missing_keywords: List[str]
    missing_patterns: List[str]
    tone_gaps:        List[str]
    recommendations:  List[str]
    confidence:       float = Field(..., ge=0.0, le=1.0)
    should_improve:   bool  = Field(
        ...,
        description="True when missing_keywords > 3 or missing_patterns > 2",
    )


class UserAnalysisResponse(BaseModel):
    user_id:                str
    total_applications:     int
    successful_applications: int
    success_rate:           float
    avg_score:              float
    improvement_trend:      float
    top_keywords:           List[str]
    failed_patterns:        List[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _trend_label(improvement_rate: float, success_rate: float) -> str:
    """Map numeric trend slope + success rate to a human-readable label."""
    if improvement_rate >= 2.0:
        return "improving"
    if improvement_rate <= -2.0:
        return "declining"
    if success_rate >= 0.6:
        return "stable"
    return "declining"


def _trajectory_analysis(
    learning_curve: str,
    improvement_rate: float,
    scores: List[float],
) -> str:
    """Generate a one-sentence human-readable trajectory summary."""
    if not scores:
        return "Insufficient data to analyse trajectory. Submit more applications."

    avg   = round(sum(scores) / len(scores), 1)
    last  = round(scores[-1], 1)
    delta = round(improvement_rate, 2)

    if learning_curve == "improving":
        return (
            f"Strong upward trajectory — avg score {avg}, latest {last}, "
            f"improving at +{delta} per iteration. Keep using evaluator feedback."
        )
    if learning_curve == "plateau":
        return (
            f"Performance stable at avg {avg}. Latest score: {last}. "
            f"Focus on cover letter personalisation to push above the plateau."
        )
    if learning_curve == "declining":
        return (
            f"Score declining (slope {delta} per iteration). Avg: {avg}, latest: {last}. "
            f"Review recent change logs and revert ineffective edits."
        )
    return (
        f"Not enough data for a reliable trend ({len(scores)} record(s) available). "
        f"Current avg: {avg}."
    )


def _build_parsed_jd_from_text(jd_text: str) -> Dict[str, Any]:
    """
    Build a minimal ParsedJD-shaped dict from raw JD text when no
    pre-parsed JD is provided by the caller.

    Uses only basic heuristics — no LLM call.
    """
    import re

    lines       = [l.strip() for l in jd_text.splitlines() if l.strip()]
    role_title  = lines[0] if lines else "Unknown Role"

    # Extract bullet-point items as heuristic keyword seeds
    bullets = [
        re.sub(r"^[-•*·]\s*", "", l)
        for l in lines
        if re.match(r"^\s*[-•*·]\s+", l)
    ]

    # Very light tokenisation for ats_keywords (words ≥ 4 chars, title-case or all-caps)
    word_re = re.compile(r"\b([A-Z][a-zA-Z]{3,}|[A-Z]{3,})\b")
    raw_kws = word_re.findall(jd_text)
    seen: Dict[str, int] = {}
    for kw in raw_kws:
        seen[kw] = seen.get(kw, 0) + 1
    ats_keywords = [
        kw.lower()
        for kw, cnt in sorted(seen.items(), key=lambda x: x[1], reverse=True)
        if cnt >= 2
    ][:30]

    # Seniority heuristic
    seniority_map = [
        (re.compile(r"\bintern\b|\bentry[\s-]level\b", re.I), "junior"),
        (re.compile(r"\bjunior\b|\bjr\.?\b",            re.I), "junior"),
        (re.compile(r"\bmid[\s-]level\b|\bintermediate\b", re.I), "mid"),
        (re.compile(r"\bsenior\b|\bsr\.?\b",             re.I), "senior"),
        (re.compile(r"\bstaff\b",                        re.I), "staff"),
        (re.compile(r"\bprincipal\b|\blead\b",           re.I), "principal"),
        (re.compile(r"\bdirector\b|\bvp\b",              re.I), "director"),
    ]
    seniority = "unknown"
    for pattern, level in seniority_map:
        if pattern.search(jd_text):
            seniority = level
            break

    return {
        "role_title":      role_title,
        "company_name":    "Unknown",
        "seniority_level": seniority,
        "ats_keywords":    ats_keywords,
        "required_skills": [],
        "preferred_skills": [],
        "responsibilities": bullets[:10],
        "culture_signals":  [],
        "tech_stack":       [],
    }


# ---------------------------------------------------------------------------
# GET /{user_id}
# ---------------------------------------------------------------------------


@router.get(
    "/{user_id}",
    response_model=RecommendationResponse,
    status_code=status.HTTP_200_OK,
    summary="Get personalised recommendations for a user",
    responses={
        200: {"description": "Recommendations returned"},
        404: {"description": "No history found for user_id"},
        500: {"description": "Service error"},
    },
)
async def get_recommendations(
    user_id: str,
    engine:  RecommendationEngine = Depends(_get_engine),
) -> RecommendationResponse:
    """
    Return personalised recommendations derived from the user's full
    application history.

    Combines:
      - Top recurring keywords from successful runs
      - Success rate and trend metrics
      - Prioritised improvement suggestions
      - Failed pattern descriptions
    """
    if not user_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id must not be empty.",
        )

    try:
        analysis = await engine.analyze_user_history(user_id)
    except Exception as exc:
        logger.exception("[GET /recommendations/%s] analyze_user_history: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyse user history: {exc}",
        )

    if analysis["total_applications"] == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No application history found for user_id='{user_id}'.",
        )

    try:
        metrics = await engine.get_success_metrics(user_id)
    except Exception as exc:
        logger.warning("[GET /recommendations/%s] get_success_metrics: %s", user_id, exc)
        metrics = {
            "success_rate":           analysis["success_rate"],
            "improvement_trend":      analysis["improvement_trend"],
            "keyword_coverage_trend": 0.0,
            "tone_effectiveness":     {},
        }

    try:
        suggestions = await engine.generate_recommendations(user_id)
    except Exception as exc:
        logger.warning("[GET /recommendations/%s] generate_recommendations: %s", user_id, exc)
        suggestions = []

    trend = _trend_label(
        metrics["improvement_trend"],
        metrics["success_rate"],
    )

    return RecommendationResponse(
        user_id  = user_id,
        top_keywords = analysis["top_keywords"],
        success_metrics = SuccessMetricsSchema(
            success_rate           = metrics["success_rate"],
            improvement_trend      = metrics["improvement_trend"],
            keyword_coverage_trend = metrics["keyword_coverage_trend"],
            tone_effectiveness     = metrics.get("tone_effectiveness") or {},
        ),
        improvement_suggestions = suggestions,
        failed_patterns         = analysis["failed_patterns"],
        trend                   = trend,
    )


# ---------------------------------------------------------------------------
# GET /{user_id}/trajectory
# ---------------------------------------------------------------------------


@router.get(
    "/{user_id}/trajectory",
    response_model=TrajectoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get score trajectory and learning curve for a user",
    responses={
        200: {"description": "Trajectory data returned"},
        404: {"description": "Insufficient history for trajectory"},
        500: {"description": "Service error"},
    },
)
async def get_trajectory(
    user_id: str,
    engine:  RecommendationEngine = Depends(_get_engine),
) -> TrajectoryResponse:
    """
    Return time-series score data and a learning curve classification.

    Learning curve labels:
      - improving          : score slope ≥ +2 per record
      - plateau            : |slope| < 2 and avg score ≥ 70
      - declining          : score slope ≤ -2 per record
      - insufficient_data  : fewer than 3 records
    """
    if not user_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id must not be empty.",
        )

    try:
        trajectory = await engine.get_improvement_trajectory(user_id)
    except Exception as exc:
        logger.exception("[GET /recommendations/%s/trajectory]: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute trajectory: {exc}",
        )

    if trajectory["learning_curve"] == "insufficient_data":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"Insufficient history for user_id='{user_id}'. "
                f"At least 3 application records are required."
            ),
        )

    analysis_text = _trajectory_analysis(
        learning_curve   = trajectory["learning_curve"],
        improvement_rate = trajectory["improvement_rate"],
        scores           = trajectory["scores"],
    )

    return TrajectoryResponse(
        user_id          = user_id,
        dates            = trajectory["dates"],
        scores           = trajectory["scores"],
        improvement_rate = trajectory["improvement_rate"],
        learning_curve   = trajectory["learning_curve"],
        analysis         = analysis_text,
    )


# ---------------------------------------------------------------------------
# POST /{user_id}/pre-submission-check
# ---------------------------------------------------------------------------


@router.post(
    "/{user_id}/pre-submission-check",
    response_model=PreSubmissionResponse,
    status_code=status.HTTP_200_OK,
    summary="Run a pre-submission gap analysis against past successes",
    responses={
        200: {"description": "Pre-submission check complete"},
        400: {"description": "Invalid request body"},
        500: {"description": "Check failed"},
    },
)
async def pre_submission_check(
    user_id: str,
    body:    PreSubmissionRequest,
    loop:    LearningLoop = Depends(_get_loop),
) -> PreSubmissionResponse:
    """
    Compare the current draft resume against high-scoring historical resumes
    to surface keyword, structural, and tone gaps **before** the pipeline runs.

    If parsed_jd is not provided, a minimal JD dict is inferred from jd_text
    using heuristics (no LLM call).

    Returns:
      - Gaps vs historical successes (missing_keywords, tone_gaps, etc.)
      - Actionable recommendations
      - confidence score (0–1) based on number of reference resumes
      - should_improve flag (True when gaps exceed safe thresholds)
    """
    if not user_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id must not be empty.",
        )

    # Build parsed_jd if caller did not supply one
    parsed_jd: Dict[str, Any] = body.parsed_jd or _build_parsed_jd_from_text(body.jd_text)

    current_app: Dict[str, Any] = {
        "tailored_resume": body.resume_text,
        "cover_letter":    "",          # not available pre-submission
    }

    # Compare against historical successes
    try:
        comparison = await loop.compare_to_successes(
            current_app = current_app,
            role        = parsed_jd.get("role_title") or "",
            user_id     = user_id,
        )
    except Exception as exc:
        logger.exception(
            "[POST /recommendations/%s/pre-submission-check] compare_to_successes: %s",
            user_id, exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Comparison failed: {exc}",
        )

    # Augment with JD-specific suggestions
    try:
        jd_suggestions = await loop.suggest_improvements_pre_submission(
            current_app = current_app,
            parsed_jd   = parsed_jd,
        )
    except Exception as exc:
        logger.warning(
            "[POST /recommendations/%s/pre-submission-check] suggestions: %s",
            user_id, exc,
        )
        jd_suggestions = []

    # Merge recommendations; deduplicate while preserving order
    seen_recs: set = set()
    merged_recs: List[str] = []
    for rec in [*comparison["recommendations"], *jd_suggestions]:
        if rec not in seen_recs:
            seen_recs.add(rec)
            merged_recs.append(rec)

    # Determine should_improve threshold
    should_improve = (
        len(comparison["missing_keywords"]) > 3
        or len(comparison["missing_patterns"]) > 2
        or len(comparison["tone_gaps"]) > 1
    )

    return PreSubmissionResponse(
        user_id          = user_id,
        missing_keywords = comparison["missing_keywords"],
        missing_patterns = comparison["missing_patterns"],
        tone_gaps        = comparison["tone_gaps"],
        recommendations  = merged_recs,
        confidence       = comparison["confidence"],
        should_improve   = should_improve,
    )


# ---------------------------------------------------------------------------
# GET /{user_id}/analysis
# ---------------------------------------------------------------------------


@router.get(
    "/{user_id}/analysis",
    response_model=UserAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Get full user analysis summary",
    responses={
        200: {"description": "Analysis returned"},
        404: {"description": "No history found for user_id"},
        500: {"description": "Service error"},
    },
)
async def get_user_analysis(
    user_id: str,
    engine:  RecommendationEngine = Depends(_get_engine),
) -> UserAnalysisResponse:
    """
    Return a complete UserAnalysis covering all application records
    for the given user_id.

    Includes success rate, average score, improvement trend, top keywords
    from successful runs, and patterns that characterise failed applications.
    """
    if not user_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id must not be empty.",
        )

    try:
        analysis = await engine.analyze_user_history(user_id)
    except Exception as exc:
        logger.exception("[GET /recommendations/%s/analysis]: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyse user history: {exc}",
        )

    if analysis["total_applications"] == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No application records found for user_id='{user_id}'.",
        )

    return UserAnalysisResponse(
        user_id                 = user_id,
        total_applications      = analysis["total_applications"],
        successful_applications = analysis["successful_applications"],
        success_rate            = analysis["success_rate"],
        avg_score               = analysis["avg_score"],
        improvement_trend       = analysis["improvement_trend"],
        top_keywords            = analysis["top_keywords"],
        failed_patterns         = analysis["failed_patterns"],
    )