"""
backend/orchestrator/state.py

Defines the shared AgentState TypedDict passed between all LangGraph nodes.
This is the single source of truth for the entire graph's data flow.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, TypedDict


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class EvalStatus(str, Enum):
    """Lifecycle status of the evaluation / improvement loop."""

    PENDING = "pending"
    IMPROVING = "improving"
    PASSED = "passed"
    FAILED = "failed"
    MAX_ITER_REACHED = "max_iter_reached"


class SeniorityLevel(str, Enum):
    """Normalised seniority extracted from a JD."""

    INTERN = "intern"
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"
    STAFF = "staff"
    PRINCIPAL = "principal"
    DIRECTOR = "director"
    UNKNOWN = "unknown"


class AgentName(str, Enum):
    """Canonical names used in execution_plan and model_routing."""

    PLANNER = "planner"
    JD_ANALYZER = "jd_analyzer"
    RETRIEVAL = "retrieval"
    RESUME_TAILOR = "resume_tailor"
    COVER_LETTER = "cover_letter"
    EVALUATOR = "evaluator"
    IMPROVER = "improver"
    PACKAGER = "packager"


class LLMModel(str, Enum):
    """Supported LLM model identifiers used in model_routing."""

    GPT_4O = "gemini-2.0-flash"
    GPT_4O_MINI = "gemini-2.0-flash-lite"
    CLAUDE_SONNET = "gemini-1.5-flash"
    CLAUDE_HAIKU = "gemini-1.5-flash-8b"


# ---------------------------------------------------------------------------
# Sub-schemas (plain dicts — kept as TypedDicts for IDE support)
# ---------------------------------------------------------------------------


class ParsedResume(TypedDict, total=False):
    """Structured output produced by the PDF/text resume parser."""

    full_name: str
    email: str
    phone: str
    linkedin_url: str
    github_url: str
    location: str
    summary: str
    # List of role dicts: {company, title, start, end, bullets: [str]}
    experience: List[Dict[str, Any]]
    # List of {institution, degree, field, graduation_year}
    education: List[Dict[str, Any]]
    skills: List[str]
    certifications: List[str]
    projects: List[Dict[str, Any]]
    languages: List[str]
    raw_text: str


class ParsedJD(TypedDict, total=False):
    """Structured output produced by the JD Analyzer agent."""

    role_title: str
    company_name: str
    seniority_level: str          # maps to SeniorityLevel
    required_skills: List[str]
    preferred_skills: List[str]
    ats_keywords: List[str]
    culture_signals: List[str]
    tech_stack: List[str]
    responsibilities: List[str]
    red_flags: List[str]
    location: str
    remote_policy: str            # "remote" | "hybrid" | "onsite" | "unknown"
    salary_range: Optional[str]


class EvalScores(TypedDict, total=False):
    """Numeric scores (0–100) computed by the Evaluator agent."""

    keyword_coverage: float
    relevance: float
    impact: float
    tone_match: float
    cover_letter_quality: float
    overall: float                # weighted average


class PastApplication(TypedDict, total=False):
    """A persisted application record retrieved from long-term memory."""

    session_id: str
    jd_role: str
    company: str
    final_scores: EvalScores
    iterations: int
    resume_snapshot: str
    cover_snapshot: str
    timestamp: str                # ISO-8601


class RetrievedChunk(TypedDict):
    """A single chunk returned by the Retrieval agent."""

    text: str
    source: str                   # "vector_db" | "bm25" | "web"
    score: float
    metadata: Dict[str, Any]


class ChangeLogEntry(TypedDict):
    """A single edit recorded by the Improvement agent."""

    iteration: int
    target: str                   # "resume" | "cover_letter"
    description: str


# ---------------------------------------------------------------------------
# Master State
# ---------------------------------------------------------------------------


class AgentState(TypedDict, total=False):
    """
    Shared state dictionary threaded through every LangGraph node.

    Fields marked Optional are populated by specific agents; all other
    fields should be present from graph initialisation onward.

    total=False means no field is required at TypedDict-construction time,
    which is necessary because LangGraph builds the dict incrementally.
    """

    # ── Session ──────────────────────────────────────────────────────────
    session_id: str
    """Unique run identifier (UUID4). Set at graph entry."""

    created_at: str
    """ISO-8601 timestamp of session creation."""

    # ── Raw Inputs ───────────────────────────────────────────────────────
    raw_resume_text: str
    """Unprocessed resume text (extracted from PDF or pasted directly)."""

    raw_resume_pdf_bytes: Optional[bytes]
    """Binary PDF content if the user uploaded a file."""

    raw_jd_text: str
    """Unprocessed job description text."""

    raw_jd_url: Optional[str]
    """Optional URL if JD was scraped."""

    linkedin_data: Optional[Dict[str, Any]]
    """Optional LinkedIn profile JSON."""

    # ── Parsed Artifacts ─────────────────────────────────────────────────
    parsed_resume: ParsedResume
    """Structured resume produced by the Ingest node."""

    parsed_jd: ParsedJD
    """Structured JD produced by the JD Analyzer agent."""

    candidate_profile: Dict[str, Any]
    """
    Merged view of parsed_resume + linkedin_data.
    Used as the primary candidate context by downstream agents.
    """

    # ── Planner Output ───────────────────────────────────────────────────
    execution_plan: List[str]
    """Ordered list of agent names to execute (subset of AgentName values)."""

    focus_areas: List[str]
    """High-level gaps identified by the Planner (e.g. 'skills_gap')."""

    model_routing: Dict[str, str]
    """Maps agent name → LLMModel value. Populated by Planner."""

    # ── Retrieval Layer ───────────────────────────────────────────────────
    retrieved_jd_context: List[RetrievedChunk]
    """Similar JDs / role descriptions pulled from VectorDB."""

    retrieved_resume_chunks: List[RetrievedChunk]
    """Relevant resume snippets matched against the JD."""

    company_intel: Optional[str]
    """Web-scraped company information (mission, news, culture)."""

    # ── Generated Outputs ─────────────────────────────────────────────────
    tailored_resume: Optional[str]
    """Markdown-formatted resume tailored to the JD."""

    cover_letter: Optional[str]
    """Plain-text cover letter tailored to the JD."""

    # ── Evaluation Loop ───────────────────────────────────────────────────
    eval_scores: EvalScores
    """Scores populated / updated by the Evaluator agent each iteration."""

    eval_feedback: Optional[str]
    """
    Structured JSON string from the Evaluator containing
    critical_issues and improvement_hints.
    """

    iteration_count: int
    """Number of Evaluator → Improver loops completed (starts at 0)."""

    eval_status: str
    """Current EvalStatus value as a string."""

    change_log: List[ChangeLogEntry]
    """Accumulated list of edits made by the Improvement agent."""

    # ── Memory ───────────────────────────────────────────────────────────
    past_applications: List[PastApplication]
    """Historical applications loaded from MongoDB at graph start."""

    session_memory: Dict[str, Any]
    """Ephemeral key-value store for intra-session agent communication."""

    # ── Error Tracking ────────────────────────────────────────────────────
    errors: List[str]
    """Non-fatal errors accumulated during execution (agent name: message)."""

    # ── Final Package ─────────────────────────────────────────────────────
    final_output: Optional[Dict[str, Any]]
    """
    Structured output emitted by the Packager node and returned via API.
    Schema:
      {
        "tailored_resume": str,
        "cover_letter": str,
        "eval_scores": EvalScores,
        "iterations_used": int,
        "session_id": str,
        "change_log": List[ChangeLogEntry]
      }
    """


# ---------------------------------------------------------------------------
# Factory helper
# ---------------------------------------------------------------------------


def create_initial_state(
    raw_resume_text: str,
    raw_jd_text: str,
    raw_resume_pdf_bytes: Optional[bytes] = None,
    raw_jd_url: Optional[str] = None,
    linkedin_data: Optional[Dict[str, Any]] = None,
    session_id: Optional[str] = None,
) -> AgentState:
    """
    Build a fully-initialised AgentState suitable for passing to
    ``graph.invoke()`` or ``graph.astream()``.

    Args:
        raw_resume_text: Resume as plain text.
        raw_jd_text: Job description as plain text.
        raw_resume_pdf_bytes: Optional raw PDF bytes.
        raw_jd_url: Optional URL the JD was fetched from.
        linkedin_data: Optional LinkedIn profile dict.
        session_id: Provide to resume a session; auto-generated otherwise.

    Returns:
        A fully populated AgentState with all list/dict fields initialised
        to their empty defaults so downstream agents never encounter KeyError.
    """
    return AgentState(
        session_id=session_id or str(uuid.uuid4()),
        created_at=datetime.utcnow().isoformat(),
        # Raw inputs
        raw_resume_text=raw_resume_text,
        raw_resume_pdf_bytes=raw_resume_pdf_bytes,
        raw_jd_text=raw_jd_text,
        raw_jd_url=raw_jd_url,
        linkedin_data=linkedin_data,
        # Parsed artifacts (will be populated by agents)
        parsed_resume={},
        parsed_jd={},
        candidate_profile={},
        # Planner
        execution_plan=[],
        focus_areas=[],
        model_routing={},
        # Retrieval
        retrieved_jd_context=[],
        retrieved_resume_chunks=[],
        company_intel=None,
        # Outputs
        tailored_resume=None,
        cover_letter=None,
        # Evaluation
        eval_scores={},
        eval_feedback=None,
        iteration_count=0,
        eval_status=EvalStatus.PENDING.value,
        change_log=[],
        # Memory
        past_applications=[],
        session_memory={},
        # Meta
        errors=[],
        final_output=None,
    )
