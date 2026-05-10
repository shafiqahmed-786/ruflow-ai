"""
backend/config/settings.py

Centralised configuration loaded from environment variables via Pydantic v2.
All other modules import from here — no os.getenv() calls elsewhere.
"""

from __future__ import annotations

import sys
from functools import lru_cache
from typing import List, Optional, Union

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# ---------------------------------------------------------------------------
# LLM Settings
# ---------------------------------------------------------------------------


class LLMSettings(BaseSettings):
    """Google Gemini API configuration."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Gemini
    gemini_api_key: SecretStr = Field(
        ..., validation_alias="GEMINI_API_KEY"
    )

    # Model names (overridable for testing)
    model_strong: str = Field(
        default="gemini-2.0-flash", validation_alias="MODEL_STRONG"
    )
    model_fast: str = Field(
        default="gemini-2.0-flash-lite", validation_alias="MODEL_FAST"
    )
    model_gemini_pro: str = Field(
        default="gemini-2.0-flash", validation_alias="MODEL_GEMINI_PRO"
    )
    model_gemini_lite: str = Field(
        default="gemini-2.0-flash-lite", validation_alias="MODEL_GEMINI_LITE"
    )

    # Token / cost controls
    llm_max_tokens: int = Field(
        default=4096, validation_alias="LLM_MAX_TOKENS"
    )
    llm_temperature: float = Field(
        default=0.3, validation_alias="LLM_TEMPERATURE"
    )
    llm_timeout_seconds: int = Field(
        default=120, validation_alias="LLM_TIMEOUT_SECONDS"
    )
    llm_max_retries: int = Field(
        default=3, validation_alias="LLM_MAX_RETRIES"
    )


# ---------------------------------------------------------------------------
# Database Settings
# ---------------------------------------------------------------------------


class DatabaseSettings(BaseSettings):
    """MongoDB and ChromaDB configuration."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # MongoDB
    mongodb_uri: str = Field(
        default="mongodb://localhost:27017",
        validation_alias="MONGODB_URI",
    )
    mongodb_db_name: str = Field(
        default="ruflow_db", validation_alias="MONGODB_DB_NAME"
    )
    mongodb_applications_collection: str = Field(
        default="applications",
        validation_alias="MONGODB_APPLICATIONS_COLLECTION",
    )
    mongodb_sessions_collection: str = Field(
        default="sessions",
        validation_alias="MONGODB_SESSIONS_COLLECTION",
    )
    mongodb_pool_size: int = Field(
        default=10, validation_alias="MONGODB_POOL_SIZE"
    )
    mongodb_connect_timeout_ms: int = Field(
        default=5000, validation_alias="MONGODB_CONNECT_TIMEOUT_MS"
    )

    # ChromaDB
    chroma_host: str = Field(
        default="localhost", validation_alias="CHROMA_HOST"
    )
    chroma_port: int = Field(
        default=8000, validation_alias="CHROMA_PORT"
    )
    chroma_persist_directory: str = Field(
        default="./chroma_data", validation_alias="CHROMA_PERSIST_DIR"
    )
    chroma_collection_resumes: str = Field(
        default="resumes", validation_alias="CHROMA_COLLECTION_RESUMES"
    )
    chroma_collection_jds: str = Field(
        default="job_descriptions",
        validation_alias="CHROMA_COLLECTION_JDS",
    )


# ---------------------------------------------------------------------------
# Embedding Settings
# ---------------------------------------------------------------------------


class EmbeddingSettings(BaseSettings):
    """Sentence-transformer and embedding configuration."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    embedding_model_name: str = Field(
        default="sentence-transformers/all-MiniLM-L6-v2",
        validation_alias="EMBEDDING_MODEL_NAME",
    )
    embedding_device: str = Field(
        default="cpu", validation_alias="EMBEDDING_DEVICE"
    )
    embedding_batch_size: int = Field(
        default=32, validation_alias="EMBEDDING_BATCH_SIZE"
    )
    embedding_cache_dir: str = Field(
        default="./model_cache", validation_alias="EMBEDDING_CACHE_DIR"
    )


# ---------------------------------------------------------------------------
# Retrieval Settings
# ---------------------------------------------------------------------------


class RetrievalSettings(BaseSettings):
    """RAG retrieval tuning knobs."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    retrieval_top_k: int = Field(
        default=5, validation_alias="RETRIEVAL_TOP_K"
    )
    retrieval_rrf_k: int = Field(
        default=60, validation_alias="RETRIEVAL_RRF_K"
    )  # Reciprocal Rank Fusion constant
    retrieval_semantic_weight: float = Field(
        default=0.7, validation_alias="RETRIEVAL_SEMANTIC_WEIGHT"
    )
    retrieval_bm25_weight: float = Field(
        default=0.3, validation_alias="RETRIEVAL_BM25_WEIGHT"
    )
    tavily_api_key: Optional[SecretStr] = Field(
        default=None, validation_alias="TAVILY_API_KEY"
    )
    web_search_enabled: bool = Field(
        default=True, validation_alias="WEB_SEARCH_ENABLED"
    )


# ---------------------------------------------------------------------------
# Evaluation Settings
# ---------------------------------------------------------------------------


class EvaluationSettings(BaseSettings):
    """Scoring thresholds and loop limits."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    eval_score_threshold: float = Field(
        default=80.0, validation_alias="EVAL_SCORE_THRESHOLD"
    )
    eval_max_iterations: int = Field(
        default=4, validation_alias="EVAL_MAX_ITERATIONS"
    )
    eval_ats_weight: float = Field(
        default=0.4, validation_alias="EVAL_ATS_WEIGHT"
    )
    eval_semantic_weight: float = Field(
        default=0.3, validation_alias="EVAL_SEMANTIC_WEIGHT"
    )
    eval_llm_judge_weight: float = Field(
        default=0.3, validation_alias="EVAL_LLM_JUDGE_WEIGHT"
    )


# ---------------------------------------------------------------------------
# Application Settings
# ---------------------------------------------------------------------------


class AppSettings(BaseSettings):
    """FastAPI application-level settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field(
        default="RuFlow API", validation_alias="APP_NAME"
    )
    app_version: str = Field(
        default="0.1.0", validation_alias="APP_VERSION"
    )
    debug: bool = Field(
        default=False, validation_alias="DEBUG"
    )
    log_level: str = Field(
        default="INFO", validation_alias="LOG_LEVEL"
    )
    cors_origins: Union[str, List[str]] = Field(
        default=["http://localhost:3000"],
        validation_alias="CORS_ORIGINS",
    )
    api_prefix: str = Field(
        default="/api/v1", validation_alias="API_PREFIX"
    )
    workers: int = Field(
        default=4, validation_alias="WORKERS"
    )

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper = v.upper()
        if upper not in allowed:
            raise ValueError(f"log_level must be one of {allowed}")
        return upper

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: object) -> List[str]:
        """Allow comma-separated string from .env."""
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Aggregated Settings
# ---------------------------------------------------------------------------


class Settings:
    """
    Top-level settings container.

    Usage::

        from backend.config.settings import get_settings
        cfg = get_settings()
        key = cfg.llm.gemini_api_key.get_secret_value()
    """

    def __init__(self) -> None:
        self.app = AppSettings()
        self.llm = LLMSettings()
        self.db = DatabaseSettings()
        self.embedding = EmbeddingSettings()
        self.retrieval = RetrievalSettings()
        self.evaluation = EvaluationSettings()

    def validate_critical(self) -> None:
        """
        Raise RuntimeError early if any mandatory secret is missing.
        Call this in main.py startup.
        """
        missing: List[str] = []

        try:
            self.llm.gemini_api_key.get_secret_value()
        except Exception:
            missing.append("GEMINI_API_KEY")

        if missing:
            raise RuntimeError(
                f"Missing required environment variables: {missing}. "
                "Copy .env.example to .env and fill in the values."
            )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Return a cached singleton Settings instance.

    The cache is cleared in tests via::

        get_settings.cache_clear()
    """
    return Settings()