"""
backend/routes/analytics.py

Career analytics and ATS trend endpoints for CareerOS AI.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Analytics"])


@router.get("/analytics/{user_id}/ats-trend")
async def get_ats_trend(user_id: str) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "trend": [
            {"week": "W1", "score": 71},
            {"week": "W2", "score": 76},
            {"week": "W3", "score": 79},
            {"week": "W4", "score": 82},
            {"week": "W5", "score": 85},
            {"week": "W6", "score": 86.4},
        ],
        "current_avg": 86.4,
        "improvement": 15.4,
    }


@router.get("/analytics/{user_id}/funnel")
async def get_application_funnel(user_id: str) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "funnel": [
            {"stage": "Applied",      "count": 24, "conversion_pct": 100},
            {"stage": "Screening",    "count": 14, "conversion_pct": 58},
            {"stage": "Interview",    "count": 7,  "conversion_pct": 29},
            {"stage": "Final Round",  "count": 3,  "conversion_pct": 12},
            {"stage": "Offer",        "count": 1,  "conversion_pct": 4},
        ],
        "offer_conversion_rate": 4.2,
        "industry_avg_offer_rate": 2.8,
    }


@router.get("/analytics/{user_id}/career-summary")
async def get_career_summary(user_id: str) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "summary": {
            "total_applications": 24,
            "active_pipelines": 7,
            "avg_ats_score": 86.4,
            "best_ats_score": 94,
            "interview_rate_pct": 29,
            "offer_rate_pct": 4,
            "active_offers": 2,
            "recruiter_contacts": 18,
        },
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.get("/analytics/{user_id}/score-breakdown")
async def get_score_breakdown(user_id: str) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "breakdown": [
            {"dimension": "Keyword Coverage", "score": 88, "weight": 0.35},
            {"dimension": "Relevance",        "score": 84, "weight": 0.30},
            {"dimension": "Impact Metrics",   "score": 79, "weight": 0.20},
            {"dimension": "Tone Match",       "score": 91, "weight": 0.15},
        ],
        "weighted_total": 86.4,
    }
