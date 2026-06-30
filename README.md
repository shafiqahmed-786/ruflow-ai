# CareerOS AI — Job Application Command Centre

> **Gappy AI Hackathon Submission** — Built on [RuFlow](https://github.com/shafiqahmed-786/ruflow-ai) (RuFlow v2.0 strict superset)

CareerOS AI is a complete, AI-powered job search command centre. It manages the full career lifecycle — from resume tailoring and JD analysis through recruiter relationship management, company intelligence, interview preparation, and offer comparison — all orchestrated by a production-grade 8-agent LangGraph pipeline.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CareerOS AI Frontend                       │
│              Next.js 14 · Tailwind · Framer Motion            │
│                                                               │
│  Overview  Applications  Copilot  Interviews  Companies       │
│  Recruiters  Offers  Memory  Analytics  Calendar  Notes       │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP / REST
┌────────────────────────▼────────────────────────────────────┐
│                 CareerOS AI Backend                           │
│              FastAPI · Uvicorn · Python 3.11+                 │
│                                                               │
│  /api/v1/apply          /api/v1/interviews                    │
│  /api/v1/applications   /api/v1/recruiters                    │
│  /api/v1/memory         /api/v1/companies                     │
│  /api/v1/recommendations /api/v1/offers                       │
│  /api/v1/analytics      /api/v1/copilot                       │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              8-Agent LangGraph Pipeline                        │
│                                                               │
│  Planner → JD Analyzer → Retrieval → Resume Tailor →          │
│  Cover Letter → Evaluator → Improver → Packager               │
│                                                               │
│  Persistent state across nodes · Conditional branching        │
│  Iterative improvement loop · Parallel sub-graphs             │
└─────────┬──────────────────────┬───────────────────────────┘
          │                      │
┌─────────▼────────┐   ┌────────▼────────────────────────────┐
│   MongoDB Atlas   │   │            ChromaDB                  │
│   Applications    │   │   Resume chunks · JD embeddings      │
│   Sessions        │   │   HybridRetriever (dense + BM25)     │
│   User profiles   │   │   RRF-merged ranking                 │
└──────────────────┘   └─────────────────────────────────────┘
```

---

## Agent Pipeline

| Agent | Responsibility | Model |
|-------|---------------|-------|
| **Planner** | Routes the request, determines execution path | `gemini-2.0-flash-lite` |
| **JD Analyzer** | Extracts keywords, requirements, ATS signals from job descriptions | `gemini-2.0-flash-lite` |
| **Retrieval** | HybridRetriever — ChromaDB dense + BM25 sparse, RRF-merged | `gemini-2.0-flash-lite` |
| **Resume Tailor** | Rewrites resume sections with retrieved context + JD alignment | `gemini-2.0-flash` |
| **Cover Letter** | Generates role-specific cover letter and recruiter outreach | `gemini-2.0-flash` |
| **Evaluator** | Scores output on ATS coverage, relevance, impact, tone (0-100) | `gemini-2.0-flash` |
| **Improver** | Rewrites low-scoring sections, re-evaluates | `gemini-2.0-flash` |
| **Packager** | Assembles final application package, stores to MongoDB | `gemini-2.0-flash-lite` |

---

## Features

### Original RuFlow (preserved 100%)
- Resume upload and PDF parsing
- Job description analysis and keyword extraction
- AI resume tailoring with ATS optimization
- Cover letter generation
- Iterative evaluation loop (Evaluator → Improver → re-score)
- Vector memory (ChromaDB) with hybrid retrieval
- Application history and session management
- Recommendations engine

### CareerOS AI Extensions
- **AI Copilot** — Conversational career assistant routing through the full agent pipeline
- **Interview Prep** — AI-generated question banks (System Design, LeetCode, Behavioural, ML)
- **Company Intelligence** — AI-researched profiles: culture, tech stack, interview process
- **Recruiter CRM** — Contact management, status tracking, AI follow-up generation
- **Offer Tracker** — Multi-offer comparison with AI negotiation analysis
- **ATS Analytics** — Score trend charts, funnel conversion, dimension breakdown
- **Application Calendar** — Deadline tracking, interview scheduling, reminders
- **Resume Memory** — Version library, ChromaDB chunk browser, retrieval visualizer
- **Notes** — Structured notes: company research, interview prep, recruiter insights

---

## Tech Stack

**Frontend**
- Next.js 14 (App Router, static export)
- TypeScript · Tailwind CSS · Framer Motion
- Recharts (analytics charts)
- Lucide React (icons)

**Backend**
- FastAPI · Uvicorn
- LangGraph (multi-agent orchestration)
- Google Gemini (LLM: `gemini-2.0-flash` + `gemini-2.0-flash-lite`)
- ChromaDB (vector store) · sentence-transformers
- Motor (async MongoDB) · rank-bm25

**Infrastructure**
- Docker Compose (local dev)
- Vercel (frontend deploy)
- Render / Railway (backend deploy)
- MongoDB Atlas (production DB)

---

## Environment Variables

### Backend (required)

```env
GEMINI_API_KEY=your-gemini-api-key-here
MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/careeros
SECRET_KEY=your-32-char-secret-key
CORS_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000
```

### Backend (optional, have defaults)

```env
CHROMA_HOST=localhost
CHROMA_PORT=8000
MODEL_STRONG=gemini-2.0-flash
MODEL_FAST=gemini-2.0-flash-lite
LLM_MAX_TOKENS=4096
LLM_TEMPERATURE=0.3
LOG_LEVEL=INFO
```

### Frontend

```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

---

## Deployment

### Frontend → Vercel

```bash
cd frontend
npm install
npm run build          # verify locally first

# Deploy
npx vercel --prod
# Set env var: NEXT_PUBLIC_API_URL=<your backend URL>
```

### Backend → Render

1. Create a new **Web Service** on [render.com](https://render.com)
2. Connect your GitHub repo (`shafiqahmed-786/ruflow-ai`, branch `careeros-v2`)
3. Set:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables (see above)
5. Deploy

### Full stack local (Docker Compose)

```bash
# Copy and fill in your env vars
cp .env.example .env

# Start everything
docker compose up --build

# Frontend: http://localhost:3000
# Backend:  http://localhost:8080
# API docs: http://localhost:8080/docs
```

---

## Demo Flow (5-minute walkthrough)

1. **Overview Dashboard** — Career funnel, ATS metrics, agent activity feed, upcoming deadlines
2. **New Application** (`/dashboard/applications/new`) — Upload resume PDF + paste JD → trigger full 8-agent pipeline
3. **Pipeline View** (`/dashboard/pipeline`) — Watch real-time LangGraph node execution
4. **AI Copilot** (`/dashboard/copilot`) — "Tailor my resume for OpenAI" → full agent pipeline response
5. **Interview Prep** (`/dashboard/interviews`) — AI generates system design questions for Anthropic
6. **Company Intel** (`/dashboard/companies`) — Research Mistral AI culture, tech stack, interview tips
7. **Recruiter CRM** (`/dashboard/recruiters`) — Generate AI follow-up for 7-days-cold recruiter
8. **Offer Tracker** (`/dashboard/offers`) — Compare Perplexity vs Stripe with negotiation advice
9. **ATS Analytics** (`/dashboard/analytics`) — Score trend from 71 → 86.4 over 6 weeks
10. **Resume Memory** (`/dashboard/memory`) — ChromaDB chunk viewer, retrieval similarity scores

---

## API Reference

Full interactive docs at `/docs` (Swagger UI) or `/redoc` after starting the backend.

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/apply` | Run full 8-agent pipeline |
| `POST` | `/api/v1/apply/pdf` | Upload PDF + run pipeline |
| `GET`  | `/api/v1/applications/{session_id}` | Retrieve application result |
| `POST` | `/api/v1/copilot/chat` | AI Copilot chat with intent routing |
| `POST` | `/api/v1/interviews/prep-questions` | Generate AI prep questions |
| `POST` | `/api/v1/companies/research` | AI company research |
| `POST` | `/api/v1/offers/compare` | Compare offers with AI analysis |
| `POST` | `/api/v1/recruiters/follow-up` | Generate AI follow-up email |
| `GET`  | `/api/v1/analytics/{user_id}/ats-trend` | ATS score trend over time |
| `GET`  | `/health` | Liveness probe |

---

## Verification Summary

| Check | Result |
|-------|--------|
| TypeScript errors | **0** |
| Frontend build | **18/18 routes — exit 0** |
| Backend imports | **All modules clean** |
| LangGraph compilation | **CompiledStateGraph, 10 nodes** |
| OpenAPI paths | **30 endpoints** |
| Dependency issues fixed | **google-generativeai, httpx added** |

---

## Future Roadmap

- Live web search agent (Tavily integration, already stubbed in settings)
- Lemma workflow integration for scheduled reminders
- Multi-resume simultaneous tailoring
- Calendar sync (Google Calendar API)
- LinkedIn recruiter auto-outreach
- spaCy NER model for richer JD entity extraction (model download required)
- Real-time WebSocket pipeline status streaming

---

*Built with ❤️ for the Gappy AI Hackathon. Original RuFlow architecture by Shafiq Ahmed.*
