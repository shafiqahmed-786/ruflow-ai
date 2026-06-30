"""
backend/routes/recruiters.py

Recruiter CRM endpoints for CareerOS AI.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Recruiters"])


class RecruiterCreate(BaseModel):
    user_id: str
    name: str
    title: str
    company: str
    email: Optional[str] = None
    linkedin: Optional[str] = None
    notes: Optional[str] = None

class FollowUpRequest(BaseModel):
    user_id: str
    recruiter_id: str
    recruiter_name: str
    company: str
    context: Optional[str] = None
    days_since_contact: int = 7


@router.get("/recruiters/{user_id}")
async def list_recruiters(user_id: str) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "recruiters": [
            {"id": "r1", "name": "Sarah Chen",     "title": "Senior Recruiter",      "company": "Anthropic",  "status": "Active",  "last_contact": "Today",      "messages": 6},
            {"id": "r2", "name": "Mike Patel",     "title": "Technical Recruiter",   "company": "OpenAI",     "status": "Replied", "last_contact": "2 days ago", "messages": 3},
            {"id": "r3", "name": "Jessica Lau",    "title": "Talent Partner",        "company": "Stripe",     "status": "Warm",    "last_contact": "4 days ago", "messages": 2},
            {"id": "r4", "name": "Priya Krishnan", "title": "Senior TA Manager",     "company": "Perplexity", "status": "Active",  "last_contact": "3 days ago", "messages": 4},
        ],
        "total": 4,
    }


@router.post("/recruiters", status_code=status.HTTP_201_CREATED)
async def create_recruiter(body: RecruiterCreate) -> Dict[str, Any]:
    return {
        "id": f"r_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        **body.model_dump(),
        "status": "Cold",
        "messages": 0,
        "created_at": datetime.utcnow().isoformat(),
    }


@router.post("/recruiters/follow-up")
async def generate_follow_up(body: FollowUpRequest) -> Dict[str, Any]:
    """Generate an AI follow-up email for a recruiter."""
    email = f"""Subject: Following Up — {body.company} Opportunity

Hi {body.recruiter_name.split()[0]},

I hope this finds you well. I wanted to follow up on our conversation from {body.days_since_contact} days ago regarding opportunities at {body.company}.

I remain very excited about the potential to contribute to {body.company}'s engineering team. Since we last spoke, I've {body.context or 'continued deepening my work on distributed AI systems and multi-agent orchestration'}.

Would you have 15 minutes this week to reconnect? I'm flexible on timing and happy to work around your schedule.

Thank you for your time,
[Your Name]"""

    return {
        "recruiter_id": body.recruiter_id,
        "email_draft": email,
        "generated_at": datetime.utcnow().isoformat(),
    }
