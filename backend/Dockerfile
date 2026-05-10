# backend/Dockerfile
# ─────────────────────────────────────────────────────────────────────────────
# RuFlow Backend — FastAPI + LangGraph multi-agent system
# Base: python:3.11-slim  |  Final user: non-root (appuser:1001)
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim AS base

# ── OS-level metadata ─────────────────────────────────────────────────────────
LABEL maintainer="ruflow-team" \
      version="0.1.0" \
      description="RuFlow FastAPI backend"

# ── System dependencies ───────────────────────────────────────────────────────
# Install build tools needed for C-extension packages (e.g. pymupdf, numpy).
# Curl is kept in the final image only for the HEALTHCHECK.
# All build-time tooling is removed in the same RUN layer to keep image lean.
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        build-essential \
        libffi-dev \
        libssl-dev \
        curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ── Non-root user ─────────────────────────────────────────────────────────────
RUN groupadd --gid 1001 appgroup \
 && useradd  --uid 1001 --gid 1001 --no-create-home --shell /bin/false appuser

# ── Working directory ─────────────────────────────────────────────────────────
WORKDIR /app

# ── Python dependency installation (separate layer for cache efficiency) ──────
# Copy only the requirements file first so this layer is rebuilt only when
# requirements change, not on every code change.
COPY requirements.txt ./

RUN pip install --upgrade pip --no-cache-dir \
 && pip install --no-cache-dir -r requirements.txt

# ── Application code ──────────────────────────────────────────────────────────
# Copy after deps so code changes don't invalidate the pip layer.
COPY . .

# ── Remove build tools post-install to slim the final image ───────────────────
RUN apt-get purge -y --auto-remove \
        gcc \
        g++ \
        build-essential \
        libffi-dev \
        libssl-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && find /app -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true \
    && find /app -name "*.pyc" -delete

# ── Runtime directories with correct ownership ────────────────────────────────
RUN mkdir -p /app/chroma_data /app/model_cache /app/logs \
 && chown -R appuser:appgroup /app

# ── Switch to non-root ────────────────────────────────────────────────────────
USER appuser

# ── Port ──────────────────────────────────────────────────────────────────────
EXPOSE 8000

# ── Health check ──────────────────────────────────────────────────────────────
# Retries=5 to allow time for embedding model warm-up on first start.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# ── Environment defaults (overridden by docker-compose / k8s env) ─────────────
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    LOG_LEVEL=INFO \
    WORKERS=2 \
    PORT=8000

# ── Entrypoint ────────────────────────────────────────────────────────────────
CMD ["sh", "-c", \
     "uvicorn backend.main:app \
        --host 0.0.0.0 \
        --port ${PORT} \
        --workers ${WORKERS} \
        --log-level ${LOG_LEVEL,,} \
        --access-log \
        --proxy-headers \
        --forwarded-allow-ips='*'"]
