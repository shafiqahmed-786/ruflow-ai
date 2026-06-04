"use client";

// frontend/app/dashboard/playground/page.tsx
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence }     from "framer-motion";
import {
  Play, Square, Brain, Database, Sparkles, BarChart3,
  RefreshCw, Zap, ChevronDown, Terminal, Clock,
  Activity, GitMerge, Cpu, AlertTriangle, CheckCircle2,
  Loader2, FileText, PenTool, Code2,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button }    from "@/components/ui/Button";
import { cn }        from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type RunStatus   = "idle" | "running" | "complete" | "stopped";
type OutputTab   = "resume" | "cover" | "ats" | "json";
type StageStatus = "idle" | "running" | "done" | "skipped";
type LogLevel    = "info" | "warn" | "success" | "error";

interface SelectOption  { value: string; label: string }
interface PromptPreset  { label: string; value: string }
interface ConsoleLine   { id: number; ts: string; level: LogLevel; msg: string }
interface TimelineStage { id: string; label: string; icon: React.ElementType; status: StageStatus; ms: string | null }
interface AgentEvent    { id: number; ts: string; agent: string; event: string; status: "done" | "running" | "warn" }

// ── Mock data ──────────────────────────────────────────────────────────────────
const PROMPT_PRESETS: PromptPreset[] = [
  { label: "Staff ML Engineer",    value: "Optimize for a Staff ML Infrastructure Engineer role at an AI safety company. Focus on distributed systems, model serving, and evaluation pipelines." },
  { label: "Senior Backend",       value: "Target a Senior Backend Engineer role at a fintech scale-up. Emphasize high-throughput APIs, PostgreSQL optimization, and Kubernetes deployments." },
  { label: "Principal Architect",  value: "Tailor for a Principal Software Architect role. Highlight cross-functional leadership, system design at scale, and migration of legacy infrastructure." },
];

const PROVIDERS: SelectOption[] = [
  { value: "openai",    label: "OpenAI"    },
  { value: "anthropic", label: "Anthropic" },
  { value: "gemini",    label: "Gemini"    },
];

const PRIMARY_MODELS: SelectOption[] = [
  { value: "gpt-4o",                    label: "GPT-4o"                     },
  { value: "gpt-4o-mini",               label: "GPT-4o-mini"                },
  { value: "claude-sonnet-4-20250514",  label: "Claude Sonnet 4"            },
  { value: "claude-haiku-4-5",          label: "Claude Haiku 4.5"           },
  { value: "gemini-2.0-flash",          label: "Gemini 2.0 Flash"           },
];

const FALLBACK_MODELS: SelectOption[] = [
  { value: "gpt-4o-mini",              label: "GPT-4o-mini (default)"   },
  { value: "claude-haiku-4-5",         label: "Claude Haiku 4.5"        },
  { value: "gemini-flash-lite",        label: "Gemini Flash Lite"       },
];

const MAX_TOKEN_OPTIONS: SelectOption[] = [
  { value: "1024", label: "1 024" },
  { value: "2048", label: "2 048" },
  { value: "4096", label: "4 096 (default)" },
  { value: "8192", label: "8 192" },
];

const INITIAL_STAGES: TimelineStage[] = [
  { id: "planner",   label: "Planner",        icon: Brain,        status: "idle", ms: null },
  { id: "retrieval", label: "Retrieval",       icon: Database,     status: "idle", ms: null },
  { id: "tailor",    label: "Resume Tailor",   icon: Sparkles,     status: "idle", ms: null },
  { id: "eval",      label: "Evaluator",       icon: BarChart3,    status: "idle", ms: null },
  { id: "improve",   label: "Improvement",     icon: RefreshCw,    status: "idle", ms: null },
  { id: "output",    label: "Final Output",    icon: Zap,          status: "idle", ms: null },
];

const MOCK_RESUME_OUT = `## Alex Rivera
alex.rivera@email.com · San Francisco, CA

## Summary
Staff Backend Engineer with 7+ years building distributed systems and ML infrastructure at scale. Led 40+ microservice Kubernetes migrations achieving 99.97% uptime. Deep expertise in Python, LangGraph, and LLM evaluation pipelines.

## Experience
### Staff Software Engineer — Stripe
- Reduced fraudulent transactions **34%** via real-time Kafka + PyTorch fraud pipeline saving $12M annually
- Cut infrastructure costs **28%** ($2.1M/year) via Kubernetes (EKS) migration of 40+ microservices`;

const MOCK_COVER_OUT = `When I reduced checkout latency by 43% at Stripe, the hardest part wasn't the engineering — it was demonstrating that speed is a safety property. That exact tension between velocity and reliability maps directly to the infrastructure challenges Anthropic faces scaling Claude's inference layer.

My experience architecting LLM evaluation platforms, vector search systems, and high-throughput APIs positions me well to contribute to your ML infrastructure mission.`;

const MOCK_ATS_OUT = `Keyword Coverage:    91 / 100  ████████████████░░
Semantic Relevance:  87 / 100  ████████████████░░
Impact Scoring:      82 / 100  ███████████████░░░
Tone Alignment:      88 / 100  ████████████████░░
Overall Score:       87 / 100  ████████████████░░

Matched: Python, Kubernetes, distributed systems, LangGraph, PyTorch, FastAPI
Missing: constitutional AI, RLHF, mechanistic interpretability`;

const MOCK_JSON_OUT = `{
  "session_id": "sess_playground_001",
  "status": "passed",
  "iterations": 2,
  "scores": {
    "keyword_coverage": 91,
    "relevance": 87,
    "impact": 82,
    "tone_match": 88,
    "overall": 87.0
  },
  "model_routing": {
    "planner": "gpt-4o-mini",
    "resume_tailor": "gpt-4o",
    "evaluator": "gpt-4o"
  }
}`;

// Scripted console log sequence
const LOG_SCRIPT: Omit<ConsoleLine, "id">[] = [
  { ts: "00:00.000", level: "info",    msg: "Pipeline initialised — session_id: sess_playground_001" },
  { ts: "00:00.082", level: "info",    msg: "[planner] Decomposing execution plan…" },
  { ts: "00:00.914", level: "success", msg: "[planner] Plan complete — 6 agents, model_routing assigned" },
  { ts: "00:01.102", level: "info",    msg: "[jd_analyzer] Extracting ATS keywords from JD…" },
  { ts: "00:01.931", level: "success", msg: "[jd_analyzer] 28 keywords extracted, seniority=staff" },
  { ts: "00:02.014", level: "info",    msg: "[retrieval] Hybrid RAG query — semantic + BM25 fusion" },
  { ts: "00:02.440", level: "warn",    msg: "[retrieval] Primary provider timeout (Gemini 2.0) — activating fallback" },
  { ts: "00:02.441", level: "info",    msg: "[fallback] Switching to GPT-4o-mini for retrieval stage" },
  { ts: "00:03.221", level: "success", msg: "[retrieval] 5 JD chunks, 3 resume examples retrieved (RRF fused)" },
  { ts: "00:03.310", level: "info",    msg: "[resume_tailor] Rewriting bullets — STAR format + keyword injection" },
  { ts: "00:05.844", level: "success", msg: "[resume_tailor] Resume optimised — 12 bullets rewritten, 28 keywords injected" },
  { ts: "00:05.901", level: "info",    msg: "[cover_letter] Generating personalised cover letter…" },
  { ts: "00:08.112", level: "success", msg: "[cover_letter] Cover letter complete — 298 words, hook-first structure" },
  { ts: "00:08.200", level: "info",    msg: "[evaluator] Running 3-layer ATS evaluation…" },
  { ts: "00:10.330", level: "success", msg: "[evaluator] Score: 74.1 — below threshold 80.0, queuing improvement" },
  { ts: "00:10.340", level: "info",    msg: "[improver] Iteration 1 — patching 4 critical issues" },
  { ts: "00:12.881", level: "success", msg: "[improver] Patches applied — 6 changes logged" },
  { ts: "00:12.900", level: "info",    msg: "[evaluator] Re-evaluating iteration 2…" },
  { ts: "00:14.720", level: "success", msg: "[evaluator] Score: 87.0 — threshold met (≥80)" },
  { ts: "00:14.800", level: "success", msg: "[packager] Output persisted → MongoDB + ChromaDB" },
  { ts: "00:14.822", level: "success", msg: "Pipeline complete — 2 iterations, 14.8s runtime, 9 240 tokens" },
];

const AGENT_EVENTS: AgentEvent[] = [
  { id: 1, ts: "00:00.082", agent: "Planner",      event: "Execution plan generated",     status: "done"    },
  { id: 2, ts: "00:01.102", agent: "JD Analyzer",  event: "28 keywords extracted",         status: "done"    },
  { id: 3, ts: "00:02.014", agent: "Retrieval",     event: "Timeout — fallback activated",  status: "warn"    },
  { id: 4, ts: "00:03.310", agent: "Resume Tailor", event: "12 bullets rewritten",          status: "done"    },
  { id: 5, ts: "00:05.901", agent: "Cover Letter",  event: "298-word letter generated",     status: "done"    },
  { id: 6, ts: "00:08.200", agent: "Evaluator",     event: "Score 74.1 — improving",        status: "warn"    },
  { id: 7, ts: "00:10.340", agent: "Improver",      event: "Iteration 1 — 4 issues patched",status: "done"   },
  { id: 8, ts: "00:12.900", agent: "Evaluator",     event: "Score 87.0 — passed",           status: "done"    },
  { id: 9, ts: "00:14.800", agent: "Packager",      event: "Output persisted",              status: "done"    },
];

// Stage timing sequence (ms delay for each stage to flip to "running" then "done")
const STAGE_TIMINGS = [900, 1900, 3200, 8100, 10200, 14700];
const STAGE_DONE_MS = ["0.9s", "1.9s", "3.2s", "8.1s", "12.8s", "14.8s"];

// ── Utility ────────────────────────────────────────────────────────────────────
function SelectInput({ id, value, onChange, options, disabled }: {
  id: string; value: string; onChange: (v: string) => void;
  options: SelectOption[]; disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full h-8 px-3 pr-8 rounded-md border border-border bg-background-secondary font-mono text-xs text-text-primary focus:outline-none focus:border-border-strong transition-colors appearance-none disabled:opacity-50"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-2 h-3.5 w-3.5 text-text-muted pointer-events-none" aria-hidden="true" />
    </div>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="font-mono text-[10px] text-text-muted uppercase tracking-widest block mb-1.5">
      {children}
    </label>
  );
}

function Toggle({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" id={id} aria-checked={checked} aria-label={label} onClick={onChange}
      className={cn("relative w-8 h-4 rounded-full border transition-colors duration-200 flex-shrink-0",
        checked ? "bg-accent border-accent" : "bg-background-secondary border-border")}>
      <span className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200",
        checked ? "translate-x-4" : "translate-x-0.5")} aria-hidden="true" />
    </button>
  );
}

function LogLevelDot({ level }: { level: LogLevel }) {
  const cls = level === "success" ? "text-text-accent" : level === "warn" ? "text-amber" : level === "error" ? "text-danger" : "text-text-muted";
  const pfx = level === "success" ? "✓" : level === "warn" ? "⚠" : level === "error" ? "✗" : "·";
  return <span className={cn("font-mono text-[10px] flex-shrink-0", cls)}>{pfx}</span>;
}

const STAGE_STATUS_RING: Record<StageStatus, string> = {
  done:    "border-accent/40 bg-accent-subtle",
  running: "border-amber/40  bg-amber-subtle",
  idle:    "border-border     bg-background-secondary",
  skipped: "border-border     bg-background-secondary",
};
const STAGE_ICON_CLS: Record<StageStatus, string> = {
  done:    "text-text-accent",
  running: "text-amber",
  idle:    "text-text-muted",
  skipped: "text-text-muted",
};

// ── Panels ─────────────────────────────────────────────────────────────────────

function LeftPanel({
  prompt, setPrompt, provider, setProvider,
  primaryModel, setPrimaryModel, fallbackModel, setFallbackModel,
  temperature, setTemperature, maxTokens, setMaxTokens,
  toggles, setToggles,
  onRun, onStop, runStatus,
}: {
  prompt: string; setPrompt: (v: string) => void;
  provider: string; setProvider: (v: string) => void;
  primaryModel: string; setPrimaryModel: (v: string) => void;
  fallbackModel: string; setFallbackModel: (v: string) => void;
  temperature: number; setTemperature: (v: number) => void;
  maxTokens: string; setMaxTokens: (v: string) => void;
  toggles: Record<string, boolean>; setToggles: (v: Record<string, boolean>) => void;
  onRun: () => void; onStop: () => void; runStatus: RunStatus;
}) {
  const running = runStatus === "running";

  return (
    <div className="space-y-3">
      {/* Prompt editor */}
      <GlassCard className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <FieldLabel>Prompt / Context</FieldLabel>
          <SelectInput
            id="preset"
            value=""
            onChange={(v) => { const p = PROMPT_PRESETS.find((pr) => pr.label === v); if (p) setPrompt(p.value); }}
            options={[{ value: "", label: "Presets…" }, ...PROMPT_PRESETS.map((p) => ({ value: p.label, label: p.label }))]}
            disabled={running}
          />
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={running}
          placeholder="Describe the optimization goal or paste a job description context…"
          rows={7}
          className="w-full resize-none rounded-md border border-border bg-background-secondary font-mono text-xs text-text-primary placeholder:text-text-muted p-3 leading-relaxed focus:outline-none focus:border-border-strong disabled:opacity-50 transition-colors"
        />
        <p className="font-mono text-[10px] text-text-muted text-right">{prompt.length} chars</p>
      </GlassCard>

      {/* Model config */}
      <GlassCard className="p-4 space-y-3">
        <p className="font-mono text-[10px] text-text-muted uppercase tracking-widest">Model Configuration</p>
        <div>
          <FieldLabel htmlFor="provider">Provider</FieldLabel>
          <SelectInput id="provider" value={provider} onChange={setProvider} options={PROVIDERS} disabled={running} />
        </div>
        <div>
          <FieldLabel htmlFor="primary-model">Primary Model</FieldLabel>
          <SelectInput id="primary-model" value={primaryModel} onChange={setPrimaryModel} options={PRIMARY_MODELS} disabled={running} />
        </div>
        <div>
          <FieldLabel htmlFor="fallback-model">Fallback Model</FieldLabel>
          <SelectInput id="fallback-model" value={fallbackModel} onChange={setFallbackModel} options={FALLBACK_MODELS} disabled={running} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <FieldLabel htmlFor="temp">Temperature</FieldLabel>
            <span className="font-mono text-[11px] text-text-accent font-semibold">{temperature.toFixed(2)}</span>
          </div>
          <input id="temp" type="range" min={0} max={1} step={0.05} value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            disabled={running} aria-label="Temperature"
            className="w-full accent-accent disabled:opacity-50" />
          <div className="flex justify-between font-mono text-[9px] text-text-muted mt-0.5">
            <span>Precise</span><span>Creative</span>
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="maxtok">Max Tokens</FieldLabel>
          <SelectInput id="maxtok" value={maxTokens} onChange={setMaxTokens} options={MAX_TOKEN_OPTIONS} disabled={running} />
        </div>
      </GlassCard>

      {/* Orchestration toggles */}
      <GlassCard className="p-4 space-y-0 divide-y divide-border">
        <p className="font-mono text-[10px] text-text-muted uppercase tracking-widest pb-2">Orchestration</p>
        {[
          { key: "multiagent", label: "Multi-Agent Pipeline" },
          { key: "retrieval",  label: "Retrieval Memory"     },
          { key: "ats",        label: "ATS Evaluation"       },
          { key: "memory",     label: "Memory Injection"     },
          { key: "streaming",  label: "Streaming Output"     },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between py-2.5">
            <label htmlFor={`tog-${key}`} className="font-mono text-xs text-text-secondary cursor-pointer">{label}</label>
            <Toggle id={`tog-${key}`} checked={!!toggles[key]} onChange={() => setToggles({ ...toggles, [key]: !toggles[key] })} label={label} />
          </div>
        ))}
      </GlassCard>

      {/* Execute */}
      <div className="flex gap-2">
        <Button
          variant="primary" size="md" onClick={onRun} type="button"
          disabled={running || !prompt.trim()} loading={running}
          className="flex-1"
        >
          <Play className="h-3.5 w-3.5" aria-hidden="true" />
          {running ? "Running…" : "Run Pipeline"}
        </Button>
        {running && (
          <Button variant="secondary" size="md" onClick={onStop} type="button">
            <Square className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}

function CenterPanel({ consoleLines, stages, runStatus }: {
  consoleLines: ConsoleLine[]; stages: TimelineStage[]; runStatus: RunStatus;
}) {
  const [outputTab, setOutputTab] = useState<OutputTab>("resume");
  const consoleRef = useRef<HTMLDivElement>(null);
  const showOutput = runStatus === "complete";

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleLines]);

  return (
    <div className="space-y-3">
      {/* Console */}
      <GlassCard className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background-secondary">
          <div className="flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-text-accent" aria-hidden="true" />
            <span className="font-mono text-xs font-semibold text-text-primary">Execution Console</span>
          </div>
          {runStatus === "running" && (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" aria-hidden="true" />
              <span className="font-mono text-[10px] text-amber uppercase tracking-widest">Live</span>
            </div>
          )}
          {runStatus === "complete" && <span className="font-mono text-[10px] text-text-accent">Complete</span>}
        </div>
        <div ref={consoleRef} className="h-52 overflow-y-auto p-3 space-y-0.5 bg-background" aria-live="polite" aria-label="Execution log">
          {consoleLines.length === 0 ? (
            <p className="font-mono text-[11px] text-text-muted">Waiting for pipeline execution…</p>
          ) : (
            consoleLines.map((line) => (
              <div key={line.id} className="flex items-start gap-2">
                <span className="font-mono text-[9px] text-text-muted flex-shrink-0 mt-px w-16">{line.ts}</span>
                <LogLevelDot level={line.level} />
                <span className={cn("font-mono text-[10px] leading-relaxed",
                  line.level === "success" ? "text-text-accent" :
                  line.level === "warn"    ? "text-amber"        :
                  line.level === "error"   ? "text-danger"       : "text-text-secondary")}>
                  {line.msg}
                </span>
              </div>
            ))
          )}
        </div>
      </GlassCard>

      {/* Timeline */}
      <GlassCard className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <GitMerge className="h-4 w-4 text-text-accent" aria-hidden="true" />
          <span className="font-mono text-xs font-semibold text-text-primary">Orchestration Timeline</span>
        </div>
        <div className="flex items-center gap-0 overflow-x-auto" role="list" aria-label="Pipeline stages">
          {stages.map((stage, i) => {
            const Icon   = stage.icon;
            const isLast = i === stages.length - 1;
            return (
              <div key={stage.id} className="flex items-center flex-1 min-w-0" role="listitem">
                <div className="flex flex-col items-center text-center flex-shrink-0">
                  <div className={cn("flex items-center justify-center w-8 h-8 rounded-full border transition-all duration-300", STAGE_STATUS_RING[stage.status],
                    stage.status === "running" && "shadow-[0_0_8px_rgba(217,119,6,.25)]")}>
                    {stage.status === "running"
                      ? <Loader2 className="h-3.5 w-3.5 text-amber animate-spin" aria-hidden="true" />
                      : <Icon className={cn("h-3.5 w-3.5", STAGE_ICON_CLS[stage.status])} aria-hidden="true" />
                    }
                  </div>
                  <span className={cn("font-mono text-[9px] mt-1 whitespace-nowrap",
                    stage.status === "done" ? "text-text-accent" : stage.status === "running" ? "text-amber" : "text-text-muted")}>
                    {stage.label}
                  </span>
                  {stage.ms && <span className="font-mono text-[8px] text-text-muted">{stage.ms}</span>}
                </div>
                {!isLast && (
                  <div className={cn("flex-1 h-px mx-1 transition-colors duration-500",
                    stage.status === "done" ? "bg-accent/40" : "bg-border")} aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Output viewer */}
      <AnimatePresence>
        {showOutput && (
          <motion.div key="output" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <GlassCard className="overflow-hidden">
              <div className="flex border-b border-border">
                {([
                  { id: "resume", label: "Optimized Resume", icon: FileText },
                  { id: "cover",  label: "Cover Letter",     icon: PenTool  },
                  { id: "ats",    label: "ATS Analysis",     icon: BarChart3},
                  { id: "json",   label: "JSON Output",      icon: Code2    },
                ] as { id: OutputTab; label: string; icon: React.ElementType }[]).map((t) => {
                  const Icon = t.icon;
                  return (
                    <button key={t.id} type="button" onClick={() => setOutputTab(t.id)}
                      className={cn("flex items-center gap-1.5 px-3 py-2.5 font-mono text-[10px] tracking-wide border-b-2 transition-colors",
                        outputTab === t.id ? "border-accent text-text-accent" : "border-transparent text-text-muted hover:text-text-primary")}>
                      <Icon className="h-3 w-3" aria-hidden="true" />{t.label}
                    </button>
                  );
                })}
              </div>
              <AnimatePresence mode="wait">
                <motion.pre key={outputTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                  className="font-mono text-[11px] text-text-primary whitespace-pre-wrap leading-relaxed p-4 max-h-56 overflow-y-auto bg-background">
                  {outputTab === "resume" ? MOCK_RESUME_OUT
                   : outputTab === "cover" ? MOCK_COVER_OUT
                   : outputTab === "ats"   ? MOCK_ATS_OUT
                   : MOCK_JSON_OUT}
                </motion.pre>
              </AnimatePresence>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RightPanel({ runStatus, agentEvents }: { runStatus: RunStatus; agentEvents: AgentEvent[] }) {
  const hasData = runStatus === "running" || runStatus === "complete";

  const analytics = {
    latency:    hasData ? "14.8s" : "—",
    tokens:     hasData ? "9 240" : "—",
    provider:   hasData ? "OpenAI" : "—",
    cost:       hasData ? "~$0.042" : "—",
    failovers:  hasData ? "1" : "0",
    retries:    hasData ? "2" : "0",
    active:     hasData ? "GPT-4o-mini (fallback)" : "—",
    primary:    "GPT-4o (OpenAI)",
  };

  return (
    <div className="space-y-3">
      {/* Runtime analytics */}
      <GlassCard className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-text-accent" aria-hidden="true" />
          <span className="font-mono text-xs font-semibold text-text-primary">Runtime Analytics</span>
        </div>
        <div className="space-y-2.5">
          {[
            { label: "Total Latency",   value: analytics.latency  },
            { label: "Token Usage",     value: analytics.tokens   },
            { label: "Provider",        value: analytics.provider },
            { label: "Cost Estimate",   value: analytics.cost     },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-text-muted">{label}</span>
              <span className="font-mono text-[11px] font-semibold text-text-primary">{value}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Fallback routing monitor */}
      <GlassCard className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-text-accent" aria-hidden="true" />
          <span className="font-mono text-xs font-semibold text-text-primary">Fallback Routing</span>
        </div>
        <div className="space-y-2.5">
          <div className="p-2.5 rounded-md bg-background-secondary border border-border">
            <span className="font-mono text-[9px] text-text-muted uppercase tracking-widest block mb-0.5">Primary Provider</span>
            <span className="font-mono text-[11px] text-text-primary">{analytics.primary}</span>
          </div>
          <div className={cn("p-2.5 rounded-md border", analytics.failovers !== "0"
            ? "bg-amber-subtle border-amber/25" : "bg-background-secondary border-border")}>
            <span className="font-mono text-[9px] text-text-muted uppercase tracking-widest block mb-0.5">Active Provider</span>
            <span className={cn("font-mono text-[11px]", analytics.failovers !== "0" ? "text-amber" : "text-text-primary")}>
              {analytics.active}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-md bg-background-secondary border border-border text-center">
              <span className={cn("font-mono text-base font-bold", analytics.failovers !== "0" ? "text-amber" : "text-text-primary")}>
                {analytics.failovers}
              </span>
              <span className="font-mono text-[9px] text-text-muted block">Failovers</span>
            </div>
            <div className="p-2 rounded-md bg-background-secondary border border-border text-center">
              <span className="font-mono text-base font-bold text-text-primary">{analytics.retries}</span>
              <span className="font-mono text-[9px] text-text-muted block">Retries</span>
            </div>
          </div>
          {analytics.failovers !== "0" && (
            <div className="flex items-start gap-2 p-2 rounded-md border border-amber/20 bg-amber-subtle">
              <AlertTriangle className="h-3.5 w-3.5 text-amber flex-shrink-0 mt-px" aria-hidden="true" />
              <p className="font-mono text-[10px] text-amber leading-relaxed">
                Primary provider timed out on retrieval stage. Automatically switched to fallback GPT-4o-mini.
              </p>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Agent activity feed */}
      <GlassCard className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="h-4 w-4 text-text-accent" aria-hidden="true" />
          <span className="font-mono text-xs font-semibold text-text-primary">Agent Activity</span>
        </div>
        <div className="space-y-0 max-h-56 overflow-y-auto" role="list" aria-label="Agent events">
          {agentEvents.length === 0 ? (
            <p className="font-mono text-[10px] text-text-muted">No events yet.</p>
          ) : (
            agentEvents.map((ev) => (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2 py-2 border-b border-border last:border-0"
                role="listitem"
              >
                {ev.status === "done"    && <CheckCircle2  className="h-3 w-3 text-text-accent flex-shrink-0 mt-0.5" aria-hidden="true" />}
                {ev.status === "warn"    && <AlertTriangle className="h-3 w-3 text-amber      flex-shrink-0 mt-0.5" aria-hidden="true" />}
                {ev.status === "running" && <Loader2       className="h-3 w-3 text-amber animate-spin flex-shrink-0 mt-0.5" aria-hidden="true" />}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] font-semibold text-text-primary">{ev.agent}</span>
                    <span className="font-mono text-[9px] text-text-muted">{ev.ts}</span>
                  </div>
                  <span className="font-mono text-[10px] text-text-muted">{ev.event}</span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </GlassCard>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PlaygroundPage() {
  const [prompt,        setPrompt]        = useState(PROMPT_PRESETS[0].value);
  const [provider,      setProvider]      = useState("openai");
  const [primaryModel,  setPrimaryModel]  = useState("gpt-4o");
  const [fallbackModel, setFallbackModel] = useState("gpt-4o-mini");
  const [temperature,   setTemperature]   = useState(0.3);
  const [maxTokens,     setMaxTokens]     = useState("4096");
  const [toggles,       setToggles]       = useState<Record<string, boolean>>({
    multiagent: true, retrieval: true, ats: true, memory: true, streaming: false,
  });

  const [runStatus,    setRunStatus]    = useState<RunStatus>("idle");
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  const [stages,       setStages]       = useState<TimelineStage[]>(INITIAL_STAGES);
  const [agentEvents,  setAgentEvents]  = useState<AgentEvent[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };

  const handleRun = () => {
    clearTimers();
    setRunStatus("running");
    setConsoleLines([]);
    setAgentEvents([]);
    setStages(INITIAL_STAGES.map((s) => ({ ...s, status: "idle", ms: null })));

    // Stream console lines
    LOG_SCRIPT.forEach((line, i) => {
      const t = setTimeout(() => {
        setConsoleLines((p) => [...p, { ...line, id: i }]);
        // Parse agent events from log
        const match = AGENT_EVENTS.find((e) => e.id === i + 1);
        if (match) setAgentEvents((p) => [...p, match]);
      }, 300 + i * 750);
      timersRef.current.push(t);
    });

    // Animate pipeline stages
    STAGE_TIMINGS.forEach((delay, i) => {
      const tRun = setTimeout(() => {
        setStages((p) => p.map((s, j) => j === i ? { ...s, status: "running" } : s));
      }, delay);
      const tDone = setTimeout(() => {
        setStages((p) => p.map((s, j) => j === i ? { ...s, status: "done", ms: STAGE_DONE_MS[i] } : s));
      }, delay + 700);
      timersRef.current.push(tRun, tDone);
    });

    // Complete
    const tComplete = setTimeout(() => {
      setRunStatus("complete");
    }, LOG_SCRIPT.length * 750 + 400);
    timersRef.current.push(tComplete);
  };

  const handleStop = () => { clearTimers(); setRunStatus("stopped"); };

  return (
    <div className="space-y-4 max-w-[1280px]">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-xl font-bold text-text-primary tracking-tight">AI Playground</h1>
        <p className="font-mono text-xs text-text-muted mt-1">
          Test prompts, orchestration flows, fallback routing, and ATS optimization pipelines.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_260px] gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
          <LeftPanel
            prompt={prompt} setPrompt={setPrompt}
            provider={provider} setProvider={setProvider}
            primaryModel={primaryModel} setPrimaryModel={setPrimaryModel}
            fallbackModel={fallbackModel} setFallbackModel={setFallbackModel}
            temperature={temperature} setTemperature={setTemperature}
            maxTokens={maxTokens} setMaxTokens={setMaxTokens}
            toggles={toggles} setToggles={setToggles}
            onRun={handleRun} onStop={handleStop} runStatus={runStatus}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}>
          <CenterPanel consoleLines={consoleLines} stages={stages} runStatus={runStatus} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}>
          <RightPanel runStatus={runStatus} agentEvents={agentEvents} />
        </motion.div>
      </div>
    </div>
  );
}