"use client";

// frontend/components/landing/HeroSection.tsx
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Zap,
  Brain,
  Database,
  Shield,
  TrendingUp,
  Play,
} from "lucide-react";

// ── Trust badge data ─────────────────────────────────────────────────────────
interface TrustBadge {
  icon: React.ReactNode;
  label: string;
}

const TRUST_BADGES: TrustBadge[] = [
  { icon: <Brain size={13} />,     label: "Multi-Agent AI" },
  { icon: <Zap size={13} />,       label: "ATS Optimized" },
  { icon: <Database size={13} />,  label: "RAG Memory" },
  { icon: <Shield size={13} />,    label: "LLM Evaluation" },
  { icon: <TrendingUp size={13} />, label: "Self-Improving" },
];

// ── Dashboard preview metric cards ───────────────────────────────────────────
interface MetricCard {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
}

const PREVIEW_METRICS: MetricCard[] = [
  { label: "ATS Score",      value: "91",   delta: "+29",   positive: true },
  { label: "Keyword Match",  value: "94%",  delta: "+41%",  positive: true },
  { label: "Iterations",     value: "3",    delta: "auto",  positive: true },
];

// ── Pipeline stages (right side preview) ─────────────────────────────────────
const PIPELINE_STAGES = [
  { label: "Planner",      status: "done",    ms: "812ms"  },
  { label: "JD Analyzer",  status: "done",    ms: "1.2s"   },
  { label: "Retrieval",    status: "done",    ms: "980ms"  },
  { label: "Resume Tailor",status: "active",  ms: "..."    },
  { label: "Evaluator",    status: "pending", ms: "--"     },
];

// ── Sub-components ────────────────────────────────────────────────────────────
function TrustBadgeRow() {
  return (
    <div className="flex flex-wrap gap-2 mt-8">
      {TRUST_BADGES.map((badge) => (
        <span
          key={badge.label}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                     border border-[#252d48] bg-[#141829] text-[#888888]
                     text-xs font-mono tracking-wide"
        >
          <span className="text-[#10a37f]">{badge.icon}</span>
          {badge.label}
        </span>
      ))}
    </div>
  );
}

function CTAButtons() {
  return (
    <div className="flex flex-wrap items-center gap-4 mt-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg
                   bg-[#10a37f] text-white font-semibold text-sm
                   hover:bg-[#0d8a6a] transition-colors duration-200
                   shadow-lg shadow-[#10a37f]/20"
      >
        Start Free
        <ArrowRight size={16} />
      </Link>

      <button
        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg
                   border border-[#252d48] bg-[#141829] text-[#e0e0e0]
                   font-semibold text-sm hover:border-[#10a37f]/50
                   hover:bg-[#141829]/80 transition-colors duration-200"
      >
        <Play size={14} className="text-[#10a37f]" />
        Watch Demo
      </button>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div
      className="w-full rounded-xl border border-[#252d48] bg-[#141829]
                 overflow-hidden shadow-2xl shadow-black/40"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#252d48] bg-[#0f1324]">
        <span className="w-3 h-3 rounded-full bg-rose-500/70" />
        <span className="w-3 h-3 rounded-full bg-amber-500/70" />
        <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
        <span className="ml-3 font-mono text-[11px] text-[#888888] tracking-wider">
          careeros — pipeline execution
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10a37f] animate-pulse" />
          <span className="font-mono text-[10px] text-[#10a37f]">LIVE</span>
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Metric row */}
        <div className="grid grid-cols-3 gap-3">
          {PREVIEW_METRICS.map((m) => (
            <div
              key={m.label}
              className="rounded-lg border border-[#252d48] bg-[#0f1324] p-3"
            >
              <p className="font-mono text-[10px] text-[#888888] uppercase tracking-widest mb-1">
                {m.label}
              </p>
              <p className="font-mono text-xl font-bold text-[#e0e0e0]">
                {m.value}
              </p>
              <p className="font-mono text-[10px] text-[#10a37f] mt-0.5">
                {m.delta}
              </p>
            </div>
          ))}
        </div>

        {/* Pipeline stages */}
        <div className="rounded-lg border border-[#252d48] bg-[#0f1324] p-3 space-y-2">
          <p className="font-mono text-[10px] text-[#888888] uppercase tracking-widest mb-2">
            Agent Pipeline
          </p>
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage.label} className="flex items-center gap-3">
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  stage.status === "done"
                    ? "bg-[#10a37f]"
                    : stage.status === "active"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-[#252d48]"
                }`}
              />
              <span
                className={`font-mono text-xs flex-1 ${
                  stage.status === "active"
                    ? "text-amber-300"
                    : stage.status === "done"
                    ? "text-[#e0e0e0]"
                    : "text-[#888888]"
                }`}
              >
                {stage.label}
              </span>
              <span className="font-mono text-[10px] text-[#888888]">
                {stage.ms}
              </span>
            </div>
          ))}
        </div>

        {/* Eval score bar */}
        <div className="rounded-lg border border-[#252d48] bg-[#0f1324] p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="font-mono text-[10px] text-[#888888] uppercase tracking-widest">
              Overall Score
            </span>
            <span className="font-mono text-sm font-bold text-[#10a37f]">91.4</span>
          </div>
          <div className="h-1.5 bg-[#252d48] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#10a37f] rounded-full"
              style={{ width: "91.4%" }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="font-mono text-[9px] text-[#888888]">0</span>
            <span className="font-mono text-[9px] text-[#10a37f]">PASS ≥ 80</span>
            <span className="font-mono text-[9px] text-[#888888]">100</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function HeroSection() {
  return (
    <section className="relative pt-28 pb-20 px-6 overflow-hidden">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(37,45,72,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(37,45,72,.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left — copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                            border border-[#10a37f]/30 bg-[#10a37f]/10 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10a37f]" />
              <span className="font-mono text-xs text-[#10a37f] tracking-wider uppercase">
                Multi-Agent AI · 8 Autonomous Agents
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-bold text-[#e0e0e0]
                           leading-tight tracking-tight text-balance">
              Build ATS-Optimized{" "}
              <span className="text-[#10a37f]">Applications</span> With{" "}
              Multi-Agent AI
            </h1>

            {/* Sub */}
            <p className="mt-5 text-lg text-[#888888] leading-relaxed max-w-xl">
              Resume tailoring, cover letters, ATS scoring, retrieval memory,
              and application intelligence — powered by autonomous AI agents
              that learn and improve across every submission.
            </p>

            <TrustBadgeRow />
            <CTAButtons />

            {/* Social proof micro-line */}
            <p className="mt-6 font-mono text-xs text-[#888888]">
              Trusted by engineers at{" "}
              <span className="text-[#e0e0e0]">Stripe · Anthropic · Google · OpenAI</span>
            </p>
          </motion.div>

          {/* Right — dashboard preview */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15, ease: "easeOut" }}
            className="w-full"
          >
            <DashboardPreview />
          </motion.div>

        </div>
      </div>
    </section>
  );
}