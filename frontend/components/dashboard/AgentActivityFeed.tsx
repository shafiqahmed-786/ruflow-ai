"use client";

// frontend/components/dashboard/AgentActivityFeed.tsx
import { motion } from "framer-motion";
import { BrainCircuit } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

interface AgentEvent {
  id: string;
  agent: string;
  action: string;
  target: string;
  ts: string;
  type: "success" | "running" | "info";
}

const FEED: AgentEvent[] = [
  { id: "f1", agent: "Evaluator",     action: "Scored resume",       target: "Anthropic · 91/100", ts: "2m ago",  type: "success" },
  { id: "f2", agent: "Cover Letter",  action: "Generated cover",     target: "OpenAI",              ts: "5m ago",  type: "success" },
  { id: "f3", agent: "JD Analyzer",  action: "Parsed keywords",      target: "Vercel JD",           ts: "12m ago", type: "info"    },
  { id: "f4", agent: "Retrieval",    action: "Vector search",        target: "ChromaDB · 94%",      ts: "18m ago", type: "running" },
  { id: "f5", agent: "Planner",      action: "Routed execution",     target: "Stripe pipeline",     ts: "1hr ago", type: "success" },
];

const TYPE_DOT: Record<AgentEvent["type"], string> = {
  success: "bg-accent",
  running: "bg-amber animate-pulse",
  info:    "bg-text-secondary",
};

export function AgentActivityFeed() {
  return (
    <GlassCard className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <BrainCircuit className="h-4 w-4 text-text-accent" aria-hidden="true" />
        <h2 className="font-mono text-sm font-semibold text-text-primary">
          Agent Activity
        </h2>
        <span className="ml-auto font-mono text-[9px] text-text-muted bg-surface-raised border border-border px-2 py-0.5 rounded">
          Live Feed
        </span>
      </div>

      <div className="divide-y divide-border">
        {FEED.map((ev, i) => (
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28, delay: 0.08 + i * 0.07 }}
            className="flex items-start gap-3 px-4 py-3 hover:bg-surface-raised transition-colors duration-150"
          >
            <div className="flex flex-col items-center gap-1 pt-1 flex-shrink-0">
              <span className={cn("w-2 h-2 rounded-full", TYPE_DOT[ev.type])} />
              {i < FEED.length - 1 && (
                <div className="w-px h-5 bg-border" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[10px] font-semibold text-text-accent leading-none mb-0.5">
                {ev.agent}
              </p>
              <p className="font-mono text-[10px] text-text-secondary leading-snug">
                {ev.action} · <span className="text-text-muted">{ev.target}</span>
              </p>
            </div>
            <span className="font-mono text-[9px] text-text-muted flex-shrink-0">{ev.ts}</span>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  );
}
