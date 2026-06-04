"use client";

// frontend/app/dashboard/pipeline/page.tsx
import { motion } from "framer-motion";
import {
  Activity,
  Timer,
  CheckCircle2,
  ListOrdered,
  Upload,
  FileText,
  Database,
  Sparkles,
  BarChart3,
  Zap,
  ArrowRight,
  GitMerge,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PipelineMetric {
  label:   string;
  value:   string;
  support: string;
  icon:    React.ElementType;
}

interface PipelineStage {
  id:     string;
  label:  string;
  tech:   string;
  icon:   React.ElementType;
  status: "done" | "active" | "idle";
}

type ExecStatus = "Completed" | "Running" | "Failed" | "Queued";

interface PipelineExecution {
  id:        string;
  job:       string;
  company:   string;
  runtime:   string;
  status:    ExecStatus;
  timestamp: string;
}

interface SystemService {
  name:   string;
  state:  "Operational" | "Processing" | "Syncing" | "Degraded";
  detail: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const METRICS: PipelineMetric[] = [
  { label: "Active Jobs",   value: "3",      support: "2 queued",        icon: Activity    },
  { label: "Avg Runtime",   value: "47s",    support: "↓ 8s this week",  icon: Timer       },
  { label: "Success Rate",  value: "94.2%",  support: "last 30 days",    icon: CheckCircle2 },
  { label: "Queue Depth",   value: "5",      support: "~2 min wait",     icon: ListOrdered },
];

const PIPELINE_STAGES: PipelineStage[] = [
  { id: "upload",   label: "Resume Upload",       tech: "PDF → structured",      icon: Upload,      status: "done"   },
  { id: "jd",       label: "JD Analysis",         tech: "ATS keyword extract",   icon: FileText,    status: "done"   },
  { id: "retrieval",label: "Semantic Retrieval",  tech: "ChromaDB · BM25 RRF",   icon: Database,    status: "active" },
  { id: "optimize", label: "Resume Optimization", tech: "STAR rewrite · inject", icon: Sparkles,    status: "idle"   },
  { id: "eval",     label: "ATS Evaluation",      tech: "3-layer scoring",       icon: BarChart3,   status: "idle"   },
  { id: "output",   label: "Final Output",        tech: "Package · persist",     icon: Zap,         status: "idle"   },
];

const EXECUTIONS: PipelineExecution[] = [
  { id: "ex-001", job: "Staff ML Infrastructure Eng",  company: "Anthropic",   runtime: "52s",  status: "Completed", timestamp: "2 min ago"  },
  { id: "ex-002", job: "Senior Backend Engineer",       company: "OpenAI",      runtime: "41s",  status: "Completed", timestamp: "18 min ago" },
  { id: "ex-003", job: "Principal Systems Engineer",    company: "Vercel",      runtime: "—",    status: "Running",   timestamp: "Just now"   },
  { id: "ex-004", job: "ML Platform Lead",              company: "Perplexity",  runtime: "—",    status: "Queued",    timestamp: "Pending"    },
  { id: "ex-005", job: "Staff Software Engineer",       company: "Stripe",      runtime: "63s",  status: "Completed", timestamp: "1 hr ago"   },
  { id: "ex-006", job: "Senior AI Research Engineer",   company: "Cohere",      runtime: "58s",  status: "Failed",    timestamp: "3 hr ago"   },
];

const SYSTEM_SERVICES: SystemService[] = [
  { name: "Gemini API",        state: "Operational", detail: "p99 < 1.4s"       },
  { name: "Embedding Engine",  state: "Processing",  detail: "2 active batches"  },
  { name: "Vector Memory",     state: "Operational", detail: "ChromaDB v0.4.24"  },
  { name: "Evaluation Loop",   state: "Operational", detail: "threshold 80.0"    },
  { name: "Orchestrator",      state: "Syncing",     detail: "state checkpoint"  },
];

// ── Status configs ─────────────────────────────────────────────────────────────
const EXEC_STATUS_STYLE: Record<ExecStatus, string> = {
  Completed: "text-text-accent  bg-accent-subtle  border-accent/20",
  Running:   "text-amber        bg-amber-subtle   border-amber/20",
  Queued:    "text-text-muted   bg-surface-raised border-border",
  Failed:    "text-danger       bg-danger-subtle  border-danger/20",
};

const SVC_STATE_STYLE: Record<SystemService["state"], { dot: string; text: string; pulse: boolean }> = {
  Operational: { dot: "bg-accent",        text: "text-text-accent",   pulse: false },
  Processing:  { dot: "bg-amber",         text: "text-amber",         pulse: true  },
  Syncing:     { dot: "bg-text-secondary",text: "text-text-secondary",pulse: true  },
  Degraded:    { dot: "bg-danger",        text: "text-danger",        pulse: false },
};

const STAGE_RING: Record<PipelineStage["status"], string> = {
  done:   "border-accent/40  bg-accent-subtle",
  active: "border-amber/40   bg-amber-subtle",
  idle:   "border-border      bg-background-secondary",
};

const STAGE_ICON: Record<PipelineStage["status"], string> = {
  done:   "text-text-accent",
  active: "text-amber",
  idle:   "text-text-muted",
};

// ── Fade-up helper ─────────────────────────────────────────────────────────────
function FadeUp({ children, delay = 0, className }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

function MetricsRow() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {METRICS.map((m, i) => {
        const Icon = m.icon;
        return (
          <FadeUp key={m.label} delay={i * 0.06}>
            <GlassCard className="p-4">
              <div className="flex items-start justify-between mb-2.5">
                <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest leading-none">
                  {m.label}
                </span>
                <Icon className="h-3.5 w-3.5 text-text-accent flex-shrink-0" aria-hidden="true" />
              </div>
              <p className="font-mono text-2xl font-bold text-text-primary leading-none mb-1">
                {m.value}
              </p>
              <p className="font-mono text-[10px] text-text-muted">{m.support}</p>
            </GlassCard>
          </FadeUp>
        );
      })}
    </div>
  );
}

function LiveFlow() {
  return (
    <FadeUp delay={0.1}>
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-5">
          <GitMerge className="h-4 w-4 text-text-accent" aria-hidden="true" />
          <h2 className="font-mono text-sm font-semibold text-text-primary">Live Orchestration Flow</h2>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" aria-hidden="true" />
            <span className="font-mono text-[10px] text-amber uppercase tracking-widest">Active</span>
          </div>
        </div>

        {/* Desktop horizontal / mobile vertical */}
        <div className="flex flex-col lg:flex-row items-center gap-2 lg:gap-0 overflow-x-auto">
          {PIPELINE_STAGES.map((stage, i) => {
            const Icon    = stage.icon;
            const isLast  = i === PIPELINE_STAGES.length - 1;
            const ring    = STAGE_RING[stage.status];
            const iconCls = STAGE_ICON[stage.status];

            return (
              <div key={stage.id} className="flex flex-col lg:flex-row items-center flex-1 min-w-0">
                <div className={cn(
                  "group flex flex-col items-center text-center rounded-lg border p-3 w-full lg:w-auto",
                  "transition-colors duration-200 flex-shrink-0",
                  ring,
                  stage.status === "active" && "shadow-[0_0_10px_rgba(217,119,6,.18)]"
                )}>
                  <Icon className={cn("h-4 w-4 mb-1.5", iconCls)} aria-hidden="true" />
                  <span className="font-mono text-[10px] font-semibold text-text-primary leading-snug whitespace-nowrap">
                    {stage.label}
                  </span>
                  <span className="font-mono text-[9px] text-text-muted mt-0.5">{stage.tech}</span>
                </div>

                {!isLast && (
                  <>
                    <ArrowRight className={cn(
                      "hidden lg:block h-3.5 w-3.5 flex-shrink-0 mx-1 transition-colors",
                      stage.status === "done" ? "text-accent/50" : "text-border"
                    )} aria-hidden="true" />
                    <div className={cn(
                      "lg:hidden h-4 w-px my-0.5",
                      stage.status === "done" ? "bg-accent/40" : "bg-border"
                    )} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>
    </FadeUp>
  );
}

function ExecutionsTable() {
  return (
    <FadeUp delay={0.16}>
      <GlassCard className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
          <h2 className="font-mono text-sm font-semibold text-text-primary">Recent Executions</h2>
          <span className="font-mono text-[10px] text-text-muted bg-surface-raised border border-border px-2 py-0.5 rounded">
            {EXECUTIONS.length} runs
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" aria-label="Pipeline executions">
            <thead>
              <tr className="border-b border-border bg-background-secondary">
                {["Job", "Company", "Runtime", "Status", "Timestamp"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-mono text-[10px] text-text-muted uppercase tracking-widest whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EXECUTIONS.map((ex, i) => (
                <motion.tr
                  key={ex.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25, delay: 0.2 + i * 0.05 }}
                  className="border-b border-border last:border-0 hover:bg-surface-raised transition-colors duration-150"
                >
                  <td className="px-4 py-3 font-mono text-xs text-text-primary max-w-[200px] truncate">
                    {ex.job}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">{ex.company}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{ex.runtime}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full border",
                      "font-mono text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap",
                      EXEC_STATUS_STYLE[ex.status]
                    )}>
                      {ex.status}
                    </span>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 font-mono text-[10px] text-text-muted whitespace-nowrap">
                    {ex.timestamp}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </FadeUp>
  );
}

function SystemStatus() {
  return (
    <FadeUp delay={0.2}>
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-sm font-semibold text-text-primary">System Health</h2>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />
            <span className="font-mono text-[10px] text-text-accent uppercase tracking-widest">Online</span>
          </div>
        </div>

        <div className="space-y-0 divide-y divide-border">
          {SYSTEM_SERVICES.map((svc, i) => {
            const cfg = SVC_STATE_STYLE[svc.state];
            return (
              <motion.div
                key={svc.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: 0.25 + i * 0.05 }}
                className="flex items-center justify-between py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg.dot, cfg.pulse && "animate-pulse")} aria-hidden="true" />
                  <span className="font-mono text-xs text-text-secondary">{svc.name}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[10px] text-text-muted hidden sm:block">{svc.detail}</span>
                  <span className={cn("font-mono text-[10px] font-semibold", cfg.text)}>{svc.state}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </GlassCard>
    </FadeUp>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PipelinePage() {
  return (
    <div className="space-y-5 max-w-[1280px]">
      {/* Header */}
      <FadeUp>
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            AI Pipeline Orchestration
          </h1>
          <p className="font-mono text-xs text-text-muted mt-1">
            Monitor and inspect real-time multi-agent execution.
          </p>
        </div>
      </FadeUp>

      <MetricsRow />
      <LiveFlow />

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.6fr] gap-5">
        <ExecutionsTable />
        <SystemStatus />
      </div>
    </div>
  );
}