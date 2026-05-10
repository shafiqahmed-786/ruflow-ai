"""
backend/main.py

FastAPI application entry point.
Mounts all routers, configures CORS, manages service lifespan,
and wires the /health endpoint directly.
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import Any, Dict

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config.settings import get_settings
from backend.routes.applications import router as applications_router
from backend.services.memory_service import get_memory_service
from backend.services.vector_db_service import get_embedding_service

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

cfg = get_settings()

# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs once at startup (before yield) and once at shutdown (after yield).
    Pre-warms singletons so the first real request is not slow.
    """
    logger.info("=== RuFlow API starting up ===")

    # Validate mandatory secrets early — will raise RuntimeError if missing
    try:
        cfg.validate_critical()
        logger.info("API key validation passed.")
    except RuntimeError as exc:
        logger.critical("Startup aborted: %s", exc)
        raise

    # Pre-warm embedding model (downloads weights on first use)
    try:
        embed_svc = get_embedding_service()
        await embed_svc.embed("warm-up")
        logger.info("Embedding model pre-warmed.")
    except Exception as exc:
        logger.warning("Embedding pre-warm failed (non-fatal): %s", exc)

    # Verify MongoDB connectivity
    try:
        memory = get_memory_service()
        await memory.mongo._ensure_connected()
        logger.info("MongoDB connection verified.")
    except Exception as exc:
        logger.warning("MongoDB unavailable at startup (non-fatal): %s", exc)

    # Store startup timestamp for uptime reporting
    app.state.started_at = time.time()

    logger.info("=== RuFlow API ready ===")
    yield

    # ── Shutdown ──────────────────────────────────────────────────────
    logger.info("=== RuFlow API shutting down ===")
    try:
        memory = get_memory_service()
        await memory.close()
        logger.info("Memory service closed.")
    except Exception as exc:
        logger.warning("Error during memory service shutdown: %s", exc)


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------


def create_app() -> FastAPI:
    """Create and configure the FastAPI application instance."""
    application = FastAPI(
        title=cfg.app.app_name,
        version=cfg.app.app_version,
        description=(
            "RuFlow — Autonomous Multi-Agent Job Intelligence System. "
            "Parses resumes and job descriptions, retrieves contextual knowledge, "
            "generates tailored application materials, and iteratively improves them."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────
    application.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.app.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Request timing middleware ──────────────────────────────────────
    @application.middleware("http")
    async def add_process_time_header(request: Request, call_next):
        start = time.monotonic()
        response = await call_next(request)
        elapsed = time.monotonic() - start
        response.headers["X-Process-Time"] = f"{elapsed:.4f}s"
        return response

    # ── Global exception handler ───────────────────────────────────────
    @application.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "error": str(exc)},
        )

    # ── Routers ───────────────────────────────────────────────────────
    application.include_router(
        applications_router,
        prefix=cfg.app.api_prefix,
    )

    # ── Health endpoint ────────────────────────────────────────────────
    @application.get(
        "/health",
        tags=["Health"],
        summary="Liveness probe",
        response_description="Service health status",
    )
    async def health() -> Dict[str, Any]:
        """
        Kubernetes-compatible liveness / readiness probe.

        Returns basic service metadata and uptime so infrastructure
        orchestrators can determine whether the pod is healthy.
        """
        uptime_seconds = (
            round(time.time() - application.state.started_at, 1)
            if hasattr(application.state, "started_at")
            else None
        )
        return {
            "status":  "ok",
            "service": cfg.app.app_name,
            "version": cfg.app.app_version,
            "uptime_seconds": uptime_seconds,
        }

    # Duplicate health under API prefix for consistency
    @application.get(
        f"{cfg.app.api_prefix}/health",
        tags=["Health"],
        summary="API-prefixed liveness probe",
        include_in_schema=False,
    )
    async def health_prefixed() -> Dict[str, Any]:
        uptime_seconds = (
            round(time.time() - application.state.started_at, 1)
            if hasattr(application.state, "started_at")
            else None
        )
        return {
            "status":  "ok",
            "service": cfg.app.app_name,
            "version": cfg.app.app_version,
            "uptime_seconds": uptime_seconds,
        }

    return application


# ---------------------------------------------------------------------------
# Module-level app instance (imported by Uvicorn / Gunicorn)
# ---------------------------------------------------------------------------

app = create_app()

# ---------------------------------------------------------------------------
# Dev entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8080,
        reload=cfg.app.debug,
        workers=1 if cfg.app.debug else cfg.app.workers,
        log_level=cfg.app.log_level.lower(),
    )