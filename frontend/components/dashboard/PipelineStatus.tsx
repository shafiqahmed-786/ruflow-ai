"use client";

// frontend/components/dashboard/PipelineStatus.tsx
import { motion }    from "framer-motion";
import { Upload, FileText, Database, Sparkles, CheckCircle, Zap, GitBranch, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn }        from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type StageStatus = "completed" | "active" | "idle" | "error";

interface PipelineStage {
  id:          string;
  label:       string;
  description: string;
  icon:        React.ElementType;
  status:      StageStatus;
  latency:     string | null;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const PIPELINE_STAGES: PipelineStage[] = [
  {
    id:          "upload",
    label:       "Resume Upload",
    description: "Resume and JD ingested and structured.",
    icon:        Upload,
    status:      "completed",
    latency:     "0.4s",
  },
  {
    id:          "jd-analysis",
    label:       "JD Analysis",
    description: "ATS keywords, seniority, and signals extracted.",
    icon:        FileText,
    status:      "completed",
    latency:     "1.1s",
  },
  {
    id:          "retrieval",
    label:       "Semantic Retrieval",
    description: "Relevant memory and prior successes retrieved via RAG.",
    icon:        Database,
    status:      "active",
    latency:     null,
  },
  {
    id:          "optimization",
    label:       "Resume Optimization",
    description: "STAR-format rewriting with ATS keyword injection.",
    icon:        Sparkles,
    status:      "idle",
    latency:     null,
  },
  {
    id:          "evaluation",
    label:       "ATS Evaluation",
    description: "Multi-layer scoring: programmatic + semantic + LLM judge.",
    icon:        CheckCircle,
    status:      "idle",
    latency:     null,
  },
  {
    id:          "output",
    label:       "Final Output",
    description: "ATS-optimized application package delivered.",
    icon:        Zap,
    status:      "idle",
    latency:     null,
  },
];

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<StageStatus, {
  dot:     string;
  ring:    string;
  icon:    string;
  label:   string;
  animate: boolean;
}> = {
  completed: {
    dot:     "bg-accent",
    ring:    "border-accent/40 bg-accent-subtle",
    icon:    "text-text-accent",
    label:   "Completed",
    animate: false,
  },
  active: {
    dot:     "bg-amber animate-pulse",
    ring:    "border-amber/40 bg-amber-subtle",
    icon:    "text-amber",
    label:   "Running",
    animate: true,
  },
  idle: {
    dot:     "bg-border-strong",
    ring:    "border-border bg-background-secondary",
    icon:    "text-text-muted",
    label:   "Waiting",
    animate: false,
  },
  error: {
    dot:     "bg-danger",
    ring:    "border-danger/40 bg-danger-subtle",
    icon:    "text-danger",
    label:   "Error",
    animate: false,
  },
};

// ── Stage node ────────────────────────────────────────────────────────────────
function StageNode({
  stage,
  index,
  isLast,
}: {
  stage:  PipelineStage;
  index:  number;
  isLast: boolean;
}) {
  const Icon   = stage.icon;
  const config = STATUS_CONFIG[stage.status];

  return (
    <div className="flex flex-col lg:flex-row items-center gap-0 flex-1 min-w-0">
      {/* Node */}
      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.32, delay: index * 0.07, ease: "easeOut" }}
        className="relative group flex flex-col items-center text-center flex-shrink-0 focus-within:outline-none"
        tabIndex={0}
        aria-label={`${stage.label}: ${config.label}${stage.latency ? `, ${stage.latency}` : ""}`}
      >
        {/* Icon circle */}
        <div
          className={cn(
            "flex items-center justify-center w-11 h-11 rounded-full border-2",
            "transition-all duration-200",
            config.ring,
            stage.status === "active" && "shadow-[0_0_12px_rgba(217,119,6,.3)]"
          )}
        >
          <Icon className={cn("h-4.5 w-4.5", config.icon)} aria-hidden="true" />
        </div>

        {/* Status dot */}
        <span
          className={cn("absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background", config.dot)}
          aria-hidden="true"
        />

        {/* Label */}
        <p
          className={cn(
            "font-mono text-[10px] mt-2 leading-snug max-w-[72px] text-center",
            stage.status === "active"  ? "text-amber"       :
            stage.status === "completed" ? "text-text-secondary" : "text-text-muted"
          )}
        >
          {stage.label}
        </p>

        {/* Latency or status badge */}
        <span
          className={cn(
            "font-mono text-[9px] mt-0.5",
            stage.status === "completed" ? "text-text-accent" :
            stage.status === "active"    ? "text-amber"       : "text-text-muted"
          )}
        >
          {stage.latency ?? config.label}
        </span>

        {/* Tailwind-only tooltip — keyboard + hover accessible */}
        <div
          role="tooltip"
          className={cn(
            "absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20",
            "w-44 px-3 py-2 rounded-lg border border-border bg-surface shadow-card-dark",
            "opacity-0 pointer-events-none",
            "group-hover:opacity-100 group-focus-within:opacity-100",
            "transition-opacity duration-200",
          )}
        >
          <p className="font-mono text-[10px] text-text-secondary text-center leading-relaxed">
            {stage.description}
          </p>
        </div>
      </motion.div>

      {/* Connector */}
      {!isLast && (
        <>
          {/* Desktop horizontal connector */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: index * 0.07 + 0.15 }}
            className="hidden lg:flex items-center flex-1 px-1 min-w-0"
          >
            <div
              className={cn(
                "h-px flex-1 transition-colors duration-300",
                stage.status === "completed" ? "bg-accent/40" : "bg-border"
              )}
            />
            <ArrowRight
              className={cn(
                "h-3 w-3 flex-shrink-0 transition-colors duration-300",
                stage.status === "completed" ? "text-accent/60" : "text-border"
              )}
              aria-hidden="true"
            />
          </motion.div>

          {/* Mobile vertical connector */}
          <div
            className={cn(
              "flex lg:hidden w-px h-5 my-1 transition-colors duration-300",
              stage.status === "completed" ? "bg-accent/40" : "bg-border"
            )}
          />
        </>
      )}
    </div>
  );
}

// ── Summary bar ────────────────────────────────────────────────────────────────
function SummaryBar() {
  const completed = PIPELINE_STAGES.filter((s) => s.status === "completed").length;
  const total     = PIPELINE_STAGES.length;
  const pct       = Math.round((completed / total) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">
          Pipeline Progress
        </span>
        <span className="font-mono text-[10px] text-text-secondary">
          {completed}/{total} stages complete
        </span>
      </div>
      <div className="h-1 bg-border rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
          className="h-full bg-accent rounded-full"
        />
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
export function PipelineStatus() {
  return (
    <GlassCard className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-text-accent" aria-hidden="true" />
          <h2 className="font-mono text-sm font-semibold text-text-primary">
            Orchestration Pipeline
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" aria-hidden="true" />
          <span className="font-mono text-[10px] text-amber uppercase tracking-widest">
            Running
          </span>
        </div>
      </div>

      {/* Nodes */}
      <div
        className="flex flex-col lg:flex-row items-center lg:items-start gap-1 lg:gap-0 mb-5 overflow-x-auto"
        role="list"
        aria-label="Pipeline stages"
      >
        {PIPELINE_STAGES.map((stage, i) => (
          <StageNode
            key={stage.id}
            stage={stage}
            index={i}
            isLast={i === PIPELINE_STAGES.length - 1}
          />
        ))}
      </div>

      {/* Progress bar */}
      <SummaryBar />
    </GlassCard>
  );
}