"""
backend/main.py

CareerOS AI — FastAPI application entry point.
Mounts all routers (original RuFlow + new CareerOS features),
configures CORS, manages service lifespan, and wires health probes.
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

# ── Original RuFlow routers (PRESERVED — do not remove) ────────────────────
from backend.routes.applications import router as applications_router
from backend.routes.memory import router as memory_router
from backend.routes.recommendations import router as recommendations_router

# ── CareerOS AI extension routers ──────────────────────────────────────────
from backend.routes.interviews import router as interviews_router
from backend.routes.recruiters import router as recruiters_router
from backend.routes.companies import router as companies_router
from backend.routes.offers import router as offers_router
from backend.routes.analytics import router as analytics_router
from backend.routes.copilot import router as copilot_router

from backend.services.memory_service import get_memory_service
from backend.services.vector_db_service import get_embedding_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

cfg = get_settings()


# ── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== CareerOS AI starting up ===")

    try:
        cfg.validate_critical()
        logger.info("API key validation passed.")
    except RuntimeError as exc:
        logger.critical("Startup aborted: %s", exc)
        raise

    try:
        embed_svc = get_embedding_service()
        await embed_svc.embed("warm-up")
        logger.info("Embedding model pre-warmed.")
    except Exception as exc:
        logger.warning("Embedding pre-warm failed (non-fatal): %s", exc)

    try:
        memory = get_memory_service()
        await memory.mongo._ensure_connected()
        logger.info("MongoDB connection verified.")
    except Exception as exc:
        logger.warning("MongoDB unavailable at startup (non-fatal): %s", exc)

    app.state.started_at = time.time()
    logger.info("=== CareerOS AI ready ===")
    yield

    logger.info("=== CareerOS AI shutting down ===")
    try:
        memory = get_memory_service()
        await memory.close()
    except Exception as exc:
        logger.warning("Error during memory service shutdown: %s", exc)


# ── App factory ───────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    application = FastAPI(
        title="CareerOS AI",
        version="2.0.0",
        description=(
            "CareerOS AI — Complete AI-powered Job Application Command Centre. "
            "Multi-agent LangGraph pipeline: resume tailoring, JD analysis, "
            "interview prep, recruiter CRM, company intelligence, offer tracking, "
            "and iterative ATS score optimization."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # CORS
    application.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.app.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request timing
    @application.middleware("http")
    async def add_process_time_header(request: Request, call_next):
        start = time.monotonic()
        response = await call_next(request)
        response.headers["X-Process-Time"] = f"{time.monotonic() - start:.4f}s"
        return response

    # Global exception handler
    @application.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "error": str(exc)},
        )

    prefix = cfg.app.api_prefix  # e.g. "/api/v1"

    # ── Original RuFlow routers (PRESERVED) ──────────────────────────────
    application.include_router(applications_router, prefix=prefix)
    application.include_router(memory_router, prefix=prefix)
    application.include_router(recommendations_router, prefix=prefix)

    # ── CareerOS AI extension routers ─────────────────────────────────────
    application.include_router(interviews_router, prefix=prefix)
    application.include_router(recruiters_router, prefix=prefix)
    application.include_router(companies_router, prefix=prefix)
    application.include_router(offers_router, prefix=prefix)
    application.include_router(analytics_router, prefix=prefix)
    application.include_router(copilot_router, prefix=prefix)

    # ── Health probes ─────────────────────────────────────────────────────
    @application.get("/health", tags=["Health"], summary="Liveness probe")
    async def health() -> Dict[str, Any]:
        uptime = (
            round(time.time() - application.state.started_at, 1)
            if hasattr(application.state, "started_at") else None
        )
        return {"status": "ok", "service": "CareerOS AI", "version": "2.0.0", "uptime_seconds": uptime}

    @application.get(f"{prefix}/health", tags=["Health"], include_in_schema=False)
    async def health_prefixed() -> Dict[str, Any]:
        uptime = (
            round(time.time() - application.state.started_at, 1)
            if hasattr(application.state, "started_at") else None
        )
        return {"status": "ok", "service": "CareerOS AI", "version": "2.0.0", "uptime_seconds": uptime}

    return application


app = create_app()

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8080,
        reload=cfg.app.debug,
        workers=1 if cfg.app.debug else cfg.app.workers,
        log_level=cfg.app.log_level.lower(),
    )
