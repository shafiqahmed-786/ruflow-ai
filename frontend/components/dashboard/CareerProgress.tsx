"use client";

// frontend/components/dashboard/CareerProgress.tsx
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

interface Stage {
  label: string;
  count: number;
  color: string;
  pct: number;
}

const FUNNEL: Stage[] = [
  { label: "Applied",      count: 24, color: "bg-border-strong",  pct: 100 },
  { label: "Screening",   count: 14, color: "bg-text-secondary", pct: 58  },
  { label: "Interview",   count: 7,  color: "bg-amber",          pct: 29  },
  { label: "Final Round", count: 3,  color: "bg-text-accent",    pct: 12  },
  { label: "Offer",       count: 1,  color: "bg-accent",         pct: 4   },
];

export function CareerProgress() {
  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="h-4 w-4 text-text-accent" aria-hidden="true" />
        <h2 className="font-mono text-sm font-semibold text-text-primary">
          Career Funnel
        </h2>
      </div>

      <div className="space-y-3">
        {FUNNEL.map((stage, i) => (
          <motion.div
            key={stage.label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.08 + i * 0.07 }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[10px] text-text-muted">{stage.label}</span>
              <span className="font-mono text-[10px] text-text-secondary">{stage.count}</span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stage.pct}%` }}
                transition={{ duration: 0.7, delay: 0.15 + i * 0.08, ease: "easeOut" }}
                className={cn("h-full rounded-full", stage.color)}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-border">
        <p className="font-mono text-[10px] text-text-muted">
          Offer conversion: <span className="text-text-accent font-semibold">4.2%</span>
          <span className="text-text-muted"> · Industry avg 2.8%</span>
        </p>
      </div>
    </GlassCard>
  );
}
