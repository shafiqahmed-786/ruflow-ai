"use client";

// frontend/components/landing/WhyRuFlow.tsx

import { motion } from "framer-motion";
import {
  Brain,
  Database,
  BarChart3,
  BookOpen,
  RefreshCw,
  Layers,
  CheckCircle,
} from "lucide-react";

import { GlassCard } from "@/components/ui/GlassCard";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Feature {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  highlight: string;
  points: string[];
}

// ── Data ──────────────────────────────────────────────────────────────────────

const FEATURES: Feature[] = [
  {
    id: "multi-agent",
    icon: Brain,
    title: "Multi-Agent Reasoning",
    description:
      "Eight specialized agents collaborate via LangGraph orchestration — each with dedicated tools, prompts, and model assignments.",
    highlight: "Autonomous orchestration layer",
    points: [
      "LangGraph StateGraph",
      "Dynamic model routing",
      "Parallel execution",
    ],
  },
  {
    id: "rag",
    icon: Database,
    title: "Retrieval-Augmented Optimization",
    description:
      "Hybrid BM25 + semantic retrieval over your personal knowledge base of resumes and job descriptions.",
    highlight: "Persistent vector memory",
    points: [
      "ChromaDB vector store",
      "BM25 + dense retrieval",
      "Query expansion",
    ],
  },
  {
    id: "ats-scoring",
    icon: BarChart3,
    title: "ATS Semantic Scoring",
    description:
      "Three-layer evaluation: programmatic keyword matching, cosine similarity, and LLM-as-judge holistic scoring.",
    highlight: "Enterprise-grade evaluation",
    points: [
      "Regex + embedding fusion",
      "LLM judge scoring",
      "Weighted composite score",
    ],
  },
  {
    id: "memory",
    icon: BookOpen,
    title: "Persistent Application Memory",
    description:
      "MongoDB stores full application history. ChromaDB indexes resume embeddings for cross-session pattern learning.",
    highlight: "Long-term learning loop",
    points: [
      "MongoDB + ChromaDB",
      "Session checkpointing",
      "Cross-session learning",
    ],
  },
  {
    id: "loop",
    icon: RefreshCw,
    title: "AI Evaluation Loop",
    description:
      "The Evaluator and Improver agents run iteratively — surgically patching critical issues until the pass threshold is met.",
    highlight: "Self-improving pipeline",
    points: [
      "Up to 4 iterations",
      "Surgical patch editing",
      "Change log auditing",
    ],
  },
  {
    id: "architecture",
    icon: Layers,
    title: "Production-Ready Architecture",
    description:
      "FastAPI backend, Next.js 14 App Router frontend, Docker Compose deployment, async throughout.",
    highlight: "Modern AI systems engineering",
    points: [
      "FastAPI + uvicorn",
      "Docker Compose ready",
      "Async LangGraph pipeline",
    ],
  },
];

// ── Feature Card ──────────────────────────────────────────────────────────────

function FeatureCard({
  feature,
  index,
}: {
  feature: Feature;
  index: number;
}) {
  const Icon = feature.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{
        duration: 0.38,
        delay: index * 0.07,
        ease: "easeOut",
      }}
    >
      <GlassCard
        hover
        glow
        className="flex h-full flex-col p-6 group"
      >
        {/* Icon */}
        <div className="mb-4 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-accent-subtle transition-colors duration-200 group-hover:border-accent/50">
          <Icon className="h-5 w-5 text-text-accent" />
        </div>

        {/* Title */}
        <h3 className="mb-2 text-sm font-semibold leading-snug text-text-primary">
          {feature.title}
        </h3>

        {/* Description */}
        <p className="mb-5 flex-1 text-xs leading-relaxed text-text-secondary">
          {feature.description}
        </p>

        {/* Highlight */}
        <div className="mb-4 flex items-center gap-2 border-t border-border pt-3">
          <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-text-accent" />

          <span className="font-mono text-[10px] tracking-wide text-text-accent">
            {feature.highlight}
          </span>
        </div>

        {/* Technical bullets */}
        <ul className="space-y-2">
          {feature.points.map((point) => (
            <li
              key={point}
              className="flex items-center gap-2"
            >
              <div className="h-1 w-1 rounded-full bg-accent" />

              <span className="font-mono text-[10px] text-text-muted">
                {point}
              </span>
            </li>
          ))}
        </ul>
      </GlassCard>
    </motion.div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export function WhyRuFlow() {
  return (
    <section
      id="features"
      className="px-6 py-20"
    >
      <div className="max-w-content mx-auto">
        {/* Header */}
        <div className="mb-14 text-center">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4 }}
            className="mb-3 font-mono text-xs uppercase tracking-widest text-text-accent"
          >
            Infrastructure
          </motion.p>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4, delay: 0.06 }}
            className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl"
          >
            Why RuFlow is different
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4, delay: 0.12 }}
            className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-text-secondary"
          >
            Not a template tool. Not a basic ATS checker.
            A full-stack AI operating system for job applications.
          </motion.p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}