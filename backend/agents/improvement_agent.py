"""
backend/agents/improvement_agent.py

Improvement Agent — surgically patches the tailored resume and cover letter
based on structured evaluator feedback. Does NOT rewrite from scratch.
Tracks all changes in a change_log for audit purposes.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional, Tuple

from backend.config.settings import get_settings
from backend.orchestrator.state import (
    AgentName,
    AgentState,
    ChangeLogEntry,
    LLMModel,
)
from backend.services.llm_service import get_llm_router

logger = logging.getLogger(__name__)
cfg = get_settings()

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

IMPROVEMENT_SYSTEM_PROMPT = """
You are a surgical document editor specialising in job application materials.

Your mandate: fix ONLY the problems listed in critical_issues.
Do NOT rewrite content that was not flagged. Do NOT change what is working.

PROCESS:
1. Read critical_issues carefully — each is a specific, addressable problem.
2. For each critical issue, make the minimum effective edit to resolve it.
3. Use improvement_hints as optional guidance — apply only if they directly
   help address a critical issue.
4. For missing ATS keywords: weave them into existing bullets naturally.
   Never add a bare keyword list. Context must make sense.
5. For impact issues: add quantification to vague bullets where plausible.
   Use placeholders like "[X]%" only if no number is inferable.
6. For tone issues: adjust word choice in affected sections only.
7. For cover letter hook issues: rewrite only paragraph 1.

CHANGE LOG rules:
- Record one entry per distinct change made.
- Format: "Section: [section name] — Change: [what was changed and why]"

Return ONLY a valid JSON object. No markdown. No preamble.

Schema:
{
  "tailored_resume": "full updated resume as markdown string",
  "cover_letter":    "full updated cover letter as plain text string",
  "change_log":      ["string", "string"]
}
"""

IMPROVEMENT_SYSTEM_PROMPT_FINAL_ITER = IMPROVEMENT_SYSTEM_PROMPT + """

NOTE: This is the FINAL improvement iteration (max iterations reached after this).
Prioritise the highest-impact fixes from critical_issues.
If you cannot fully resolve an issue without a complete rewrite, make the best
partial improvement possible.
"""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_feedback(eval_feedback: Optional[str]) -> Tuple[List[str], List[str]]:
    """Parse eval_feedback JSON → (critical_issues, improvement_hints)."""
    if not eval_feedback:
        return [], []
    try:
        parsed = json.loads(eval_feedback)
        return (
            [str(c) for c in (parsed.get("critical_issues") or []) if c],
            [str(h) for h in (parsed.get("improvement_hints") or []) if h],
        )
    except (json.JSONDecodeError, AttributeError):
        return [], []


def _select_system_prompt(iteration: int, max_iter: int) -> str:
    """Use the final-iteration prompt on the last allowed loop."""
    if iteration >= max_iter - 1:
        return IMPROVEMENT_SYSTEM_PROMPT_FINAL_ITER
    return IMPROVEMENT_SYSTEM_PROMPT


def _build_user_message(
    state: AgentState,
    critical_issues: List[str],
    improvement_hints: List[str],
) -> str:
    """Assemble the full context message for the improvement agent."""
    resume       = state.get("tailored_resume") or "[No resume]"
    cover_letter = state.get("cover_letter")    or "[No cover letter]"
    parsed_jd    = state.get("parsed_jd")       or {}

    jd_context: Dict[str, Any] = {
        "role_title":      parsed_jd.get("role_title"),
        "seniority_level": parsed_jd.get("seniority_level"),
        "ats_keywords":    (parsed_jd.get("ats_keywords") or [])[:25],
        "required_skills": parsed_jd.get("required_skills"),
    }

    issues_block   = "\n".join(f"  {i+1}. {c}" for i, c in enumerate(critical_issues))
    hints_block    = "\n".join(f"  - {h}" for h in improvement_hints) if improvement_hints else "  None"

    return (
        f"## Critical Issues (MUST fix all)\n{issues_block}\n\n"
        f"## Improvement Hints (optional)\n{hints_block}\n\n"
        f"## JD Context\n{json.dumps(jd_context, indent=2)}\n\n"
        f"## Current Resume (edit this)\n{resume}\n\n"
        f"## Current Cover Letter (edit this)\n{cover_letter}"
    )


def _validate_improvement_result(
    result: Dict[str, Any],
    state: AgentState,
    iteration: int,
) -> Tuple[str, str, List[ChangeLogEntry]]:
    """
    Validate and extract fields from the LLM improvement result.
    Falls back to existing content if a field is missing or invalid.
    """
    existing_resume = state.get("tailored_resume") or ""
    existing_cl     = state.get("cover_letter")    or ""

    resume = result.get("tailored_resume")
    if not resume or not isinstance(resume, str) or len(resume.strip()) < 50:
        logger.warning("[improver] LLM returned invalid resume; keeping existing")
        resume = existing_resume

    cover_letter = result.get("cover_letter")
    if not cover_letter or not isinstance(cover_letter, str) or len(cover_letter.strip()) < 20:
        logger.warning("[improver] LLM returned invalid cover letter; keeping existing")
        cover_letter = existing_cl

    raw_log = result.get("change_log") or []
    change_entries: List[ChangeLogEntry] = [
        ChangeLogEntry(
            iteration=iteration,
            target="resume/cover_letter",
            description=str(entry).strip(),
        )
        for entry in raw_log
        if entry and str(entry).strip()
    ]

    if not change_entries:
        # Create a synthetic entry if the LLM didn't log changes
        change_entries.append(
            ChangeLogEntry(
                iteration=iteration,
                target="resume/cover_letter",
                description="Improvement applied; no detailed change log returned by model.",
            )
        )

    return resume.strip(), cover_letter.strip(), change_entries


# ---------------------------------------------------------------------------
# Node
# ---------------------------------------------------------------------------


async def improvement_node(state: AgentState) -> AgentState:
    """
    LangGraph node: Improvement Agent.

    Reads:  tailored_resume, cover_letter, eval_feedback, parsed_jd,
            iteration_count, change_log, model_routing
    Writes: tailored_resume, cover_letter, iteration_count, change_log,
            eval_feedback (cleared so evaluator gets a fresh run)
    """
    session_id = state["session_id"]
    iteration  = (state.get("iteration_count") or 0) + 1
    logger.info("[improver] START session=%s new_iter=%d", session_id, iteration)

    router = get_llm_router()
    errors: List[str] = list(state.get("errors") or [])

    model = (state.get("model_routing") or {}).get(
        AgentName.IMPROVER.value, LLMModel.GPT_4O.value
    )

    critical_issues, improvement_hints = _parse_feedback(state.get("eval_feedback"))

    if not critical_issues:
        logger.warning(
            "[improver] no critical_issues found in eval_feedback; skipping LLM call"
        )
        existing_log: List[ChangeLogEntry] = list(state.get("change_log") or [])
        existing_log.append(
            ChangeLogEntry(
                iteration=iteration,
                target="resume/cover_letter",
                description="No critical issues identified; no changes made.",
            )
        )
        return {
            **state,  # type: ignore[misc]
            "iteration_count": iteration,
            "change_log":      existing_log,
            "eval_feedback":   None,
            "errors":          errors,
        }

    max_iter      = cfg.evaluation.eval_max_iterations
    system_prompt = _select_system_prompt(iteration, max_iter)
    user_message  = _build_user_message(state, critical_issues, improvement_hints)

    # ── LLM call ────────────────────────────────────────────────────────
    new_resume:       str = state.get("tailored_resume") or ""
    new_cover_letter: str = state.get("cover_letter")    or ""
    new_change_log:   List[ChangeLogEntry] = []

    try:
        result: Dict[str, Any] = await router.invoke_json(
            agent_name=AgentName.IMPROVER.value,
            system_prompt=system_prompt,
            user_message=user_message,
            session_id=session_id,
            model_override=model,
        )

        new_resume, new_cover_letter, new_change_log = _validate_improvement_result(
            result, state, iteration
        )

        logger.info(
            "[improver] DONE changes=%d iter=%d session=%s",
            len(new_change_log), iteration, session_id,
        )

    except Exception as exc:
        logger.error("[improver] LLM failed: %s", exc)
        errors.append(f"improver:llm:{exc}")
        new_change_log = [
            ChangeLogEntry(
                iteration=iteration,
                target="resume/cover_letter",
                description=f"Improvement failed: {exc}",
            )
        ]

    # Accumulate change log
    accumulated_log: List[ChangeLogEntry] = list(state.get("change_log") or [])
    accumulated_log.extend(new_change_log)

    return {
        **state,  # type: ignore[misc]
        "tailored_resume":  new_resume,
        "cover_letter":     new_cover_letter,
        "iteration_count":  iteration,
        "change_log":       accumulated_log,
        "eval_feedback":    None,   # cleared — evaluator will repopulate
        "errors":           errors,
    }