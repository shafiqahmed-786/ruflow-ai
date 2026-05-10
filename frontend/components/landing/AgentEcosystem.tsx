"use client";

// frontend/components/landing/AgentEcosystem.tsx
import { motion }      from "framer-motion";
import { Brain, Search, Database, Sparkles, PenTool, BarChart3, Workflow } from "lucide-react";
import { GlassCard }   from "@/components/ui/GlassCard";
import { cn }          from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Agent {
  name:        string;
  description: string;
  model:       string;
  latency:     string;
  purpose:     string;
  icon:        React.ElementType;
  status:      string;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const AGENTS: Agent[] = [
  {
    name:        "Planner Agent",
    description: "Builds execution strategy and orchestrates agent flow.",
    model:       "Gemini 2.0 Flash",
    latency:     "~1.2s",
    purpose:     "Planning & orchestration",
    icon:        Brain,
    status:      "Active",
  },
  {
    name:        "JD Analyzer",
    description: "Extracts ATS keywords, requirements, and semantic signals.",
    model:       "Gemini 2.0 Flash Lite",
    latency:     "~0.8s",
    purpose:     "Job description intelligence",
    icon:        Search,
    status:      "Active",
  },
  {
    name:        "Retrieval Agent",
    description: "Performs semantic retrieval using vector memory.",
    model:       "Embedding Pipeline",
    latency:     "~1.4s",
    purpose:     "RAG retrieval",
    icon:        Database,
    status:      "Active",
  },
  {
    name:        "Resume Tailor",
    description: "Optimizes resumes for ATS and recruiter readability.",
    model:       "Gemini 2.0 Flash",
    latency:     "~2.1s",
    purpose:     "Resume optimization",
    icon:        Sparkles,
    status:      "Active",
  },
  {
    name:        "Cover Letter Agent",
    description: "Generates personalized, role-aware cover letters.",
    model:       "Gemini 2.0 Flash",
    latency:     "~1.7s",
    purpose:     "Cover letter generation",
    icon:        PenTool,
    status:      "Active",
  },
  {
    name:        "Evaluator Agent",
    description: "Scores ATS compatibility and semantic alignment.",
    model:       "Evaluation Engine",
    latency:     "~0.9s",
    purpose:     "Quality assurance",
    icon:        BarChart3,
    status:      "Active",
  },
  {
    name:        "Memory Agent",
    description: "Learns from application history and success patterns.",
    model:       "Persistent Memory Layer",
    latency:     "~0.6s",
    purpose:     "Continuous learning",
    icon:        Workflow,
    status:      "Active",
  },
];

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader() {
  return (
    <div className="text-center mb-14">
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.4 }}
        className="font-mono text-xs text-text-accent tracking-widest uppercase mb-3"
      >
        Agent Ecosystem
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.4, delay: 0.06 }}
        className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight"
      >
        8 autonomous agents. One coordinated pipeline.
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.4, delay: 0.12 }}
        className="mt-4 text-text-secondary text-sm max-w-lg mx-auto leading-relaxed"
      >
        Each agent is a specialized LLM system with dedicated tools, memory, and
        evaluation criteria — orchestrated by LangGraph StateGraph.
      </motion.p>
    </div>
  );
}

// ── Agent card ─────────────────────────────────────────────────────────────────
function AgentCard({ agent, index }: { agent: Agent; index: number }) {
  const Icon = agent.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.38, delay: index * 0.07, ease: "easeOut" }}
    >
      <GlassCard
        hover
        glow
        className="flex flex-col p-5 h-full group"
      >
        {/* Icon row */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg border border-accent/25 bg-accent-subtle flex-shrink-0 group-hover:border-accent/50 transition-colors duration-200">
            <Icon className="h-5 w-5 text-text-accent" />
          </div>
          {/* Status dot */}
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="font-mono text-[9px] text-text-accent uppercase tracking-widest">
              {agent.status}
            </span>
          </div>
        </div>

        {/* Name + purpose */}
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-text-primary leading-snug mb-0.5">
            {agent.name}
          </h3>
          <span className="font-mono text-[10px] text-text-muted tracking-wide">
            {agent.purpose}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-text-secondary leading-relaxed flex-1 mb-4">
          {agent.description}
        </p>

        {/* Terminal metadata footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="font-mono text-[10px] text-text-accent truncate max-w-[60%]">
            {agent.model}
          </span>
          <span className="font-mono text-[10px] text-text-muted flex-shrink-0">
            ⏱ {agent.latency}
          </span>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
export function AgentEcosystem() {
  return (
    <section id="agents" className="py-20 px-6 bg-background-secondary">
      <div className="max-w-content mx-auto">
        <SectionHeader />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENTS.map((agent, i) => (
            <AgentCard key={agent.name} agent={agent} index={i} />
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="text-center font-mono text-xs text-text-muted mt-10"
        >
          Orchestrated via{" "}
          <span className="text-text-secondary">LangGraph StateGraph</span>
          {" "}· Multi-model routing ·{" "}
          <span className="text-text-accent">Gemini · Claude · Embedding Pipeline</span>
        </motion.p>
      </div>
    </section>
  );
}