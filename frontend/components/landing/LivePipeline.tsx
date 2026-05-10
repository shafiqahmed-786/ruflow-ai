"use client";

// frontend/components/landing/LivePipeline.tsx
import { motion }     from "framer-motion";
import { Upload, FileText, BarChart3, Database, Sparkles, CheckCircle, Zap, ArrowRight } from "lucide-react";
import { GlassCard }  from "@/components/ui/GlassCard";
import { cn }         from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PipelineStage {
  title:       string;
  description: string;
  icon:        React.ElementType;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const PIPELINE_STAGES: PipelineStage[] = [
  { title: "Resume Upload",       description: "User uploads resume and target job description.",         icon: Upload      },
  { title: "JD Extraction",       description: "AI extracts ATS keywords and role signals.",              icon: FileText    },
  { title: "ATS Analysis",        description: "Semantic scoring and structure analysis begin.",           icon: BarChart3   },
  { title: "Semantic Retrieval",  description: "Relevant memory and prior successes retrieved.",          icon: Database    },
  { title: "Resume Optimization", description: "Resume rewritten for ATS and recruiter alignment.",       icon: Sparkles    },
  { title: "Evaluation",          description: "AI evaluates semantic and structural quality.",           icon: CheckCircle },
  { title: "Final Output",        description: "ATS-optimized application package delivered.",            icon: Zap         },
];

// ── Stage node ────────────────────────────────────────────────────────────────
function StageNode({
  stage,
  index,
  total,
}: {
  stage: PipelineStage;
  index: number;
  total: number;
}) {
  const Icon   = stage.icon;
  const isLast = index === total - 1;

  return (
    <div className="flex flex-col lg:flex-row items-center gap-0 lg:gap-0 flex-1">
      {/* Node + tooltip */}
      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.32, delay: index * 0.07, ease: "easeOut" }}
        className="relative group flex flex-col items-center text-center flex-shrink-0"
      >
        {/* Icon circle */}
        <div className="flex items-center justify-center w-11 h-11 rounded-full border border-border bg-surface group-hover:border-accent/40 group-hover:bg-accent-subtle transition-colors duration-200 mb-2.5">
          <Icon className="h-5 w-5 text-text-muted group-hover:text-text-accent transition-colors duration-200" />
        </div>

        {/* Step label */}
        <span className="font-mono text-[9px] text-text-muted uppercase tracking-widest mb-0.5">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="font-mono text-[11px] text-text-secondary leading-tight max-w-[80px] text-center group-hover:text-text-primary transition-colors duration-150">
          {stage.title}
        </span>

        {/* Tailwind tooltip — hover + focus-within accessible */}
        <div
          role="tooltip"
          aria-label={stage.description}
          className={cn(
            "absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10",
            "w-48 px-3 py-2 rounded-lg border border-border bg-surface shadow-card-dark",
            "opacity-0 pointer-events-none",
            "group-hover:opacity-100 group-focus-within:opacity-100",
            "transition-opacity duration-200"
          )}
        >
          <p className="font-mono text-[10px] text-text-secondary leading-relaxed text-center">
            {stage.description}
          </p>
        </div>
      </motion.div>

      {/* Connector */}
      {!isLast && (
        <>
          {/* Desktop: horizontal arrow */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.3, delay: index * 0.07 + 0.12 }}
            className="hidden lg:flex items-center justify-center flex-1 px-1"
          >
            <div className="h-px flex-1 bg-border" />
            <ArrowRight className="h-3 w-3 text-border flex-shrink-0" />
          </motion.div>
          {/* Mobile: vertical line */}
          <div className="flex lg:hidden h-5 w-px bg-border my-1" />
        </>
      )}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
export function LivePipeline() {
  return (
    <section id="pipeline" className="py-20 px-6">
      <div className="max-w-content mx-auto">

        {/* Header */}
        <div className="text-center mb-14">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4 }}
            className="font-mono text-xs text-text-accent tracking-widest uppercase mb-3"
          >
            Live Pipeline
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4, delay: 0.06 }}
            className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight"
          >
            From raw input to ATS-ready output
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4, delay: 0.12 }}
            className="mt-4 text-text-secondary text-sm max-w-lg mx-auto leading-relaxed"
          >
            A deterministic 7-stage pipeline. Each stage is an autonomous agent
            with its own toolchain, memory, and evaluation loop.
          </motion.p>
        </div>

        {/* Pipeline card */}
        <GlassCard className="p-6 lg:p-8">
          {/* Nodes */}
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-2 lg:gap-0">
            {PIPELINE_STAGES.map((stage, i) => (
              <StageNode
                key={stage.title}
                stage={stage}
                index={i}
                total={PIPELINE_STAGES.length}
              />
            ))}
          </div>

          {/* Stats bar */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="mt-8 pt-6 border-t border-border flex flex-wrap items-center justify-center gap-6"
          >
            {[
              { label: "Avg Runtime",  value: "35–90s"   },
              { label: "Max Iters",    value: "4 loops"  },
              { label: "Pass Score",   value: "≥ 80/100" },
              { label: "Fallback",     value: "4 models" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider">
                  {item.label}
                </span>
                <span className="font-mono text-xs text-text-accent font-semibold">
                  {item.value}
                </span>
              </div>
            ))}
          </motion.div>
        </GlassCard>

      </div>
    </section>
  );
}