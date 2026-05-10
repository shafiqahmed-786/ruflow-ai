"use client";

// frontend/components/landing/TrustBadges.tsx
import { motion } from "framer-motion";
import { Brain, Zap, Database, ShieldCheck, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Badge {
  icon:  React.ElementType;
  label: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const BADGES: Badge[] = [
  { icon: Brain,       label: "Multi-Agent AI"       },
  { icon: Zap,         label: "ATS Optimized"        },
  { icon: Database,    label: "RAG Memory"            },
  { icon: ShieldCheck, label: "LLM Evaluation"       },
  { icon: Activity,    label: "Real-Time Scoring"    },
];

// ── Badge pill ────────────────────────────────────────────────────────────────
function BadgePill({ badge, index }: { badge: Badge; index: number }) {
  const Icon = badge.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.6 + index * 0.08, ease: "easeOut" }}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5",
          "rounded-full border border-border bg-surface",
          "font-mono text-xs text-text-muted",
          "hover:border-accent/40 hover:text-text-accent",
          "transition-colors duration-200 cursor-default"
        )}
      >
        <Icon className="h-3 w-3 text-text-accent flex-shrink-0" />
        {badge.label}
      </span>
    </motion.div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
export function TrustBadges() {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-7">
      {BADGES.map((badge, i) => (
        <BadgePill key={badge.label} badge={badge} index={i} />
      ))}
    </div>
  );
}