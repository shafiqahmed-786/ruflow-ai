"""
backend/agents/evaluator_agent.py

Evaluator Agent — three-layer scoring pipeline:
  Layer 1: Programmatic ATS keyword coverage score
  Layer 2: Semantic similarity via cosine distance (embedding)
  Layer 3: LLM-as-judge holistic quality scoring (0–100)

Produces: eval_scores, eval_feedback, eval_status
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from backend.config.settings import get_settings
from backend.orchestrator.state import (
    AgentName,
    AgentState,
    EvalScores,
    EvalStatus,
    LLMModel,
)
from backend.services.llm_service import get_llm_router
from backend.services.vector_db_service import EmbeddingService, get_embedding_service

logger = logging.getLogger(__name__)
cfg = get_settings()

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

EVALUATOR_SYSTEM_PROMPT = """
You are a ruthless expert hiring manager, senior ATS system specialist,
and technical recruiter who evaluates job application materials.

Score the provided tailored resume and cover letter against the job description.

SCORING DIMENSIONS (each 0–100):

keyword_coverage:
  - What percentage of ats_keywords appear naturally in the resume?
  - 90+ = excellent, 70-89 = good, 50-69 = needs work, <50 = poor
  - Penalise keyword stuffing (unnatural repetition)

relevance:
  - Does the experience align with role responsibilities?
  - Do the most prominent experience bullets match required_skills?
  - 90+ = highly targeted, 70-89 = mostly aligned, <70 = generic

impact:
  - Are achievements quantified? (%, $, scale metrics, time savings)
  - Is STAR format used consistently?
  - 90+ = all bullets quantified, 70-89 = most, <50 = vague / no numbers

tone_match:
  - Does the writing match JD seniority and culture signals?
  - Senior/principal should show ownership and strategy language
  - 90+ = perfect tone, 70-89 = minor mismatches, <70 = clear mismatch

cover_letter_quality:
  - Is the opening hook specific and compelling (not generic)?
  - Does it reference company-specific knowledge?
  - Does it map skills to JD requirements with concrete evidence?
  - 90+ = exceptional, 70-89 = good, 50-69 = generic, <50 = template-like

overall:
  Weighted average:
    keyword_coverage * 0.30
    + relevance       * 0.25
    + impact          * 0.20
    + tone_match      * 0.15
    + cover_letter_quality * 0.10

FEEDBACK FORMAT:
critical_issues: Specific must-fix problems (list 3–6 actionable items)
improvement_hints: Nice-to-have enhancements (list 2–4 items)

Return ONLY a valid JSON object. No markdown. No preamble.

Schema:
{
  "scores": {
    "keyword_coverage": <float 0-100>,
    "relevance":        <float 0-100>,
    "impact":           <float 0-100>,
    "tone_match":       <float 0-100>,
    "cover_letter_quality": <float 0-100>
  },
  "overall": <float 0-100>,
  "critical_issues":  ["string"],
  "improvement_hints": ["string"]
}
"""

# ---------------------------------------------------------------------------
# Layer 1: Programmatic ATS scoring
# ---------------------------------------------------------------------------


def _compute_ats_score(resume: str, ats_keywords: List[str]) -> Tuple[float, List[str], List[str]]:
    """
    Compute ATS keyword coverage score.

    Algorithm:
      - Tokenise resume to lowercase words + bigrams
      - For each keyword in ats_keywords, check exact substring match
        (case-insensitive) with whole-word boundary enforcement where possible
      - Score = (matched / total) * 100

    Returns:
        (score_0_100, matched_keywords, missing_keywords)
    """
    if not ats_keywords:
        return 75.0, [], []

    lower_resume = resume.lower()
    matched: List[str] = []
    missing: List[str] = []

    for kw in ats_keywords:
        kw_lower = kw.lower().strip()
        if not kw_lower:
            continue

        # Multi-word keywords: substring match is sufficient
        if " " in kw_lower:
            found = kw_lower in lower_resume
        else:
            # Single word: word boundary match to avoid false positives
            # e.g. "go" should not match "good" or "google"
            found = bool(re.search(rf"\b{re.escape(kw_lower)}\b", lower_resume))

        if found:
            matched.append(kw)
        else:
            missing.append(kw)

    if not ats_keywords:
        return 75.0, [], []

    score = (len(matched) / len(ats_keywords)) * 100.0
    return round(score, 2), matched, missing


# ---------------------------------------------------------------------------
# Layer 2: Semantic similarity scoring
# ---------------------------------------------------------------------------


async def _compute_semantic_score(
    embed_svc: EmbeddingService,
    resume: str,
    cover_letter: str,
    jd_text: str,
) -> float:
    """
    Compute semantic alignment between application materials and JD.

    Method:
      1. Embed resume[:2000] and cover_letter[:800]
      2. Embed JD[:1500]
      3. Compute cosine similarity for each pair
      4. Weighted average: resume_sim * 0.6 + cl_sim * 0.4
      5. Normalise from [-1,1] to [0,100]

    Returns:
        Semantic similarity score 0–100.
    """
    try:
        resume_trunc = resume[:2000] if resume else ""
        cl_trunc     = cover_letter[:800] if cover_letter else ""
        jd_trunc     = jd_text[:1500] if jd_text else ""

        if not jd_trunc:
            return 50.0

        texts_to_embed = [t for t in [resume_trunc, cl_trunc, jd_trunc] if t]
        embeddings = await embed_svc.embed_batch(texts_to_embed)

        if len(embeddings) < 2:
            return 50.0

        import numpy as np

        def cosine(a: List[float], b: List[float]) -> float:
            va = np.array(a, dtype=np.float32)
            vb = np.array(b, dtype=np.float32)
            norm_a = np.linalg.norm(va)
            norm_b = np.linalg.norm(vb)
            if norm_a == 0 or norm_b == 0:
                return 0.0
            return float(np.dot(va, vb) / (norm_a * norm_b))

        # Last embedding is always the JD
        jd_emb = embeddings[-1]

        if len(embeddings) == 3:
            resume_sim = cosine(embeddings[0], jd_emb)
            cl_sim     = cosine(embeddings[1], jd_emb)
            combined   = resume_sim * 0.6 + cl_sim * 0.4
        elif len(embeddings) == 2:
            # Only resume or only cover letter
            combined = cosine(embeddings[0], jd_emb)
        else:
            return 50.0

        # Cosine is in [-1, 1]; practical range for text is [0, 1]
        # Scale to [0, 100]
        score = max(0.0, min(1.0, combined)) * 100.0
        return round(score, 2)

    except Exception as exc:
        logger.warning("[evaluator] semantic scoring failed: %s", exc)
        return 50.0


# ---------------------------------------------------------------------------
# Layer 3: LLM-as-judge scoring
# ---------------------------------------------------------------------------


async def _compute_llm_scores(
    session_id: str,
    resume: str,
    cover_letter: str,
    parsed_jd: Dict[str, Any],
    model: str,
) -> Tuple[EvalScores, str]:
    """
    Get holistic quality scores and structured feedback from the LLM judge.

    Returns:
        (EvalScores, eval_feedback_json_string)
    """
    router = get_llm_router()

    # Trim inputs to manage token budget
    resume_trimmed = resume[:3000] if resume else "[No resume generated]"
    cl_trimmed     = cover_letter[:1200] if cover_letter else "[No cover letter generated]"

    jd_for_eval: Dict[str, Any] = {
        "role_title":      parsed_jd.get("role_title"),
        "seniority_level": parsed_jd.get("seniority_level"),
        "required_skills": parsed_jd.get("required_skills"),
        "ats_keywords":    (parsed_jd.get("ats_keywords") or [])[:30],
        "responsibilities": (parsed_jd.get("responsibilities") or [])[:8],
        "culture_signals": parsed_jd.get("culture_signals"),
    }

    user_msg = (
        f"## Job Description (Key Fields)\n"
        f"{json.dumps(jd_for_eval, indent=2)}\n\n"
        f"## Tailored Resume\n{resume_trimmed}\n\n"
        f"## Cover Letter\n{cl_trimmed}"
    )

    default_scores = EvalScores(
        keyword_coverage=50.0,
        relevance=50.0,
        impact=50.0,
        tone_match=50.0,
        cover_letter_quality=50.0,
        overall=50.0,
    )
    default_feedback = json.dumps({
        "critical_issues": ["LLM evaluation unavailable — check logs"],
        "improvement_hints": [],
    })

    try:
        result: Dict[str, Any] = await router.invoke_json(
            agent_name=AgentName.EVALUATOR.value,
            system_prompt=EVALUATOR_SYSTEM_PROMPT,
            user_message=user_msg,
            session_id=session_id,
            model_override=model,
        )

        raw_scores = result.get("scores") or {}

        def _clamp(v: Any) -> float:
            try:
                return float(max(0.0, min(100.0, float(v))))
            except (TypeError, ValueError):
                return 50.0

        scores = EvalScores(
            keyword_coverage    = _clamp(raw_scores.get("keyword_coverage", 50)),
            relevance           = _clamp(raw_scores.get("relevance", 50)),
            impact              = _clamp(raw_scores.get("impact", 50)),
            tone_match          = _clamp(raw_scores.get("tone_match", 50)),
            cover_letter_quality= _clamp(raw_scores.get("cover_letter_quality", 50)),
            overall             = _clamp(result.get("overall", 50)),
        )

        # Recompute overall using our weights (don't fully trust LLM's arithmetic)
        computed_overall = (
            scores["keyword_coverage"]    * cfg.evaluation.eval_ats_weight      * (1/0.4) * 0.30
            + scores["relevance"]         * 0.25
            + scores["impact"]            * 0.20
            + scores["tone_match"]        * 0.15
            + scores["cover_letter_quality"] * 0.10
        )
        # Simpler: use standard weights directly
        computed_overall = (
            scores["keyword_coverage"]     * 0.30
            + scores["relevance"]          * 0.25
            + scores["impact"]             * 0.20
            + scores["tone_match"]         * 0.15
            + scores["cover_letter_quality"] * 0.10
        )
        scores["overall"] = round(computed_overall, 2)

        feedback = json.dumps({
            "critical_issues":   [str(c) for c in (result.get("critical_issues") or [])],
            "improvement_hints": [str(h) for h in (result.get("improvement_hints") or [])],
        })

        return scores, feedback

    except Exception as exc:
        logger.error("[evaluator] LLM judge failed: %s", exc)
        return default_scores, default_feedback


# ---------------------------------------------------------------------------
# Score fusion
# ---------------------------------------------------------------------------


def _fuse_scores(
    ats_score: float,
    semantic_score: float,
    llm_scores: EvalScores,
) -> EvalScores:
    """
    Fuse the three scoring layers into final EvalScores.

    ATS score overrides LLM's keyword_coverage dimension.
    Semantic score biases the LLM relevance dimension.
    Other dimensions come directly from the LLM judge.

    Weights: ats=0.4, semantic=0.3, llm_judge=0.3 (from settings)
    """
    # Blend keyword_coverage: 70% programmatic + 30% LLM
    blended_keyword = (
        ats_score * 0.70
        + llm_scores.get("keyword_coverage", 50.0) * 0.30
    )

    # Blend relevance: 50% semantic + 50% LLM
    blended_relevance = (
        semantic_score * 0.50
        + llm_scores.get("relevance", 50.0) * 0.50
    )

    fused = EvalScores(
        keyword_coverage    = round(blended_keyword, 2),
        relevance           = round(blended_relevance, 2),
        impact              = round(llm_scores.get("impact", 50.0), 2),
        tone_match          = round(llm_scores.get("tone_match", 50.0), 2),
        cover_letter_quality= round(llm_scores.get("cover_letter_quality", 50.0), 2),
    )

    # Recompute overall with fused scores
    overall = (
        fused["keyword_coverage"]     * 0.30
        + fused["relevance"]          * 0.25
        + fused["impact"]             * 0.20
        + fused["tone_match"]         * 0.15
        + fused["cover_letter_quality"] * 0.10
    )
    fused["overall"] = round(overall, 2)
    return fused


# ---------------------------------------------------------------------------
# Node
# ---------------------------------------------------------------------------


async def evaluator_node(state: AgentState) -> AgentState:
    """
    LangGraph node: Evaluator Agent.

    Reads:  tailored_resume, cover_letter, parsed_jd, raw_jd_text,
            iteration_count, model_routing
    Writes: eval_scores, eval_feedback, eval_status
    """
    session_id = state["session_id"]
    iteration  = state.get("iteration_count") or 0
    logger.info("[evaluator] START session=%s iter=%d", session_id, iteration)

    embed_svc = get_embedding_service()
    errors: List[str] = list(state.get("errors") or [])

    model = (state.get("model_routing") or {}).get(
        AgentName.EVALUATOR.value, LLMModel.GPT_4O.value
    )

    resume       = state.get("tailored_resume") or ""
    cover_letter = state.get("cover_letter")    or ""
    parsed_jd    = state.get("parsed_jd")       or {}
    raw_jd       = state.get("raw_jd_text")     or ""
    ats_keywords = parsed_jd.get("ats_keywords") or []

    # ── Layer 1: Programmatic ATS ───────────────────────────────────────
    ats_score, matched_kws, missing_kws = _compute_ats_score(resume, ats_keywords)
    logger.info(
        "[evaluator] ATS score=%.1f matched=%d missing=%d session=%s",
        ats_score, len(matched_kws), len(missing_kws), session_id,
    )

    # ── Layer 2: Semantic similarity ────────────────────────────────────
    jd_for_semantic = raw_jd if raw_jd else " ".join(ats_keywords)
    semantic_score = await _compute_semantic_score(
        embed_svc, resume, cover_letter, jd_for_semantic
    )
    logger.info(
        "[evaluator] semantic score=%.1f session=%s", semantic_score, session_id
    )

    # ── Layer 3: LLM judge ──────────────────────────────────────────────
    llm_scores, eval_feedback = await _compute_llm_scores(
        session_id, resume, cover_letter, parsed_jd, model
    )

    # Inject missing keywords list into feedback
    try:
        feedback_dict = json.loads(eval_feedback)
        if missing_kws:
            kw_issue = (
                f"Missing {len(missing_kws)} ATS keywords: "
                f"{', '.join(missing_kws[:12])}"
                + (" ..." if len(missing_kws) > 12 else "")
            )
            critical = feedback_dict.get("critical_issues") or []
            if kw_issue not in critical:
                critical.insert(0, kw_issue)
            feedback_dict["critical_issues"] = critical
        eval_feedback = json.dumps(feedback_dict)
    except (json.JSONDecodeError, TypeError):
        pass

    # ── Score fusion ─────────────────────────────────────────────────────
    fused_scores = _fuse_scores(ats_score, semantic_score, llm_scores)

    # ── Determine eval status ────────────────────────────────────────────
    overall   = fused_scores.get("overall", 0.0)
    threshold = cfg.evaluation.eval_score_threshold
    max_iter  = cfg.evaluation.eval_max_iterations

    if overall >= threshold:
        eval_status = EvalStatus.PASSED.value
    elif iteration >= max_iter:
        eval_status = EvalStatus.MAX_ITER_REACHED.value
    else:
        eval_status = EvalStatus.IMPROVING.value

    logger.info(
        "[evaluator] DONE overall=%.1f status=%s iter=%d session=%s",
        overall, eval_status, iteration, session_id,
    )

    return {
        **state,  # type: ignore[misc]
        "eval_scores":  fused_scores,
        "eval_feedback": eval_feedback,
        "eval_status":  eval_status,
        "errors":       errors,
    }