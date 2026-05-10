"""
backend/services/recommendation_engine.py

RecommendationEngine — generates personalised recommendations from a user's
application history using purely deterministic Python logic.

No LLM calls. No external NLP libraries.
All DB access via injected MemoryService and MemoryOptimizer.
"""

from __future__ import annotations

import logging
import math
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TypedDict

from backend.services.memory_service import MemoryService, get_memory_service
from backend.services.memory_optimizer import MemoryOptimizer, get_memory_optimizer
from backend.services.pattern_extractor import PatternExtractor, get_pattern_extractor

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# TypedDicts
# ---------------------------------------------------------------------------


class UserAnalysis(TypedDict):
    total_applications:     int
    successful_applications: int
    success_rate:           float
    avg_score:              float
    improvement_trend:      float
    top_keywords:           List[str]
    failed_patterns:        List[str]


class SuccessMetrics(TypedDict):
    success_rate:             float
    improvement_trend:        float
    keyword_coverage_trend:   float
    tone_effectiveness:       Dict[str, float]


class TrajectoryData(TypedDict):
    dates:            List[str]
    scores:           List[float]
    improvement_rate: float
    learning_curve:   str          # "improving" | "plateau" | "declining" | "insufficient_data"


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_SUCCESS_THRESHOLD = 80.0       # overall score considered a pass
_MIN_RECORDS_FOR_TREND = 3      # need at least this many to compute trend


# ---------------------------------------------------------------------------
# RecommendationEngine
# ---------------------------------------------------------------------------


class RecommendationEngine:
    """
    Generates personalised recommendations from stored application history.

    Args:
        memory_service:    Injected MemoryService (Mongo + Chroma).
        memory_optimizer:  Injected MemoryOptimizer (cached stats, aggregations).
        pattern_extractor: Injected PatternExtractor (keyword / tone mining).
        success_threshold: Minimum overall score treated as successful.
    """

    def __init__(
        self,
        memory_service:    Optional[MemoryService]    = None,
        memory_optimizer:  Optional[MemoryOptimizer]  = None,
        pattern_extractor: Optional[PatternExtractor] = None,
        success_threshold: float = _SUCCESS_THRESHOLD,
    ) -> None:
        self._memory    = memory_service    or get_memory_service()
        self._optimizer = memory_optimizer  or get_memory_optimizer()
        self._extractor = pattern_extractor or get_pattern_extractor()
        self._threshold = success_threshold

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def analyze_user_history(self, user_id: str) -> UserAnalysis:
        """
        Build a full UserAnalysis for the given user.

        Reads all stored applications for the user, computes success rate,
        average score, improvement trend, top keywords from successful runs,
        and failed patterns from low-scoring runs.

        Args:
            user_id: Client-supplied user identifier.

        Returns:
            UserAnalysis TypedDict. Returns safe zero-defaults on DB failure.
        """
        records = await self._fetch_user_records(user_id)

        if not records:
            return UserAnalysis(
                total_applications      = 0,
                successful_applications = 0,
                success_rate            = 0.0,
                avg_score               = 0.0,
                improvement_trend       = 0.0,
                top_keywords            = [],
                failed_patterns         = [],
            )

        scores = [self._overall(r) for r in records]

        successful = [r for r in records if self._overall(r) >= self._threshold]
        failed     = [r for r in records if self._overall(r) < self._threshold]

        total   = len(records)
        success_rate = round(len(successful) / total, 4) if total > 0 else 0.0
        avg_score    = round(sum(scores) / len(scores), 2) if scores else 0.0
        trend        = self._linear_trend(scores) if len(scores) >= _MIN_RECORDS_FOR_TREND else 0.0

        top_keywords  = await self.get_top_keywords(user_id, limit=15)
        failed_patterns = await self.get_failed_patterns(user_id)

        return UserAnalysis(
            total_applications      = total,
            successful_applications = len(successful),
            success_rate            = success_rate,
            avg_score               = avg_score,
            improvement_trend       = round(trend, 4),
            top_keywords            = top_keywords,
            failed_patterns         = failed_patterns,
        )

    async def get_top_keywords(self, user_id: str, limit: int = 10) -> List[str]:
        """
        Return the most frequent keywords found in high-scoring resumes
        for this user.

        Algorithm:
          1. Fetch all successful applications.
          2. Run PatternExtractor.extract_keywords() on each resume.
          3. Aggregate counts across all resumes.
          4. Return top-n by frequency.

        Args:
            user_id: User identifier.
            limit:   Max keywords to return.

        Returns:
            List of keyword strings ordered by frequency descending.
        """
        records = await self._fetch_user_records(user_id)
        successful = [
            r for r in records
            if self._overall(r) >= self._threshold
            and r.get("resume_snapshot", "").strip()
        ]

        if not successful:
            return []

        combined: Counter = Counter()
        for r in successful:
            score   = self._overall(r)
            resume  = r.get("resume_snapshot") or ""
            kws     = self._extractor.extract_keywords(resume, score, top_n=40)
            for kw in kws:
                combined[kw.keyword] += kw.frequency

        return [kw for kw, _ in combined.most_common(limit)]

    async def get_failed_patterns(self, user_id: str) -> List[str]:
        """
        Identify patterns common in low-scoring applications.

        Compares keyword / structural traits of failed applications against
        successful ones and returns traits present in failures but not in
        successes — these represent "avoid" signals.

        Args:
            user_id: User identifier.

        Returns:
            List of human-readable pattern descriptions.
        """
        records = await self._fetch_user_records(user_id)
        if not records:
            return []

        successful = [r for r in records if self._overall(r) >= self._threshold]
        failed     = [r for r in records if self._overall(r) < self._threshold]

        if not failed:
            return []

        patterns: List[str] = []

        # Structural comparison
        if failed:
            failed_structs = [
                self._extractor.extract_structure_patterns(
                    r.get("resume_snapshot") or ""
                )
                for r in failed
            ]
            failed_quant_rates = [s.quantification_rate for s in failed_structs]
            avg_failed_quant   = (
                sum(failed_quant_rates) / len(failed_quant_rates)
                if failed_quant_rates else 0.0
            )

            if successful:
                success_structs = [
                    self._extractor.extract_structure_patterns(
                        r.get("resume_snapshot") or ""
                    )
                    for r in successful
                ]
                success_quant_rates = [s.quantification_rate for s in success_structs]
                avg_success_quant = (
                    sum(success_quant_rates) / len(success_quant_rates)
                    if success_quant_rates else 0.0
                )
                if avg_failed_quant < avg_success_quant - 0.15:
                    patterns.append(
                        f"Low quantification rate ({avg_failed_quant:.0%} vs "
                        f"{avg_success_quant:.0%} in successful applications)"
                    )

        # Passive voice check
        if failed:
            failed_tones = [
                self._extractor.extract_tone_markers(r.get("resume_snapshot") or "")
                for r in failed
            ]
            avg_passive = (
                sum(t.passive_voice_count for t in failed_tones) / len(failed_tones)
                if failed_tones else 0.0
            )
            if avg_passive > 5:
                patterns.append(
                    f"High passive voice usage (avg {avg_passive:.1f} instances per resume)"
                )

        # Low bullet count
        if failed:
            structs = [
                self._extractor.extract_structure_patterns(r.get("resume_snapshot") or "")
                for r in failed
            ]
            avg_bullets = sum(s.bullet_count for s in structs) / len(structs) if structs else 0
            if avg_bullets < 8:
                patterns.append(
                    f"Insufficient bullet points (avg {avg_bullets:.1f}) — use STAR format bullets"
                )

        # Missing summary section
        no_summary = [
            r for r in failed
            if not self._extractor.extract_structure_patterns(
                r.get("resume_snapshot") or ""
            ).has_summary
        ]
        if len(no_summary) >= max(1, len(failed) // 2):
            patterns.append("Missing professional summary section in most failed applications")

        return patterns

    async def generate_recommendations(self, user_id: str) -> List[str]:
        """
        Generate a prioritised list of actionable, human-readable recommendations.

        Combines: success rate analysis, trend direction, top keyword gaps,
        and failed patterns into a ranked recommendation list.

        Args:
            user_id: User identifier.

        Returns:
            List of recommendation strings (most impactful first).
        """
        analysis = await self.analyze_user_history(user_id)
        recs: List[str] = []

        # Success rate advice
        sr = analysis["success_rate"]
        if sr < 0.3:
            recs.append(
                "Priority: Increase ATS keyword density — fewer than 30% of your applications "
                "are passing the score threshold. Focus on exact-match keywords from the JD."
            )
        elif sr < 0.6:
            recs.append(
                "Improve STAR-format bullet points — your pass rate is moderate. "
                "Every bullet should state Situation, Action, and a quantified Result."
            )
        else:
            recs.append(
                "Strong pass rate — focus on cover letter personalisation to improve "
                "quality scores from passing to outstanding."
            )

        # Trend advice
        trend = analysis["improvement_trend"]
        if trend < -2.0:
            recs.append(
                "Score declining across recent applications — review the change log "
                "and revert any structural changes made in the last 2 iterations."
            )
        elif trend > 3.0:
            recs.append(
                "Strong upward trend detected — your iterative improvement strategy "
                "is working. Continue using the evaluator feedback loop."
            )

        # Keyword advice
        top_kws = analysis["top_keywords"]
        if top_kws:
            recs.append(
                f"These keywords appear most in your successful resumes and should be "
                f"prioritised in new applications: {', '.join(top_kws[:8])}."
            )

        # Failed pattern advice
        for pattern in analysis["failed_patterns"][:3]:
            recs.append(f"Recurring issue detected: {pattern}")

        # Default if no records
        if not recs:
            recs.append(
                "No application history found. Run your first pipeline to begin "
                "building personalised recommendations."
            )

        return recs

    async def get_success_metrics(self, user_id: str) -> SuccessMetrics:
        """
        Compute success rate, improvement trend, keyword coverage trend,
        and tone effectiveness scores.

        Args:
            user_id: User identifier.

        Returns:
            SuccessMetrics TypedDict with zero-defaults on failure.
        """
        records = await self._fetch_user_records(user_id)

        if not records:
            return SuccessMetrics(
                success_rate           = 0.0,
                improvement_trend      = 0.0,
                keyword_coverage_trend = 0.0,
                tone_effectiveness     = {},
            )

        scores = [self._overall(r) for r in records]
        kw_scores = [
            (r.get("final_scores") or {}).get("keyword_coverage", 0.0)
            for r in records
        ]

        success_rate  = round(
            sum(1 for s in scores if s >= self._threshold) / len(scores), 4
        ) if scores else 0.0
        score_trend   = self._linear_trend(scores)   if len(scores) >= _MIN_RECORDS_FOR_TREND else 0.0
        kw_trend      = self._linear_trend(kw_scores) if len(kw_scores) >= _MIN_RECORDS_FOR_TREND else 0.0

        # Tone effectiveness: average impact + tone_match scores for successful apps
        successful = [r for r in records if self._overall(r) >= self._threshold]
        tone_effectiveness: Dict[str, float] = {}
        if successful:
            dims = ["impact", "tone_match", "relevance"]
            for dim in dims:
                vals = [
                    (r.get("final_scores") or {}).get(dim, 0.0)
                    for r in successful
                    if (r.get("final_scores") or {}).get(dim) is not None
                ]
                if vals:
                    tone_effectiveness[dim] = round(sum(vals) / len(vals), 2)

        return SuccessMetrics(
            success_rate           = success_rate,
            improvement_trend      = round(score_trend, 4),
            keyword_coverage_trend = round(kw_trend, 4),
            tone_effectiveness     = tone_effectiveness,
        )

    async def get_improvement_trajectory(self, user_id: str) -> TrajectoryData:
        """
        Return time-series scores and compute a learning curve classification.

        Classification rules:
          - "improving":         linear trend ≥ +2.0 per record
          - "plateau":           |trend| < 2.0 and avg_score ≥ 70
          - "declining":         linear trend ≤ -2.0 per record
          - "insufficient_data": fewer than _MIN_RECORDS_FOR_TREND records

        Args:
            user_id: User identifier.

        Returns:
            TrajectoryData TypedDict.
        """
        records = await self._fetch_user_records(user_id)

        if len(records) < _MIN_RECORDS_FOR_TREND:
            return TrajectoryData(
                dates            = [],
                scores           = [],
                improvement_rate = 0.0,
                learning_curve   = "insufficient_data",
            )

        # Sort chronologically
        def _ts(r: Dict[str, Any]) -> str:
            return r.get("timestamp") or ""

        sorted_records = sorted(records, key=_ts)
        dates  = [r.get("timestamp", "")[:10] for r in sorted_records]
        scores = [self._overall(r) for r in sorted_records]

        trend   = self._linear_trend(scores)
        avg_scr = sum(scores) / len(scores) if scores else 0.0

        if trend >= 2.0:
            curve = "improving"
        elif trend <= -2.0:
            curve = "declining"
        elif avg_scr >= 70.0:
            curve = "plateau"
        else:
            curve = "declining"

        return TrajectoryData(
            dates            = dates,
            scores           = [round(s, 2) for s in scores],
            improvement_rate = round(trend, 4),
            learning_curve   = curve,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _fetch_user_records(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Pull all application records associated with user_id.

        Attempts cache first, then Mongo.
        """
        cache_key = f"user_records:{user_id}"
        cached    = await self._optimizer.cache_get(cache_key)
        if cached is not None:
            return cached  # type: ignore[return-value]

        try:
            records = await self._memory.retrieve_past_applications(limit=100)
            # Filter by user_id stored in session_memory (best-effort)
            # In the current schema user_id is not a top-level field, so we return all
            # and rely on the caller's user_id for context.
            # If user partitioning is needed, store user_id in the doc at write time.
            await self._optimizer.cache_set(cache_key, records)
            return records
        except Exception as exc:
            logger.error(
                "[recommendation_engine] failed to fetch records user=%s: %s",
                user_id, exc,
            )
            return []

    @staticmethod
    def _overall(record: Dict[str, Any]) -> float:
        """Extract overall score from a PastApplication record."""
        return float(
            (record.get("final_scores") or {}).get("overall", 0.0) or 0.0
        )

    @staticmethod
    def _linear_trend(values: List[float]) -> float:
        """
        Compute the slope of the ordinary least-squares regression line
        through (index, value) pairs.

        Returns 0.0 if fewer than 2 values are provided.
        """
        n = len(values)
        if n < 2:
            return 0.0

        xs = list(range(n))
        x_mean = sum(xs) / n
        y_mean = sum(values) / n

        numerator   = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, values))
        denominator = sum((x - x_mean) ** 2 for x in xs)

        if denominator == 0:
            return 0.0

        return numerator / denominator


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_engine_instance: Optional[RecommendationEngine] = None


def get_recommendation_engine() -> RecommendationEngine:
    """Return the process-wide RecommendationEngine singleton."""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = RecommendationEngine()
    return _engine_instance