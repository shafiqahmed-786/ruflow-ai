"""
backend/routes/companies.py

Company intelligence endpoints for CareerOS AI.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Companies"])


class CompanyResearchRequest(BaseModel):
    company_name: str
    focus_areas: List[str] = Field(default=["culture", "tech_stack", "interview_process"])


@router.get("/companies/{user_id}")
async def list_tracked_companies(user_id: str) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "companies": [
            {
                "id": "c1", "name": "Anthropic",   "stage": "Series E",
                "tech_stack": ["Python", "Rust", "AWS", "Kubernetes"],
                "interview_difficulty": "Hard", "rating": 4.8, "tracked": True,
            },
            {
                "id": "c2", "name": "OpenAI",      "stage": "Private",
                "tech_stack": ["Python", "Go", "Azure", "CUDA"],
                "interview_difficulty": "Hard", "rating": 4.6, "tracked": True,
            },
            {
                "id": "c3", "name": "Vercel",      "stage": "Series C",
                "tech_stack": ["TypeScript", "Rust", "Next.js"],
                "interview_difficulty": "Medium", "rating": 4.4, "tracked": True,
            },
            {
                "id": "c4", "name": "Perplexity",  "stage": "Series B",
                "tech_stack": ["Python", "TypeScript", "Ray", "Triton"],
                "interview_difficulty": "Medium", "rating": 4.3, "tracked": True,
            },
        ],
        "total": 4,
    }


@router.post("/companies/research")
async def research_company(body: CompanyResearchRequest) -> Dict[str, Any]:
    """
    AI-powered company research.
    In production: uses web search agent + LLM synthesis.
    """
    profiles: Dict[str, Dict[str, Any]] = {
        "anthropic": {
            "name": "Anthropic",
            "mission": "AI safety company building reliable, interpretable AI systems.",
            "culture": "Research-driven, mission-first. Exceptional intellectual rigour expected. High autonomy.",
            "tech_stack": ["Python", "Rust", "JAX", "AWS", "Kubernetes", "CUDA"],
            "interview_process": [
                "Recruiter screen (30 min)",
                "Technical phone screen (60 min — systems + ML)",
                "System design (90 min)",
                "Values & research alignment (60 min)",
                "Reference checks",
            ],
            "interview_tips": "Constitutional AI alignment is core. Know their research papers. Prepare STAR stories around mission-driven decisions.",
            "avg_process_weeks": 6,
        },
        "openai": {
            "name": "OpenAI",
            "mission": "Ensure AGI benefits all of humanity.",
            "culture": "Fast-paced, high-ownership. Ship mindset. Strong ML theory expected.",
            "tech_stack": ["Python", "Go", "C++", "Azure", "CUDA", "Triton"],
            "interview_process": [
                "Recruiter screen", "Technical screen (LC medium-hard)",
                "System design", "ML depth interview", "Bar raiser",
            ],
            "interview_tips": "Speed and scale matter. Expect ML theory depth questions. Process is 6-8 weeks.",
            "avg_process_weeks": 7,
        },
    }

    name_lower = body.company_name.lower()
    profile = profiles.get(name_lower, {
        "name": body.company_name,
        "mission": f"Information being researched for {body.company_name}.",
        "culture": "Research in progress — connect your CareerOS to live web search for real-time data.",
        "tech_stack": [],
        "interview_process": ["Recruiter screen", "Technical rounds", "Final interviews"],
        "interview_tips": "Research their latest product releases and engineering blog posts.",
        "avg_process_weeks": 4,
    })

    return {
        **profile,
        "researched_at": datetime.utcnow().isoformat(),
        "focus_areas": body.focus_areas,
    }
