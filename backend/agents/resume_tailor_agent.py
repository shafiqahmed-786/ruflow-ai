"""
backend/agents/resume_tailor_agent.py

Resume Tailor Agent — rewrites the candidate's resume to maximise ATS score
and relevance for the specific JD, using STAR-format bullets and natural
keyword integration.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

from backend.config.settings import get_settings
from backend.orchestrator.state import (
    AgentName,
    AgentState,
    LLMModel,
    RetrievedChunk,
)
from backend.services.llm_service import get_llm_router

logger = logging.getLogger(__name__)
cfg = get_settings()

# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

RESUME_TAILOR_SYSTEM_PROMPT = """
You are a senior technical resume writer and ATS optimisation expert with
15+ years of experience helping engineers land roles at top-tier companies.

INPUT you will receive:
1. Candidate profile (structured JSON)
2. Parsed job description with ATS keywords
3. Retrieved similar resume examples (reference only — never copy verbatim)
4. Evaluator feedback (only present on iteration > 0)

WRITING RULES:
1. Rewrite ALL experience bullets using strict STAR format:
   - Situation/context (1 clause)
   - Action taken (specific, first-person, past tense active verb)
   - Quantified Result (%, $, users, latency ms, uptime, etc.)
   Example: "Reduced API p99 latency by 43% by redesigning the caching layer
             with Redis, improving checkout completion rate for 2M daily users."

2. ATS keyword injection:
   - Every keyword from ats_keywords MUST appear at least once
   - Use exact form (not paraphrases) where contextually natural
   - Spread keywords across multiple sections — never cluster

3. Structure order (most relevant first):
   - Summary → Skills → Most-relevant Experience → Other Experience
     → Projects → Education → Certifications

4. Seniority matching:
   - junior/mid: emphasise learning, contributions, tech breadth
   - senior/staff/principal: emphasise ownership, impact, architecture decisions

5. If evaluator feedback is present:
   - Address EVERY item in critical_issues explicitly
   - Do not touch sections that scored well

OUTPUT: return the full resume as clean Markdown ONLY.
- No XML tags, no JSON, no commentary
- Use ## for section headers, ### for role titles
- Use - for bullet points
"""

RESUME_TAILOR_SYSTEM_PROMPT_WITH_FEEDBACK = RESUME_TAILOR_SYSTEM_PROMPT + """

CRITICAL — This is iteration {iteration}. The evaluator identified these issues:
{critical_issues}

Improvement hints:
{improvement_hints}

You MUST fix every critical issue listed above. Sections not mentioned should
remain structurally unchanged.
"""

# ---------------------------------------------------------------------------
# Context builders
# ---------------------------------------------------------------------------


def _format_jd_context(chunks: List[RetrievedChunk], max_chunks: int = 3) -> str:
    """Format retrieved JD context chunks into a readable block."""
    if not chunks:
        return "No similar JDs retrieved."
    selected = sorted(chunks, key=lambda c: c.get("score", 0), reverse=True)[:max_chunks]
    parts = [
        f"[Similar JD {i+1} | score={c.get('score', 0):.2f}]\n{c.get('text', '')[:600]}"
        for i, c in enumerate(selected)
    ]
    return "\n\n---\n\n".join(parts)


def _format_resume_examples(chunks: List[RetrievedChunk], max_chunks: int = 2) -> str:
    """Format retrieved resume examples into a readable block."""
    if not chunks:
        return "No similar resumes in knowledge base."
    selected = sorted(chunks, key=lambda c: c.get("score", 0), reverse=True)[:max_chunks]
    parts = [
        f"[Resume Example {i+1} | score={c.get('score', 0):.2f}]\n{c.get('text', '')[:800]}"
        for i, c in enumerate(selected)
    ]
    return "\n\n---\n\n".join(parts)


def _parse_feedback(eval_feedback: Optional[str]) -> tuple[List[str], List[str]]:
    """
    Parse eval_feedback JSON string into (critical_issues, improvement_hints).
    Returns empty lists if parsing fails.
    """
    if not eval_feedback:
        return [], []
    try:
        parsed = json.loads(eval_feedback)
        critical = parsed.get("critical_issues") or []
        hints    = parsed.get("improvement_hints") or []
        return (
            [str(c) for c in critical if c],
            [str(h) for h in hints if h],
        )
    except (json.JSONDecodeError, AttributeError):
        return [], []


def _build_system_prompt(state: AgentState) -> str:
    """Select and format the appropriate system prompt."""
    iteration = state.get("iteration_count") or 0
    if iteration == 0:
        return RESUME_TAILOR_SYSTEM_PROMPT

    critical_issues, improvement_hints = _parse_feedback(state.get("eval_feedback"))
    if not critical_issues:
        return RESUME_TAILOR_SYSTEM_PROMPT

    return RESUME_TAILOR_SYSTEM_PROMPT_WITH_FEEDBACK.format(
        iteration=iteration,
        critical_issues="\n".join(f"  - {c}" for c in critical_issues),
        improvement_hints="\n".join(f"  - {h}" for h in improvement_hints),
    )


def _build_user_message(state: AgentState) -> str:
    """Assemble the full user message for the resume tailor prompt."""
    profile  = state.get("candidate_profile") or {}
    jd       = state.get("parsed_jd") or {}
    jd_ctx   = _format_jd_context(state.get("retrieved_jd_context") or [])
    res_ex   = _format_resume_examples(state.get("retrieved_resume_chunks") or [])

    # Trim profile to reduce tokens while keeping key sections
    profile_trimmed: Dict[str, Any] = {
        "full_name":   profile.get("full_name", ""),
        "email":       profile.get("email", ""),
        "summary":     (profile.get("summary") or "")[:400],
        "skills":      (profile.get("skills") or [])[:40],
        "experience":  profile.get("experience") or [],
        "education":   profile.get("education") or [],
        "projects":    (profile.get("projects") or [])[:5],
        "certifications": profile.get("certifications") or [],
    }

    # Trim JD to key fields
    jd_trimmed: Dict[str, Any] = {
        "role_title":      jd.get("role_title"),
        "company_name":    jd.get("company_name"),
        "seniority_level": jd.get("seniority_level"),
        "required_skills": jd.get("required_skills"),
        "ats_keywords":    jd.get("ats_keywords"),
        "responsibilities": (jd.get("responsibilities") or [])[:10],
        "culture_signals": jd.get("culture_signals"),
        "tech_stack":      jd.get("tech_stack"),
    }

    parts: List[str] = [
        "## Candidate Profile",
        json.dumps(profile_trimmed, indent=2),
        "",
        "## Target Job Description",
        json.dumps(jd_trimmed, indent=2),
        "",
        "## Retrieved JD Context (for style reference)",
        jd_ctx,
        "",
        "## Retrieved Resume Examples (for structure reference — do NOT copy)",
        res_ex,
    ]

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Post-processing
# ---------------------------------------------------------------------------


def _strip_preamble(text: str) -> str:
    """
    Remove any preamble the LLM added before the actual Markdown resume.
    The resume should start with a # or ## heading.
    """
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if re.match(r"^#{1,3}\s+", line.strip()):
            return "\n".join(lines[i:])
    return text


def _validate_ats_keywords(resume: str, ats_keywords: List[str]) -> tuple[str, List[str]]:
    """
    Check which ATS keywords are missing from the resume.
    Returns (resume_unchanged, list_of_missing_keywords).
    """
    lower_resume = resume.lower()
    missing = [kw for kw in ats_keywords if kw.lower() not in lower_resume]
    return resume, missing


# ---------------------------------------------------------------------------
# Node
# ---------------------------------------------------------------------------


async def resume_tailor_node(state: AgentState) -> AgentState:
    """
    LangGraph node: Resume Tailor Agent.

    Reads:  candidate_profile, parsed_jd, retrieved_jd_context,
            retrieved_resume_chunks, eval_feedback, iteration_count,
            model_routing
    Writes: tailored_resume
    """
    session_id = state["session_id"]
    iteration  = state.get("iteration_count") or 0
    logger.info("[resume_tailor] START session=%s iter=%d", session_id, iteration)

    router = get_llm_router()
    errors: List[str] = list(state.get("errors") or [])

    model = (state.get("model_routing") or {}).get(
        AgentName.RESUME_TAILOR.value, LLMModel.GPT_4O.value
    )

    system_prompt = _build_system_prompt(state)
    user_message  = _build_user_message(state)

    tailored_resume: str = state.get("tailored_resume") or ""

    try:
        response = await router.invoke(
            agent_name=AgentName.RESUME_TAILOR.value,
            system_prompt=system_prompt,
            user_message=user_message,
            session_id=session_id,
            model_override=model,
        )
        raw_resume = response.content.strip()

        if not raw_resume:
            raise ValueError("LLM returned empty resume content")

        tailored_resume = _strip_preamble(raw_resume)

        # Log coverage gap
        ats_keywords = (state.get("parsed_jd") or {}).get("ats_keywords") or []
        _, missing = _validate_ats_keywords(tailored_resume, ats_keywords)
        if missing:
            logger.info(
                "[resume_tailor] %d ATS keywords not found: %s session=%s",
                len(missing), missing[:10], session_id,
            )

        logger.info(
            "[resume_tailor] DONE len=%d iter=%d session=%s",
            len(tailored_resume), iteration, session_id,
        )

    except Exception as exc:
        logger.error("[resume_tailor] failed: %s", exc)
        errors.append(f"resume_tailor:llm:{exc}")
        # Keep existing resume if we have one; otherwise return empty string
        if not tailored_resume:
            tailored_resume = (
                f"# Resume Generation Failed\n\n"
                f"Error: {exc}\n\n"
                f"Please retry or contact support."
            )

    return {
        **state,  # type: ignore[misc]
        "tailored_resume": tailored_resume,
        "errors":          errors,
    }