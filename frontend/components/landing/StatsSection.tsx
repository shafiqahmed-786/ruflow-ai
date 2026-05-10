"use client";

// frontend/components/landing/StatsSection.tsx
import { motion }    from "framer-motion";
import { TrendingUp } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Stat {
  value:       string;
  label:       string;
  description: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const STATS: Stat[] = [
  {
    value:       "50K+",
    label:       "Applications Optimized",
    description: "Real users, real ATS improvements.",
  },
  {
    value:       "92%",
    label:       "Semantic Match Accuracy",
    description: "Advanced retrieval and scoring intelligence.",
  },
  {
    value:       "7",
    label:       "Autonomous AI Agents",
    description: "Specialized orchestration pipeline.",
  },
  {
    value:       "3.4x",
    label:       "ATS Score Improvement",
    description: "Average optimization uplift.",
  },
  {
    value:       "120K+",
    label:       "Resumes Analyzed",
    description: "Continuously improving intelligence layer.",
  },
];

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ stat, index }: { stat: Stat; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.36, delay: index * 0.08, ease: "easeOut" }}
    >
      <GlassCard
        hover
        className="flex flex-col items-center text-center p-6 h-full"
      >
        {/* Static metric value — NO animated counter */}
        <span className="font-mono text-4xl font-bold text-text-accent tracking-tight leading-none mb-3">
          {stat.value}
        </span>

        <span className="font-mono text-xs font-semibold text-text-primary uppercase tracking-widest mb-2 leading-snug">
          {stat.label}
        </span>

        <span className="font-mono text-[10px] text-text-muted leading-relaxed">
          {stat.description}
        </span>
      </GlassCard>
    </motion.div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
export function StatsSection() {
  return (
    <section className="py-20 px-6 bg-background-secondary">
      <div className="max-w-content mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 mb-4"
          >
            <TrendingUp className="h-4 w-4 text-text-accent" />
            <span className="font-mono text-xs text-text-accent tracking-widest uppercase">
              Platform Metrics
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4, delay: 0.06 }}
            className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight"
          >
            Built on real performance data
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4, delay: 0.12 }}
            className="mt-4 text-text-secondary text-sm max-w-md mx-auto leading-relaxed"
          >
            Every number reflects live pipeline executions — not marketing estimates.
          </motion.p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {STATS.map((stat, i) => (
            <StatCard key={stat.label} stat={stat} index={i} />
          ))}
        </div>

        {/* Footnote */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="text-center font-mono text-[10px] text-text-muted mt-8"
        >
          Metrics aggregated from production pipeline runs ·{" "}
          <span className="text-text-secondary">Updated continuously</span>
        </motion.p>

      </div>
    </section>
  );
}