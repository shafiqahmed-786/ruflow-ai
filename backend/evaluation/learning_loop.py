"""
backend/evaluation/learning_loop.py

LearningLoop — continuous learning mechanism that compares current application
materials against historical successes, identifies gaps, and updates the
learned knowledge base after each submission.

No LLM calls. No external NLP libraries.
All DB access via injected services.
"""

from __future__ import annotations

import json
import logging
import re
from collections import Counter
from datetime import datetime
from typing import Any, Dict, List, Optional, TypedDict

from backend.services.memory_service import MemoryService, get_memory_service
from backend.services.memory_optimizer import MemoryOptimizer, get_memory_optimizer
from backend.services.pattern_extractor import PatternExtractor, get_pattern_extractor

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# TypedDicts
# ---------------------------------------------------------------------------


class ComparisonResult(TypedDict):
    missing_keywords:  List[str]
    missing_patterns:  List[str]
    tone_gaps:         List[str]
    recommendations:   List[str]
    confidence:        float        # 0.0–1.0; based on number of reference resumes


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_HIGH_SCORE_THRESHOLD = 78.0        # records above this are used as references
_MIN_KEYWORD_OVERLAP  = 0.4         # alert if keyword overlap < 40%
_PASSIVE_VOICE_LIMIT  = 4           # alert if passive voice > this


# ---------------------------------------------------------------------------
# Internal helpers (module-level, no state)
# ---------------------------------------------------------------------------


def _tokenise(text: str) -> set:
    """Lowercase word-tokenise text; returns a set of tokens ≥ 3 chars."""
    words = re.sub(r"[^\w\s]", " ", text.lower()).split()
    return {w for w in words if len(w) >= 3}


def _keyword_overlap(a: str, b: str) -> float:
    """Jaccard similarity between token sets of two texts."""
    ta, tb = _tokenise(a), _tokenise(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def _extract_ats_keywords(jd: Dict[str, Any]) -> List[str]:
    """Pull ats_keywords from a parsed JD dict, lowercased."""
    return [kw.lower() for kw in (jd.get("ats_keywords") or []) if kw]


def _missing_ats_keywords(resume: str, ats_keywords: List[str]) -> List[str]:
    """Return keywords that do not appear in the resume (case-insensitive)."""
    lower_resume = resume.lower()
    return [
        kw for kw in ats_keywords
        if not re.search(r"\b" + re.escape(kw) + r"\b", lower_resume)
    ]


def _parse_eval_feedback(eval_feedback: str) -> tuple[List[str], List[str]]:
    """
    Parse eval_feedback JSON string → (critical_issues, improvement_hints).
    Returns empty lists on any parse failure.
    """
    if not eval_feedback:
        return [], []
    try:
        parsed = json.loads(eval_feedback)
        critical = [str(c) for c in (parsed.get("critical_issues") or []) if c]
        hints    = [str(h) for h in (parsed.get("improvement_hints") or []) if h]
        return critical, hints
    except (json.JSONDecodeError, AttributeError, TypeError):
        return [], []


# ---------------------------------------------------------------------------
# LearningLoop
# ---------------------------------------------------------------------------


class LearningLoop:
    """
    Continuous learning mechanism for the multi-agent pipeline.

    Responsibilities:
      1. PRE-SUBMISSION: Compare current draft against past successes and
         surface keyword / tone / structure gaps before the Evaluator runs.
      2. POST-SUBMISSION: After a scored application, persist pattern
         observations so future applications can learn from this session.

    Args:
        memory_service:    Injected MemoryService.
        memory_optimizer:  Injected MemoryOptimizer (caching layer).
        pattern_extractor: Injected PatternExtractor.
        high_score_threshold: Minimum score for a record to be used as a
                              positive reference example.
    """

    def __init__(
        self,
        memory_service:       Optional[MemoryService]    = None,
        memory_optimizer:     Optional[MemoryOptimizer]  = None,
        pattern_extractor:    Optional[PatternExtractor] = None,
        high_score_threshold: float = _HIGH_SCORE_THRESHOLD,
    ) -> None:
        self._memory    = memory_service    or get_memory_service()
        self._optimizer = memory_optimizer  or get_memory_optimizer()
        self._extractor = pattern_extractor or get_pattern_extractor()
        self._threshold = high_score_threshold

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def compare_to_successes(
        self,
        current_app: Dict[str, Any],
        role:        str,
        user_id:     str,
    ) -> ComparisonResult:
        """
        Compare a current (pre-submission) application against stored high-
        scoring resumes to surface gaps.

        Args:
            current_app: Dict with at minimum keys:
                           "tailored_resume" and "cover_letter".
            role:        Target JD role title (used for role-filtered retrieval).
            user_id:     User identifier (for cache scoping).

        Returns:
            ComparisonResult TypedDict.
        """
        current_resume = current_app.get("tailored_resume") or ""
        current_cl     = current_app.get("cover_letter")    or ""

        # Fetch reference resumes from memory
        references = await self._fetch_reference_resumes(role)

        if not references:
            return ComparisonResult(
                missing_keywords  = [],
                missing_patterns  = [],
                tone_gaps         = [],
                recommendations   = [
                    "No historical high-scoring resumes found for comparison. "
                    "This is your first application — the system will learn from this run."
                ],
                confidence        = 0.0,
            )

        confidence = min(1.0, len(references) / 10.0)

        # Keyword gap: tokens that appear in most reference resumes but not current
        missing_keywords  = self._find_missing_keywords(current_resume, references)

        # Pattern gaps: structural traits common in references but absent here
        missing_patterns  = self._find_missing_structural_patterns(
            current_resume, references
        )

        # Tone gaps
        tone_gaps = self._find_tone_gaps(current_resume, current_cl, references)

        # Recommendations from gaps
        recommendations = self._build_gap_recommendations(
            missing_keywords, missing_patterns, tone_gaps
        )

        return ComparisonResult(
            missing_keywords  = missing_keywords[:15],
            missing_patterns  = missing_patterns[:8],
            tone_gaps         = tone_gaps[:6],
            recommendations   = recommendations,
            confidence        = round(confidence, 3),
        )

    async def suggest_improvements_pre_submission(
        self,
        current_app: Dict[str, Any],
        parsed_jd:   Dict[str, Any],
    ) -> List[str]:
        """
        Generate improvement suggestions based on JD ATS keywords vs current
        resume, without calling any LLM.

        Algorithm:
          1. Extract ATS keywords from parsed_jd.
          2. Identify which are missing from the resume.
          3. Check structural properties (bullets, quantification).
          4. Check cover letter length / hook quality (heuristics).

        Args:
            current_app: Dict with "tailored_resume" and "cover_letter" keys.
            parsed_jd:   ParsedJD dict with "ats_keywords", "seniority_level", etc.

        Returns:
            Ordered list of improvement suggestion strings.
        """
        resume = current_app.get("tailored_resume") or ""
        cl     = current_app.get("cover_letter")    or ""
        suggestions: List[str] = []

        # ATS keyword gaps
        ats_keywords = _extract_ats_keywords(parsed_jd)
        missing      = _missing_ats_keywords(resume, ats_keywords)
        if missing:
            top_missing = missing[:8]
            suggestions.append(
                f"Insert these {len(missing)} ATS keywords naturally before submission: "
                + ", ".join(top_missing)
                + ("..." if len(missing) > 8 else "")
            )

        # Structural checks
        struct = self._extractor.extract_structure_patterns(resume)

        if struct.bullet_count < 8:
            suggestions.append(
                f"Add more STAR-format bullet points (current: {struct.bullet_count}; "
                f"target: ≥ 10 for competitive applications)."
            )

        if struct.quantification_rate < 0.4 and struct.bullet_count > 0:
            quantified = struct.quantified_bullets
            total      = struct.bullet_count
            suggestions.append(
                f"Quantify more bullets: {quantified}/{total} contain numbers. "
                f"Target 60%+ quantification — add %, $, or scale metrics."
            )

        if not struct.has_summary:
            suggestions.append(
                "Add a 2-3 sentence professional summary at the top of your resume "
                "— ATS systems use it for initial relevance scoring."
            )

        # Tone check
        tone = self._extractor.extract_tone_markers(resume)
        if tone.passive_voice_count > _PASSIVE_VOICE_LIMIT:
            suggestions.append(
                f"Reduce passive voice: {tone.passive_voice_count} instances detected. "
                f"Rewrite passive bullets with strong action verbs."
            )

        # Cover letter checks (heuristic — word count and opener)
        if cl:
            word_count = len(cl.split())
            if word_count < 100:
                suggestions.append(
                    f"Cover letter is too short ({word_count} words). "
                    f"Aim for 250–380 words with specific company references."
                )
            elif word_count > 420:
                suggestions.append(
                    f"Cover letter is too long ({word_count} words). "
                    f"Trim to under 380 words — hiring managers skim, not read."
                )

            lower_cl = cl.lower()
            generic_openers = [
                "i am writing to apply",
                "i am excited to apply",
                "i am passionate",
                "please find attached",
                "i believe i would",
            ]
            for opener in generic_openers:
                if opener in lower_cl[:120]:
                    suggestions.append(
                        f"Replace generic cover letter opener ('{opener}') with a "
                        f"specific achievement that maps to a company challenge."
                    )
                    break
        else:
            suggestions.append(
                "No cover letter detected — generate one before submission."
            )

        # Seniority alignment
        seniority = (parsed_jd.get("seniority_level") or "").lower()
        if seniority in {"senior", "staff", "principal"} and resume:
            leadership_words = ["led", "owned", "architected", "drove", "designed"]
            found = [w for w in leadership_words if w in resume.lower()]
            if len(found) < 2:
                suggestions.append(
                    f"Role requires {seniority}-level language. Add leadership markers "
                    f"(e.g. 'led', 'architected', 'owned') to experience bullets."
                )

        return suggestions

    async def update_learned_knowledge(
        self,
        app_data:    Dict[str, Any],
        final_score: float,
        user_id:     str,
    ) -> None:
        """
        Store extracted patterns from a completed application into MongoDB.

        Called by the Packager agent (or an API route) after a pipeline run
        completes and the final score is known.

        Args:
            app_data:    Dict with at minimum "tailored_resume", "cover_letter",
                         "session_id", "jd_role", "company" keys.
            final_score: Composite overall score (0–100).
            user_id:     User identifier.
        """
        resume     = app_data.get("tailored_resume") or ""
        session_id = app_data.get("session_id")      or ""
        role       = app_data.get("jd_role")
        company    = app_data.get("company")

        if not resume or not session_id:
            logger.warning(
                "[learning_loop] update_learned_knowledge skipped: "
                "missing resume or session_id user=%s", user_id
            )
            return

        # Extract and store patterns — fire-and-forget per pattern type
        errors: List[str] = []

        # Keywords
        try:
            kws = self._extractor.extract_keywords(resume, final_score, top_n=30)
            if kws:
                payload = {
                    "keywords": [
                        {"keyword": k.keyword, "frequency": k.frequency,
                         "avg_score": k.avg_score}
                        for k in kws[:30]
                    ]
                }
                await self._extractor.store_pattern(
                    "keyword", payload, final_score, session_id, role, company
                )
        except Exception as exc:
            errors.append(f"keywords: {exc}")

        # Tone
        try:
            tone    = self._extractor.extract_tone_markers(resume)
            import dataclasses
            payload = dataclasses.asdict(tone)
            await self._extractor.store_pattern(
                "tone", payload, final_score, session_id, role, company
            )
        except Exception as exc:
            errors.append(f"tone: {exc}")

        # Structure
        try:
            struct  = self._extractor.extract_structure_patterns(resume)
            import dataclasses as _dc
            payload = _dc.asdict(struct)
            await self._extractor.store_pattern(
                "structure", payload, final_score, session_id, role, company
            )
        except Exception as exc:
            errors.append(f"structure: {exc}")

        # Invalidate user record cache so next analysis is fresh
        try:
            cache_key = f"user_records:{user_id}"
            await self._optimizer.cache_set(cache_key, [])   # evict
        except Exception as exc:
            errors.append(f"cache_evict: {exc}")

        if errors:
            logger.warning(
                "[learning_loop] update_learned_knowledge partial errors "
                "session=%s: %s", session_id, errors
            )
        else:
            logger.info(
                "[learning_loop] update_learned_knowledge complete "
                "session=%s score=%.1f", session_id, final_score
            )

    async def get_improvement_suggestions(
        self,
        app_data:      Dict[str, Any],
        eval_feedback: str,
    ) -> List[str]:
        """
        Translate raw evaluator feedback into prioritised, human-readable
        improvement suggestions.

        Uses deterministic logic only — parses the eval_feedback JSON,
        adds structural analysis, and ranks by severity.

        Args:
            app_data:      Dict with "tailored_resume" and "cover_letter".
            eval_feedback: JSON string from Evaluator agent.

        Returns:
            Ranked list of improvement suggestion strings.
        """
        critical_issues, improvement_hints = _parse_eval_feedback(eval_feedback)
        resume = app_data.get("tailored_resume") or ""
        suggestions: List[str] = []

        # Highest priority: evaluator critical issues
        for issue in critical_issues[:6]:
            suggestions.append(f"[CRITICAL] {issue}")

        # Structural analysis to enrich
        if resume:
            struct = self._extractor.extract_structure_patterns(resume)
            tone   = self._extractor.extract_tone_markers(resume)

            if struct.quantification_rate < 0.35 and struct.bullet_count > 0:
                suggestions.append(
                    f"[HIGH] Only {struct.quantified_bullets}/{struct.bullet_count} bullets "
                    f"are quantified ({struct.quantification_rate:.0%}). "
                    f"Add % / $ / scale metrics to at least 60% of bullets."
                )

            if tone.passive_voice_count > _PASSIVE_VOICE_LIMIT:
                suggestions.append(
                    f"[MEDIUM] {tone.passive_voice_count} passive-voice constructions "
                    f"detected. Rewrite using strong action verbs."
                )

            if not tone.action_verbs:
                suggestions.append(
                    "[MEDIUM] No strong action verbs detected at bullet starts. "
                    "Begin each bullet with a past-tense action verb (Led, Built, Reduced...)."
                )

            if not struct.has_summary:
                suggestions.append(
                    "[LOW] Add a professional summary (3-4 sentences) to improve "
                    "ATS relevance scoring."
                )

        # Optional improvement hints from evaluator
        for hint in improvement_hints[:4]:
            suggestions.append(f"[HINT] {hint}")

        return suggestions

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _fetch_reference_resumes(
        self, role: Optional[str] = None
    ) -> List[str]:
        """
        Retrieve resume texts from high-scoring stored applications.
        Tries cache first; falls back to Mongo.
        """
        cache_key = f"refs:{role or 'all'}"
        cached    = await self._optimizer.cache_get(cache_key)
        if cached is not None:
            return cached  # type: ignore[return-value]

        try:
            records = await self._memory.retrieve_past_applications(limit=50)
        except Exception as exc:
            logger.error("[learning_loop] fetch references failed: %s", exc)
            return []

        refs = [
            r.get("resume_snapshot") or ""
            for r in records
            if (r.get("final_scores") or {}).get("overall", 0.0) >= self._threshold
            and r.get("resume_snapshot", "").strip()
        ]

        await self._optimizer.cache_set(cache_key, refs)
        return refs

    @staticmethod
    def _find_missing_keywords(
        current_resume: str,
        references:     List[str],
        min_presence:   float = 0.5,
    ) -> List[str]:
        """
        Find tokens that appear in at least min_presence fraction of reference
        resumes but are absent from the current resume.

        Args:
            current_resume: Text of the candidate's current draft.
            references:     List of high-scoring reference resume texts.
            min_presence:   Fraction of references a token must appear in.

        Returns:
            Sorted list of missing keyword strings.
        """
        if not references:
            return []

        current_tokens = _tokenise(current_resume)
        ref_token_freq: Counter = Counter()

        for ref in references:
            for token in _tokenise(ref):
                ref_token_freq[token] += 1

        threshold = max(1, int(min_presence * len(references)))
        common_ref_tokens = {
            t for t, c in ref_token_freq.items()
            if c >= threshold and len(t) >= 4
        }

        missing = sorted(common_ref_tokens - current_tokens)
        return missing[:20]

    @staticmethod
    def _find_missing_structural_patterns(
        current_resume: str,
        references:     List[str],
    ) -> List[str]:
        """
        Compare structural metrics of current resume against reference averages.

        Returns human-readable descriptions of gaps.
        """
        if not references:
            return []

        from backend.services.pattern_extractor import PatternExtractor as _PE
        extractor = _PE.__new__(_PE)
        # Use class methods directly (no __init__ deps needed here)
        _PE.__init__(extractor)

        current_struct = extractor.extract_structure_patterns(current_resume)

        ref_bullet_counts = []
        ref_quant_rates   = []
        ref_has_summary   = []
        ref_has_projects  = []
        ref_word_counts   = []

        for ref in references:
            rs = extractor.extract_structure_patterns(ref)
            ref_bullet_counts.append(rs.bullet_count)
            ref_quant_rates.append(rs.quantification_rate)
            ref_has_summary.append(int(rs.has_summary))
            ref_has_projects.append(int(rs.has_projects))
            ref_word_counts.append(rs.total_word_count)

        n = len(references)
        avg_bullets  = sum(ref_bullet_counts) / n
        avg_quant    = sum(ref_quant_rates)   / n
        avg_words    = sum(ref_word_counts)   / n
        pct_summary  = sum(ref_has_summary)   / n
        pct_projects = sum(ref_has_projects)  / n

        patterns: List[str] = []

        if current_struct.bullet_count < avg_bullets * 0.7:
            patterns.append(
                f"Fewer bullets than top resumes for this role "
                f"({current_struct.bullet_count} vs avg {avg_bullets:.0f})"
            )

        if current_struct.quantification_rate < avg_quant - 0.2:
            patterns.append(
                f"Lower quantification rate than top resumes "
                f"({current_struct.quantification_rate:.0%} vs avg {avg_quant:.0%})"
            )

        if not current_struct.has_summary and pct_summary >= 0.7:
            patterns.append(
                "Missing professional summary — 70%+ of successful resumes include one"
            )

        if not current_struct.has_projects and pct_projects >= 0.6:
            patterns.append(
                "Missing projects section — 60%+ of top resumes include one"
            )

        if current_struct.total_word_count < avg_words * 0.6:
            patterns.append(
                f"Resume is shorter than average for top scorers "
                f"({current_struct.total_word_count} vs avg {avg_words:.0f} words)"
            )

        return patterns

    @staticmethod
    def _find_tone_gaps(
        current_resume: str,
        current_cl:     str,
        references:     List[str],
    ) -> List[str]:
        """
        Compare tone markers (leadership language, passive voice, action verbs)
        between current application and reference pool.
        """
        if not references:
            return []

        from backend.services.pattern_extractor import PatternExtractor as _PE
        extractor = _PE.__new__(_PE)
        _PE.__init__(extractor)

        current_tone = extractor.extract_tone_markers(current_resume)
        ref_tones    = [extractor.extract_tone_markers(ref) for ref in references]

        n = len(ref_tones)
        avg_leadership = sum(len(t.leadership_markers) for t in ref_tones) / n
        avg_passive    = sum(t.passive_voice_count for t in ref_tones)     / n
        avg_action     = sum(len(t.action_verbs)     for t in ref_tones)   / n

        gaps: List[str] = []

        if len(current_tone.leadership_markers) < avg_leadership * 0.5:
            gaps.append(
                f"Weak leadership language ({len(current_tone.leadership_markers)} markers "
                f"vs avg {avg_leadership:.1f} in top resumes)"
            )

        if current_tone.passive_voice_count > avg_passive * 1.5 + 2:
            gaps.append(
                f"Passive voice overuse: {current_tone.passive_voice_count} instances "
                f"(avg {avg_passive:.1f} in top resumes)"
            )

        if len(current_tone.action_verbs) < avg_action * 0.6:
            gaps.append(
                f"Fewer strong action verbs ({len(current_tone.action_verbs)}) "
                f"than top resumes (avg {avg_action:.1f})"
            )

        if not current_tone.quantifier_phrases:
            gaps.append(
                "No quantifier phrases detected (e.g. 'reduced by X%', 'saved $X') — "
                "add measurable outcomes to at least 3 bullets"
            )

        return gaps

    @staticmethod
    def _build_gap_recommendations(
        missing_keywords:  List[str],
        missing_patterns:  List[str],
        tone_gaps:         List[str],
    ) -> List[str]:
        """Convert gap lists into prioritised recommendation strings."""
        recs: List[str] = []

        if missing_keywords:
            top = missing_keywords[:8]
            recs.append(
                f"Add these {len(missing_keywords)} keywords found in top resumes: "
                + ", ".join(top)
                + ("..." if len(missing_keywords) > 8 else "")
            )

        for pattern in missing_patterns[:4]:
            recs.append(f"Structural gap: {pattern}")

        for gap in tone_gaps[:3]:
            recs.append(f"Tone gap: {gap}")

        if not recs:
            recs.append(
                "Application materials are well-aligned with top-scoring references. "
                "Focus on cover letter personalisation."
            )

        return recs


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_learning_loop_instance: Optional[LearningLoop] = None


def get_learning_loop() -> LearningLoop:
    """Return the process-wide LearningLoop singleton."""
    global _learning_loop_instance
    if _learning_loop_instance is None:
        _learning_loop_instance = LearningLoop()
    return _learning_loop_instance