"""
backend/routes/memory.py

FastAPI router for memory management endpoints.

Routes:
  GET    /memory/stats/{user_id}
  POST   /memory/optimize
  GET    /memory/patterns/{user_id}
  DELETE /memory/clear/{user_id}
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.services.memory_optimizer import MemoryOptimizer, get_memory_optimizer
from backend.services.pattern_extractor import PatternExtractor, get_pattern_extractor
from backend.services.memory_service import MemoryService, get_memory_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/memory", tags=["memory"])


# ---------------------------------------------------------------------------
# Dependency providers
# ---------------------------------------------------------------------------


def _get_optimizer() -> MemoryOptimizer:
    return get_memory_optimizer()


def _get_extractor() -> PatternExtractor:
    return get_pattern_extractor()


def _get_memory() -> MemoryService:
    return get_memory_service()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class MemoryStatsResponse(BaseModel):
    user_id:             str
    total_applications:  int
    cached_items:        int
    vector_db_size:      int
    success_rate:        float
    avg_score:           Optional[float] = None
    cache_hit_rate:      float


class OptimizeRequest(BaseModel):
    dry_run:             bool  = Field(default=False, description="Report what would be done without executing")
    prune_below_score:   Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Delete records below this score (defaults to instance threshold)",
    )


class OptimizeResponse(BaseModel):
    optimized:              bool
    applications_embedded:  int
    applications_pruned:    int
    cache_stats:            Dict[str, Any]
    analytics:              Dict[str, Any]
    dry_run:                bool
    ran_at:                 str


class KeywordPatternItem(BaseModel):
    keyword:     str
    total_freq:  Optional[int]   = None
    avg_score:   Optional[float] = None
    appearances: Optional[int]   = None


class PatternsResponse(BaseModel):
    user_id:           str
    top_keywords:      List[str]
    top_tone_markers:  Dict[str, float]
    top_structures:    Dict[str, Any]
    pattern_count:     int


class ClearRequest(BaseModel):
    confirm:       bool  = Field(..., description="Must be True to execute the operation")
    clear_history: bool  = Field(default=False, description="Also delete MongoDB application records")


class ClearResponse(BaseModel):
    cleared:       bool
    items_removed: int
    message:       str


# ---------------------------------------------------------------------------
# GET /stats/{user_id}
# ---------------------------------------------------------------------------


@router.get(
    "/stats/{user_id}",
    response_model=MemoryStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve memory statistics for a user",
    responses={
        200: {"description": "Memory stats returned successfully"},
        404: {"description": "No records found for user_id"},
        500: {"description": "Internal service error"},
    },
)
async def get_memory_stats(
    user_id:   str,
    optimizer: MemoryOptimizer = Depends(_get_optimizer),
    memory:    MemoryService   = Depends(_get_memory),
) -> MemoryStatsResponse:
    """
    Return aggregated memory statistics for a given user_id.

    Combines:
      - Application count from MongoDB
      - Cache entry count from in-memory LRU cache
      - Success rate computed from stored scores
      - Cache hit rate from optimizer stats
    """
    if not user_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id must not be empty.",
        )

    # Fetch records
    try:
        records = await memory.retrieve_past_applications(limit=200)
    except Exception as exc:
        logger.error("[/memory/stats] DB error user=%s: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve application records: {exc}",
        )

    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No application records found for user_id='{user_id}'.",
        )

    # Compute success rate and avg score
    scores = [
        float((r.get("final_scores") or {}).get("overall", 0.0) or 0.0)
        for r in records
    ]
    success_rate = (
        round(sum(1 for s in scores if s >= 80.0) / len(scores), 4)
        if scores else 0.0
    )
    avg_score = round(sum(scores) / len(scores), 2) if scores else None

    # Cache stats
    try:
        cache_stats = await optimizer.get_cache_stats()
    except Exception as exc:
        logger.warning("[/memory/stats] cache_stats failed: %s", exc)
        cache_stats = {}

    # ChromaDB size estimate — count via stored records (proxy)
    vector_db_size = len(records)

    return MemoryStatsResponse(
        user_id            = user_id,
        total_applications = len(records),
        cached_items       = cache_stats.get("size", 0),
        vector_db_size     = vector_db_size,
        success_rate       = success_rate,
        avg_score          = avg_score,
        cache_hit_rate     = float(cache_stats.get("hit_rate", 0.0)),
    )


# ---------------------------------------------------------------------------
# POST /optimize
# ---------------------------------------------------------------------------


@router.post(
    "/optimize",
    response_model=OptimizeResponse,
    status_code=status.HTTP_200_OK,
    summary="Run a full memory optimization pass",
    responses={
        200: {"description": "Optimization complete"},
        500: {"description": "Optimization failed"},
    },
)
async def optimize_memory(
    body:      OptimizeRequest,
    optimizer: MemoryOptimizer = Depends(_get_optimizer),
) -> OptimizeResponse:
    """
    Trigger a full optimization pass:
      1. Batch-embed any resumes not yet in ChromaDB.
      2. Run MongoDB aggregation analytics.
      3. Prune low-scoring records (unless dry_run=True).

    Safe to call repeatedly — idempotent for already-embedded records.
    """
    try:
        result = await optimizer.optimize_storage(
            prune_below_score=body.prune_below_score,
            dry_run=body.dry_run,
        )
    except Exception as exc:
        logger.exception("[/memory/optimize] error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Optimization failed: {exc}",
        )

    try:
        cache_stats = await optimizer.get_cache_stats()
    except Exception:
        cache_stats = {}

    return OptimizeResponse(
        optimized             = True,
        applications_embedded = result.get("embedded_count", 0),
        applications_pruned   = result.get("pruned_count", 0),
        cache_stats           = cache_stats,
        analytics             = result.get("analytics", {}),
        dry_run               = result.get("dry_run", body.dry_run),
        ran_at                = result.get("ran_at", ""),
    )


# ---------------------------------------------------------------------------
# GET /patterns/{user_id}
# ---------------------------------------------------------------------------


@router.get(
    "/patterns/{user_id}",
    response_model=PatternsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get extracted writing patterns for a user",
    responses={
        200: {"description": "Pattern data returned successfully"},
        404: {"description": "No patterns found for user_id"},
        500: {"description": "Pattern retrieval failed"},
    },
)
async def get_patterns(
    user_id:   str,
    min_score: float = 75.0,
    limit:     int   = 20,
    extractor: PatternExtractor = Depends(_get_extractor),
) -> PatternsResponse:
    """
    Retrieve aggregated writing patterns extracted from high-scoring
    applications for this user.

    Returns:
      - top_keywords:     Most valuable keywords by frequency × score
      - top_tone_markers: Aggregated tone signal strengths
      - top_structures:   Common structural traits
      - pattern_count:    Total pattern observations
    """
    if not user_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id must not be empty.",
        )

    if min_score < 0 or min_score > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="min_score must be between 0 and 100.",
        )

    # Keyword patterns
    try:
        kw_patterns = await extractor.get_top_patterns(
            pattern_type="keyword",
            top_n=limit,
            min_score=min_score,
        )
    except Exception as exc:
        logger.error("[/memory/patterns] keyword patterns failed user=%s: %s", user_id, exc)
        kw_patterns = []

    top_keywords = [p.get("keyword", "") for p in kw_patterns if p.get("keyword")]

    # Tone patterns
    top_tone_markers: Dict[str, float] = {}
    try:
        tone_patterns = await extractor.get_top_patterns(
            pattern_type="tone",
            top_n=10,
            min_score=min_score,
        )
        if tone_patterns:
            # Aggregate action_verbs frequency across pattern docs
            verb_counter: Dict[str, int] = {}
            for pat in tone_patterns:
                payload = pat.get("payload") or {}
                for verb in (payload.get("action_verbs") or []):
                    verb_counter[verb] = verb_counter.get(verb, 0) + 1
            total = sum(verb_counter.values()) or 1
            top_tone_markers = {
                verb: round(count / total, 4)
                for verb, count in sorted(
                    verb_counter.items(), key=lambda x: x[1], reverse=True
                )[:15]
            }
    except Exception as exc:
        logger.warning("[/memory/patterns] tone patterns failed user=%s: %s", user_id, exc)

    # Structure patterns
    top_structures: Dict[str, Any] = {}
    try:
        struct_patterns = await extractor.get_top_patterns(
            pattern_type="structure",
            top_n=10,
            min_score=min_score,
        )
        if struct_patterns:
            n = len(struct_patterns)
            payloads = [p.get("payload") or {} for p in struct_patterns]
            top_structures = {
                "avg_bullet_count": round(
                    sum(p.get("bullet_count", 0) for p in payloads) / n, 1
                ),
                "avg_quantification_rate": round(
                    sum(p.get("quantification_rate", 0.0) for p in payloads) / n, 3
                ),
                "avg_word_count": round(
                    sum(p.get("total_word_count", 0) for p in payloads) / n, 0
                ),
                "pct_with_summary": round(
                    sum(1 for p in payloads if p.get("has_summary")) / n, 3
                ),
                "pct_with_projects": round(
                    sum(1 for p in payloads if p.get("has_projects")) / n, 3
                ),
            }
    except Exception as exc:
        logger.warning("[/memory/patterns] structure patterns failed user=%s: %s", user_id, exc)

    pattern_count = len(kw_patterns) + len(top_tone_markers) + len(top_structures)

    if not top_keywords and not top_tone_markers and not top_structures:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"No patterns found for user_id='{user_id}' with "
                f"min_score={min_score}. Run more applications to build pattern history."
            ),
        )

    return PatternsResponse(
        user_id          = user_id,
        top_keywords     = top_keywords[:limit],
        top_tone_markers = top_tone_markers,
        top_structures   = top_structures,
        pattern_count    = pattern_count,
    )


# ---------------------------------------------------------------------------
# DELETE /clear/{user_id}
# ---------------------------------------------------------------------------


@router.delete(
    "/clear/{user_id}",
    response_model=ClearResponse,
    status_code=status.HTTP_200_OK,
    summary="Clear in-memory cache (and optionally application history)",
    responses={
        200: {"description": "Clear operation complete"},
        400: {"description": "confirm must be True"},
        500: {"description": "Clear operation failed"},
    },
)
async def clear_user_data(
    user_id:   str,
    body:      ClearRequest,
    optimizer: MemoryOptimizer = Depends(_get_optimizer),
    memory:    MemoryService   = Depends(_get_memory),
) -> ClearResponse:
    """
    Clear cached data for a user.

    - Always clears the in-memory LRU cache entries.
    - If clear_history=True, also deletes MongoDB application records.

    Requires confirm=True in the request body as a safety gate.
    """
    if not body.confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="confirm must be True to execute the clear operation.",
        )

    items_removed = 0

    # Clear in-memory cache
    try:
        removed = await optimizer.clear_cache()
        items_removed += removed
    except Exception as exc:
        logger.error("[/memory/clear] cache clear failed user=%s: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear cache: {exc}",
        )

    message_parts = [f"Cleared {items_removed} cache entries."]

    # Optionally clear MongoDB history
    if body.clear_history:
        try:
            await memory.mongo._ensure_connected()
            coll   = memory.mongo._applications
            result = await coll.delete_many({})
            deleted = result.deleted_count
            items_removed += deleted
            message_parts.append(f"Deleted {deleted} application records from MongoDB.")
        except Exception as exc:
            logger.error(
                "[/memory/clear] MongoDB clear failed user=%s: %s", user_id, exc
            )
            message_parts.append(f"MongoDB clear failed: {exc}")

    return ClearResponse(
        cleared       = True,
        items_removed = items_removed,
        message       = " ".join(message_parts),
    )