"""
backend/routes/interviews.py

Interview management endpoints for CareerOS AI.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Interviews"])


# ── Models ──────────────────────────────────────────────────────────────────

class InterviewCreate(BaseModel):
    user_id: str
    company: str
    role: str
    interview_type: str = Field(default="Technical")
    scheduled_at: Optional[str] = None
    notes: Optional[str] = None

class InterviewUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    outcome: Optional[str] = None
    prep_score: Optional[int] = None

class PrepQuestion(BaseModel):
    user_id: str
    company: str
    role: str
    interview_type: str = "System Design"
    num_questions: int = Field(default=5, ge=1, le=20)


# ── Routes ──────────────────────────────────────────────────────────────────

@router.get("/interviews/{user_id}")
async def list_interviews(user_id: str) -> Dict[str, Any]:
    """List all interviews for a user."""
    # In production: query MongoDB. Returns sample data for demo.
    return {
        "user_id": user_id,
        "interviews": [
            {
                "id": "i1",
                "company": "Anthropic",
                "role": "Staff ML Infrastructure Engineer",
                "interview_type": "System Design",
                "status": "Scheduled",
                "scheduled_at": "2026-07-01T15:00:00Z",
                "prep_score": 84,
            },
            {
                "id": "i2",
                "company": "OpenAI",
                "role": "Senior Backend Engineer",
                "interview_type": "Technical + LeetCode",
                "status": "Upcoming",
                "scheduled_at": "2026-07-03T14:30:00Z",
                "prep_score": 61,
            },
        ],
        "total": 2,
    }


@router.post("/interviews", status_code=status.HTTP_201_CREATED)
async def create_interview(body: InterviewCreate) -> Dict[str, Any]:
    """Schedule a new interview."""
    interview_id = f"iv_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    return {
        "id": interview_id,
        "user_id": body.user_id,
        "company": body.company,
        "role": body.role,
        "interview_type": body.interview_type,
        "status": "Scheduled",
        "scheduled_at": body.scheduled_at,
        "notes": body.notes,
        "prep_score": 0,
        "created_at": datetime.utcnow().isoformat(),
    }


@router.patch("/interviews/{interview_id}")
async def update_interview(interview_id: str, body: InterviewUpdate) -> Dict[str, Any]:
    """Update interview status, notes, or outcome."""
    return {
        "id": interview_id,
        "updated": True,
        **body.model_dump(exclude_none=True),
    }


@router.post("/interviews/prep-questions")
async def generate_prep_questions(body: PrepQuestion) -> Dict[str, Any]:
    """
    Generate AI interview preparation questions.
    In production routes through the LLM pipeline.
    """
    sample_questions = {
        "System Design": [
            f"Design a distributed job queue for {body.company}'s scale — handle 100K concurrent pipeline executions with exactly-once semantics.",
            "How would you architect a vector similarity search service supporting 50M embeddings at sub-100ms p99?",
            "Walk me through a multi-agent orchestration system — state management, retries, partial failure handling.",
            "Design a real-time ATS scoring service processing 10K resumes/minute with ML inference.",
            "How do you implement distributed rate limiting across a microservices fleet?",
        ],
        "Technical + LeetCode": [
            "Implement an LRU cache with O(1) get and put. What's the optimal data structure?",
            "Given a stream of application events, find the top-K companies by application volume in real time.",
            "Design a trie-based autocomplete for job title search with frequency ranking.",
            "Implement async task retry with exponential backoff in Python.",
            "How would you detect a cycle in a directed graph of agent dependencies?",
        ],
        "Behavioural": [
            f"Tell me about a time you disagreed with a technical decision at {body.company}'s scale.",
            "Describe a project where you had to balance speed and quality under a tight deadline.",
            "How do you handle ambiguity when requirements are unclear?",
            "Give an example of a failure and what you learned from it.",
            "How do you influence teams without direct authority?",
        ],
    }

    questions = sample_questions.get(
        body.interview_type,
        sample_questions["System Design"]
    )[:body.num_questions]

    return {
        "company": body.company,
        "role": body.role,
        "interview_type": body.interview_type,
        "questions": questions,
        "generated_at": datetime.utcnow().isoformat(),
    }
