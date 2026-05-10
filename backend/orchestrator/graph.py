"""
backend/orchestrator/graph.py

LangGraph StateGraph definition for the RuFlow multi-agent pipeline.

Graph topology:
  ingest → planner → jd_analyzer → retrieval
                                       ↓          ↓
                                 resume_tailor  cover_letter
                                       ↓          ↓
                                      evaluator (join)
                                       ↓
                            [score < threshold?]
                               YES ↓         NO ↓
                             improver      packager → END
                               ↓
                            evaluator (loop back)

All agent node functions are async.  The graph is compiled once at module
load time and re-used across requests.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from langgraph.graph import StateGraph, END

from backend.config.settings import get_settings
from backend.orchestrator.state import (
    AgentName,
    AgentState,
    ChangeLogEntry,
    EvalScores,
    EvalStatus,
    LLMModel,
    ParsedJD,
    ParsedResume,
    RetrievedChunk,
    SeniorityLevel,
    create_initial_state,
)
from backend.services.llm_service import get_llm_router
from backend.services.memory_service import get_memory_service
from backend.services.vector_db_service import (
    HybridRetriever,
    get_embedding_service,
)
from backend.tools.pdf_parser import ResumeParser

logger = logging.getLogger(__name__)
cfg = get_settings()

# ---------------------------------------------------------------------------
# Helper: safe state merge
# ---------------------------------------------------------------------------


def _merge(state: AgentState, updates: Dict[str, Any]) -> AgentState:
    """Return a new AgentState dict with ``updates`` applied."""
    return {**state, **updates}  # type: ignore[return-value]


def _append_error(state: AgentState, msg: str) -> List[str]:
    return [*state.get("errors", []), msg]


# ---------------------------------------------------------------------------
# Node 1: Ingest
# ---------------------------------------------------------------------------


async def ingest_node(state: AgentState) -> AgentState:
    """
    Parse raw resume text / PDF bytes into a structured ParsedResume.
    Merge with optional LinkedIn data to build candidate_profile.
    """
    logger.info("[ingest] session=%s", state["session_id"])
    parser = ResumeParser()
    errors = list(state.get("errors", []))

    try:
        if state.get("raw_resume_pdf_bytes"):
            parsed_resume = parser.parse_pdf(state["raw_resume_pdf_bytes"])
        elif state.get("raw_resume_text"):
            parsed_resume = parser.parse_text(state["raw_resume_text"])
        else:
            parsed_resume = ParsedResume(raw_text="")
            errors.append("ingest: no resume input provided")
    except Exception as exc:
        logger.error("[ingest] resume parsing failed: %s", exc)
        parsed_resume = ParsedResume(raw_text=state.get("raw_resume_text", ""))
        errors.append(f"ingest: resume parse error — {exc}")

    # Merge LinkedIn data into candidate_profile
    candidate_profile: Dict[str, Any] = dict(parsed_resume)
    if state.get("linkedin_data"):
        ld = state["linkedin_data"]
        candidate_profile["linkedin_headline"] = ld.get("headline", "")
        candidate_profile["linkedin_connections"] = ld.get("connections", 0)
        candidate_profile["linkedin_about"] = ld.get("about", "")

    return _merge(state, {
        "parsed_resume": parsed_resume,
        "candidate_profile": candidate_profile,
        "errors": errors,
    })


# ---------------------------------------------------------------------------
# Node 2: Planner
# ---------------------------------------------------------------------------

_PLANNER_SYSTEM = """
You are a strategic execution planner for an AI-powered job application system.

Given a structured candidate profile and a parsed job description summary,
you will:
1. Identify high-level gaps between the candidate and the JD.
2. Determine which agents to run and in what order.
3. Assign the most cost-efficient LLM to each agent based on task complexity.

Model IDs available:
- {strong}: high-reasoning tasks (cover letter generation, evaluation, improvement)
- {fast}: extraction / classification tasks (JD analysis, planning, packaging)
- {claude_sonnet}: alternative for long-form writing when gemini-2.0-flash is rate-limited
- {claude_haiku}: ultra-fast extraction fallback

Return ONLY a valid JSON object. No markdown. No explanation.
Schema:
{{
  "execution_plan": ["jd_analyzer","retrieval","resume_tailor","cover_letter","evaluator"],
  "focus_areas": ["skills_gap","keyword_density"],
  "model_routing": {{
    "jd_analyzer": "<model_id>",
    "retrieval": "<model_id>",
    "resume_tailor": "<model_id>",
    "cover_letter": "<model_id>",
    "evaluator": "<model_id>",
    "improver": "<model_id>",
    "packager": "<model_id>"
  }}
}}
""".format(
    strong=LLMModel.GPT_4O.value,
    fast=LLMModel.GPT_4O_MINI.value,
    claude_sonnet=LLMModel.CLAUDE_SONNET.value,
    claude_haiku=LLMModel.CLAUDE_HAIKU.value,
)


async def planner_agent(state: AgentState) -> AgentState:
    """
    Decide execution plan and model assignments.
    Falls back to sensible defaults if LLM call fails.
    """
    logger.info("[planner] session=%s", state["session_id"])
    router = get_llm_router()
    errors = list(state.get("errors", []))

    default_routing: Dict[str, str] = {
        AgentName.JD_ANALYZER.value: LLMModel.GPT_4O_MINI.value,
        AgentName.RETRIEVAL.value: LLMModel.GPT_4O_MINI.value,
        AgentName.RESUME_TAILOR.value: LLMModel.GPT_4O.value,
        AgentName.COVER_LETTER.value: LLMModel.GPT_4O.value,
        AgentName.EVALUATOR.value: LLMModel.GPT_4O.value,
        AgentName.IMPROVER.value: LLMModel.GPT_4O.value,
        AgentName.PACKAGER.value: LLMModel.GPT_4O_MINI.value,
    }
    default_plan = [
        AgentName.JD_ANALYZER.value,
        AgentName.RETRIEVAL.value,
        AgentName.RESUME_TAILOR.value,
        AgentName.COVER_LETTER.value,
        AgentName.EVALUATOR.value,
    ]

    user_msg = (
        f"Candidate profile summary:\n"
        f"Skills: {state['candidate_profile'].get('skills', [])}\n"
        f"Experience entries: {len(state['candidate_profile'].get('experience', []))}\n\n"
        f"Job description (raw, first 800 chars):\n"
        f"{state.get('raw_jd_text', '')[:800]}"
    )

    try:
        result = await router.invoke_json(
            agent_name=AgentName.PLANNER.value,
            system_prompt=_PLANNER_SYSTEM,
            user_message=user_msg,
            session_id=state["session_id"],
        )
        plan = result.get("execution_plan", default_plan)
        routing = result.get("model_routing", default_routing)
        focus = result.get("focus_areas", [])
    except Exception as exc:
        logger.error("[planner] LLM failed: %s; using defaults", exc)
        errors.append(f"planner: LLM error — {exc}")
        plan = default_plan
        routing = default_routing
        focus = []

    # Load past applications from long-term memory
    try:
        memory = get_memory_service()
        past = await memory.retrieve_past_applications(limit=5)
    except Exception as exc:
        logger.warning("[planner] memory retrieval failed: %s", exc)
        past = []
        errors.append(f"planner: memory error — {exc}")

    return _merge(state, {
        "execution_plan": plan,
        "model_routing": routing,
        "focus_areas": focus,
        "past_applications": past,
        "errors": errors,
    })


# ---------------------------------------------------------------------------
# Node 3: JD Analyzer
# ---------------------------------------------------------------------------

_JD_ANALYZER_SYSTEM = """
You are an expert technical recruiter and NLP specialist.

Parse the job description below and return ONLY a valid JSON object. No markdown.

Required schema:
{
  "role_title": "string",
  "company_name": "string",
  "seniority_level": "junior|mid|senior|staff|principal|director|unknown",
  "required_skills": ["string"],
  "preferred_skills": ["string"],
  "ats_keywords": ["string"],
  "culture_signals": ["string"],
  "tech_stack": ["string"],
  "responsibilities": ["string"],
  "red_flags": ["string"],
  "location": "string",
  "remote_policy": "remote|hybrid|onsite|unknown",
  "salary_range": "string or null"
}

Be exhaustive with ats_keywords — these are the exact terms ATS systems scan for.
Include both acronyms and full forms (e.g. "ML" and "machine learning").
"""


async def jd_analyzer_agent(state: AgentState) -> AgentState:
    """Parse raw JD text into a structured ParsedJD dict."""
    logger.info("[jd_analyzer] session=%s", state["session_id"])
    router = get_llm_router()
    errors = list(state.get("errors", []))
    model = state.get("model_routing", {}).get(
        AgentName.JD_ANALYZER.value, LLMModel.GPT_4O_MINI.value
    )

    try:
        parsed_jd: ParsedJD = await router.invoke_json(
            agent_name=AgentName.JD_ANALYZER.value,
            system_prompt=_JD_ANALYZER_SYSTEM,
            user_message=state.get("raw_jd_text", ""),
            session_id=state["session_id"],
            model_override=model,
        )  # type: ignore[assignment]
    except Exception as exc:
        logger.error("[jd_analyzer] failed: %s", exc)
        errors.append(f"jd_analyzer: {exc}")
        parsed_jd = ParsedJD(
            role_title="Unknown",
            company_name="Unknown",
            seniority_level=SeniorityLevel.UNKNOWN.value,
            required_skills=[],
            preferred_skills=[],
            ats_keywords=[],
        )

    return _merge(state, {"parsed_jd": parsed_jd, "errors": errors})


# ---------------------------------------------------------------------------
# Node 4: Retrieval
# ---------------------------------------------------------------------------


async def retrieval_agent(state: AgentState) -> AgentState:
    """
    Hybrid RAG retrieval:
    1. Query ChromaDB for similar resumes and JDs.
    2. Optionally web-search for company intel.
    """
    logger.info("[retrieval] session=%s", state["session_id"])
    embed_svc = get_embedding_service()
    memory = get_memory_service()
    errors = list(state.get("errors", []))

    ats_keywords = state["parsed_jd"].get("ats_keywords", [])
    jd_query = " ".join([
        state["parsed_jd"].get("role_title", ""),
        state["parsed_jd"].get("company_name", ""),
        *ats_keywords[:20],
    ])

    # --- Dense retrieval from ChromaDB ---
    retrieved_jd_context: List[RetrievedChunk] = []
    retrieved_resume_chunks: List[RetrievedChunk] = []
    try:
        query_vec = await embed_svc.embed(jd_query)

        similar_jds = await memory.find_similar_jds(
            query_vec, top_k=cfg.retrieval.retrieval_top_k
        )
        retrieved_jd_context = [
            RetrievedChunk(
                text=r["document"],
                source="vector_db",
                score=1.0 - r["distance"],
                metadata=r["metadata"],
            )
            for r in similar_jds
        ]

        candidate_skills = " ".join(
            state["candidate_profile"].get("skills", [])[:30]
        )
        resume_vec = await embed_svc.embed(candidate_skills or jd_query)
        similar_resumes = await memory.find_similar_resumes(
            resume_vec, top_k=cfg.retrieval.retrieval_top_k
        )
        retrieved_resume_chunks = [
            RetrievedChunk(
                text=r["document"],
                source="vector_db",
                score=1.0 - r["distance"],
                metadata=r["metadata"],
            )
            for r in similar_resumes
        ]
    except Exception as exc:
        logger.warning("[retrieval] vector search failed: %s", exc)
        errors.append(f"retrieval: vector search — {exc}")

    # --- Optional web search for company intel ---
    company_intel: Optional[str] = None
    company = state["parsed_jd"].get("company_name", "")
    if cfg.retrieval.web_search_enabled and company and company != "Unknown":
        try:
            router = get_llm_router()
            intel_response = await router.invoke(
                agent_name=AgentName.RETRIEVAL.value,
                system_prompt=(
                    "You are a research assistant. Given a company name, "
                    "summarise what you know about the company's mission, culture, "
                    "recent news, and tech stack in 2-3 concise paragraphs. "
                    "If you have no reliable information, say so briefly."
                ),
                user_message=f"Company: {company}",
                session_id=state["session_id"],
            )
            company_intel = intel_response.content
        except Exception as exc:
            logger.warning("[retrieval] company intel failed: %s", exc)
            errors.append(f"retrieval: company intel — {exc}")

    return _merge(state, {
        "retrieved_jd_context": retrieved_jd_context,
        "retrieved_resume_chunks": retrieved_resume_chunks,
        "company_intel": company_intel,
        "errors": errors,
    })


# ---------------------------------------------------------------------------
# Node 5: Resume Tailor
# ---------------------------------------------------------------------------

_RESUME_TAILOR_SYSTEM = """
You are a senior technical resume writer and ATS optimisation expert.

You will receive:
1. Candidate profile (structured)
2. Parsed job description with ATS keywords
3. Retrieved similar resume examples (for reference only — do not copy)
4. (Optional) Evaluator feedback from a previous iteration

Rules:
- Rewrite experience bullets in STAR format (Situation→Task→Action→Result)
- Embed ATS keywords from the JD naturally — no stuffing
- Reorder sections: most-relevant experience first
- Quantify achievements (percentages, dollar amounts, user counts)
- Match seniority tone to JD seniority level
- If feedback is provided, address EVERY critical issue explicitly
- Output ONLY the final resume in clean Markdown — no commentary
"""


async def resume_tailor_agent(state: AgentState) -> AgentState:
    """Generate or refine the tailored resume."""
    logger.info("[resume_tailor] session=%s iter=%d", state["session_id"], state.get("iteration_count", 0))
    router = get_llm_router()
    errors = list(state.get("errors", []))
    model = state.get("model_routing", {}).get(
        AgentName.RESUME_TAILOR.value, LLMModel.GPT_4O.value
    )

    jd_context_snippets = "\n---\n".join(
        c["text"] for c in state.get("retrieved_jd_context", [])[:3]
    )
    resume_examples = "\n---\n".join(
        c["text"] for c in state.get("retrieved_resume_chunks", [])[:2]
    )

    user_msg = (
        f"## Candidate Profile\n{json.dumps(state['candidate_profile'], indent=2)}\n\n"
        f"## Target JD (Parsed)\n{json.dumps(state['parsed_jd'], indent=2)}\n\n"
        f"## Retrieved JD Context\n{jd_context_snippets or 'None'}\n\n"
        f"## Resume Examples\n{resume_examples or 'None'}\n\n"
        + (
            f"## Evaluator Feedback (MUST address all critical issues)\n"
            f"{state['eval_feedback']}\n"
            if state.get("eval_feedback") and state.get("iteration_count", 0) > 0
            else ""
        )
    )

    try:
        response = await router.invoke(
            agent_name=AgentName.RESUME_TAILOR.value,
            system_prompt=_RESUME_TAILOR_SYSTEM,
            user_message=user_msg,
            session_id=state["session_id"],
            model_override=model,
        )
        tailored_resume = response.content
    except Exception as exc:
        logger.error("[resume_tailor] failed: %s", exc)
        errors.append(f"resume_tailor: {exc}")
        tailored_resume = state.get("tailored_resume", "")

    return _merge(state, {"tailored_resume": tailored_resume, "errors": errors})


# ---------------------------------------------------------------------------
# Node 6: Cover Letter
# ---------------------------------------------------------------------------

_COVER_LETTER_SYSTEM = """
You are an expert career coach and persuasive writer.

Rules:
- DO NOT open with "I am writing to apply..." — be bold and specific
- Paragraph 1: Hook — connect one specific candidate achievement to a company challenge
- Paragraph 2: Demonstrate deep knowledge of the company (use company intel if provided)
- Paragraph 3: Map the top 3 required skills to concrete candidate evidence
- Closing: Clear CTA, confident tone
- Tone must match the JD seniority level
- Maximum 350 words
- If evaluator feedback is provided, address ALL critical issues before regenerating
- Output ONLY the cover letter as plain text — no headers, no labels
"""


async def cover_letter_agent(state: AgentState) -> AgentState:
    """Generate or refine the cover letter."""
    logger.info("[cover_letter] session=%s iter=%d", state["session_id"], state.get("iteration_count", 0))
    router = get_llm_router()
    errors = list(state.get("errors", []))
    model = state.get("model_routing", {}).get(
        AgentName.COVER_LETTER.value, LLMModel.GPT_4O.value
    )

    user_msg = (
        f"## Candidate Profile\n{json.dumps(state['candidate_profile'], indent=2)}\n\n"
        f"## Parsed JD\n{json.dumps(state['parsed_jd'], indent=2)}\n\n"
        f"## Company Intel\n{state.get('company_intel') or 'Not available'}\n\n"
        + (
            f"## Evaluator Feedback (address ALL critical issues)\n"
            f"{state['eval_feedback']}\n"
            if state.get("eval_feedback") and state.get("iteration_count", 0) > 0
            else ""
        )
    )

    try:
        response = await router.invoke(
            agent_name=AgentName.COVER_LETTER.value,
            system_prompt=_COVER_LETTER_SYSTEM,
            user_message=user_msg,
            session_id=state["session_id"],
            model_override=model,
        )
        cover_letter = response.content
    except Exception as exc:
        logger.error("[cover_letter] failed: %s", exc)
        errors.append(f"cover_letter: {exc}")
        cover_letter = state.get("cover_letter", "")

    return _merge(state, {"cover_letter": cover_letter, "errors": errors})


# ---------------------------------------------------------------------------
# Node 7: Evaluator
# ---------------------------------------------------------------------------

_EVALUATOR_SYSTEM = """
You are a ruthless expert hiring manager and ATS system evaluator.

Score the resume and cover letter against the job description.
Return ONLY a valid JSON object. No markdown.

Schema:
{
  "scores": {
    "keyword_coverage": <0-100 float>,
    "relevance": <0-100 float>,
    "impact": <0-100 float>,
    "tone_match": <0-100 float>,
    "cover_letter_quality": <0-100 float>
  },
  "overall": <0-100 float, weighted average>,
  "critical_issues": ["string"],
  "improvement_hints": ["string"]
}

Scoring guidance:
- keyword_coverage: What % of JD ats_keywords appear naturally in the resume?
- relevance: Does the experience align with the role's responsibilities?
- impact: Are achievements quantified with STAR format?
- tone_match: Does the writing match the JD's seniority/culture?
- cover_letter_quality: Is it specific, compelling, non-generic?
- overall: 0.3*keyword_coverage + 0.25*relevance + 0.2*impact + 0.15*tone_match + 0.1*cover_letter_quality
"""


async def evaluator_agent(state: AgentState) -> AgentState:
    """Score the tailored resume and cover letter; generate improvement feedback."""
    logger.info(
        "[evaluator] session=%s iter=%d",
        state["session_id"],
        state.get("iteration_count", 0),
    )
    router = get_llm_router()
    errors = list(state.get("errors", []))
    model = state.get("model_routing", {}).get(
        AgentName.EVALUATOR.value, LLMModel.GPT_4O.value
    )

    user_msg = (
        f"## Target JD (Parsed)\n{json.dumps(state['parsed_jd'], indent=2)}\n\n"
        f"## Tailored Resume\n{state.get('tailored_resume', '')}\n\n"
        f"## Cover Letter\n{state.get('cover_letter', '')}"
    )

    try:
        result = await router.invoke_json(
            agent_name=AgentName.EVALUATOR.value,
            system_prompt=_EVALUATOR_SYSTEM,
            user_message=user_msg,
            session_id=state["session_id"],
            model_override=model,
        )
        raw_scores = result.get("scores", {})
        eval_scores = EvalScores(
            keyword_coverage=float(raw_scores.get("keyword_coverage", 0)),
            relevance=float(raw_scores.get("relevance", 0)),
            impact=float(raw_scores.get("impact", 0)),
            tone_match=float(raw_scores.get("tone_match", 0)),
            cover_letter_quality=float(raw_scores.get("cover_letter_quality", 0)),
            overall=float(result.get("overall", 0)),
        )
        eval_feedback = json.dumps({
            "critical_issues": result.get("critical_issues", []),
            "improvement_hints": result.get("improvement_hints", []),
        })
        logger.info(
            "[evaluator] overall=%.1f session=%s",
            eval_scores["overall"],
            state["session_id"],
        )
    except Exception as exc:
        logger.error("[evaluator] failed: %s", exc)
        errors.append(f"evaluator: {exc}")
        eval_scores = EvalScores(overall=0.0)
        eval_feedback = json.dumps({"critical_issues": [str(exc)], "improvement_hints": []})

    # Determine eval_status
    overall = eval_scores.get("overall", 0.0)
    iteration = state.get("iteration_count", 0)
    if overall >= cfg.evaluation.eval_score_threshold:
        status = EvalStatus.PASSED.value
    elif iteration >= cfg.evaluation.eval_max_iterations:
        status = EvalStatus.MAX_ITER_REACHED.value
    else:
        status = EvalStatus.IMPROVING.value

    return _merge(state, {
        "eval_scores": eval_scores,
        "eval_feedback": eval_feedback,
        "eval_status": status,
        "errors": errors,
    })


# ---------------------------------------------------------------------------
# Node 8: Improver
# ---------------------------------------------------------------------------

_IMPROVER_SYSTEM = """
You are a surgical editor. You do NOT rewrite from scratch.

You receive:
- Current resume draft
- Current cover letter draft
- Evaluator critical_issues and improvement_hints
- Target JD

Your job:
1. Address ONLY the listed critical_issues — preserve what is working
2. Make the minimum effective change for each issue
3. Record each change in change_log

Return ONLY a valid JSON object. No markdown.
Schema:
{
  "tailored_resume": "full updated resume as markdown string",
  "cover_letter": "full updated cover letter as plain text string",
  "change_log": ["description of each change made"]
}
"""


async def improvement_agent(state: AgentState) -> AgentState:
    """Surgically patch outputs based on evaluator feedback."""
    logger.info(
        "[improver] session=%s iter=%d",
        state["session_id"],
        state.get("iteration_count", 0),
    )
    router = get_llm_router()
    errors = list(state.get("errors", []))
    model = state.get("model_routing", {}).get(
        AgentName.IMPROVER.value, LLMModel.GPT_4O.value
    )

    user_msg = (
        f"## Current Resume\n{state.get('tailored_resume', '')}\n\n"
        f"## Current Cover Letter\n{state.get('cover_letter', '')}\n\n"
        f"## Evaluator Feedback\n{state.get('eval_feedback', '{}')}\n\n"
        f"## Target JD\n{json.dumps(state['parsed_jd'], indent=2)}"
    )

    iteration = state.get("iteration_count", 0) + 1
    existing_log: List[ChangeLogEntry] = list(state.get("change_log", []))

    try:
        result = await router.invoke_json(
            agent_name=AgentName.IMPROVER.value,
            system_prompt=_IMPROVER_SYSTEM,
            user_message=user_msg,
            session_id=state["session_id"],
            model_override=model,
        )
        tailored_resume = result.get("tailored_resume") or state.get("tailored_resume", "")
        cover_letter = result.get("cover_letter") or state.get("cover_letter", "")
        new_entries: List[ChangeLogEntry] = [
            ChangeLogEntry(
                iteration=iteration,
                target="resume/cover_letter",
                description=desc,
            )
            for desc in result.get("change_log", [])
        ]
        change_log = existing_log + new_entries
    except Exception as exc:
        logger.error("[improver] failed: %s", exc)
        errors.append(f"improver: {exc}")
        tailored_resume = state.get("tailored_resume", "")
        cover_letter = state.get("cover_letter", "")
        change_log = existing_log

    return _merge(state, {
        "tailored_resume": tailored_resume,
        "cover_letter": cover_letter,
        "iteration_count": iteration,
        "change_log": change_log,
        "eval_feedback": None,   # cleared; will be re-populated by evaluator
        "errors": errors,
    })


# ---------------------------------------------------------------------------
# Node 9: Packager
# ---------------------------------------------------------------------------


async def output_packager(state: AgentState) -> AgentState:
    """
    Persist the final application to memory and build the API response payload.
    """
    logger.info("[packager] session=%s", state["session_id"])
    memory = get_memory_service()
    embed_svc = get_embedding_service()
    errors = list(state.get("errors", []))

    resume_embedding: Optional[List[float]] = None
    try:
        resume_text = state.get("tailored_resume") or ""
        if resume_text:
            resume_embedding = await embed_svc.embed(resume_text[:2000])
    except Exception as exc:
        logger.warning("[packager] embedding failed: %s", exc)
        errors.append(f"packager: embedding — {exc}")

    try:
        await memory.store_application(
            session_id=state["session_id"],
            jd_role=state["parsed_jd"].get("role_title", "Unknown"),
            company=state["parsed_jd"].get("company_name", "Unknown"),
            final_scores=state.get("eval_scores", {}),
            iterations=state.get("iteration_count", 0),
            resume_snapshot=state.get("tailored_resume", ""),
            cover_snapshot=state.get("cover_letter", ""),
            resume_embedding=resume_embedding,
        )
    except Exception as exc:
        logger.error("[packager] memory store failed: %s", exc)
        errors.append(f"packager: memory store — {exc}")

    final_output: Dict[str, Any] = {
        "session_id": state["session_id"],
        "tailored_resume": state.get("tailored_resume", ""),
        "cover_letter": state.get("cover_letter", ""),
        "eval_scores": state.get("eval_scores", {}),
        "iterations_used": state.get("iteration_count", 0),
        "change_log": state.get("change_log", []),
        "errors": errors,
        "generated_at": datetime.utcnow().isoformat(),
    }

    return _merge(state, {
        "final_output": final_output,
        "eval_status": EvalStatus.PASSED.value,
        "errors": errors,
    })


# ---------------------------------------------------------------------------
# Conditional routing
# ---------------------------------------------------------------------------


def route_eval(state: AgentState) -> str:
    """
    Routing function called after the evaluator node.

    Returns:
        "improve" if score is below threshold and max iterations not reached.
        "done"    otherwise.
    """
    overall = state.get("eval_scores", {}).get("overall", 0.0)
    iteration = state.get("iteration_count", 0)
    threshold = cfg.evaluation.eval_score_threshold
    max_iter = cfg.evaluation.eval_max_iterations

    if overall >= threshold:
        logger.info(
            "[route_eval] PASSED — score=%.1f >= threshold=%.1f", overall, threshold
        )
        return "done"

    if iteration >= max_iter:
        logger.warning(
            "[route_eval] MAX_ITER — score=%.1f iteration=%d >= max=%d",
            overall, iteration, max_iter,
        )
        return "done"

    logger.info(
        "[route_eval] IMPROVE — score=%.1f < threshold=%.1f iteration=%d",
        overall, threshold, iteration,
    )
    return "improve"


# ---------------------------------------------------------------------------
# Graph assembly
# ---------------------------------------------------------------------------


def build_graph() -> StateGraph:
    """
    Assemble and return the compiled LangGraph StateGraph.

    This function is called once at module load.  The resulting compiled
    graph object is stored as ``workflow`` and imported by the API layer.
    """
    builder: StateGraph = StateGraph(AgentState)

    # ── Register nodes ─────────────────────────────────────────────────
    builder.add_node(AgentName.PLANNER.value,      planner_agent)
    builder.add_node("ingest",                     ingest_node)
    builder.add_node(AgentName.JD_ANALYZER.value,  jd_analyzer_agent)
    builder.add_node(AgentName.RETRIEVAL.value,    retrieval_agent)
    builder.add_node(AgentName.RESUME_TAILOR.value, resume_tailor_agent)
    builder.add_node(AgentName.COVER_LETTER.value, cover_letter_agent)
    builder.add_node(AgentName.EVALUATOR.value,    evaluator_agent)
    builder.add_node(AgentName.IMPROVER.value,     improvement_agent)
    builder.add_node(AgentName.PACKAGER.value,     output_packager)

    # ── Entry point ─────────────────────────────────────────────────────
    builder.set_entry_point("ingest")

    # ── Sequential edges ────────────────────────────────────────────────
    builder.add_edge("ingest",                     AgentName.PLANNER.value)
    builder.add_edge(AgentName.PLANNER.value,      AgentName.JD_ANALYZER.value)
    builder.add_edge(AgentName.JD_ANALYZER.value,  AgentName.RETRIEVAL.value)

    # ── Parallel fork: retrieval → resume_tailor AND cover_letter ───────
    builder.add_edge(AgentName.RETRIEVAL.value,    AgentName.RESUME_TAILOR.value)
    builder.add_edge(AgentName.RETRIEVAL.value,    AgentName.COVER_LETTER.value)

    # ── Join: both parallel branches → evaluator ────────────────────────
    # LangGraph will wait for both branches to complete before invoking evaluator
    builder.add_edge(AgentName.RESUME_TAILOR.value, AgentName.EVALUATOR.value)
    builder.add_edge(AgentName.COVER_LETTER.value,  AgentName.EVALUATOR.value)

    # ── Conditional: evaluator → (improver | packager) ──────────────────
    builder.add_conditional_edges(
        AgentName.EVALUATOR.value,
        route_eval,
        {
            "improve": AgentName.IMPROVER.value,
            "done":    AgentName.PACKAGER.value,
        },
    )

    # ── Loop back: improver feeds into resume_tailor + cover_letter ─────
    builder.add_edge(AgentName.IMPROVER.value, AgentName.RESUME_TAILOR.value)
    builder.add_edge(AgentName.IMPROVER.value, AgentName.COVER_LETTER.value)

    # ── Terminal ─────────────────────────────────────────────────────────
    builder.add_edge(AgentName.PACKAGER.value, END)

    return builder


# ---------------------------------------------------------------------------
# Compiled workflow (module-level singleton — import this in the API layer)
# ---------------------------------------------------------------------------

workflow = build_graph().compile()