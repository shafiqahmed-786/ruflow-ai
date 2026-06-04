"use client";

// frontend/components/dashboard/SystemStatus.tsx
import { motion }    from "framer-motion";
import { Activity }  from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn }        from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type SystemState = "Operational" | "Processing" | "Syncing" | "Degraded";

interface SystemService {
  name:   string;
  status: SystemState;
  detail: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const SERVICES: SystemService[] = [
  { name: "Gemini API",       status: "Operational", detail: "p99 < 1.4s"     },
  { name: "Retrieval Engine", status: "Processing",  detail: "2 active jobs"  },
  { name: "Vector Database",  status: "Operational", detail: "ChromaDB v0.4"  },
  { name: "Memory System",    status: "Syncing",     detail: "Indexing…"      },
  { name: "Evaluation Loop",  status: "Operational", detail: "threshold 80.0" },
];

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<SystemState, { dot: string; text: string; animate: boolean }> = {
  Operational: { dot: "bg-accent",        text: "text-text-accent", animate: false },
  Processing:  { dot: "bg-amber",         text: "text-amber",       animate: true  },
  Syncing:     { dot: "bg-text-secondary",text: "text-text-secondary",animate: true },
  Degraded:    { dot: "bg-danger",        text: "text-danger",      animate: false },
};

// ── Service row ────────────────────────────────────────────────────────────────
function ServiceRow({ service, index }: { service: SystemService; index: number }) {
  const config = STATUS_CONFIG[service.status];

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.1 + index * 0.06, ease: "easeOut" }}
      className="flex items-center justify-between py-2.5 border-b border-border last:border-0"
    >
      {/* Left: dot + name */}
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "w-2 h-2 rounded-full flex-shrink-0",
            config.dot,
            config.animate && "animate-pulse"
          )}
          aria-hidden="true"
        />
        <span className="font-mono text-xs text-text-secondary">{service.name}</span>
      </div>

      {/* Right: detail + status */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] text-text-muted hidden sm:block">
          {service.detail}
        </span>
        <span className={cn("font-mono text-[10px] font-semibold", config.text)}>
          {service.status}
        </span>
      </div>
    </motion.div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
export function SystemStatus() {
  const allOperational = SERVICES.every((s) => s.status === "Operational");

  return (
    <GlassCard className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-text-accent" aria-hidden="true" />
          <h2 className="font-mono text-sm font-semibold text-text-primary">
            System Status
          </h2>
        </div>
        <div className="flex items-center gap-1.5" aria-live="polite">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full flex-shrink-0",
              allOperational ? "bg-accent" : "bg-amber animate-pulse"
            )}
            aria-hidden="true"
          />
          <span
            className={cn(
              "font-mono text-[10px] uppercase tracking-widest",
              allOperational ? "text-text-accent" : "text-amber"
            )}
          >
            {allOperational ? "All Systems Go" : "Partially Active"}
          </span>
        </div>
      </div>

      {/* Service list */}
      <div role="list" aria-label="System services">
        {SERVICES.map((service, i) => (
          <ServiceRow key={service.name} service={service} index={i} />
        ))}
      </div>

      {/* Footer uptime note */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="font-mono text-[10px] text-text-muted mt-3 pt-3 border-t border-border"
      >
        Uptime: <span className="text-text-secondary">99.97%</span> · Last checked just now
      </motion.p>
    </GlassCard>
  );
}