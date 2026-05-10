"""
backend/services/vector_db_service.py

EmbeddingService — wraps Sentence Transformers for dense embeddings plus
a BM25 sparse index.  Provides hybrid retrieval via Reciprocal Rank Fusion
(RRF) and a cosine similarity utility used by the Evaluator agent.
"""

from __future__ import annotations

import asyncio
import logging
import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi

from backend.config.settings import get_settings
from backend.orchestrator.state import RetrievedChunk

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# EmbeddingService
# ---------------------------------------------------------------------------


class EmbeddingService:
    """
    Dense embedding service using Sentence Transformers.

    The model is loaded lazily on first use so that import-time cost is zero.
    All CPU-bound embedding calls are offloaded to a thread-pool executor so
    they do not block the asyncio event loop.

    Usage::

        svc = get_embedding_service()
        vec = await svc.embed("Software engineer with 5 years Python")
        results = await svc.semantic_search(query, corpus_texts)
    """

    def __init__(self) -> None:
        cfg = get_settings()
        self._model_name: str = cfg.embedding.embedding_model_name
        self._device: str = cfg.embedding.embedding_device
        self._batch_size: int = cfg.embedding.embedding_batch_size
        self._cache_dir: str = cfg.embedding.embedding_cache_dir
        self._model: Optional[SentenceTransformer] = None

    # ------------------------------------------------------------------
    # Model lifecycle
    # ------------------------------------------------------------------

    def _load_model(self) -> SentenceTransformer:
        """Load model synchronously (called inside executor)."""
        if self._model is None:
            logger.info("Loading embedding model: %s", self._model_name)
            self._model = SentenceTransformer(
                self._model_name,
                device=self._device,
                cache_folder=self._cache_dir,
            )
            logger.info("Embedding model loaded on device: %s", self._device)
        return self._model

    async def _ensure_model(self) -> SentenceTransformer:
        """Ensure the model is loaded, running in an executor if needed."""
        if self._model is not None:
            return self._model
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._load_model)

    # ------------------------------------------------------------------
    # Public async API
    # ------------------------------------------------------------------

    async def embed(self, text: str) -> List[float]:
        """
        Compute a dense embedding for a single text string.

        Args:
            text: Input text (will be truncated by the model if too long).

        Returns:
            1-D list of floats (embedding vector).
        """
        if not text or not text.strip():
            raise ValueError("Cannot embed empty text")

        model = await self._ensure_model()
        loop = asyncio.get_running_loop()

        def _encode() -> np.ndarray:
            return model.encode(
                text,
                convert_to_numpy=True,
                show_progress_bar=False,
                normalize_embeddings=True,
            )

        vector: np.ndarray = await loop.run_in_executor(None, _encode)
        return vector.tolist()

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Compute dense embeddings for a list of texts in a single forward pass.

        Args:
            texts: List of input strings. Empty strings are replaced with a
                   single space to prevent model errors.

        Returns:
            List of embedding vectors, same length and order as ``texts``.
        """
        if not texts:
            return []

        safe_texts = [t if t.strip() else " " for t in texts]
        model = await self._ensure_model()
        loop = asyncio.get_running_loop()

        def _encode_batch() -> np.ndarray:
            return model.encode(
                safe_texts,
                batch_size=self._batch_size,
                convert_to_numpy=True,
                show_progress_bar=False,
                normalize_embeddings=True,
            )

        vectors: np.ndarray = await loop.run_in_executor(None, _encode_batch)
        return vectors.tolist()

    async def semantic_search(
        self,
        query: str,
        corpus: List[str],
        top_k: int = 5,
        metadata: Optional[List[Dict[str, Any]]] = None,
    ) -> List[RetrievedChunk]:
        """
        Rank ``corpus`` texts by cosine similarity to ``query``.

        Since embeddings are L2-normalised, cosine similarity = dot product.

        Args:
            query: The search query.
            corpus: List of candidate texts to rank.
            top_k: Number of top results to return.
            metadata: Optional per-document metadata dicts (same length as
                      corpus). Included verbatim in returned chunks.

        Returns:
            List of RetrievedChunk sorted by descending score.
        """
        if not corpus:
            return []

        meta = metadata or [{} for _ in corpus]
        if len(meta) != len(corpus):
            raise ValueError("metadata length must match corpus length")

        # Embed query and corpus
        all_texts = [query, *corpus]
        all_vectors = await self.embed_batch(all_texts)

        query_vec = np.array(all_vectors[0])
        corpus_vecs = np.array(all_vectors[1:])

        # Cosine similarity (vectors are already L2-normalised)
        scores: np.ndarray = corpus_vecs @ query_vec

        top_k_actual = min(top_k, len(corpus))
        top_indices = np.argpartition(-scores, top_k_actual - 1)[:top_k_actual]
        top_indices = top_indices[np.argsort(-scores[top_indices])]

        results: List[RetrievedChunk] = []
        for idx in top_indices:
            results.append(
                RetrievedChunk(
                    text=corpus[int(idx)],
                    source="vector_db",
                    score=float(scores[int(idx)]),
                    metadata=meta[int(idx)],
                )
            )
        return results

    @staticmethod
    def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
        """
        Compute cosine similarity between two vectors.

        Args:
            vec_a: First embedding vector.
            vec_b: Second embedding vector.

        Returns:
            Cosine similarity in [-1, 1].
        """
        a = np.array(vec_a, dtype=np.float32)
        b = np.array(vec_b, dtype=np.float32)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))


# ---------------------------------------------------------------------------
# BM25 sparse retriever
# ---------------------------------------------------------------------------


class BM25Retriever:
    """
    In-memory BM25 (Okapi) sparse retriever.

    Build once with a corpus, then call retrieve() for each query.
    This is a synchronous class; wrap calls in asyncio executor if needed
    (BM25 is fast enough that for <10 k documents it rarely matters).

    Usage::

        retriever = BM25Retriever(corpus_texts)
        results = retriever.retrieve("Python senior engineer ML", top_k=5)
    """

    def __init__(self, corpus: List[str]) -> None:
        """
        Args:
            corpus: List of documents to index.
        """
        if not corpus:
            raise ValueError("BM25Retriever requires a non-empty corpus")

        self._corpus = corpus
        tokenised = [self._tokenize(doc) for doc in corpus]
        self._bm25 = BM25Okapi(tokenised)
        logger.debug("BM25 index built over %d documents", len(corpus))

    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        metadata: Optional[List[Dict[str, Any]]] = None,
    ) -> List[RetrievedChunk]:
        """
        Return the top-k documents by BM25 score.

        Args:
            query: Search query string.
            top_k: Maximum results to return.
            metadata: Optional per-document metadata (same length as corpus).

        Returns:
            List of RetrievedChunk sorted by descending score.
        """
        meta = metadata or [{} for _ in self._corpus]
        tokens = self._tokenize(query)
        scores: np.ndarray = self._bm25.get_scores(tokens)

        top_k_actual = min(top_k, len(self._corpus))
        top_indices = np.argpartition(-scores, top_k_actual - 1)[:top_k_actual]
        top_indices = top_indices[np.argsort(-scores[top_indices])]

        results: List[RetrievedChunk] = []
        for idx in top_indices:
            if scores[int(idx)] > 0:  # skip zero-score matches
                results.append(
                    RetrievedChunk(
                        text=self._corpus[int(idx)],
                        source="bm25",
                        score=float(scores[int(idx)]),
                        metadata=meta[int(idx)],
                    )
                )
        return results

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        """Lowercase whitespace-split tokenisation."""
        return text.lower().split()


# ---------------------------------------------------------------------------
# Hybrid Retrieval (RRF)
# ---------------------------------------------------------------------------


class HybridRetriever:
    """
    Combines dense (semantic) and sparse (BM25) retrieval results using
    Reciprocal Rank Fusion (RRF).

    RRF score = Σ  1 / (k + rank_i)
    where k is a tuning constant (default 60 per the original paper).

    Usage::

        retriever = HybridRetriever(embedding_service, corpus_texts)
        results = await retriever.retrieve("ML engineer Python", top_k=5)
    """

    def __init__(
        self,
        embedding_service: EmbeddingService,
        corpus: List[str],
        metadata: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        cfg = get_settings()
        self._embed_svc = embedding_service
        self._corpus = corpus
        self._metadata = metadata or [{} for _ in corpus]
        self._bm25 = BM25Retriever(corpus, metadata=self._metadata) if corpus else None
        self._rrf_k: int = cfg.retrieval.retrieval_rrf_k
        self._semantic_weight: float = cfg.retrieval.retrieval_semantic_weight
        self._bm25_weight: float = cfg.retrieval.retrieval_bm25_weight

    async def retrieve(
        self,
        query: str,
        top_k: int = 5,
    ) -> List[RetrievedChunk]:
        """
        Retrieve top-k documents using hybrid RRF ranking.

        Args:
            query: Search query.
            top_k: Number of results to return.

        Returns:
            RRF-ranked list of RetrievedChunk objects.
        """
        if not self._corpus:
            return []

        # Run both retrievers
        semantic_results = await self._embed_svc.semantic_search(
            query, self._corpus, top_k=top_k * 2, metadata=self._metadata
        )

        bm25_results: List[RetrievedChunk] = []
        if self._bm25:
            bm25_results = self._bm25.retrieve(
                query, top_k=top_k * 2, metadata=self._metadata
            )

        return self._rrf_fuse(semantic_results, bm25_results, top_k)

    def _rrf_fuse(
        self,
        dense: List[RetrievedChunk],
        sparse: List[RetrievedChunk],
        top_k: int,
    ) -> List[RetrievedChunk]:
        """
        Fuse two ranked lists using Reciprocal Rank Fusion.

        Returns the top_k highest-scoring fused chunks.
        """
        rrf_scores: Dict[str, float] = {}
        chunk_map: Dict[str, RetrievedChunk] = {}

        def add_ranked_list(
            results: List[RetrievedChunk], weight: float
        ) -> None:
            for rank, chunk in enumerate(results, start=1):
                key = chunk.text  # use text as dedup key
                rrf_contribution = weight / (self._rrf_k + rank)
                rrf_scores[key] = rrf_scores.get(key, 0.0) + rrf_contribution
                if key not in chunk_map:
                    chunk_map[key] = chunk

        add_ranked_list(dense, self._semantic_weight)
        add_ranked_list(sparse, self._bm25_weight)

        sorted_keys = sorted(rrf_scores, key=lambda k: rrf_scores[k], reverse=True)

        results: List[RetrievedChunk] = []
        for key in sorted_keys[:top_k]:
            chunk = chunk_map[key]
            results.append(
                RetrievedChunk(
                    text=chunk.text,
                    source="hybrid_rrf",
                    score=rrf_scores[key],
                    metadata=chunk.metadata,
                )
            )
        return results


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_embedding_service_instance: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """Return the process-wide EmbeddingService singleton."""
    global _embedding_service_instance
    if _embedding_service_instance is None:
        _embedding_service_instance = EmbeddingService()
    return _embedding_service_instance