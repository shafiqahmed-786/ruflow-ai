// frontend/lib/mockData.ts

import type {
  ApplicationResponse,
  ApplicationSummary,
  AgentStep,
  IterationScore,
} from "./types";

export const MOCK_AGENT_STEPS: AgentStep[] = [
  {
    name: "planner",
    label: "Planner",
    description: "Decomposing task into execution plan",
    status: "waiting",
    duration_ms: null,
  },
  {
    name: "jd_analyzer",
    label: "JD Analyzer",
    description: "Extracting ATS keywords & seniority signals",
    status: "waiting",
    duration_ms: null,
  },
  {
    name: "retrieval",
    label: "Retrieval (RAG)",
    description: "Hybrid semantic + BM25 knowledge retrieval",
    status: "waiting",
    duration_ms: null,
  },
  {
    name: "resume_tailor",
    label: "Resume Tailor",
    description: "Rewriting bullets with STAR format + ATS injection",
    status: "waiting",
    duration_ms: null,
  },
  {
    name: "cover_letter",
    label: "Cover Letter",
    description: "Generating targeted cover letter with company intel",
    status: "waiting",
    duration_ms: null,
  },
  {
    name: "evaluator",
    label: "Evaluator",
    description: "Scoring ATS coverage, semantic similarity & LLM judge",
    status: "waiting",
    duration_ms: null,
  },
  {
    name: "improver",
    label: "Improver",
    description: "Surgically patching critical issues from evaluation",
    status: "waiting",
    duration_ms: null,
  },
  {
    name: "packager",
    label: "Packager",
    description: "Persisting to memory & building final output",
    status: "waiting",
    duration_ms: null,
  },
];

export const MOCK_ITERATION_SCORES: IterationScore[] = [
  {
    iteration: 1,
    keyword_coverage: 52,
    relevance: 61,
    impact: 44,
    tone_match: 58,
    cover_letter_quality: 48,
    overall: 53,
  },
  {
    iteration: 2,
    keyword_coverage: 71,
    relevance: 74,
    impact: 63,
    tone_match: 69,
    cover_letter_quality: 66,
    overall: 70,
  },
  {
    iteration: 3,
    keyword_coverage: 84,
    relevance: 87,
    impact: 79,
    tone_match: 82,
    cover_letter_quality: 81,
    overall: 83,
  },
];

export const MOCK_RESUME = `## Alex Rivera
alex.rivera@email.com · linkedin.com/in/alexrivera · github.com/arivera · San Francisco, CA

---

## Summary
Senior Backend Engineer with 7+ years designing distributed systems and ML infrastructure at scale. Deep expertise in Python, Kubernetes, and LLM integration pipelines. Led platform teams shipping to 5M+ daily active users.

---

## Experience

### Staff Software Engineer — Stripe, Inc.
*San Francisco, CA · Jan 2022 – Present*

- Architected a real-time fraud detection pipeline using Python, Apache Kafka, and PyTorch, reducing fraudulent transactions by **34%** and saving $12M annually across 180 markets
- Led migration of 40+ microservices from EC2 to Kubernetes (EKS), achieving **99.97% uptime** and cutting infrastructure costs by 28% ($2.1M/year)
- Designed and shipped an internal LLM evaluation platform (LangChain + FastAPI) used by 200 engineers to benchmark 15 proprietary models against production workloads
- Mentored 6 junior engineers; 3 promoted to mid-level within 18 months

### Senior Software Engineer — Databricks
*San Francisco, CA · Mar 2019 – Dec 2021*

- Built the core job scheduling engine in Apache Spark, reducing p99 execution latency from 4.2s to **890ms** for 10k+ daily batch jobs
- Designed a distributed vector indexing service (FAISS + PostgreSQL) serving semantic search across 50TB of enterprise data at <200ms SLA
- Owned the Python SDK (60k weekly downloads); shipped 3 major versions with zero breaking changes using backward-compatible API design

### Software Engineer — Twilio
*San Francisco, CA · Jun 2017 – Feb 2019*

- Delivered REST API endpoints powering 2B+ monthly SMS/voice events using Python, Django, and PostgreSQL with horizontal autoscaling
- Reduced CI/CD pipeline duration by 61% through parallelised test execution and Docker layer caching optimisations

---

## Skills
**Languages**: Python, TypeScript, Go, SQL  
**Infrastructure**: Kubernetes, AWS (EKS, S3, RDS, Lambda), Terraform, Docker  
**ML/AI**: PyTorch, LangChain, FAISS, Hugging Face, LangGraph  
**Databases**: PostgreSQL, MongoDB, Redis, Elasticsearch  
**Practices**: Distributed systems, MLOps, API design, technical leadership

---

## Education
**B.S. Computer Science** — UC Berkeley · 2017

---

## Certifications
AWS Certified Solutions Architect – Professional · Kubernetes Administrator (CKA)`;

export const MOCK_COVER_LETTER = `When I led the rebuild of Stripe's fraud detection pipeline, the hardest part wasn't the engineering — it was convincing stakeholders that a 34% fraud reduction was possible without adding latency to checkout. That tension between safety and speed is exactly the challenge I understand Anthropic is wrestling with as you scale Claude's inference infrastructure to millions of concurrent users.

Anthropic's approach to Constitutional AI and interpretability research isn't just impressive scientifically — it's the kind of principled engineering environment where I do my best work. The recent paper on mechanistic interpretability applied to transformer circuits in particular resonated with the systems-thinking approach I've used to debug distributed pipelines at Stripe and Databricks: understand the mechanism, not just the symptom.

My experience maps directly to this role: I've built LLM evaluation platforms serving 200 engineers, designed sub-200ms vector search across 50TB of enterprise data, and led Kubernetes migrations achieving five-nines uptime. At Databricks, I owned an open-source Python SDK with 60k weekly downloads — I understand the craft and responsibility of building infrastructure that others depend on.

I'd welcome the chance to discuss how my background in ML infrastructure and distributed systems could contribute to Anthropic's mission of building AI that is safe, beneficial, and interpretable.`;

export const MOCK_RESULT: ApplicationResponse = {
  session_id: "sess_demo_001",
  user_id: "user_demo",
  status: "passed",
  scores: {
    keyword_coverage: 84,
    relevance: 87,
    impact: 79,
    tone_match: 82,
    cover_letter_quality: 81,
    overall: 83,
  },
  resume: MOCK_RESUME,
  cover_letter: MOCK_COVER_LETTER,
  iterations: 3,
  change_log: [
    { iteration: 1, target: "resume", description: "Skills section: Added 'LangGraph', 'mechanistic interpretability', 'Constitutional AI' — missing from original" },
    { iteration: 1, target: "cover_letter", description: "Hook rewritten — removed generic opener, replaced with Stripe fraud pipeline story" },
    { iteration: 2, target: "resume", description: "Experience bullets: Quantified 4 vague bullets with latency metrics and dollar impact" },
    { iteration: 2, target: "resume", description: "Reordered sections — ML/AI experience surfaced before general backend work" },
    { iteration: 3, target: "cover_letter", description: "Paragraph 2: Added specific reference to Anthropic mechanistic interpretability paper" },
  ],
  errors: [],
  focus_areas: ["skills_gap", "keyword_density", "quantification_needed"],
  jd_role: "Staff ML Infrastructure Engineer",
  company: "Anthropic",
};

export const MOCK_HISTORY: ApplicationSummary[] = [
  {
    session_id: "sess_demo_001",
    jd_role: "Staff ML Infrastructure Engineer",
    company: "Anthropic",
    overall_score: 83,
    iterations: 3,
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    session_id: "sess_demo_002",
    jd_role: "Senior Backend Engineer",
    company: "OpenAI",
    overall_score: 91,
    iterations: 2,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    session_id: "sess_demo_003",
    jd_role: "Principal Software Engineer",
    company: "Google DeepMind",
    overall_score: 77,
    iterations: 4,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    session_id: "sess_demo_004",
    jd_role: "ML Platform Lead",
    company: "Cohere",
    overall_score: 88,
    iterations: 2,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    session_id: "sess_demo_005",
    jd_role: "Senior MLOps Engineer",
    company: "Mistral AI",
    overall_score: 65,
    iterations: 4,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
];

export const DEMO_RESUME_TEXT = `Alex Rivera | Senior Backend Engineer
alex.rivera@email.com | San Francisco, CA

EXPERIENCE
Stripe (2022-Present) — Staff Engineer
Built fraud detection system with Python and Kafka. Led Kubernetes migration.
Worked on LLM tools for internal use. Mentored junior engineers.

Databricks (2019-2021) — Senior Engineer  
Worked on Spark scheduling. Built vector search with FAISS.
Maintained Python SDK with many downloads.

Twilio (2017-2019) — Software Engineer
Built REST APIs for SMS/voice platform. Improved CI/CD pipeline.

SKILLS: Python, TypeScript, Go, Kubernetes, AWS, PyTorch, LangChain, PostgreSQL

EDUCATION: B.S. Computer Science, UC Berkeley 2017`;

export const DEMO_JD_TEXT = `Staff ML Infrastructure Engineer — Anthropic

We're looking for a Staff-level engineer to build and scale the infrastructure 
that powers Claude's training and inference at massive scale.

Requirements:
- 7+ years backend/infrastructure engineering
- Python expertise (required)
- Kubernetes, distributed systems at scale
- ML infrastructure experience (training pipelines, model serving)
- LangChain, LangGraph, or equivalent LLM framework experience
- Experience with vector databases (FAISS, ChromaDB, Pinecone)
- Constitutional AI or interpretability research interest (preferred)
- Strong written communication

You will:
- Design inference infrastructure serving millions of daily requests
- Build evaluation pipelines for safety and capability assessment  
- Lead cross-functional teams of 5-10 engineers
- Contribute to MLOps tooling used across the organisation`;