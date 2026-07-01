# backend/Dockerfile
# CareerOS AI — FastAPI + LangGraph multi-agent system
#
# Build context: REPO ROOT (not backend/)
# docker-compose.yml must use: context: . (repo root)
#
# Internal imports use `from backend.xxx` throughout, so PYTHONPATH
# must be the repo root — /app — with the backend/ package inside it.
#
# Stage 1: base  — OS deps + non-root user
# Stage 2: deps  — pip install (separate layer for cache)
# Stage 3: final — app code + runtime
# ---------------------------------------------------------------------------

FROM python:3.11-slim AS base

LABEL maintainer="careeros-team" \
      version="2.0.0" \
      description="CareerOS AI FastAPI backend"

RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc g++ build-essential libffi-dev libssl-dev curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1001 appgroup \
 && useradd  --uid 1001 --gid 1001 --no-create-home --shell /bin/false appuser

# ---------------------------------------------------------------------------
FROM base AS deps

WORKDIR /app

# Copy only requirements for layer-cache efficiency
COPY backend/requirements.txt ./backend/requirements.txt

RUN pip install --upgrade pip --no-cache-dir \
 && pip install --no-cache-dir -r backend/requirements.txt

# ---------------------------------------------------------------------------
FROM base AS final

WORKDIR /app

# Copy installed packages from deps stage
COPY --from=deps /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=deps /usr/local/bin /usr/local/bin

# Copy only the backend package (keeps image lean — no frontend source)
COPY backend/ ./backend/

# Strip bytecode from source
RUN find /app -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true \
 && find /app -name "*.pyc" -delete

# Runtime directories
RUN mkdir -p /app/chroma_data /app/model_cache /app/logs \
 && chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

# PYTHONPATH=/app means `import backend.main` resolves to /app/backend/main.py
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    LOG_LEVEL=INFO \
    WORKERS=1 \
    PORT=8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# LOG_LEVEL is already uppercased by settings validator; pass lowercase to uvicorn
CMD uvicorn backend.main:app \
        --host 0.0.0.0 \
        --port ${PORT} \
        --workers ${WORKERS} \
        --log-level info \
        --access-log \
        --proxy-headers \
        --forwarded-allow-ips='*'
