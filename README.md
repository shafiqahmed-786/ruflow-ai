# RuFlow — Autonomous Multi-Agent Job Intelligence System

> **Single-command deployment of a production-grade, self-improving AI pipeline** that parses resumes and job descriptions, retrieves contextual knowledge, generates tailored application materials, and iteratively improves them until a quality threshold is reached.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Architecture Overview](#2-architecture-overview)
3. [Environment Setup](#3-environment-setup)
4. [Local Development](#4-local-development)
5. [Testing](#5-testing)
6. [Performance Notes](#6-performance-notes)
7. [Deployment to Cloud](#7-deployment-to-cloud)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Quick Start

### Prerequisites

| Tool | Minimum Version | Check |
|------|----------------|-------|
| Docker | 24.x | `docker --version` |
| Docker Compose | 2.x (plugin) | `docker compose version` |
| 8 GB RAM | — | Available to Docker Desktop |

### One-Command Deployment

```bash
# 1. Clone the repository
git clone https://github.com/your-org/ruflow.git
cd ruflow

# 2. Configure environment
cp .env.example .env
# Edit .env and fill in GEMINI_API_KEY

# 3. Launch the full stack
docker compose up --build
```

The stack starts in dependency order:

```
MongoDB → ChromaDB → Backend (FastAPI) → Frontend (Next.js)
```

**Services available after startup:**

| Service | URL | Description |
|---------|-----|-------------|
| Dashboard | http://localhost:3000 | Next.js frontend |
| API | http://localhost:8000 | FastAPI backend |
| API Docs | http://localhost:8000/docs | Swagger UI |
| MongoDB | localhost:27017 | Document store |
| ChromaDB | http://localhost:8001 | Vector database |

> **First-run note:** The backend downloads the `all-MiniLM-L6-v2` embedding model (~90 MB) on first start. Allow up to 2 minutes before the health check passes.

---

## 2. Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                              │
│                    http://localhost:3000                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │  HTTPS / REST
┌────────────────────────────▼────────────────────────────────────────┐
│                   NEXT.JS FRONTEND  (port 3000)                     │
│  ┌─────────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ ApplicationForm │  │ ResultsPanel │  │ ScoreChart / History  │  │
│  └────────┬────────┘  └──────┬───────┘  └───────────────────────┘  │
│           │  DashboardContext (useReducer) — no prop drilling        │
└───────────┼───────────────────┼──────────────────────────────────────┘
            │  REST API         │
┌───────────▼───────────────────▼──────────────────────────────────────┐
│                   FASTAPI BACKEND  (port 8000)                        │
│                                                                       │
│  POST /api/v1/apply          GET /api/v1/recommendations/{user_id}   │
│  GET  /api/v1/applications   POST /api/v1/memory/optimize            │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │               LANGGRAPH STATE MACHINE                          │  │
│  │                                                                │  │
│  │  ingest ──► planner ──► jd_analyzer ──► retrieval             │  │
│  │                                            │         │         │  │
│  │                                     resume_tailor  cover_letter│  │
│  │                                            │         │         │  │
│  │                                       ◄────┴─────────┘         │  │
│  │                                    evaluator                    │  │
│  │                                    ┌──┴──┐                      │  │
│  │                              [pass]│     │[fail, iter < max]    │  │
│  │                                    │   improver                 │  │
│  │                                packager  │                      │  │
│  │                                    └──────────────► (loop back) │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌────────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│  │  LLMRouter     │  │  MemoryService   │  │  EmbeddingService    │ │
│  │  Gemini 2.0    │  │  Mongo + Chroma  │  │  Sentence-BERT       │ │
│  │  Gemini 2.0 Lite │  │  + LRU Cache   │  │  HybridRetriever     │ │
│  │  Gemini 1.5    │  └──────────────────┘  └──────────────────────┘ │
│  │  Gemini 1.5 8B │                                                   │
│  │  + fallback    │  ┌──────────────────┐  ┌──────────────────────┐ │
│  └────────────────┘  │ PatternExtractor │  │ RecommendationEngine │ │
│                       │ Counter + regex  │  │ LearningLoop         │ │
│                       └──────────────────┘  └──────────────────────┘ │
└──────────────────────────────┬────────────────────────────────────────┘
                               │
          ┌────────────────────┼──────────────────────┐
          │                    │                       │
┌─────────▼──────────┐  ┌──────▼──────────┐  ┌───────▼───────────┐
│   MONGODB (27017)  │  │ CHROMADB (8001) │  │  GOOGLE GEMINI     │
│   Applications     │  │ resume vectors  │  │  LLM API calls     │
│   Sessions         │  │ JD vectors      │  │  (external)        │
│   Patterns         │  │ learned patterns│  └───────────────────┘
└────────────────────┘  └─────────────────┘
```

### Agent Pipeline

| # | Agent | Model | Responsibility |
|---|-------|-------|----------------|
| 1 | **Planner** | gemini-2.0-flash-lite | Decomposes task, assigns models, routes execution |
| 2 | **JD Analyzer** | gemini-2.0-flash-lite | Extracts ATS keywords, seniority, tech stack |
| 3 | **Retrieval** | gemini-2.0-flash-lite | Hybrid BM25 + semantic RAG over resume/JD knowledge base |
| 4 | **Resume Tailor** | gemini-2.0-flash | STAR-format rewriting with ATS keyword injection |
| 5 | **Cover Letter** | gemini-2.0-flash | Hook-based, company-aware cover letter generation |
| 6 | **Evaluator** | gemini-2.0-flash | 3-layer scoring: programmatic ATS + semantic + LLM judge |
| 7 | **Improver** | gemini-2.0-flash | Surgical patching based on evaluator feedback |
| 8 | **Packager** | gemini-2.0-flash-lite | Persists to memory, builds API response |

### Evaluation Scoring

```
Overall = keyword_coverage × 0.30
        + relevance          × 0.25
        + impact             × 0.20
        + tone_match         × 0.15
        + cover_letter       × 0.10

Pass threshold: 80.0 / 100   (configurable via EVAL_SCORE_THRESHOLD)
Max iterations: 4            (configurable via EVAL_MAX_ITERATIONS)
```

---

## 3. Environment Setup

### Required Variables

Copy `.env.example` to `.env` and fill in the two mandatory secrets:

```bash
cp .env.example .env
```

```env
# Mandatory — pipeline will not start without these
GEMINI_API_KEY=sk-...
```

### Full Variable Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | — | **Required.** Google Gemini API key |
| `MONGODB_URI` | `mongodb://mongo:27017` | MongoDB connection string |
| `MONGODB_DB_NAME` | `ruflow_db` | Database name |
| `CHROMA_HOST` | `chroma` | ChromaDB host (Docker service name) |
| `CHROMA_PORT` | `8000` | ChromaDB port (internal) |
| `EMBEDDING_MODEL_NAME` | `sentence-transformers/all-MiniLM-L6-v2` | Embedding model |
| `EMBEDDING_DEVICE` | `cpu` | `cpu` or `cuda` |
| `EVAL_SCORE_THRESHOLD` | `80.0` | Minimum score to pass (0–100) |
| `EVAL_MAX_ITERATIONS` | `4` | Maximum improvement loops |
| `MODEL_STRONG` | `gemini-2.0-flash` | Model for reasoning tasks |
| `MODEL_FAST` | `gemini-2.0-flash-lite` | Model for extraction tasks |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api/v1` | Browser-visible API URL |
| `API_URL` | `http://backend:8000/api/v1` | Server-side API URL (SSR) |
| `TAVILY_API_KEY` | _(empty)_ | Optional web search key |
| `WEB_SEARCH_ENABLED` | `true` | Enable company intel retrieval |
| `LOG_LEVEL` | `INFO` | `DEBUG` / `INFO` / `WARNING` |
| `WORKERS` | `2` | Uvicorn worker count |
| `DEBUG` | `false` | FastAPI debug mode |

> **`NEXT_PUBLIC_API_URL` vs `API_URL`:** The browser cannot resolve Docker internal hostnames. `NEXT_PUBLIC_API_URL` uses `localhost` (accessible from the user's machine). `API_URL` uses `http://backend:8000` (internal Docker network, used by Next.js SSR and API Route Handlers).

---

## 4. Local Development

### Without Docker (recommended for active development)

**Backend:**

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download spaCy model (optional but recommended)
python -m spacy download en_core_web_sm

# Start MongoDB and ChromaDB via Docker (databases only)
docker compose up mongo chroma -d

# Run backend with hot reload
PYTHONPATH=. uvicorn backend.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend

# Install dependencies
npm install

# Start development server
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 npm run dev
```

Dashboard available at: http://localhost:3000

### Full Stack via Docker Compose

```bash
# Build and start all services
docker compose up --build

# Start in background
docker compose up --build -d

# View logs for a specific service
docker compose logs -f backend
docker compose logs -f frontend

# Restart a single service after code change
docker compose restart backend

# Stop everything
docker compose down

# Stop and remove volumes (full reset)
docker compose down -v
```

### Useful Development Commands

```bash
# Open a shell in the running backend container
docker compose exec backend bash

# Run a one-off Python script inside the backend
docker compose exec backend python -c "from backend.orchestrator.state import AgentState; print('OK')"

# Inspect MongoDB data
docker compose exec mongo mongosh ruflow_db --eval "db.applications.find().limit(3).pretty()"

# Check ChromaDB collections
curl http://localhost:8001/api/v1/collections

# Tail backend logs
docker compose logs -f --tail=100 backend
```

---

## 5. Testing

### Unit Tests

```bash
cd backend

# Install test dependencies
pip install pytest pytest-asyncio

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run a specific test file
pytest tests/test_pattern_extractor.py -v

# Run with coverage
pytest --cov=backend --cov-report=term-missing
```

### Manual API Testing

**Health check:**

```bash
curl http://localhost:8000/api/v1/health
# Expected: {"status": "ok", "service": "RuFlow API", ...}
```

**Submit an application (full pipeline):**

```bash
curl -X POST http://localhost:8000/api/v1/apply \
  -H "Content-Type: application/json" \
  -d '{
    "resume_text": "Jane Smith\nSenior Engineer with 6 years Python, AWS, Kubernetes...",
    "jd_text": "We are hiring a Senior Backend Engineer with Python and Kubernetes...",
    "user_id": "test_user_001"
  }'
```

**Get recommendations for a user:**

```bash
curl http://localhost:8000/api/v1/recommendations/test_user_001
```

**Run memory optimization:**

```bash
curl -X POST http://localhost:8000/api/v1/memory/optimize \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true}'
```

**Swagger UI (interactive):**

Open http://localhost:8000/docs in your browser for the full interactive API explorer.

### Demo Mode (No API Keys Required)

Open the dashboard at http://localhost:3000 and click **Demo Mode**. This runs the full UI pipeline using pre-built mock data — no Gemini API key is required.

---

## 6. Performance Notes

### Latency Breakdown

| Stage | Typical Duration | Notes |
|-------|-----------------|-------|
| Ingest + Planner | 1–3s | Local parsing + cheap model |
| JD Analyzer | 2–4s | gemini-2.0-flash-lite extraction |
| Retrieval (RAG) | 1–3s | Embedding + vector search |
| Resume Tailor | 8–15s | gemini-2.0-flash generation |
| Cover Letter | 8–15s | gemini-2.0-flash generation (parallel) |
| Evaluator | 5–10s | 3-layer scoring |
| Improver (per iter) | 8–15s | gemini-2.0-flash patch |
| Packager | 1–2s | DB write + embedding |
| **Total (1 iteration)** | **~35–55s** | Passes at score ≥ 80 |
| **Total (3 iterations)** | **~90–130s** | Typical complex JD |

### Optimisation Levers

**Reduce cost:**
```env
MODEL_STRONG=gemini-2.0-flash-lite     # Use mini for all tasks (lower quality)
EVAL_MAX_ITERATIONS=2         # Cap improvement loops
```

**Reduce latency:**
```env
EMBEDDING_DEVICE=cuda         # GPU acceleration (requires nvidia-docker)
WORKERS=4                     # More Uvicorn workers
```

**Memory & storage:**
```bash
# Run storage optimization (embeds un-indexed resumes, prunes low scorers)
curl -X POST http://localhost:8000/api/v1/memory/optimize \
  -d '{"dry_run": false, "prune_below_score": 40.0}'
```

### Embedding Model

The default model (`all-MiniLM-L6-v2`) produces 384-dimensional vectors and runs at ~2,000 sentences/second on CPU. For higher semantic quality at higher cost:

```env
EMBEDDING_MODEL_NAME=sentence-transformers/all-mpnet-base-v2   # 768-dim, slower
```

---

## 7. Deployment to Cloud

### AWS ECS / Fargate

```bash
# 1. Build and push images to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com

docker build -t ruflow-backend ./backend
docker tag  ruflow-backend:latest <account>.dkr.ecr.us-east-1.amazonaws.com/ruflow-backend:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/ruflow-backend:latest

docker build -t ruflow-frontend ./frontend
docker tag  ruflow-frontend:latest <account>.dkr.ecr.us-east-1.amazonaws.com/ruflow-frontend:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/ruflow-frontend:latest

# 2. Store secrets in AWS Secrets Manager
aws secretsmanager create-secret --name ruflow/gemini-key --secret-string "sk-..."

# 3. Use MongoDB Atlas for managed DB (update MONGODB_URI in task definition)
# 4. Use managed ChromaDB or deploy chroma on ECS with EFS volume
```

**Recommended managed services:**

| Component | AWS | GCP |
|-----------|-----|-----|
| MongoDB | MongoDB Atlas / DocumentDB | MongoDB Atlas |
| ChromaDB | Self-hosted on ECS + EFS | Self-hosted on Cloud Run |
| Backend | ECS Fargate | Cloud Run |
| Frontend | ECS Fargate / Amplify | Cloud Run |
| Secrets | Secrets Manager | Secret Manager |

### Production Environment Variables

Set these in your container orchestration platform (not in `.env`):

```bash
# Required secrets (inject from secrets manager, never in plaintext)
GEMINI_API_KEY

# Update these for cloud infrastructure
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/ruflow_db
CHROMA_HOST=<your-chroma-service-host>
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
API_URL=https://api.yourdomain.com/api/v1
CORS_ORIGINS=https://yourdomain.com

# Scale up for production
WORKERS=4
EVAL_MAX_ITERATIONS=3
LOG_LEVEL=WARNING
```

### Docker Compose Production Override

```bash
# Use a production override file
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 8. Troubleshooting

### Service Fails to Start

**Backend health check failing:**

```bash
# Check logs for the actual error
docker compose logs backend --tail=50

# Most common cause: API keys not set
grep "GEMINI_API_KEY" .env

# Allow more time for embedding model download
# Increase start_period in docker-compose.yml: start_period: 120s
```

**ChromaDB connection refused:**

```bash
# Verify chroma is healthy before backend starts
docker compose ps chroma
docker compose logs chroma

# Test chroma heartbeat
curl http://localhost:8001/api/v1/heartbeat
# Expected: {"nanosecond heartbeat": <timestamp>}
```

**MongoDB connection error:**

```bash
# Verify mongo is healthy
docker compose exec mongo mongosh --eval "db.adminCommand('ping')"

# Check URI in .env
grep MONGODB_URI .env
# Should be: MONGODB_URI=mongodb://mongo:27017
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `RuntimeError: Missing required environment variables: ['GEMINI_API_KEY']` | Key not in `.env` | Add key to `.env`, restart backend |
| `ConnectionFailure: Cannot connect to MongoDB` | Mongo not ready | Wait 30s, or increase `start_period` |
| `TimeoutError: Pipeline exceeded ... limit` | LLM API slow / rate limited | Retry; or set `EVAL_MAX_ITERATIONS=2` |
| `ValueError: Cannot embed empty text` | Empty resume/JD input | Ensure inputs meet minimum length |
| Port `3000` already in use | Another service on 3000 | `lsof -i :3000` then kill, or change port |
| Port `8000` already in use | Another service on 8000 | `lsof -i :8000` then kill, or change port |
| `next build` fails in Docker | Missing `output: 'standalone'` in next.config.js | Add `output: 'standalone'` to next.config.js |

### Resetting the Stack

```bash
# Soft reset — restart all containers
docker compose restart

# Hard reset — remove containers, keep data volumes
docker compose down && docker compose up -d

# Full reset — remove everything including persisted data
docker compose down -v --remove-orphans
docker compose up --build

# Clear only the in-memory cache (no data loss)
curl -X DELETE http://localhost:8000/api/v1/memory/clear/all_users \
  -H "Content-Type: application/json" \
  -d '{"confirm": true, "clear_history": false}'
```

### Viewing Logs

```bash
# All services simultaneously
docker compose logs -f

# Individual service with timestamps
docker compose logs -f --timestamps backend

# Last 200 lines from backend
docker compose logs --tail=200 backend

# Filter for errors only
docker compose logs backend 2>&1 | grep -i "error\|exception\|critical"
```

### Checking Service Health

```bash
# All container statuses
docker compose ps

# Backend health
curl -s http://localhost:8000/api/v1/health | python3 -m json.tool

# Memory / cache stats
curl -s http://localhost:8000/api/v1/memory/stats/test_user | python3 -m json.tool
```

---

## Project Structure

```
ruflow/
├── backend/
│   ├── agents/               # 7 LangGraph agent nodes
│   │   ├── planner_agent.py
│   │   ├── jd_analyzer_agent.py
│   │   ├── retrieval_agent.py
│   │   ├── resume_tailor_agent.py
│   │   ├── cover_letter_agent.py
│   │   ├── evaluator_agent.py
│   │   └── improvement_agent.py
│   ├── config/
│   │   └── settings.py       # Pydantic v2 settings
│   ├── evaluation/
│   │   └── learning_loop.py  # Pre/post submission learning
│   ├── orchestrator/
│   │   ├── state.py          # AgentState TypedDict
│   │   ├── graph.py          # LangGraph StateGraph
│   │   └── runner.py         # Async workflow executor
│   ├── routes/
│   │   ├── applications.py   # POST /apply, GET /applications
│   │   ├── memory.py         # Memory management endpoints
│   │   └── recommendations.py # Personalised recommendations
│   ├── services/
│   │   ├── llm_service.py        # Multi-model LLM router
│   │   ├── memory_service.py     # MongoDB + ChromaDB facade
│   │   ├── memory_optimizer.py   # Batch embed + aggregation
│   │   ├── pattern_extractor.py  # Counter/regex pattern mining
│   │   ├── recommendation_engine.py # User analysis + recs
│   │   └── vector_db_service.py  # Embedding + hybrid retrieval
│   ├── tools/
│   │   └── pdf_parser.py     # Resume PDF → ParsedResume
│   ├── main.py               # FastAPI app factory
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── layout.tsx        # Root layout + fonts
│   │   ├── page.tsx          # DashboardContext + routing
│   │   └── globals.css
│   ├── components/
│   │   ├── ApplicationForm.tsx
│   │   ├── LoadingState.tsx   # Live agent execution view
│   │   ├── ResultsPanel.tsx   # Scores + outputs + changelog
│   │   ├── ScoreChart.tsx     # Line + radar charts
│   │   ├── HistoryPanel.tsx   # Past applications table
│   │   ├── MetricCard.tsx     # Reusable score card
│   │   ├── ComparisonView.tsx # Iteration diff view
│   │   └── ActionToolbar.tsx  # Copy / download / reset
│   ├── lib/
│   │   ├── api.ts            # Typed API client
│   │   ├── types.ts          # TypeScript interfaces
│   │   └── mockData.ts       # Demo mode data
│   ├── Dockerfile
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## License

MIT — see `LICENSE` for details.