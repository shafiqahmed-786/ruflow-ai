"use client";

// frontend/components/landing/InsightsSection.tsx

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Brain,
  Sparkles,
  Database,
  ArrowRight,
} from "lucide-react";

import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Insight {
  title: string;
  description: string;
  category: string;
  icon: React.ElementType;
  readTime: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const INSIGHTS: Insight[] = [
  {
    title: "How ATS Systems Actually Rank Resumes",
    description:
      "Master the algorithms recruiters use. Learn semantic scoring, keyword weighting, parsing behavior, and system-level optimization strategies.",
    category: "ATS Intelligence",
    icon: Brain,
    readTime: "6 min read",
  },
  {
    title: "Building Multi-Agent AI Systems for Career Infrastructure",
    description:
      "Why orchestration pipelines outperform single-prompt workflows for resume optimization, evaluation loops, and autonomous application intelligence.",
    category: "AI Systems",
    icon: Sparkles,
    readTime: "8 min read",
  },
  {
    title: "RAG Memory in Job Application Optimization",
    description:
      "Using retrieval-augmented generation and vector memory to continuously improve application quality from patterns learned across thousands of resumes.",
    category: "RAG Architecture",
    icon: Database,
    readTime: "7 min read",
  },
];

// ── Category styles ───────────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<string, string> = {
  "ATS Intelligence":
    "text-text-accent bg-accent-subtle border-accent/25",

  "AI Systems":
    "text-amber bg-amber-subtle border-amber/25",

  "RAG Architecture":
    "text-text-primary bg-surface-raised border-border",
};

// ── Card ──────────────────────────────────────────────────────────────────────

function InsightCard({
  insight,
  index,
}: {
  insight: Insight;
  index: number;
}) {
  const Icon = insight.icon;

  const badgeStyle =
    CATEGORY_STYLE[insight.category] ??
    "text-text-muted bg-surface border-border";

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{
        duration: 0.45,
        delay: index * 0.1,
        ease: "easeOut",
      }}
    >
      <GlassCard
        hover
        className="group flex h-full cursor-pointer flex-col p-6"
      >
        {/* Top Row */}
        <div className="mb-5 flex items-center justify-between">
          <div
            className="
              flex h-10 w-10 flex-shrink-0 items-center justify-center
              rounded-lg border border-accent/25 bg-accent-subtle
              transition-colors duration-200
              group-hover:border-accent/50
            "
          >
            <Icon
              className="h-5 w-5 text-text-accent"
              aria-hidden="true"
            />
          </div>

          <span
            className={cn(
              "rounded-full border px-2.5 py-1",
              "font-mono text-[10px] font-semibold uppercase tracking-wider",
              badgeStyle
            )}
          >
            {insight.category}
          </span>
        </div>

        {/* Title */}
        <h3
          className="
            mb-2 text-sm font-semibold leading-snug text-text-primary
            transition-colors duration-200
            group-hover:text-text-accent
          "
        >
          {insight.title}
        </h3>

        {/* Description */}
        <p
          className="
            mb-5 flex-1 text-xs leading-relaxed text-text-secondary
          "
        >
          {insight.description}
        </p>

        {/* Footer */}
        <div
          className="
            flex items-center justify-between
            border-t border-border pt-4
          "
        >
          <span
            className="
              font-mono text-[10px] text-text-muted
            "
          >
            {insight.readTime}
          </span>

          <Link
            href="/blog"
            aria-label={`Read: ${insight.title}`}
            className="
              inline-flex items-center gap-1
              font-mono text-[10px]
              text-text-accent
              transition-colors duration-150
              hover:text-accent-muted
            "
          >
            Read

            <ArrowRight
              className="
                h-3 w-3
                transition-transform duration-200
                group-hover:translate-x-0.5
              "
              aria-hidden="true"
            />
          </Link>
        </div>
      </GlassCard>
    </motion.article>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export function InsightsSection() {
  return (
    <section
      id="insights"
      className="bg-background-secondary px-6 py-20"
    >
      <div className="max-w-content mx-auto">
        {/* Header */}
        <div
          className="
            mb-12 flex flex-col justify-between gap-4
            sm:flex-row sm:items-end
          "
        >
          <div>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.4 }}
              className="
                mb-3 font-mono text-xs uppercase tracking-widest
                text-text-accent
              "
            >
              Insights
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.4, delay: 0.06 }}
              className="
                text-3xl font-bold tracking-tight text-text-primary
                sm:text-4xl
              "
            >
              From the research team
            </motion.h2>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4, delay: 0.12 }}
          >
            <Link
              href="/blog"
              className="
                inline-flex items-center gap-1.5
                font-mono text-xs
                text-text-muted
                transition-colors duration-150
                hover:text-text-primary
              "
            >
              View all posts

              <ArrowRight
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
            </Link>
          </motion.div>
        </div>

        {/* Cards */}
        <div
          className="
            grid grid-cols-1 gap-5
            md:grid-cols-2
            lg:grid-cols-3
          "
        >
          {INSIGHTS.map((insight, index) => (
            <InsightCard
              key={insight.title}
              insight={insight}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}