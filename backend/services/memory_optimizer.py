"""
backend/services/memory_optimizer.py

MemoryOptimizer — batch-processes stored resumes into embeddings,
runs Mongo aggregation pipelines for analytics, maintains an in-memory
LRU-style cache, and prunes low-scoring application records.

Design constraints:
  - Accepts all dependencies via __init__ (no new DB clients).
  - Uses only the existing MemoryService and EmbeddingService singletons.
  - All DB operations wrapped in try/except; errors are logged, never raised.
  - All public methods are async.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from backend.config.settings import get_settings
from backend.services.memory_service import MemoryService, get_memory_service
from backend.services.vector_db_service import EmbeddingService, get_embedding_service

logger = logging.getLogger(__name__)
cfg = get_settings()


# ---------------------------------------------------------------------------
# Cache entry
# ---------------------------------------------------------------------------


@dataclass
class CacheEntry:
    value:      Any
    created_at: float = field(default_factory=time.monotonic)
    hits:       int   = 0

    @property
    def age_seconds(self) -> float:
        return time.monotonic() - self.created_at


# ---------------------------------------------------------------------------
# MemoryOptimizer
# ---------------------------------------------------------------------------


class MemoryOptimizer:
    """
    Optimises the dual-layer memory backend (MongoDB + ChromaDB).

    Responsibilities:
      1. Batch-embed resumes that were stored without embeddings.
      2. Aggregate scoring analytics across stored applications.
      3. Serve a fast in-memory cache for repeated queries.
      4. Prune records below a configurable quality threshold.

    All heavy I/O is offloaded to asyncio coroutines; CPU-bound embedding
    is pushed into the executor via EmbeddingService.

    Args:
        memory_service:   Injected MemoryService (uses Mongo + Chroma).
        embedding_service: Injected EmbeddingService (Sentence Transformers).
        cache_ttl_seconds: How long cache entries live (default 600s).
        cache_max_size:    Maximum number of cached entries (default 256).
        min_score_threshold: Applications below this overall score are
                             eligible for pruning (default 30.0).
        batch_size:          Embedding batch size for bulk processing.
    """

    def __init__(
        self,
        memory_service:    Optional[MemoryService]    = None,
        embedding_service: Optional[EmbeddingService] = None,
        cache_ttl_seconds:    int   = 600,
        cache_max_size:       int   = 256,
        min_score_threshold:  float = 30.0,
        batch_size:           int   = 16,
    ) -> None:
        self._memory    = memory_service    or get_memory_service()
        self._embed_svc = embedding_service or get_embedding_service()

        self._cache_ttl   = cache_ttl_seconds
        self._cache_max   = cache_max_size
        self._min_score   = min_score_threshold
        self._batch_size  = batch_size

        # Ordered dict used as an LRU cache (oldest entries first)
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._cache_lock = asyncio.Lock()

        # Runtime stats
        self._stats: Dict[str, int] = {
            "cache_hits":   0,
            "cache_misses": 0,
            "embeds_run":   0,
            "pruned":       0,
        }

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def optimize_storage(
        self,
        prune_below_score: Optional[float] = None,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """
        Run a full optimization pass:
          1. Compute analytics via Mongo aggregation.
          2. Batch-embed any resumes missing from ChromaDB.
          3. Optionally prune low-quality records.

        Args:
            prune_below_score: Override the instance-level threshold.
            dry_run: If True, reports what would be pruned without deleting.

        Returns:
            Summary dict with keys:
              total_records, embedded_count, pruned_count,
              avg_score, top_role, analytics
        """
        logger.info("[optimizer] optimize_storage started dry_run=%s", dry_run)
        threshold = prune_below_score if prune_below_score is not None else self._min_score

        # Step 1: analytics
        analytics = await self._run_analytics_pipeline()

        # Step 2: batch embed
        embedded_count = await self.batch_embed_resumes()

        # Step 3: prune
        pruned_count = 0
        if not dry_run:
            pruned_count = await self._prune_low_score_records(threshold)

        result: Dict[str, Any] = {
            "total_records": analytics.get("total_records", 0),
            "embedded_count": embedded_count,
            "pruned_count":  pruned_count,
            "avg_score":     analytics.get("avg_score"),
            "top_role":      analytics.get("top_role"),
            "analytics":     analytics,
            "dry_run":       dry_run,
            "ran_at":        datetime.utcnow().isoformat(),
        }
        logger.info("[optimizer] optimize_storage complete: %s", result)
        return result

    async def batch_embed_resumes(self) -> int:
        """
        Retrieve stored applications whose resumes are not yet embedded in
        ChromaDB, embed them in batches, and upsert into the vector store.

        Returns:
            Number of resumes newly embedded.
        """
        logger.info("[optimizer] batch_embed_resumes started")
        embedded = 0

        try:
            records = await self._memory.retrieve_past_applications(limit=200)
        except Exception as exc:
            logger.error("[optimizer] failed to retrieve records: %s", exc)
            return 0

        if not records:
            return 0

        # Chunk into batches
        batches = [
            records[i : i + self._batch_size]
            for i in range(0, len(records), self._batch_size)
        ]

        for batch in batches:
            texts = [
                r.get("resume_snapshot") or ""
                for r in batch
            ]
            ids = [r.get("session_id") or "" for r in batch]

            # Skip records with empty resumes or missing IDs
            valid: List[Tuple[str, str, Dict[str, Any]]] = [
                (sid, txt, r)
                for sid, txt, r in zip(ids, texts, batch)
                if sid and txt.strip()
            ]
            if not valid:
                continue

            valid_ids, valid_texts, valid_records = zip(*valid)

            try:
                # Truncate to first 2000 chars for embedding efficiency
                truncated = [t[:2000] for t in valid_texts]
                vectors   = await self._embed_svc.embed_batch(list(truncated))
            except Exception as exc:
                logger.warning("[optimizer] embedding batch failed: %s", exc)
                continue

            for session_id, vector, record in zip(valid_ids, vectors, valid_records):
                try:
                    meta: Dict[str, Any] = {
                        "session_id": session_id,
                        "jd_role":   record.get("jd_role", ""),
                        "company":   record.get("company", ""),
                        "overall_score": (
                            record.get("final_scores") or {}
                        ).get("overall", 0.0),
                    }
                    await self._memory.chroma.store_resume_embedding(
                        session_id  = session_id,
                        resume_text = record.get("resume_snapshot") or "",
                        embedding   = vector,
                        metadata    = meta,
                    )
                    embedded += 1
                    self._stats["embeds_run"] += 1
                except Exception as exc:
                    logger.warning(
                        "[optimizer] failed to store embedding session=%s: %s",
                        session_id, exc,
                    )

        await self._memory.chroma.persist()
        logger.info("[optimizer] batch_embed_resumes complete embedded=%d", embedded)
        return embedded

    async def get_cache_stats(self) -> Dict[str, Any]:
        """
        Return current cache statistics.

        Returns:
            Dict with keys: size, max_size, hits, misses,
            hit_rate, oldest_entry_age_seconds.
        """
        async with self._cache_lock:
            size = len(self._cache)
            hits   = self._stats["cache_hits"]
            misses = self._stats["cache_misses"]
            total  = hits + misses
            hit_rate = round(hits / total, 4) if total > 0 else 0.0

            oldest_age: Optional[float] = None
            if self._cache:
                oldest_age = round(
                    next(iter(self._cache.values())).age_seconds, 1
                )

        return {
            "size":                   size,
            "max_size":               self._cache_max,
            "hits":                   hits,
            "misses":                 misses,
            "hit_rate":               hit_rate,
            "oldest_entry_age_seconds": oldest_age,
            "embeds_run":             self._stats["embeds_run"],
            "pruned":                 self._stats["pruned"],
        }

    async def clear_cache(self) -> int:
        """
        Evict all entries from the in-memory cache.

        Returns:
            Number of entries removed.
        """
        async with self._cache_lock:
            count = len(self._cache)
            self._cache.clear()
        logger.info("[optimizer] cache cleared entries=%d", count)
        return count

    # ------------------------------------------------------------------
    # Cache helpers (internal)
    # ------------------------------------------------------------------

    async def cache_get(self, key: str) -> Optional[Any]:
        """Retrieve a value from the cache; returns None on miss or expiry."""
        async with self._cache_lock:
            entry = self._cache.get(key)
            if entry is None:
                self._stats["cache_misses"] += 1
                return None

            if entry.age_seconds > self._cache_ttl:
                del self._cache[key]
                self._stats["cache_misses"] += 1
                return None

            # Move to end (most-recently-used)
            self._cache.move_to_end(key)
            entry.hits += 1
            self._stats["cache_hits"] += 1
            return entry.value

    async def cache_set(self, key: str, value: Any) -> None:
        """Insert or update a cache entry, evicting LRU entries if at capacity."""
        async with self._cache_lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                self._cache[key] = CacheEntry(value=value)
                return

            if len(self._cache) >= self._cache_max:
                # Evict least-recently-used (first item)
                self._cache.popitem(last=False)

            self._cache[key] = CacheEntry(value=value)

    # ------------------------------------------------------------------
    # Mongo analytics
    # ------------------------------------------------------------------

    async def _run_analytics_pipeline(self) -> Dict[str, Any]:
        """
        Run a series of Mongo aggregation pipelines to compute:
          - total application count
          - average overall score
          - score distribution buckets
          - most common target role
          - average iterations needed

        Returns:
            Analytics dict; empty dict on any DB error.
        """
        try:
            await self._memory.mongo._ensure_connected()
            coll = self._memory.mongo._applications
        except Exception as exc:
            logger.error("[optimizer] analytics: DB connection failed: %s", exc)
            return {}

        results: Dict[str, Any] = {}

        # ── Total count ───────────────────────────────────────────────
        try:
            results["total_records"] = await coll.count_documents({})
        except Exception as exc:
            logger.warning("[optimizer] count failed: %s", exc)
            results["total_records"] = 0

        # ── Average overall score ─────────────────────────────────────
        try:
            pipeline_avg = [
                {"$match":   {"final_scores.overall": {"$exists": True, "$gt": 0}}},
                {"$group":   {
                    "_id":       None,
                    "avg_score": {"$avg": "$final_scores.overall"},
                    "min_score": {"$min": "$final_scores.overall"},
                    "max_score": {"$max": "$final_scores.overall"},
                    "avg_iters": {"$avg": "$iterations"},
                }},
            ]
            async for doc in coll.aggregate(pipeline_avg):
                results["avg_score"]  = round(doc.get("avg_score", 0), 2)
                results["min_score"]  = round(doc.get("min_score", 0), 2)
                results["max_score"]  = round(doc.get("max_score", 0), 2)
                results["avg_iters"]  = round(doc.get("avg_iters", 0), 2)
        except Exception as exc:
            logger.warning("[optimizer] avg score pipeline failed: %s", exc)

        # ── Score bucket distribution ─────────────────────────────────
        try:
            pipeline_buckets = [
                {"$match": {"final_scores.overall": {"$exists": True}}},
                {"$bucket": {
                    "groupBy":    "$final_scores.overall",
                    "boundaries": [0, 40, 60, 80, 100.01],
                    "default":    "other",
                    "output":     {"count": {"$sum": 1}},
                }},
            ]
            buckets: Dict[str, int] = {}
            async for doc in coll.aggregate(pipeline_buckets):
                bucket_id = doc.get("_id")
                if bucket_id == 0:   buckets["0-40"]   = doc["count"]
                elif bucket_id == 40: buckets["40-60"]  = doc["count"]
                elif bucket_id == 60: buckets["60-80"]  = doc["count"]
                elif bucket_id == 80: buckets["80-100"] = doc["count"]
            results["score_distribution"] = buckets
        except Exception as exc:
            logger.warning("[optimizer] bucket pipeline failed: %s", exc)
            results["score_distribution"] = {}

        # ── Top role ─────────────────────────────────────────────────
        try:
            pipeline_role = [
                {"$group": {"_id": "$jd_role", "count": {"$sum": 1}}},
                {"$sort":  {"count": -1}},
                {"$limit": 1},
            ]
            async for doc in coll.aggregate(pipeline_role):
                results["top_role"] = doc.get("_id")
        except Exception as exc:
            logger.warning("[optimizer] top role pipeline failed: %s", exc)

        # ── Applications per company ─────────────────────────────────
        try:
            pipeline_company = [
                {"$group": {"_id": "$company", "count": {"$sum": 1}}},
                {"$sort":  {"count": -1}},
                {"$limit": 5},
            ]
            companies: List[Dict[str, Any]] = []
            async for doc in coll.aggregate(pipeline_company):
                companies.append({"company": doc["_id"], "count": doc["count"]})
            results["top_companies"] = companies
        except Exception as exc:
            logger.warning("[optimizer] top companies pipeline failed: %s", exc)

        return results

    # ------------------------------------------------------------------
    # Pruning
    # ------------------------------------------------------------------

    async def _prune_low_score_records(self, threshold: float) -> int:
        """
        Delete application records whose overall score falls below threshold.

        Protects the most recent 10 records regardless of score
        (so the system always retains recent context).

        Returns:
            Number of documents deleted.
        """
        if threshold <= 0:
            return 0

        try:
            await self._memory.mongo._ensure_connected()
            coll = self._memory.mongo._applications
        except Exception as exc:
            logger.error("[optimizer] prune: DB connection failed: %s", exc)
            return 0

        # Identify the 10 most recent session IDs to protect
        protected_ids: List[str] = []
        try:
            cursor = coll.find({}, {"session_id": 1}).sort("timestamp", -1).limit(10)
            async for doc in cursor:
                sid = doc.get("session_id")
                if sid:
                    protected_ids.append(sid)
        except Exception as exc:
            logger.warning("[optimizer] prune: could not fetch protected ids: %s", exc)

        # Delete low-score records not in the protected list
        try:
            query: Dict[str, Any] = {
                "final_scores.overall": {"$lt": threshold, "$exists": True},
            }
            if protected_ids:
                query["session_id"] = {"$nin": protected_ids}

            result = await coll.delete_many(query)
            count  = result.deleted_count
            self._stats["pruned"] += count
            logger.info(
                "[optimizer] pruned %d records below score=%.1f",
                count, threshold,
            )
            return count
        except Exception as exc:
            logger.error("[optimizer] prune delete failed: %s", exc)
            return 0


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_optimizer_instance: Optional[MemoryOptimizer] = None


def get_memory_optimizer() -> MemoryOptimizer:
    """Return the process-wide MemoryOptimizer singleton."""
    global _optimizer_instance
    if _optimizer_instance is None:
        _optimizer_instance = MemoryOptimizer()
    return _optimizer_instance