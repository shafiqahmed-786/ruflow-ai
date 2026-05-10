"""
backend/services/memory_service.py

Dual-layer memory service:
  - Short-term  : ephemeral session state (in-process dict)
  - Long-term   : MongoDB (structured documents) + ChromaDB (vector search)

All public methods are async-safe.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import motor.motor_asyncio as motor
from pymongo import DESCENDING
from pymongo.errors import (
    BulkWriteError,
    ConnectionFailure,
    OperationFailure,
    ServerSelectionTimeoutError,
)

import chromadb
from chromadb.config import Settings as ChromaSettings

from backend.config.settings import get_settings
from backend.orchestrator.state import EvalScores, PastApplication

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# MongoDB client
# ---------------------------------------------------------------------------


class MongoMemoryClient:
    """
    Async MongoDB wrapper using Motor.

    Provides insert/query operations for application records and sessions.
    Connection is lazily established and verified on first use.
    """

    def __init__(self) -> None:
        cfg = get_settings()
        self._db_cfg = cfg.db
        self._client: Optional[motor.AsyncIOMotorClient] = None
        self._db: Optional[motor.AsyncIOMotorDatabase] = None
        self._verified: bool = False

    async def _ensure_connected(self) -> None:
        """Establish connection and verify with a ping if not already done."""
        if self._verified:
            return

        cfg = self._db_cfg
        self._client = motor.AsyncIOMotorClient(
            cfg.mongodb_uri,
            maxPoolSize=cfg.mongodb_pool_size,
            connectTimeoutMS=cfg.mongodb_connect_timeout_ms,
            serverSelectionTimeoutMS=cfg.mongodb_connect_timeout_ms,
        )
        self._db = self._client[cfg.mongodb_db_name]

        try:
            await self._client.admin.command("ping")
            self._verified = True
            logger.info("MongoDB connected: %s / %s", cfg.mongodb_uri, cfg.mongodb_db_name)
        except (ConnectionFailure, ServerSelectionTimeoutError) as exc:
            self._client = None
            self._db = None
            raise RuntimeError(f"Cannot connect to MongoDB at {cfg.mongodb_uri}: {exc}") from exc

    @property
    def _applications(self) -> motor.AsyncIOMotorCollection:
        assert self._db is not None, "MongoMemoryClient not connected"
        return self._db[self._db_cfg.mongodb_applications_collection]

    @property
    def _sessions(self) -> motor.AsyncIOMotorCollection:
        assert self._db is not None, "MongoMemoryClient not connected"
        return self._db[self._db_cfg.mongodb_sessions_collection]

    async def store_application(
        self,
        session_id: str,
        jd_role: str,
        company: str,
        final_scores: EvalScores,
        iterations: int,
        resume_snapshot: str,
        cover_snapshot: str,
        extra_meta: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Persist a completed application to MongoDB.

        Args:
            session_id: Unique session identifier.
            jd_role: Role title extracted from the JD.
            company: Company name extracted from the JD.
            final_scores: EvalScores dict with numeric scores.
            iterations: Number of improvement loops run.
            resume_snapshot: Final tailored resume (Markdown).
            cover_snapshot: Final cover letter (plain text).
            extra_meta: Any additional key-value metadata.

        Returns:
            Inserted document ID as a string.
        """
        await self._ensure_connected()

        doc: Dict[str, Any] = {
            "session_id": session_id,
            "jd_role": jd_role,
            "company": company,
            "final_scores": dict(final_scores),
            "iterations": iterations,
            "resume_snapshot": resume_snapshot,
            "cover_snapshot": cover_snapshot,
            "timestamp": datetime.utcnow().isoformat(),
            **(extra_meta or {}),
        }

        try:
            result = await self._applications.insert_one(doc)
            logger.info(
                "Application stored: session=%s role=%s company=%s",
                session_id, jd_role, company,
            )
            return str(result.inserted_id)
        except OperationFailure as exc:
            logger.error("Failed to store application: %s", exc)
            raise

    async def retrieve_past_applications(
        self,
        session_id: Optional[str] = None,
        company: Optional[str] = None,
        jd_role: Optional[str] = None,
        limit: int = 10,
    ) -> List[PastApplication]:
        """
        Retrieve historical application records.

        Any combination of filters may be applied; all are ANDed.
        Results are sorted by timestamp descending.

        Args:
            session_id: Filter by exact session ID.
            company: Filter by company name (case-insensitive).
            jd_role: Filter by role title (case-insensitive).
            limit: Maximum number of records to return.

        Returns:
            List of PastApplication TypedDicts.
        """
        await self._ensure_connected()

        query: Dict[str, Any] = {}
        if session_id:
            query["session_id"] = session_id
        if company:
            query["company"] = {"$regex": company, "$options": "i"}
        if jd_role:
            query["jd_role"] = {"$regex": jd_role, "$options": "i"}

        try:
            cursor = (
                self._applications.find(query, {"_id": 0})
                .sort("timestamp", DESCENDING)
                .limit(limit)
            )
            docs = await cursor.to_list(length=limit)
        except OperationFailure as exc:
            logger.error("Failed to retrieve applications: %s", exc)
            return []

        results: List[PastApplication] = []
        for doc in docs:
            results.append(
                PastApplication(
                    session_id=doc.get("session_id", ""),
                    jd_role=doc.get("jd_role", ""),
                    company=doc.get("company", ""),
                    final_scores=doc.get("final_scores", {}),
                    iterations=doc.get("iterations", 0),
                    resume_snapshot=doc.get("resume_snapshot", ""),
                    cover_snapshot=doc.get("cover_snapshot", ""),
                    timestamp=doc.get("timestamp", ""),
                )
            )
        return results

    async def store_session_state(
        self, session_id: str, state_snapshot: Dict[str, Any]
    ) -> None:
        """
        Upsert a raw state snapshot for checkpoint / resume capability.

        Args:
            session_id: Session identifier.
            state_snapshot: Serialisable dict from AgentState.
        """
        await self._ensure_connected()
        await self._sessions.update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "session_id": session_id,
                    "state": state_snapshot,
                    "updated_at": datetime.utcnow().isoformat(),
                }
            },
            upsert=True,
        )

    async def get_session_state(
        self, session_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Load a previously checkpointed session state.

        Returns:
            The raw state dict or None if not found.
        """
        await self._ensure_connected()
        doc = await self._sessions.find_one(
            {"session_id": session_id}, {"_id": 0, "state": 1}
        )
        return doc["state"] if doc else None

    async def close(self) -> None:
        """Close the Motor client gracefully."""
        if self._client:
            self._client.close()
            self._verified = False
            logger.info("MongoDB connection closed.")


# ---------------------------------------------------------------------------
# ChromaDB client
# ---------------------------------------------------------------------------


class ChromaMemoryClient:
    """
    Synchronous ChromaDB client wrapped in asyncio executor calls so it
    integrates cleanly with async code without blocking the event loop.

    Maintains two collections:
      - resumes    : embedded resume snapshots for future RAG retrieval.
      - job_descriptions : embedded JDs for similarity search.
    """

    def __init__(self) -> None:
        cfg = get_settings()
        self._cfg = cfg.db
        self._client: Optional[chromadb.Client] = None
        self._resume_collection: Optional[chromadb.Collection] = None
        self._jd_collection: Optional[chromadb.Collection] = None
        self._loop = asyncio.get_event_loop()

    def _init_client(self) -> None:
        """Initialise ChromaDB client and collections (blocking)."""
        if self._client is not None:
            return

        self._client = chromadb.Client(
            ChromaSettings(
                chroma_db_impl="duckdb+parquet",
                persist_directory=self._cfg.chroma_persist_directory,
                anonymized_telemetry=False,
            )
        )

        self._resume_collection = self._client.get_or_create_collection(
            name=self._cfg.chroma_collection_resumes,
            metadata={"hnsw:space": "cosine"},
        )
        self._jd_collection = self._client.get_or_create_collection(
            name=self._cfg.chroma_collection_jds,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(
            "ChromaDB initialised. persist_dir=%s",
            self._cfg.chroma_persist_directory,
        )

    async def _run_sync(self, fn, *args, **kwargs):
        """Run a blocking Chroma call in the default thread executor."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: fn(*args, **kwargs))

    async def store_resume_embedding(
        self,
        session_id: str,
        resume_text: str,
        embedding: List[float],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Add a resume embedding to the resumes collection.

        Args:
            session_id: Used as the document ID; upserted so re-runs are safe.
            resume_text: Plain-text resume (stored as document).
            embedding: Pre-computed embedding vector (1-D list of floats).
            metadata: Optional dict (role, company, scores, etc.).
        """
        await self._run_sync(self._init_client)

        def _upsert():
            self._resume_collection.upsert(
                ids=[session_id],
                embeddings=[embedding],
                documents=[resume_text],
                metadatas=[metadata or {}],
            )

        await self._run_sync(_upsert)
        logger.debug("Resume embedding stored for session=%s", session_id)

    async def store_jd_embedding(
        self,
        jd_id: str,
        jd_text: str,
        embedding: List[float],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Add a JD embedding to the job_descriptions collection.

        Args:
            jd_id: Unique identifier for this JD.
            jd_text: Raw JD text.
            embedding: Pre-computed embedding vector.
            metadata: Optional metadata (company, role, etc.).
        """
        await self._run_sync(self._init_client)

        def _upsert():
            self._jd_collection.upsert(
                ids=[jd_id],
                embeddings=[embedding],
                documents=[jd_text],
                metadatas=[metadata or {}],
            )

        await self._run_sync(_upsert)

    async def query_similar_resumes(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        where: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Find the top-k most similar resumes by cosine similarity.

        Args:
            query_embedding: Query vector.
            top_k: Number of results to return.
            where: Optional ChromaDB metadata filter dict.

        Returns:
            List of dicts with keys: id, document, distance, metadata.
        """
        await self._run_sync(self._init_client)

        def _query():
            kwargs: Dict[str, Any] = {
                "query_embeddings": [query_embedding],
                "n_results": min(top_k, self._resume_collection.count() or top_k),
                "include": ["documents", "metadatas", "distances"],
            }
            if where:
                kwargs["where"] = where
            return self._resume_collection.query(**kwargs)

        results = await self._run_sync(_query)
        return self._format_chroma_results(results)

    async def query_similar_jds(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        where: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Find the top-k most similar job descriptions by cosine similarity.

        Args:
            query_embedding: Query vector.
            top_k: Number of results to return.
            where: Optional ChromaDB metadata filter dict.

        Returns:
            List of dicts with keys: id, document, distance, metadata.
        """
        await self._run_sync(self._init_client)

        def _query():
            kwargs: Dict[str, Any] = {
                "query_embeddings": [query_embedding],
                "n_results": min(top_k, self._jd_collection.count() or top_k),
                "include": ["documents", "metadatas", "distances"],
            }
            if where:
                kwargs["where"] = where
            return self._jd_collection.query(**kwargs)

        results = await self._run_sync(_query)
        return self._format_chroma_results(results)

    @staticmethod
    def _format_chroma_results(raw: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Flatten ChromaDB's nested list response into a list of dicts."""
        output: List[Dict[str, Any]] = []
        ids = (raw.get("ids") or [[]])[0]
        docs = (raw.get("documents") or [[]])[0]
        metas = (raw.get("metadatas") or [[]])[0]
        dists = (raw.get("distances") or [[]])[0]

        for i, doc_id in enumerate(ids):
            output.append(
                {
                    "id": doc_id,
                    "document": docs[i] if i < len(docs) else "",
                    "distance": dists[i] if i < len(dists) else 1.0,
                    "metadata": metas[i] if i < len(metas) else {},
                }
            )
        return output

    async def persist(self) -> None:
        """Flush ChromaDB data to disk (duckdb+parquet backend)."""
        if self._client:
            await self._run_sync(self._client.persist)
            logger.info("ChromaDB persisted to disk.")


# ---------------------------------------------------------------------------
# Unified MemoryService
# ---------------------------------------------------------------------------


class MemoryService:
    """
    Facade that exposes a single, consistent API over both MongoDB (long-term
    structured memory) and ChromaDB (vector similarity memory).

    Agents interact only with this class — they never touch MongoDB or
    ChromaDB directly.

    Usage::

        memory = get_memory_service()
        await memory.store_application(session_id=..., ...)
        past = await memory.retrieve_past_applications(company="Google")
    """

    def __init__(self) -> None:
        self.mongo = MongoMemoryClient()
        self.chroma = ChromaMemoryClient()

    async def store_application(
        self,
        session_id: str,
        jd_role: str,
        company: str,
        final_scores: EvalScores,
        iterations: int,
        resume_snapshot: str,
        cover_snapshot: str,
        resume_embedding: Optional[List[float]] = None,
        jd_embedding: Optional[List[float]] = None,
        extra_meta: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Persist application to MongoDB and optionally update ChromaDB vectors.

        Returns:
            MongoDB inserted document ID.
        """
        mongo_id = await self.mongo.store_application(
            session_id=session_id,
            jd_role=jd_role,
            company=company,
            final_scores=final_scores,
            iterations=iterations,
            resume_snapshot=resume_snapshot,
            cover_snapshot=cover_snapshot,
            extra_meta=extra_meta,
        )

        if resume_embedding:
            await self.chroma.store_resume_embedding(
                session_id=session_id,
                resume_text=resume_snapshot,
                embedding=resume_embedding,
                metadata={
                    "session_id": session_id,
                    "jd_role": jd_role,
                    "company": company,
                    "overall_score": final_scores.get("overall", 0.0),
                },
            )

        await self.chroma.persist()
        return mongo_id

    async def retrieve_past_applications(
        self,
        session_id: Optional[str] = None,
        company: Optional[str] = None,
        jd_role: Optional[str] = None,
        limit: int = 10,
    ) -> List[PastApplication]:
        """Delegate to MongoMemoryClient.retrieve_past_applications()."""
        return await self.mongo.retrieve_past_applications(
            session_id=session_id,
            company=company,
            jd_role=jd_role,
            limit=limit,
        )

    async def find_similar_resumes(
        self, query_embedding: List[float], top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """Return the most similar stored resumes by vector similarity."""
        return await self.chroma.query_similar_resumes(query_embedding, top_k)

    async def find_similar_jds(
        self, query_embedding: List[float], top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """Return the most similar stored JDs by vector similarity."""
        return await self.chroma.query_similar_jds(query_embedding, top_k)

    async def checkpoint_session(
        self, session_id: str, state_snapshot: Dict[str, Any]
    ) -> None:
        """Save a session checkpoint to MongoDB for fault tolerance."""
        await self.mongo.store_session_state(session_id, state_snapshot)

    async def restore_session(
        self, session_id: str
    ) -> Optional[Dict[str, Any]]:
        """Restore a previously checkpointed session state."""
        return await self.mongo.get_session_state(session_id)

    async def close(self) -> None:
        """Gracefully close all connections."""
        await self.mongo.close()


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_memory_service_instance: Optional[MemoryService] = None


def get_memory_service() -> MemoryService:
    """Return the process-wide MemoryService singleton."""
    global _memory_service_instance
    if _memory_service_instance is None:
        _memory_service_instance = MemoryService()
    return _memory_service_instance