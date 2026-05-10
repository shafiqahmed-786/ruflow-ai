"""
backend/agents/planner_agent.py

Planner Agent — decomposes the job application task into a prioritised
execution plan and assigns LLM models to each downstream agent.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List

from backend.config.settings import get_settings
from backend.orchestrator.state import (
    AgentName,
    AgentState,
    EvalStatus,
    LLMModel,
    PastApplication,
)
from backend.services.llm_service import get_llm_router
from backend.services.memory_service import get_memory_service

logger = logging.getLogger(__name__)
cfg = get_settings()

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

PLANNER_SYSTEM_PROMPT = """
You are a strategic execution planner for an AI-powered job application system.

Your role is to analyse the candidate profile and job description, then produce
a precise execution plan with model assignments.

Available agents (use these exact strings in execution_plan):
  - jd_analyzer    : parses and structures the job description
  - retrieval      : hybrid RAG over resume/JD knowledge bases
  - resume_tailor  : rewrites the resume for the specific JD
  - cover_letter   : generates a targeted cover letter
  - evaluator      : scores outputs programmatically + LLM judge
  - improver       : surgically patches outputs based on feedback

Available model IDs:
  - gemini-2.0-flash          : best reasoning, writing, evaluation (higher cost)
  - gemini-2.0-flash-lite     : fast, cheap, good for extraction/classification
  - gemini-1.5-flash          : fallback for long-form writing
  - gemini-1.5-flash-8b       : ultra-fast, cheap extraction fallback

Assignment rules:
  - Use gemini-2.0-flash-lite for: jd_analyzer, retrieval, packager
  - Use gemini-2.0-flash for: resume_tailor, cover_letter, evaluator, improver
  - Downgrade to gemini-1.5-flash-8b if candidate has sparse profile (< 3 jobs)
  - Upgrade cover_letter to gemini-1.5-flash if company_culture signals are rich

Gap analysis — populate focus_areas from this list:
  skills_gap, keyword_density, seniority_mismatch, quantification_needed,
  tone_adjustment, culture_fit, tech_stack_alignment, leadership_signals

Return ONLY a valid JSON object with NO markdown fences. Exact schema:
{
  "execution_plan": ["jd_analyzer", "retrieval", "resume_tailor", "cover_letter", "evaluator"],
  "focus_areas": ["<gap1>", "<gap2>"],
  "model_routing": {
    "jd_analyzer":    "<model_id>",
    "retrieval":      "<model_id>",
    "resume_tailor":  "<model_id>",
    "cover_letter":   "<model_id>",
    "evaluator":      "<model_id>",
    "improver":       "<model_id>",
    "packager":       "<model_id>"
  }
}
"""

# ---------------------------------------------------------------------------
# Defaults (used when LLM call fails)
# ---------------------------------------------------------------------------

_DEFAULT_PLAN: List[str] = [
    AgentName.JD_ANALYZER.value,
    AgentName.RETRIEVAL.value,
    AgentName.RESUME_TAILOR.value,
    AgentName.COVER_LETTER.value,
    AgentName.EVALUATOR.value,
]

_DEFAULT_ROUTING: Dict[str, str] = {
    AgentName.JD_ANALYZER.value:   LLMModel.GPT_4O_MINI.value,
    AgentName.RETRIEVAL.value:     LLMModel.GPT_4O_MINI.value,
    AgentName.RESUME_TAILOR.value: LLMModel.GPT_4O.value,
    AgentName.COVER_LETTER.value:  LLMModel.GPT_4O.value,
    AgentName.EVALUATOR.value:     LLMModel.GPT_4O.value,
    AgentName.IMPROVER.value:      LLMModel.GPT_4O.value,
    AgentName.PACKAGER.value:      LLMModel.GPT_4O_MINI.value,
}

_VALID_AGENTS = {a.value for a in AgentName}
_VALID_MODELS = {m.value for m in LLMModel}
_VALID_FOCUS  = {
    "skills_gap", "keyword_density", "seniority_mismatch",
    "quantification_needed", "tone_adjustment", "culture_fit",
    "tech_stack_alignment", "leadership_signals",
}


# ---------------------------------------------------------------------------
# Node
# ---------------------------------------------------------------------------


async def planner_node(state: AgentState) -> AgentState:
    """
    LangGraph node: Planner Agent.

    Reads: raw_jd_text, candidate_profile, raw_resume_text
    Writes: execution_plan, focus_areas, model_routing, past_applications
    """
    session_id = state["session_id"]
    logger.info("[planner] START session=%s", session_id)

    router = get_llm_router()
    errors: List[str] = list(state.get("errors") or [])

    # ── Build user message ──────────────────────────────────────────────
    profile   = state.get("candidate_profile") or {}
    skills    = profile.get("skills") or []
    exp       = profile.get("experience") or []
    jd_text   = (state.get("raw_jd_text") or "")[:1200]

    past_context = ""
    past_apps: List[PastApplication] = []

    # ── Load long-term memory ───────────────────────────────────────────
    try:
        memory = get_memory_service()
        past_apps = await memory.retrieve_past_applications(limit=5)
        if past_apps:
            summaries = [
                f"- {p.get('jd_role','?')} @ {p.get('company','?')} "
                f"(score={p.get('final_scores',{}).get('overall',0):.0f}, "
                f"iter={p.get('iterations',0)})"
                for p in past_apps[:3]
            ]
            past_context = "Recent applications:\n" + "\n".join(summaries)
    except Exception as exc:
        logger.warning("[planner] memory retrieval failed: %s", exc)
        errors.append(f"planner:memory:{exc}")

    user_msg = (
        f"## Candidate Profile\n"
        f"Skills ({len(skills)} total): {', '.join(skills[:25])}\n"
        f"Experience entries: {len(exp)}\n"
        f"Summary: {profile.get('summary', '')[:300]}\n\n"
        f"## Job Description (first 1200 chars)\n{jd_text}\n\n"
        f"{past_context}"
    )

    # ── LLM call ────────────────────────────────────────────────────────
    execution_plan = _DEFAULT_PLAN[:]
    model_routing  = dict(_DEFAULT_ROUTING)
    focus_areas: List[str] = []

    try:
        result: Dict[str, Any] = await router.invoke_json(
            agent_name=AgentName.PLANNER.value,
            system_prompt=PLANNER_SYSTEM_PROMPT,
            user_message=user_msg,
            session_id=session_id,
        )

        raw_plan    = result.get("execution_plan") or []
        raw_routing = result.get("model_routing")  or {}
        raw_focus   = result.get("focus_areas")    or []

        # Validate plan entries
        execution_plan = [a for a in raw_plan if a in _VALID_AGENTS] or _DEFAULT_PLAN[:]

        # Validate routing — fall back per-key to defaults
        for agent_key, default_model in _DEFAULT_ROUTING.items():
            proposed = raw_routing.get(agent_key, default_model)
            model_routing[agent_key] = (
                proposed if proposed in _VALID_MODELS else default_model
            )

        # Validate focus areas
        focus_areas = [f for f in raw_focus if f in _VALID_FOCUS]

        logger.info(
            "[planner] plan=%s focus=%s session=%s",
            execution_plan, focus_areas, session_id,
        )

    except Exception as exc:
        logger.error("[planner] LLM failed, using defaults: %s", exc)
        errors.append(f"planner:llm:{exc}")

    return {
        **state,  # type: ignore[misc]
        "execution_plan":   execution_plan,
        "focus_areas":      focus_areas,
        "model_routing":    model_routing,
        "past_applications": past_apps,
        "errors":           errors,
    }