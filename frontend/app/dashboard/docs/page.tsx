"use client";

// frontend/app/dashboard/docs/page.tsx
import { useState } from "react";
import { motion }   from "framer-motion";
import {
  BookOpen, Layers, GitMerge, BarChart3, Database,
  Server, Code2, Workflow, ChevronRight, Terminal,
  ExternalLink, Zap,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn }        from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DocSection {
  id:      string;
  label:   string;
  icon:    React.ElementType;
}

interface ApiEndpoint {
  method: "POST" | "GET" | "DELETE";
  path:   string;
  desc:   string;
}

interface PipelineStep {
  step:  string;
  agent: string;
  model: string;
  out:   string;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const SECTIONS: DocSection[] = [
  { id: "overview",    label: "Platform Overview",    icon: BookOpen    },
  { id: "agents",      label: "Agent Architecture",   icon: Layers      },
  { id: "pipeline",    label: "Pipeline Lifecycle",   icon: GitMerge    },
  { id: "ats",         label: "ATS Evaluation",       icon: BarChart3   },
  { id: "memory",      label: "Retrieval Memory",     icon: Database    },
  { id: "api",         label: "API Endpoints",        icon: Code2       },
  { id: "deployment",  label: "Deployment Stack",     icon: Server      },
];

const PIPELINE_STEPS: PipelineStep[] = [
  { step: "01", agent: "Planner Agent",       model: "GPT-4o-mini",   out: "execution_plan, model_routing"         },
  { step: "02", agent: "JD Analyzer",         model: "GPT-4o-mini",   out: "parsed_jd, ats_keywords[]"             },
  { step: "03", agent: "Retrieval Agent",     model: "Embedding+BM25",out: "retrieved_jd_context, company_intel"   },
  { step: "04", agent: "Resume Tailor",       model: "GPT-4o",        out: "tailored_resume: markdown"             },
  { step: "05", agent: "Cover Letter Agent",  model: "GPT-4o",        out: "cover_letter: plaintext"               },
  { step: "06", agent: "Evaluator Agent",     model: "GPT-4o",        out: "eval_scores{}, eval_feedback"          },
  { step: "07", agent: "Improvement Agent",   model: "GPT-4o",        out: "patched_resume, change_log[]"          },
  { step: "08", agent: "Packager",            model: "GPT-4o-mini",   out: "final_output → MongoDB + ChromaDB"     },
];

const API_ENDPOINTS: ApiEndpoint[] = [
  { method: "POST", path: "/api/v1/apply",                      desc: "Run full multi-agent pipeline" },
  { method: "POST", path: "/api/v1/apply/pdf",                  desc: "Pipeline with PDF resume upload" },
  { method: "GET",  path: "/api/v1/applications/{session_id}",  desc: "Retrieve completed application" },
  { method: "GET",  path: "/api/v1/applications/user/{user_id}",desc: "List all user applications" },
  { method: "POST", path: "/api/v1/memory/optimize",            desc: "Batch embed + prune storage" },
  { method: "GET",  path: "/api/v1/recommendations/{user_id}",  desc: "Get personalised recommendations" },
  { method: "POST", path: "/api/v1/recommendations/{user_id}/pre-submission-check", desc: "Pre-submission gap analysis" },
  { method: "DELETE", path: "/api/v1/memory/clear/{user_id}",   desc: "Clear cache and history" },
];

const METHOD_STYLE: Record<ApiEndpoint["method"], string> = {
  POST:   "text-text-accent  bg-accent-subtle  border-accent/25",
  GET:    "text-amber        bg-amber-subtle   border-amber/25",
  DELETE: "text-danger       bg-danger-subtle  border-danger/25",
};

// ── Shared ─────────────────────────────────────────────────────────────────────
function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-base font-bold text-text-primary mb-3 pt-1 tracking-tight scroll-mt-20">
      {children}
    </h2>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2 mt-4">
      {children}
    </h3>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs text-text-secondary leading-relaxed">
      {children}
    </p>
  );
}

function CodeBlock({ code, lang = "python" }: { code: string; lang?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-background-secondary">
        <div className="flex items-center gap-1.5">
          <Terminal className="h-3 w-3 text-text-muted" aria-hidden="true" />
          <span className="font-mono text-[10px] text-text-muted">{lang}</span>
        </div>
      </div>
      <pre className="px-4 py-3 font-mono text-[11px] text-text-primary overflow-x-auto leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

// ── Doc sections ───────────────────────────────────────────────────────────────

function Overview() {
  return (
    <section className="space-y-3">
      <SectionHeading id="overview">Platform Overview</SectionHeading>
      <Prose>
        RuFlow is an autonomous multi-agent AI system that parses resumes and job descriptions,
        retrieves contextual knowledge via hybrid RAG, generates ATS-optimized application
        materials, and iteratively improves them through a self-evaluation loop.
      </Prose>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        {[
          { label: "Agents",    value: "8",         sub: "autonomous agents"      },
          { label: "Stack",     value: "LangGraph",  sub: "StateGraph orchestration"},
          { label: "Storage",   value: "Dual-layer", sub: "MongoDB + ChromaDB"    },
        ].map((item) => (
          <GlassCard key={item.label} className="p-4 text-center">
            <p className="font-mono text-lg font-bold text-text-accent leading-none mb-0.5">{item.value}</p>
            <p className="font-mono text-[10px] text-text-muted">{item.sub}</p>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}

function AgentArchitecture() {
  return (
    <section className="space-y-3">
      <SectionHeading id="agents">Agent Architecture</SectionHeading>
      <Prose>
        Each agent is a specialized LangGraph node that accepts and returns the shared{" "}
        <code className="bg-surface-raised px-1 rounded text-text-accent">AgentState</code>{" "}
        TypedDict. Agents are routed by the Planner and execute sequentially or in parallel
        depending on the execution plan.
      </Prose>
      <SubHeading>State Schema</SubHeading>
      <CodeBlock lang="typescript" code={`interface AgentState {
  session_id:        string;
  raw_resume_text:   string;
  raw_jd_text:       string;
  parsed_jd:         ParsedJD;
  tailored_resume:   string | null;
  cover_letter:      string | null;
  eval_scores:       EvalScores;
  eval_feedback:     string | null;
  iteration_count:   number;
  eval_status:       EvalStatus;
  model_routing:     Record<string, string>;
  errors:            string[];
}`} />
      <SubHeading>Model Routing</SubHeading>
      <Prose>
        The Planner agent assigns LLM models to each downstream agent based on task complexity.
        Extraction tasks use <code className="bg-surface-raised px-1 rounded text-text-accent">gpt-4o-mini</code>;
        reasoning and generation tasks use <code className="bg-surface-raised px-1 rounded text-text-accent">gpt-4o</code>.
        All models fall back through a 4-model chain on rate-limit or timeout errors.
      </Prose>
    </section>
  );
}

function PipelineLifecycle() {
  return (
    <section className="space-y-3">
      <SectionHeading id="pipeline">Pipeline Lifecycle</SectionHeading>
      <Prose>
        The pipeline is a compiled LangGraph StateGraph. Nodes execute sequentially with a
        parallel fork at the Resume Tailor + Cover Letter agents, followed by a conditional
        evaluation loop that iterates up to 4 times until the composite score exceeds 80.
      </Prose>
      <div className="space-y-1.5 mt-3">
        {PIPELINE_STEPS.map((s) => (
          <div key={s.step} className="grid grid-cols-[28px_1fr_1fr_1fr] gap-2 items-start px-3 py-2.5 rounded-lg border border-border bg-background-secondary hover:bg-surface-raised transition-colors">
            <span className="font-mono text-[9px] text-text-muted">{s.step}</span>
            <span className="font-mono text-[10px] text-text-primary font-semibold">{s.agent}</span>
            <span className="font-mono text-[10px] text-text-accent">{s.model}</span>
            <span className="font-mono text-[10px] text-text-muted truncate">{s.out}</span>
          </div>
        ))}
      </div>
      <SubHeading>Conditional Routing</SubHeading>
      <CodeBlock lang="python" code={`def route_eval(state: AgentState) -> str:
    overall = state["eval_scores"].get("overall", 0.0)
    if overall >= 80.0 or state["iteration_count"] >= 4:
        return "done"     # → packager
    return "improve"      # → improver → evaluator (loop)`} />
    </section>
  );
}

function AtsEvaluation() {
  return (
    <section className="space-y-3">
      <SectionHeading id="ats">ATS Evaluation System</SectionHeading>
      <Prose>
        The Evaluator agent applies a 3-layer scoring system. Scores are fused with weighted
        averages: programmatic ATS (30%), semantic similarity (25%), LLM judge (45%).
      </Prose>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        {[
          { layer: "Layer 1", name: "Programmatic ATS", desc: "Regex word-boundary keyword match against ats_keywords[]" },
          { layer: "Layer 2", name: "Semantic Similarity", desc: "Cosine similarity via Sentence Transformers (L2-normalised)" },
          { layer: "Layer 3", name: "LLM Judge", desc: "GPT-4o holistic scoring across 5 quality dimensions" },
        ].map((item) => (
          <GlassCard key={item.layer} className="p-4">
            <span className="font-mono text-[9px] text-text-accent uppercase tracking-widest">{item.layer}</span>
            <p className="font-mono text-xs font-semibold text-text-primary mt-1 mb-1">{item.name}</p>
            <p className="font-mono text-[10px] text-text-muted leading-relaxed">{item.desc}</p>
          </GlassCard>
        ))}
      </div>
      <SubHeading>Score Weights</SubHeading>
      <CodeBlock lang="python" code={`overall = (
    keyword_coverage     * 0.30
    + relevance          * 0.25
    + impact             * 0.20
    + tone_match         * 0.15
    + cover_letter_quality * 0.10
)`} />
    </section>
  );
}

function RetrievalMemory() {
  return (
    <section className="space-y-3">
      <SectionHeading id="memory">Retrieval Memory</SectionHeading>
      <Prose>
        RuFlow uses a dual-layer memory backend: MongoDB for structured application records and
        ChromaDB for dense vector embeddings. Retrieval combines BM25 sparse search with dense
        Sentence Transformer embeddings, fused via Reciprocal Rank Fusion (RRF).
      </Prose>
      <SubHeading>Hybrid Retrieval Formula</SubHeading>
      <CodeBlock lang="python" code={`# Reciprocal Rank Fusion (RRF)
def rrf_score(rank: int, k: int = 60) -> float:
    return 1 / (k + rank)

# Fuse dense + sparse ranked lists
for rank, chunk in enumerate(dense_results, 1):
    rrf_scores[chunk.text] += 0.7 * rrf_score(rank)
for rank, chunk in enumerate(bm25_results, 1):
    rrf_scores[chunk.text] += 0.3 * rrf_score(rank)`} />
    </section>
  );
}

function ApiReference() {
  return (
    <section className="space-y-3">
      <SectionHeading id="api">API Endpoints</SectionHeading>
      <Prose>
        Base URL: <code className="bg-surface-raised px-1 rounded text-text-accent">/api/v1</code>.
        All endpoints return structured JSON. Authentication via Bearer token (header).
      </Prose>
      <div className="space-y-1.5 mt-3">
        {API_ENDPOINTS.map((ep) => (
          <div key={ep.path} className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-border bg-background-secondary hover:bg-surface-raised transition-colors group">
            <span className={cn(
              "flex-shrink-0 font-mono text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider",
              METHOD_STYLE[ep.method]
            )}>
              {ep.method}
            </span>
            <code className="font-mono text-[11px] text-text-primary flex-1 break-all">{ep.path}</code>
            <span className="font-mono text-[10px] text-text-muted hidden sm:block flex-shrink-0 max-w-[200px] text-right">{ep.desc}</span>
          </div>
        ))}
      </div>
      <SubHeading>Example Request</SubHeading>
      <CodeBlock lang="bash" code={`curl -X POST https://api.ruflow.ai/api/v1/apply \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <token>" \\
  -d '{
    "resume_text": "Jane Smith\\nSenior Engineer...",
    "jd_text": "We are hiring a Staff ML Engineer...",
    "user_id": "user_abc123"
  }'`} />
    </section>
  );
}

function DeploymentStack() {
  return (
    <section className="space-y-3">
      <SectionHeading id="deployment">Deployment Stack</SectionHeading>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { layer: "Backend",   tech: "FastAPI + Uvicorn", detail: "Async, 4 workers, health checks" },
          { layer: "Frontend",  tech: "Next.js 14 (App Router)", detail: "Standalone output, Docker multi-stage" },
          { layer: "Database",  tech: "MongoDB 7.0 + ChromaDB 0.4.24", detail: "Pinned versions, named volumes" },
          { layer: "Embedding", tech: "Sentence Transformers", detail: "all-MiniLM-L6-v2, CPU/GPU, cached" },
          { layer: "LLMs",      tech: "OpenAI + Anthropic", detail: "4-model fallback chain, retry backoff" },
          { layer: "Orchestration", tech: "LangGraph 0.1+", detail: "StateGraph, ainvoke, thread-safe" },
        ].map((item) => (
          <GlassCard key={item.layer} className="p-4">
            <span className="font-mono text-[9px] text-text-muted uppercase tracking-widest">{item.layer}</span>
            <p className="font-mono text-xs font-semibold text-text-primary mt-0.5 mb-0.5">{item.tech}</p>
            <p className="font-mono text-[10px] text-text-muted">{item.detail}</p>
          </GlassCard>
        ))}
      </div>
      <SubHeading>Single-command Deploy</SubHeading>
      <CodeBlock lang="bash" code={`cp .env.example .env   # fill OPENAI_API_KEY + ANTHROPIC_API_KEY
docker compose up --build`} />
    </section>
  );
}

const SECTION_COMPONENTS: Record<string, React.FC> = {
  overview:   Overview,
  agents:     AgentArchitecture,
  pipeline:   PipelineLifecycle,
  ats:        AtsEvaluation,
  memory:     RetrievalMemory,
  api:        ApiReference,
  deployment: DeploymentStack,
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DocsPage() {
  const [active, setActive] = useState("overview");
  const Content = SECTION_COMPONENTS[active] ?? Overview;

  return (
    <div className="max-w-[1280px] space-y-5">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-xl font-bold text-text-primary tracking-tight">RuFlow Documentation</h1>
        <p className="font-mono text-xs text-text-muted mt-1">
          Architecture, orchestration, and AI pipeline reference.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5">
        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <GlassCard className="p-2 md:sticky md:top-4">
            <nav aria-label="Documentation sections">
              {SECTIONS.map((sec) => {
                const Icon = sec.icon;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setActive(sec.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-md font-mono text-xs text-left transition-colors duration-150",
                      active === sec.id
                        ? "bg-accent-subtle text-text-accent border border-accent/20"
                        : "text-text-muted hover:text-text-primary hover:bg-surface-raised border border-transparent"
                    )}
                    aria-current={active === sec.id ? "page" : undefined}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                    {sec.label}
                    {active === sec.id && <ChevronRight className="h-3 w-3 ml-auto text-text-accent" aria-hidden="true" />}
                  </button>
                );
              })}
            </nav>
          </GlassCard>
        </motion.div>

        {/* Content */}
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <GlassCard className="p-6">
            <Content />
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}