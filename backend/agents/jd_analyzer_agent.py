"""
backend/agents/jd_analyzer_agent.py

JD Analyzer Agent — deep-parses the raw job description into a structured
ParsedJD dict with ATS keywords, culture signals, and seniority classification.
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
    ParsedJD,
    SeniorityLevel,
)
from backend.services.llm_service import get_llm_router

logger = logging.getLogger(__name__)
cfg = get_settings()

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

JD_ANALYZER_SYSTEM_PROMPT = """
You are an expert technical recruiter and NLP specialist with deep knowledge
of ATS (Applicant Tracking Systems) and modern hiring practices.

Your task: parse the provided job description into a structured JSON object.

Rules:
1. ats_keywords MUST include BOTH acronyms and full forms
   (e.g. include both "ML" and "machine learning").
2. required_skills = explicitly stated as required/must-have.
3. preferred_skills = "nice to have", "bonus", "preferred" language.
4. culture_signals = infer from language tone, stated values, team descriptions.
5. red_flags = unrealistic demands, excessive scope, conflicting requirements.
6. seniority_level must be exactly one of:
   intern, junior, mid, senior, staff, principal, director, unknown
7. remote_policy must be exactly one of:
   remote, hybrid, onsite, unknown

Return ONLY a valid JSON object. No markdown. No explanation.

Schema:
{
  "role_title": "string",
  "company_name": "string",
  "seniority_level": "string",
  "required_skills": ["string"],
  "preferred_skills": ["string"],
  "ats_keywords": ["string"],
  "culture_signals": ["string"],
  "tech_stack": ["string"],
  "responsibilities": ["string"],
  "red_flags": ["string"],
  "location": "string",
  "remote_policy": "string",
  "salary_range": "string or null"
}
"""

# ---------------------------------------------------------------------------
# Seniority keyword map (regex fallback if LLM fails)
# ---------------------------------------------------------------------------

_SENIORITY_MAP: List[tuple] = [
    (re.compile(r"\bintern\b|\bco-?op\b|\btrainee\b", re.I), SeniorityLevel.INTERN.value),
    (re.compile(r"\bjunior\b|\bjr\.?\b|\bentry[- ]level\b|\b0[-–]2\s*years?\b", re.I), SeniorityLevel.JUNIOR.value),
    (re.compile(r"\bmid[- ]level\b|\bintermediate\b|\b2[-–]5\s*years?\b|\b3\+\s*years?\b", re.I), SeniorityLevel.MID.value),
    (re.compile(r"\bsenior\b|\bsr\.?\b|\b5\+\s*years?\b|\b5[-–]8\s*years?\b", re.I), SeniorityLevel.SENIOR.value),
    (re.compile(r"\bstaff\b", re.I), SeniorityLevel.STAFF.value),
    (re.compile(r"\bprincipal\b|\blead\b|\b8\+\s*years?\b", re.I), SeniorityLevel.PRINCIPAL.value),
    (re.compile(r"\bdirector\b|\bvp\b|\bvice president\b|\bhead of\b", re.I), SeniorityLevel.DIRECTOR.value),
]

_REMOTE_MAP: List[tuple] = [
    (re.compile(r"\bfully remote\b|\b100%\s*remote\b|\bwork from anywhere\b", re.I), "remote"),
    (re.compile(r"\bhybrid\b|\bflexible\b|\b[23]\s*days?\s*(in\s*office|onsite)\b", re.I), "hybrid"),
    (re.compile(r"\bonsite\b|\bin[- ]office\b|\bon[- ]site\b|\bno remote\b", re.I), "onsite"),
]

_VALID_SENIORITY = {s.value for s in SeniorityLevel}
_VALID_REMOTE    = {"remote", "hybrid", "onsite", "unknown"}


# ---------------------------------------------------------------------------
# Fallback regex parser
# ---------------------------------------------------------------------------


def _regex_parse_jd(text: str) -> ParsedJD:
    """
    Minimal regex-based JD parser used when the LLM call fails entirely.
    Produces a partial ParsedJD with at least seniority and remote_policy.
    """
    seniority = SeniorityLevel.UNKNOWN.value
    for pattern, level in _SENIORITY_MAP:
        if pattern.search(text):
            seniority = level
            break

    remote_policy = "unknown"
    for pattern, policy in _REMOTE_MAP:
        if pattern.search(text):
            remote_policy = policy
            break

    # Heuristic: first line that looks like a job title
    role_title = ""
    for line in text.splitlines():
        line = line.strip()
        if 3 < len(line) < 80 and not re.search(r"[.@:/]", line):
            role_title = line
            break

    # Bullet points as responsibilities
    bullets = [
        re.sub(r"^[-•*·]\s*", "", l).strip()
        for l in text.splitlines()
        if re.match(r"^\s*[-•*·]\s+", l)
    ]

    return ParsedJD(
        role_title=role_title,
        company_name="Unknown",
        seniority_level=seniority,
        required_skills=[],
        preferred_skills=[],
        ats_keywords=[],
        culture_signals=[],
        tech_stack=[],
        responsibilities=bullets[:15],
        red_flags=[],
        location="",
        remote_policy=remote_policy,
        salary_range=None,
    )


def _validate_parsed_jd(raw: Dict[str, Any]) -> ParsedJD:
    """
    Coerce and validate an LLM-returned dict into a well-typed ParsedJD.
    Fills missing keys with safe defaults.
    """
    def _str(v: Any, default: str = "") -> str:
        return str(v).strip() if v else default

    def _list_of_str(v: Any) -> List[str]:
        if not v:
            return []
        if isinstance(v, list):
            return [str(i).strip() for i in v if i]
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return []

    seniority = _str(raw.get("seniority_level"), SeniorityLevel.UNKNOWN.value).lower()
    if seniority not in _VALID_SENIORITY:
        seniority = SeniorityLevel.UNKNOWN.value

    remote_policy = _str(raw.get("remote_policy"), "unknown").lower()
    if remote_policy not in _VALID_REMOTE:
        remote_policy = "unknown"

    return ParsedJD(
        role_title       = _str(raw.get("role_title")),
        company_name     = _str(raw.get("company_name"), "Unknown"),
        seniority_level  = seniority,
        required_skills  = _list_of_str(raw.get("required_skills")),
        preferred_skills = _list_of_str(raw.get("preferred_skills")),
        ats_keywords     = _list_of_str(raw.get("ats_keywords")),
        culture_signals  = _list_of_str(raw.get("culture_signals")),
        tech_stack       = _list_of_str(raw.get("tech_stack")),
        responsibilities = _list_of_str(raw.get("responsibilities")),
        red_flags        = _list_of_str(raw.get("red_flags")),
        location         = _str(raw.get("location")),
        remote_policy    = remote_policy,
        salary_range     = raw.get("salary_range"),
    )


# ---------------------------------------------------------------------------
# Node
# ---------------------------------------------------------------------------


async def jd_analyzer_node(state: AgentState) -> AgentState:
    """
    LangGraph node: JD Analyzer Agent.

    Reads:  raw_jd_text, model_routing
    Writes: parsed_jd
    """
    session_id = state["session_id"]
    logger.info("[jd_analyzer] START session=%s", session_id)

    router = get_llm_router()
    errors: List[str] = list(state.get("errors") or [])

    raw_jd = (state.get("raw_jd_text") or "").strip()
    if not raw_jd:
        errors.append("jd_analyzer:no_jd_text")
        fallback = _regex_parse_jd("")
        logger.warning("[jd_analyzer] no JD text; using empty fallback")
        return {**state, "parsed_jd": fallback, "errors": errors}  # type: ignore[misc]

    model = (state.get("model_routing") or {}).get(
        AgentName.JD_ANALYZER.value, LLMModel.GPT_4O_MINI.value
    )

    parsed_jd: ParsedJD

    try:
        raw_result: Dict[str, Any] = await router.invoke_json(
            agent_name=AgentName.JD_ANALYZER.value,
            system_prompt=JD_ANALYZER_SYSTEM_PROMPT,
            user_message=raw_jd,
            session_id=session_id,
            model_override=model,
        )
        parsed_jd = _validate_parsed_jd(raw_result)

        logger.info(
            "[jd_analyzer] role=%s company=%s seniority=%s keywords=%d session=%s",
            parsed_jd.get("role_title"),
            parsed_jd.get("company_name"),
            parsed_jd.get("seniority_level"),
            len(parsed_jd.get("ats_keywords") or []),
            session_id,
        )

    except Exception as exc:
        logger.error("[jd_analyzer] LLM failed: %s — using regex fallback", exc)
        errors.append(f"jd_analyzer:llm:{exc}")
        parsed_jd = _regex_parse_jd(raw_jd)

    # Deduplicate ats_keywords (case-insensitive)
    seen: set = set()
    deduped: List[str] = []
    for kw in (parsed_jd.get("ats_keywords") or []):
        key = kw.lower()
        if key not in seen:
            seen.add(key)
            deduped.append(kw)
    parsed_jd["ats_keywords"] = deduped  # type: ignore[literal-required]

    return {
        **state,  # type: ignore[misc]
        "parsed_jd": parsed_jd,
        "errors":    errors,
    }