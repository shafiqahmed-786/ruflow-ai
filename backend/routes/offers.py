"""
backend/routes/offers.py

Offer tracking and comparison endpoints for CareerOS AI.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Offers"])


class OfferCreate(BaseModel):
    user_id: str
    company: str
    role: str
    base_salary: int
    equity_percent: Optional[float] = None
    bonus: Optional[int] = None
    sign_on: Optional[int] = None
    deadline: Optional[str] = None
    notes: Optional[str] = None

class OfferCompareRequest(BaseModel):
    user_id: str
    offer_ids: List[str]


@router.get("/offers/{user_id}")
async def list_offers(user_id: str) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "offers": [
            {
                "id": "o1", "company": "Perplexity", "role": "ML Platform Lead",
                "base": 170000, "equity_pct": 0.12, "bonus": 20000,
                "total_tc": 210000, "deadline": "2026-07-05", "status": "Active", "ai_score": 88,
            },
            {
                "id": "o2", "company": "Stripe", "role": "Staff Software Engineer",
                "base": 195000, "equity_pct": 0.08, "bonus": 30000,
                "total_tc": 265000, "deadline": "2026-07-10", "status": "Active", "ai_score": 92,
            },
        ],
        "total": 2,
    }


@router.post("/offers", status_code=status.HTTP_201_CREATED)
async def create_offer(body: OfferCreate) -> Dict[str, Any]:
    total_tc = body.base_salary + (body.bonus or 0)
    return {
        "id": f"o_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        **body.model_dump(),
        "total_tc": total_tc,
        "status": "Active",
        "ai_score": None,
        "created_at": datetime.utcnow().isoformat(),
    }


@router.post("/offers/compare")
async def compare_offers(body: OfferCompareRequest) -> Dict[str, Any]:
    """AI-powered offer comparison and negotiation advice."""
    return {
        "user_id": body.user_id,
        "offer_ids": body.offer_ids,
        "analysis": {
            "winner_short_term": "Stripe",
            "winner_long_term": "Context-dependent — Perplexity equity upside may exceed Stripe at 4-year vest if company reaches $10B+ valuation.",
            "tc_delta_pct": 26,
            "negotiation_advice": [
                "Stripe historically accepts counter-offers within 8% of base. Counter at $210k.",
                "Perplexity's equity is negotiable by 20-30% for engineering leadership — ask for 0.15%.",
                "Request sign-on bonus ($30-50k) from whichever offer you decline, to buy time.",
            ],
            "key_non_monetary_factors": [
                "Perplexity: higher ownership, faster growth trajectory, smaller team.",
                "Stripe: stronger brand for future fundraising/founding, larger eng org, more mentorship.",
            ],
        },
        "generated_at": datetime.utcnow().isoformat(),
    }
