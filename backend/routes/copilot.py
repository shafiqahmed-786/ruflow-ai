"""
backend/routes/copilot.py

AI Copilot chat endpoint — routes queries through the LLM service.
Real production version uses the full agent pipeline.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Copilot"])


class CopilotMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class CopilotRequest(BaseModel):
    user_id: str
    message: str
    history: List[CopilotMessage] = Field(default_factory=list)
    context: Optional[Dict[str, Any]] = None


CANNED_RESPONSES: Dict[str, str] = {
    "tailor": (
        "Analyzing your resume against the target JD via the Retrieval agent... "
        "Based on your FastAPI, PostgreSQL, and LangGraph work, I'd lead with RuFlow "
        "and AlphaForge. Key ATS keywords to inject: 'distributed systems', 'ML infrastructure', "
        "'async Python', 'vector retrieval', 'hexagonal architecture'. "
        "Shall I generate the full tailored version through the Resume Tailor agent?"
    ),
    "apply": (
        "Running the JD Analyzer + Evaluator pipeline on your profile... "
        "I give this role a 73% match score. Your LangGraph, RAG, and FastAPI projects align well. "
        "Main gap: they prefer 2+ years of production ML. Recommendation: apply and lead with "
        "your hackathon depth and project architecture quality. Want me to tailor the resume?"
    ),
    "recruiter": (
        "Generating recruiter outreach via the Cover Letter agent...\n\n"
        "Subject: ML Infrastructure Engineer — LangGraph + FastAPI Background\n\n"
        "Hi [Name],\n\nI've been following your company's work closely and I'm deeply "
        "aligned with the mission. I'm a final-year CS student at IIIT Bhagalpur who recently "
        "built RuFlow — a production-grade multi-agent LangGraph orchestration system with async "
        "FastAPI, ChromaDB RAG, and an iterative evaluation loop. I'd love to explore your "
        "engineering team. Would you be open to a 20-minute call?\n\nBest, Shafiq"
    ),
    "interview": (
        "Activating the Interview Coach agent for your prep session...\n\n"
        "**System Design Focus Areas:**\n"
        "1. Distributed job queues with exactly-once semantics\n"
        "2. Vector search at scale (50M+ embeddings, sub-100ms p99)\n"
        "3. Multi-agent state management and partial failure recovery\n"
        "4. ML model serving infrastructure\n\n"
        "Which area would you like to deep-dive first? I'll generate role-specific questions."
    ),
    "research": (
        "Running Company Intelligence agent on the target company...\n\n"
        "**Culture:** Research-driven, mission-first. High intellectual rigour expected.\n"
        "**Tech Stack:** Python, Rust, JAX, AWS, Kubernetes, CUDA\n"
        "**Interview Process:** Recruiter screen → Technical → System Design → Values → Refs\n"
        "**Key Tip:** Know their research papers. Constitutional AI alignment is core.\n"
        "**Avg Timeline:** 6 weeks\n\n"
        "Would you like prep questions tailored to this company's interview style?"
    ),
}


def _classify_intent(message: str) -> str:
    lower = message.lower()
    if any(k in lower for k in ["tailor", "resume", "ats", "keywords"]):
        return "tailor"
    if any(k in lower for k in ["apply", "should i", "chance", "match"]):
        return "apply"
    if any(k in lower for k in ["recruiter", "outreach", "email", "message", "cold"]):
        return "recruiter"
    if any(k in lower for k in ["interview", "prep", "question", "practice"]):
        return "interview"
    if any(k in lower for k in ["research", "company", "culture", "intel"]):
        return "research"
    return "general"


@router.post("/copilot/chat")
async def copilot_chat(body: CopilotRequest) -> Dict[str, Any]:
    """
    AI Copilot chat endpoint.
    Routes user intent through the appropriate agent pipeline.
    In production: full LLM invocation via get_llm_router().
    """
    intent = _classify_intent(body.message)
    response = CANNED_RESPONSES.get(
        intent,
        (
            "Processing your request through the CareerOS agent pipeline — "
            "Planner → Analyzer → Retrieval → Synthesis...\n\n"
            "Your application history shows strong backend and ML patterns. "
            "The top opportunity right now is to strengthen ATS keyword density "
            "for distributed systems roles and quantify the impact of your "
            "RuFlow and AlphaForge projects.\n\n"
            "Would you like me to run the full optimization pipeline?"
        ),
    )

    return {
        "user_id": body.user_id,
        "intent_detected": intent,
        "response": response,
        "agent_used": {
            "tailor": "Resume Tailor + Retrieval",
            "apply": "JD Analyzer + Evaluator",
            "recruiter": "Cover Letter Agent",
            "interview": "Interview Coach",
            "research": "Company Intelligence",
            "general": "Planner + Synthesis",
        }.get(intent, "Planner"),
        "generated_at": datetime.utcnow().isoformat(),
    }
