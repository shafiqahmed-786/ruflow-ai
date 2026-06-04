"use client";

// frontend/app/dashboard/applications/new/page.tsx
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Upload, Sliders, Zap, CheckCircle2, Loader2,
  Brain, Database, Sparkles, BarChart3, PenTool, CircleDot,
  X, ChevronRight, TerminalSquare, ArrowRight,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button }    from "@/components/ui/Button";
import { cn }        from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type PipelineStatus = "idle" | "running" | "done" | "error";
type OutputTab      = "resume" | "ats" | "cover" | "insights";

interface OrcheStage {
  id:      string;
  label:   string;
  desc:    string;
  icon:    React.ElementType;
  tokens:  number | null;
  runtime: string | null;
  status:  PipelineStatus;
}

// ── Mock orchestration stages ─────────────────────────────────────────────────
const INITIAL_STAGES: OrcheStage[] = [
  { id: "parse",    label: "Resume Parsing",        desc: "Extracting structure via PyMuPDF",  icon: FileText,   tokens: null, runtime: null, status: "idle" },
  { id: "jd",       label: "JD Semantic Analysis",  desc: "Extracting ATS keywords + signals", icon: Brain,      tokens: null, runtime: null, status: "idle" },
  { id: "keywords", label: "Keyword Extraction",    desc: "Building ATS keyword corpus",       icon: TerminalSquare, tokens: null, runtime: null, status: "idle" },
  { id: "retrieval",label: "Retrieval Memory",      desc: "Vector search · hybrid RRF",        icon: Database,   tokens: null, runtime: null, status: "idle" },
  { id: "optimize", label: "Resume Optimization",   desc: "STAR rewrite · keyword injection",  icon: Sparkles,   tokens: null, runtime: null, status: "idle" },
  { id: "eval",     label: "ATS Evaluation",        desc: "3-layer scoring pipeline",          icon: BarChart3,  tokens: null, runtime: null, status: "idle" },
  { id: "cover",    label: "Cover Letter",          desc: "Personalized generation",           icon: PenTool,    tokens: null, runtime: null, status: "idle" },
  { id: "final",    label: "Final Evaluation",      desc: "Composite quality assurance",       icon: CheckCircle2, tokens: null, runtime: null, status: "idle" },
];

const MOCK_RESUME_OUTPUT = `## Alex Rivera
alex.rivera@email.com · linkedin.com/in/alexrivera · San Francisco, CA

---

## Summary
Staff Backend Engineer with 7+ years designing distributed systems and ML infrastructure at scale. Led platform teams shipping to 5M+ daily active users with 99.97% uptime. Deep expertise in Python, Kubernetes, and LLM integration pipelines.

---

## Experience

### Staff Software Engineer — Stripe
*Jan 2022 – Present*
- Architected real-time fraud detection using Python, Kafka, and PyTorch — **reduced fraud by 34%**, saving $12M annually across 180 markets
- Led migration of 40+ microservices to Kubernetes (EKS), achieving **99.97% uptime** and cutting infrastructure costs **28%** ($2.1M/year)
- Built internal LLM evaluation platform (LangChain + FastAPI) used by 200 engineers to benchmark 15 proprietary models`;

const MOCK_COVER_OUTPUT = `When I reduced checkout latency by 43% at Stripe, the hardest part wasn't the engineering — it was convincing stakeholders that speed is a safety feature. That tension between velocity and reliability is exactly the challenge I understand Anthropic is navigating as you scale Claude's inference infrastructure.

Anthropic's approach to Constitutional AI resonated deeply with my systems-thinking approach at Databricks, where I owned an open-source Python SDK with 60k weekly downloads. The responsibility of building infrastructure others depend on shaped how I approach every architecture decision.`;

const ATS_KEYWORDS_MATCHED = ["Python", "Kubernetes", "distributed systems", "ML infrastructure", "LangChain", "FastAPI", "PyTorch", "Apache Kafka", "EKS", "microservices"];
const ATS_KEYWORDS_MISSING = ["constitutional AI", "mechanistic interpretability", "RLHF", "model evaluation"];

const AI_INSIGHTS = [
  "Backend infrastructure experience is the strongest signal — lead with platform scale metrics in the summary.",
  "ATS coverage improved from 52 → 91 across 3 optimization iterations.",
  "Cover letter hook references Anthropic's Constitutional AI directly — increases recruiter relevance by ~34%.",
  "Quantification rate is now 78% of bullets (up from 31%) — all major achievements include $ or % impact.",
];

// ── Status ring/icon helpers ───────────────────────────────────────────────────
function stageRing(status: PipelineStatus) {
  return status === "done"    ? "border-accent/40  bg-accent-subtle"
       : status === "running" ? "border-amber/40   bg-amber-subtle"
       : status === "error"   ? "border-danger/40  bg-danger-subtle"
       :                        "border-border      bg-background-secondary";
}

function stageIconCls(status: PipelineStatus) {
  return status === "done"    ? "text-text-accent"
       : status === "running" ? "text-amber"
       : status === "error"   ? "text-danger"
       :                        "text-text-muted";
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] text-text-muted uppercase tracking-widest mb-2">
      {children}
    </p>
  );
}

function InputPanel({
  jdText, setJdText,
  resumeText, setResumeText,
  company, setCompany,
  role, setRole,
  controls, setControls,
  onRun, running,
}: {
  jdText: string; setJdText: (v: string) => void;
  resumeText: string; setResumeText: (v: string) => void;
  company: string; setCompany: (v: string) => void;
  role: string; setRole: (v: string) => void;
  controls: Record<string, boolean | string>;
  setControls: (v: Record<string, boolean | string>) => void;
  onRun: () => void;
  running: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      {/* Company + role */}
      <GlassCard className="p-4 space-y-3">
        <SectionLabel>Target Position</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-mono text-[10px] text-text-muted block mb-1.5" htmlFor="company">
              Company
            </label>
            <input
              id="company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Anthropic"
              disabled={running}
              className="w-full h-8 px-3 rounded-md border border-border bg-background-secondary font-mono text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong disabled:opacity-50 transition-colors"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] text-text-muted block mb-1.5" htmlFor="role">
              Role
            </label>
            <input
              id="role"
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Staff ML Engineer"
              disabled={running}
              className="w-full h-8 px-3 rounded-md border border-border bg-background-secondary font-mono text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong disabled:opacity-50 transition-colors"
            />
          </div>
        </div>
      </GlassCard>

      {/* JD input */}
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Job Description</SectionLabel>
          {jdText && (
            <button
              type="button"
              onClick={() => setJdText("")}
              aria-label="Clear job description"
              className="font-mono text-[10px] text-text-muted hover:text-danger transition-colors flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          disabled={running}
          placeholder="Paste the full job description here…"
          rows={10}
          className="w-full resize-none rounded-md border border-border bg-background-secondary font-mono text-xs text-text-primary placeholder:text-text-muted p-3 leading-relaxed focus:outline-none focus:border-border-strong disabled:opacity-50 transition-colors"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="font-mono text-[10px] text-text-muted">{jdText.length} chars</span>
        </div>
      </GlassCard>

      {/* Resume upload / paste */}
      <GlassCard className="p-4">
        <SectionLabel>Resume</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={running}
            className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-lg border border-dashed border-border hover:border-border-strong text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span className="font-mono text-[10px]">Upload PDF / DOCX</span>
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden" aria-label="Upload resume file" />
          <div className="flex items-center justify-center h-16 rounded-lg border border-border bg-background-secondary">
            <span className="font-mono text-[10px] text-text-muted">or paste below</span>
          </div>
        </div>
        <textarea
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          disabled={running}
          placeholder="Paste resume text here…"
          rows={6}
          className="w-full resize-none rounded-md border border-border bg-background-secondary font-mono text-xs text-text-primary placeholder:text-text-muted p-3 leading-relaxed focus:outline-none focus:border-border-strong disabled:opacity-50 transition-colors"
        />
      </GlassCard>

      {/* Controls */}
      <GlassCard className="p-4 space-y-3">
        <SectionLabel>Optimization Controls</SectionLabel>
        {[
          { key: "ats",    label: "ATS Optimization",          desc: "Keyword injection + structure" },
          { key: "backend",label: "Backend Focus Mode",        desc: "Emphasise systems experience"  },
          { key: "cover",  label: "Generate Cover Letter",     desc: "Company-aware personalization"  },
        ].map(({ key, label, desc }) => (
          <label key={key} className="flex items-center justify-between cursor-pointer group">
            <div>
              <p className="font-mono text-xs text-text-primary group-hover:text-text-accent transition-colors">{label}</p>
              <p className="font-mono text-[10px] text-text-muted">{desc}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!controls[key]}
              onClick={() => setControls({ ...controls, [key]: !controls[key] })}
              className={cn(
                "relative w-8 h-4 rounded-full border transition-colors duration-200 flex-shrink-0",
                controls[key] ? "bg-accent border-accent" : "bg-background-secondary border-border"
              )}
            >
              <span className={cn(
                "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200",
                controls[key] ? "translate-x-4" : "translate-x-0.5"
              )} />
            </button>
          </label>
        ))}

        <div>
          <label className="font-mono text-[10px] text-text-muted block mb-1.5" htmlFor="level">
            AI Enhancement Level
          </label>
          <select
            id="level"
            value={String(controls.level)}
            onChange={(e) => setControls({ ...controls, level: e.target.value })}
            className="w-full h-8 px-3 rounded-md border border-border bg-background-secondary font-mono text-xs text-text-primary focus:outline-none focus:border-border-strong transition-colors"
          >
            <option value="standard">Standard</option>
            <option value="aggressive">Aggressive</option>
            <option value="precision">Precision</option>
          </select>
        </div>
      </GlassCard>

      {/* CTA */}
      <Button
        variant="primary"
        size="lg"
        onClick={onRun}
        disabled={running || (!jdText.trim() && !resumeText.trim())}
        loading={running}
        className="w-full"
        type="button"
      >
        {running ? "Running AI Optimization…" : (
          <>
            <Zap className="h-4 w-4" aria-hidden="true" />
            Run AI Optimization
          </>
        )}
      </Button>
    </div>
  );
}

function OrchestrationPanel({ stages }: { stages: OrcheStage[] }) {
  return (
    <GlassCard className="p-5 sticky top-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-mono text-sm font-semibold text-text-primary">Orchestration</h2>
        <div className="flex items-center gap-1.5">
          {stages.some((s) => s.status === "running") && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" aria-hidden="true" />
              <span className="font-mono text-[10px] text-amber uppercase tracking-widest">Live</span>
            </>
          )}
          {stages.every((s) => s.status === "idle") && (
            <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">Standby</span>
          )}
          {stages.every((s) => s.status === "done") && (
            <span className="font-mono text-[10px] text-text-accent uppercase tracking-widest">Complete</span>
          )}
        </div>
      </div>

      <div className="space-y-1" role="list" aria-label="Pipeline stages">
        {stages.map((stage, i) => {
          const Icon = stage.icon;
          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-200",
                stage.status === "running"
                  ? "border-amber/30 bg-amber-subtle shadow-[0_0_8px_rgba(217,119,6,.12)]"
                  : stage.status === "done"
                  ? "border-accent/20 bg-accent-subtle/30"
                  : "border-transparent"
              )}
              role="listitem"
            >
              <div className={cn("flex items-center justify-center w-7 h-7 rounded-full border flex-shrink-0", stageRing(stage.status))}>
                {stage.status === "running"
                  ? <Loader2 className="h-3 w-3 text-amber animate-spin" aria-hidden="true" />
                  : <Icon className={cn("h-3 w-3", stageIconCls(stage.status))} aria-hidden="true" />
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn("font-mono text-[11px] font-semibold", stage.status === "running" ? "text-amber" : stage.status === "done" ? "text-text-primary" : "text-text-muted")}>
                    {stage.label}
                  </span>
                </div>
                <span className="font-mono text-[9px] text-text-muted truncate block">{stage.desc}</span>
              </div>

              <div className="text-right flex-shrink-0">
                {stage.runtime && (
                  <span className="font-mono text-[9px] text-text-accent block">{stage.runtime}</span>
                )}
                {stage.tokens && (
                  <span className="font-mono text-[9px] text-text-muted block">{stage.tokens}tk</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-4 space-y-1">
        <div className="flex justify-between font-mono text-[9px] text-text-muted">
          <span>Progress</span>
          <span>{stages.filter((s) => s.status === "done").length}/{stages.length}</span>
        </div>
        <div className="h-1 bg-border rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-accent rounded-full"
            animate={{ width: `${(stages.filter((s) => s.status === "done").length / stages.length) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>
    </GlassCard>
  );
}

function OutputWorkspace({ visible }: { visible: boolean }) {
  const [tab, setTab] = useState<OutputTab>("resume");

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <GlassCard className="overflow-hidden">
        <div className="flex border-b border-border">
          {(
            [
              { id: "resume",   label: "Optimized Resume"   },
              { id: "ats",      label: "ATS Analysis"       },
              { id: "cover",    label: "Cover Letter"       },
              { id: "insights", label: "AI Insights"        },
            ] as { id: OutputTab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-3 font-mono text-[11px] tracking-wide border-b-2 transition-colors",
                tab === t.id ? "border-accent text-text-accent" : "border-transparent text-text-muted hover:text-text-primary"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {tab === "resume" && (
              <motion.pre key="resume" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="font-mono text-xs text-text-primary whitespace-pre-wrap leading-relaxed bg-background-secondary border border-border rounded-md p-4 max-h-80 overflow-y-auto">
                {MOCK_RESUME_OUTPUT}
              </motion.pre>
            )}

            {tab === "ats" && (
              <motion.div key="ats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="font-mono text-3xl font-bold text-danger leading-none">52</p>
                    <p className="font-mono text-[10px] text-text-muted mt-0.5">Before</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-border" aria-hidden="true" />
                  <div className="text-center">
                    <p className="font-mono text-3xl font-bold text-text-accent leading-none">91</p>
                    <p className="font-mono text-[10px] text-text-muted mt-0.5">After</p>
                  </div>
                  <div className="ml-auto font-mono text-xs text-text-accent font-semibold">+39 pts</div>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-text-muted uppercase tracking-widest mb-2">Matched Keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ATS_KEYWORDS_MATCHED.map((kw) => (
                      <span key={kw} className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-accent/25 bg-accent-subtle text-text-accent">{kw}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-text-muted uppercase tracking-widest mb-2">Still Missing</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ATS_KEYWORDS_MISSING.map((kw) => (
                      <span key={kw} className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-danger/25 bg-danger-subtle text-danger">{kw}</span>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {tab === "cover" && (
              <motion.pre key="cover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="font-mono text-xs text-text-primary whitespace-pre-wrap leading-relaxed bg-background-secondary border border-border rounded-md p-4 max-h-80 overflow-y-auto">
                {MOCK_COVER_OUTPUT}
              </motion.pre>
            )}

            {tab === "insights" && (
              <motion.div key="insights" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2.5">
                {AI_INSIGHTS.map((insight, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background-secondary">
                    <CircleDot className="h-3.5 w-3.5 text-text-accent flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="font-mono text-[11px] text-text-secondary leading-relaxed">{insight}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NewApplicationPage() {
  const [jdText,     setJdText]     = useState("");
  const [resumeText, setResumeText] = useState("");
  const [company,    setCompany]    = useState("");
  const [role,       setRole]       = useState("");
  const [running,    setRunning]    = useState(false);
  const [complete,   setComplete]   = useState(false);
  const [controls,   setControls]   = useState<Record<string, boolean | string>>({
    ats: true, backend: false, cover: true, level: "standard",
  });
  const [stages, setStages] = useState<OrcheStage[]>(INITIAL_STAGES);

  const runPipeline = () => {
    setRunning(true);
    setComplete(false);
    const reset = INITIAL_STAGES.map((s) => ({ ...s, status: "idle" as PipelineStatus, runtime: null, tokens: null }));
    setStages(reset);

    const runtimes = ["0.4s", "1.1s", "0.8s", "1.4s", "2.1s", "1.7s", "2.0s", "0.9s"];
    const tokenCounts = [null, 840, 520, 380, 2100, 1640, 1950, 720];

    reset.forEach((_, i) => {
      setTimeout(() => {
        setStages((prev) => prev.map((s, j) => j === i ? { ...s, status: "running" } : s));
        setTimeout(() => {
          setStages((prev) => prev.map((s, j) =>
            j === i ? { ...s, status: "done", runtime: runtimes[i], tokens: tokenCounts[i] } : s
          ));
          if (i === reset.length - 1) { setRunning(false); setComplete(true); }
        }, 900 + Math.random() * 400);
      }, i * 1350);
    });
  };

  return (
    <div className="space-y-5 max-w-[1280px]">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-xl font-bold text-text-primary tracking-tight">AI Application Builder</h1>
        <p className="font-mono text-xs text-text-muted mt-1">
          Run multi-agent resume optimization and ATS orchestration pipelines.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
          <InputPanel
            jdText={jdText} setJdText={setJdText}
            resumeText={resumeText} setResumeText={setResumeText}
            company={company} setCompany={setCompany}
            role={role} setRole={setRole}
            controls={controls} setControls={setControls}
            onRun={runPipeline}
            running={running}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <OrchestrationPanel stages={stages} />
        </motion.div>
      </div>

      <OutputWorkspace visible={complete} />
    </div>
  );
}