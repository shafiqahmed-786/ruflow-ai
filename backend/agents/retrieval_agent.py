"""
backend/agents/retrieval_agent.py

Retrieval Agent — hybrid RAG over resume and JD knowledge bases.
Populates retrieved_resume_chunks, retrieved_jd_context, and company_intel.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

from backend.config.settings import get_settings
from backend.orchestrator.state import (
    AgentName,
    AgentState,
    LLMModel,
    RetrievedChunk,
)
from backend.services.llm_service import get_llm_router
from backend.services.memory_service import get_memory_service
from backend.services.vector_db_service import EmbeddingService, get_embedding_service

logger = logging.getLogger(__name__)
cfg = get_settings()

# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

QUERY_EXPANSION_SYSTEM_PROMPT = """
You are a search query expansion expert.

Given a list of ATS keywords and a job role, generate 5 semantically diverse
search queries that would retrieve relevant resumes and job descriptions from
a vector database.

Return ONLY a JSON array of strings. No markdown. No explanation.
Example: ["senior python engineer machine learning", "ML platform backend 5 years", ...]
"""

COMPANY_INTEL_SYSTEM_PROMPT = """
You are a research analyst. Given a company name and job role, provide a
concise 2-3 paragraph summary covering:
1. Company mission, core product, and business model
2. Engineering culture, tech stack, and team structure (if known)
3. Recent notable news, growth trajectory, or strategic direction

If you have limited information, state that clearly rather than fabricating.
Write in plain prose — no headers, no bullet points.
"""

# ---------------------------------------------------------------------------
# Query builder
# ---------------------------------------------------------------------------


def _build_base_jd_query(state: AgentState) -> str:
    """Construct a baseline query string from parsed JD fields."""
    jd = state.get("parsed_jd") or {}
    parts: List[str] = []

    role = jd.get("role_title") or ""
    if role:
        parts.append(role)

    seniority = jd.get("seniority_level") or ""
    if seniority and seniority != "unknown":
        parts.append(seniority)

    keywords = (jd.get("ats_keywords") or [])[:15]
    parts.extend(keywords)

    tech = (jd.get("tech_stack") or [])[:8]
    parts.extend(tech)

    return " ".join(parts) if parts else (state.get("raw_jd_text") or "")[:400]


def _build_resume_query(state: AgentState) -> str:
    """Construct a query string from the candidate profile."""
    profile = state.get("candidate_profile") or {}
    skills  = (profile.get("skills") or [])[:20]
    summary = (profile.get("summary") or "")[:200]
    jd      = state.get("parsed_jd") or {}
    role    = jd.get("role_title") or ""

    parts: List[str] = []
    if role:
        parts.append(role)
    if summary:
        parts.append(summary)
    parts.extend(skills)
    return " ".join(parts)


# ---------------------------------------------------------------------------
# Query expansion via LLM
# ---------------------------------------------------------------------------


async def _expand_queries(
    base_query: str,
    jd_keywords: List[str],
    role: str,
    session_id: str,
) -> List[str]:
    """
    Use the LLM to generate semantically diverse query variants.
    Falls back to [base_query] if the call fails.
    """
    router = get_llm_router()
    user_msg = (
        f"Role: {role}\n"
        f"Base query: {base_query[:300]}\n"
        f"Top keywords: {', '.join(jd_keywords[:20])}"
    )
    try:
        import json as _json
        response = await router.invoke(
            agent_name=AgentName.RETRIEVAL.value,
            system_prompt=QUERY_EXPANSION_SYSTEM_PROMPT,
            user_message=user_msg,
            session_id=session_id,
            model_override=LLMModel.GPT_4O_MINI.value,
        )
        raw = response.content.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            lines = raw.splitlines()
            raw = "\n".join(
                lines[1:] if lines[0].startswith("```") else lines
            )
            raw = raw.rstrip("`").strip()
        queries: List[str] = _json.loads(raw)
        if isinstance(queries, list) and all(isinstance(q, str) for q in queries):
            # Always include the original
            return [base_query, *queries[:4]]
    except Exception as exc:
        logger.warning("[retrieval] query expansion failed: %s", exc)
    return [base_query]


# ---------------------------------------------------------------------------
# Vector search helpers
# ---------------------------------------------------------------------------


async def _vector_search_jds(
    embed_svc: EmbeddingService,
    queries: List[str],
    top_k: int,
) -> List[RetrievedChunk]:
    """
    Run multiple query embeddings against the JD collection and merge results,
    deduplicating by text content.
    """
    memory = get_memory_service()
    seen_texts: set = set()
    merged: List[RetrievedChunk] = []

    for query in queries[:3]:  # cap at 3 queries to limit API calls
        try:
            q_vec = await embed_svc.embed(query[:512])
            results = await memory.find_similar_jds(q_vec, top_k=top_k)
            for r in results:
                text = r.get("document", "")
                if text and text not in seen_texts:
                    seen_texts.add(text)
                    merged.append(
                        RetrievedChunk(
                            text=text,
                            source="vector_db",
                            score=1.0 - float(r.get("distance", 1.0)),
                            metadata=r.get("metadata") or {},
                        )
                    )
        except Exception as exc:
            logger.warning("[retrieval] JD vector search failed for query '%s': %s", query[:60], exc)

    # Sort by score descending
    merged.sort(key=lambda c: c["score"], reverse=True)
    return merged[:top_k]


async def _vector_search_resumes(
    embed_svc: EmbeddingService,
    query: str,
    top_k: int,
) -> List[RetrievedChunk]:
    """Run resume vector search for a single query."""
    memory = get_memory_service()
    try:
        q_vec = await embed_svc.embed(query[:512])
        results = await memory.find_similar_resumes(q_vec, top_k=top_k)
        return [
            RetrievedChunk(
                text=r.get("document", ""),
                source="vector_db",
                score=1.0 - float(r.get("distance", 1.0)),
                metadata=r.get("metadata") or {},
            )
            for r in results
            if r.get("document")
        ]
    except Exception as exc:
        logger.warning("[retrieval] resume vector search failed: %s", exc)
        return []


# ---------------------------------------------------------------------------
# Company intel
# ---------------------------------------------------------------------------


async def _fetch_company_intel(
    company: str,
    role: str,
    session_id: str,
) -> Optional[str]:
    """
    Synthesise company intel using the LLM's parametric knowledge.
    This is a best-effort call; failures are silently skipped.
    """
    if not company or company.lower() in {"unknown", "n/a", ""}:
        return None

    router = get_llm_router()
    try:
        response = await router.invoke(
            agent_name=AgentName.RETRIEVAL.value,
            system_prompt=COMPANY_INTEL_SYSTEM_PROMPT,
            user_message=f"Company: {company}\nRole applied for: {role}",
            session_id=session_id,
            model_override=LLMModel.GPT_4O_MINI.value,
        )
        intel = response.content.strip()
        return intel if intel else None
    except Exception as exc:
        logger.warning("[retrieval] company intel failed for '%s': %s", company, exc)
        return None


# ---------------------------------------------------------------------------
# Node
# ---------------------------------------------------------------------------


async def retrieval_node(state: AgentState) -> AgentState:
    """
    LangGraph node: Retrieval Agent.

    Reads:  parsed_jd, candidate_profile, model_routing
    Writes: retrieved_jd_context, retrieved_resume_chunks, company_intel
    """
    session_id = state["session_id"]
    logger.info("[retrieval] START session=%s", session_id)

    embed_svc = get_embedding_service()
    errors: List[str] = list(state.get("errors") or [])
    top_k = cfg.retrieval.retrieval_top_k

    jd       = state.get("parsed_jd") or {}
    role     = jd.get("role_title") or "Software Engineer"
    company  = jd.get("company_name") or "Unknown"
    keywords = jd.get("ats_keywords") or []

    # ── Build queries ───────────────────────────────────────────────────
    jd_base_query     = _build_base_jd_query(state)
    resume_base_query = _build_resume_query(state)

    # ── Parallel: query expansion + company intel ───────────────────────
    try:
        expanded_queries, company_intel = await asyncio.gather(
            _expand_queries(jd_base_query, keywords, role, session_id),
            _fetch_company_intel(company, role, session_id)
            if cfg.retrieval.web_search_enabled
            else asyncio.coroutine(lambda: None)(),
        )
    except Exception as exc:
        logger.warning("[retrieval] parallel pre-fetch error: %s", exc)
        expanded_queries = [jd_base_query]
        company_intel    = None
        errors.append(f"retrieval:pre_fetch:{exc}")

    # ── Parallel: JD vector search + resume vector search ───────────────
    retrieved_jd_context:      List[RetrievedChunk] = []
    retrieved_resume_chunks:   List[RetrievedChunk] = []

    try:
        jd_results, resume_results = await asyncio.gather(
            _vector_search_jds(embed_svc, expanded_queries, top_k),
            _vector_search_resumes(embed_svc, resume_base_query, top_k),
        )
        retrieved_jd_context    = jd_results
        retrieved_resume_chunks = resume_results
    except Exception as exc:
        logger.error("[retrieval] vector search error: %s", exc)
        errors.append(f"retrieval:vector:{exc}")

    logger.info(
        "[retrieval] jd_chunks=%d resume_chunks=%d company_intel=%s session=%s",
        len(retrieved_jd_context),
        len(retrieved_resume_chunks),
        "yes" if company_intel else "no",
        session_id,
    )

    return {
        **state,  # type: ignore[misc]
        "retrieved_jd_context":    retrieved_jd_context,
        "retrieved_resume_chunks": retrieved_resume_chunks,
        "company_intel":           company_intel,
        "errors":                  errors,
    }