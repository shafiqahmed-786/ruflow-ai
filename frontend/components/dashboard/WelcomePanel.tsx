"use client";

// frontend/components/dashboard/WelcomePanel.tsx
import { motion }    from "framer-motion";
import { Activity, Brain, Database, TrendingUp, Upload, Zap } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button }    from "@/components/ui/Button";
import { cn }        from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Metric {
  label:       string;
  value:       string;
  trend:       string;
  positive:    boolean;
  icon:        React.ElementType;
}

interface ActiveAgent {
  name:   string;
  status: "active" | "idle";
}

// ── Data ──────────────────────────────────────────────────────────────────────
const METRICS: Metric[] = [
  { label: "Applications Optimized", value: "24",   trend: "+3 this week", positive: true,  icon: TrendingUp },
  { label: "Avg ATS Score",          value: "86.4", trend: "+12.1 avg gain", positive: true, icon: Zap        },
  { label: "Retrieval Accuracy",     value: "94%",  trend: "semantic match", positive: true, icon: Database   },
  { label: "Active Sessions",        value: "2",    trend: "running now",    positive: true, icon: Activity   },
];

const ACTIVE_AGENTS: ActiveAgent[] = [
  { name: "Planner",      status: "active" },
  { name: "JD Analyzer",  status: "active" },
  { name: "Retrieval",    status: "idle"   },
  { name: "Resume Tailor",status: "idle"   },
  { name: "Evaluator",    status: "idle"   },
];

// ── Metric card ────────────────────────────────────────────────────────────────
function MetricCard({ metric, index }: { metric: Metric; index: number }) {
  const Icon = metric.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 + index * 0.07, ease: "easeOut" }}
    >
      <div className="rounded-lg border border-border bg-background-secondary p-4">
        <div className="flex items-start justify-between mb-3">
          <p className="font-mono text-[10px] text-text-muted uppercase tracking-widest leading-none">
            {metric.label}
          </p>
          <Icon className="h-3.5 w-3.5 text-text-accent flex-shrink-0" aria-hidden="true" />
        </div>
        <p className="font-mono text-2xl font-bold text-text-primary leading-none mb-1.5">
          {metric.value}
        </p>
        <p className={cn("font-mono text-[10px]", metric.positive ? "text-text-accent" : "text-danger")}>
          {metric.trend}
        </p>
      </div>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function WelcomePanel() {
  return (
    <GlassCard className="relative overflow-hidden p-6">
      {/* Subtle radial glow in dark mode */}
      <div
        className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse at 80% 20%, rgba(16,163,127,.06) 0%, transparent 65%)",
        }}
      />

      <div className="relative">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-2 mb-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" aria-hidden="true" />
              <span className="font-mono text-[10px] text-text-accent tracking-widest uppercase">
                Orchestration Active
              </span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="text-xl font-bold text-text-primary tracking-tight"
            >
              Welcome back to RuFlow
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="font-mono text-xs text-text-muted mt-1"
            >
              Your AI career infrastructure is ready.
            </motion.p>
          </div>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.12 }}
            className="flex items-center gap-2 flex-shrink-0"
          >
            <Button href="/dashboard/pipeline" variant="secondary" size="sm">
              <Brain className="h-3.5 w-3.5" aria-hidden="true" />
              View Pipeline
            </Button>
            <Button href="/dashboard/applications" variant="primary" size="sm">
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              New Application
            </Button>
          </motion.div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {METRICS.map((metric, i) => (
            <MetricCard key={metric.label} metric={metric} index={i} />
          ))}
        </div>

        {/* Active agents strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="flex items-center gap-3 flex-wrap"
        >
          <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">
            Agents
          </span>
          {ACTIVE_AGENTS.map((agent) => (
            <div key={agent.name} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full flex-shrink-0",
                  agent.status === "active" ? "bg-accent animate-pulse" : "bg-border-strong"
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "font-mono text-[10px]",
                  agent.status === "active" ? "text-text-accent" : "text-text-muted"
                )}
              >
                {agent.name}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </GlassCard>
  );
}