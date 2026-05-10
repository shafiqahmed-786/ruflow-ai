"""
backend/agents/cover_letter_agent.py

Cover Letter Agent — generates a targeted, non-generic cover letter that
demonstrates cultural fit, role alignment, and company knowledge.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Dict, List, Optional

from backend.config.settings import get_settings
from backend.orchestrator.state import (
    AgentName,
    AgentState,
    LLMModel,
)
from backend.services.llm_service import get_llm_router

logger = logging.getLogger(__name__)
cfg = get_settings()

# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

COVER_LETTER_SYSTEM_PROMPT = """
You are an expert career coach and persuasive writer specialising in
tech industry cover letters that actually get read by humans, not filtered
by ATS.

STRUCTURE (follow exactly — no deviations):

Paragraph 1 — THE HOOK (2-3 sentences):
  Do NOT start with "I am writing to apply for..."
  Start with a specific achievement from the candidate's background that
  directly maps to a pain point or goal evident in the JD.
  Example opener: "When I reduced checkout latency by 43% at CompanyX,
  I learned that the gap between good and great engineering often comes
  down to obsessing over the metrics no one else tracks."

Paragraph 2 — COMPANY KNOWLEDGE (2-3 sentences):
  Demonstrate genuine knowledge of the company using company_intel.
  Reference a specific product, initiative, or company challenge.
  If no company intel is available, use the culture signals from the JD.

Paragraph 3 — SKILL ALIGNMENT (3-4 sentences):
  Map the top 3 required_skills from the JD to concrete evidence
  from the candidate's experience. Use specifics — not generalities.
  Format: "My experience with [skill] is evidenced by [concrete example]."

Paragraph 4 — CLOSING (2 sentences):
  Express genuine enthusiasm for the specific role (not "the opportunity").
  Strong, direct call to action — no hedging.

TONE RULES:
  - junior/intern: enthusiastic, growth-oriented, humble confidence
  - mid: competent, collaborative, results-focused
  - senior/staff/principal: authoritative, strategic, concise

HARD CONSTRAINTS:
  - Maximum 380 words total
  - No "I am a passionate..." or "I believe..." openers
  - No "Please find attached my resume"
  - No bullet points — pure prose paragraphs
  - No headers or labels

If evaluator feedback is present, address ALL critical_issues
before generating the new version.

OUTPUT: plain text cover letter ONLY. No JSON. No markdown.
"""

COVER_LETTER_SYSTEM_PROMPT_WITH_FEEDBACK = COVER_LETTER_SYSTEM_PROMPT + """

ITERATION {iteration} — Evaluator flagged these issues with the previous version:
CRITICAL ISSUES (must fix all):
{critical_issues}

IMPROVEMENT HINTS:
{improvement_hints}

Preserve the parts of the letter that worked. Only change what is listed above.
"""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_feedback(eval_feedback: Optional[str]) -> tuple[List[str], List[str]]:
    """Parse eval_feedback JSON string → (critical_issues, improvement_hints)."""
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


def _build_system_prompt(state: AgentState) -> str:
    """Return the appropriate system prompt based on iteration count."""
    iteration = state.get("iteration_count") or 0
    if iteration == 0:
        return COVER_LETTER_SYSTEM_PROMPT

    critical_issues, improvement_hints = _parse_feedback(state.get("eval_feedback"))
    if not critical_issues:
        return COVER_LETTER_SYSTEM_PROMPT

    return COVER_LETTER_SYSTEM_PROMPT_WITH_FEEDBACK.format(
        iteration=iteration,
        critical_issues="\n".join(f"  - {c}" for c in critical_issues),
        improvement_hints="\n".join(f"  - {h}" for h in improvement_hints),
    )


def _build_user_message(state: AgentState) -> str:
    """Build the user message with all context the cover letter agent needs."""
    profile = state.get("candidate_profile") or {}
    jd      = state.get("parsed_jd") or {}

    # Condense profile for token efficiency
    profile_condensed: Dict = {
        "full_name":      profile.get("full_name", ""),
        "summary":        (profile.get("summary") or "")[:400],
        "top_skills":     (profile.get("skills") or [])[:20],
        "experience":     [
            {
                "title":   exp.get("title", ""),
                "company": exp.get("company", ""),
                "bullets": (exp.get("bullets") or [])[:3],
            }
            for exp in (profile.get("experience") or [])[:4]
        ],
        "certifications": profile.get("certifications") or [],
    }

    jd_condensed: Dict = {
        "role_title":      jd.get("role_title"),
        "company_name":    jd.get("company_name"),
        "seniority_level": jd.get("seniority_level"),
        "required_skills": (jd.get("required_skills") or [])[:10],
        "culture_signals": jd.get("culture_signals"),
        "responsibilities": (jd.get("responsibilities") or [])[:8],
    }

    company_intel_block = (
        f"## Company Intel\n{state.get('company_intel')}"
        if state.get("company_intel")
        else "## Company Intel\nNot available — use JD culture signals instead."
    )

    parts: List[str] = [
        "## Candidate Profile",
        json.dumps(profile_condensed, indent=2),
        "",
        "## Job Description (Key Fields)",
        json.dumps(jd_condensed, indent=2),
        "",
        company_intel_block,
    ]

    # Include current draft on iteration > 0 for surgical editing
    iteration = state.get("iteration_count") or 0
    if iteration > 0 and state.get("cover_letter"):
        parts.extend([
            "",
            "## Current Cover Letter Draft (edit this — do not regenerate from scratch)",
            state.get("cover_letter", ""),
        ])

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Post-processing
# ---------------------------------------------------------------------------


def _clean_cover_letter(text: str) -> str:
    """
    Strip any Markdown, JSON wrapper, or preamble the LLM might add.
    The cover letter should be pure prose.
    """
    # Remove markdown headers
    text = re.sub(r"^#{1,4}\s+.*$", "", text, flags=re.MULTILINE)
    # Remove bold/italic markers
    text = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", text)
    # Remove leading/trailing whitespace per line
    lines = [l.rstrip() for l in text.splitlines()]
    # Collapse 3+ blank lines
    result_lines: List[str] = []
    blank_count = 0
    for line in lines:
        if not line.strip():
            blank_count += 1
            if blank_count <= 2:
                result_lines.append(line)
        else:
            blank_count = 0
            result_lines.append(line)
    return "\n".join(result_lines).strip()


def _word_count(text: str) -> int:
    return len(text.split())


# ---------------------------------------------------------------------------
# Node
# ---------------------------------------------------------------------------


async def cover_letter_node(state: AgentState) -> AgentState:
    """
    LangGraph node: Cover Letter Agent.

    Reads:  candidate_profile, parsed_jd, company_intel, eval_feedback,
            iteration_count, model_routing
    Writes: cover_letter
    """
    session_id = state["session_id"]
    iteration  = state.get("iteration_count") or 0
    logger.info("[cover_letter] START session=%s iter=%d", session_id, iteration)

    router = get_llm_router()
    errors: List[str] = list(state.get("errors") or [])

    model = (state.get("model_routing") or {}).get(
        AgentName.COVER_LETTER.value, LLMModel.GPT_4O.value
    )

    system_prompt = _build_system_prompt(state)
    user_message  = _build_user_message(state)

    cover_letter: str = state.get("cover_letter") or ""

    try:
        response = await router.invoke(
            agent_name=AgentName.COVER_LETTER.value,
            system_prompt=system_prompt,
            user_message=user_message,
            session_id=session_id,
            model_override=model,
        )
        raw = response.content.strip()

        if not raw:
            raise ValueError("LLM returned empty cover letter content")

        cover_letter = _clean_cover_letter(raw)
        word_count   = _word_count(cover_letter)

        if word_count > 420:
            logger.warning(
                "[cover_letter] word_count=%d exceeds limit; trimming is recommended",
                word_count,
            )

        logger.info(
            "[cover_letter] DONE words=%d iter=%d session=%s",
            word_count, iteration, session_id,
        )

    except Exception as exc:
        logger.error("[cover_letter] failed: %s", exc)
        errors.append(f"cover_letter:llm:{exc}")
        if not cover_letter:
            cover_letter = (
                "Cover letter generation failed. "
                f"Error: {exc}. Please retry."
            )

    return {
        **state,  # type: ignore[misc]
        "cover_letter": cover_letter,
        "errors":       errors,
    }