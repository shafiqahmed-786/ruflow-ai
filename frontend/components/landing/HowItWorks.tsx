"use client";

// frontend/components/landing/HowItWorks.tsx
import { motion } from "framer-motion";
import { Upload, Cpu, FileCheck, ArrowRight } from "lucide-react";

// ── Step data ─────────────────────────────────────────────────────────────────
interface Step {
  number: string;
  icon:   React.ReactNode;
  title:  string;
  description: string;
  details: string[];
}

const STEPS: Step[] = [
  {
    number: "01",
    icon:   <Upload size={22} />,
    title:  "Upload Resume + JD",
    description:
      "Paste your resume and the target job description. CareerOS AI ingests, parses, and structures both documents into machine-readable context.",
    details: [
      "PDF or plain text supported",
      "Structured extraction via PyMuPDF",
      "LinkedIn profile integration",
    ],
  },
  {
    number: "02",
    icon:   <Cpu size={22} />,
    title:  "AI Agents Analyze + Optimize",
    description:
      "Eight specialized autonomous agents execute in an orchestrated LangGraph pipeline — analyzing, retrieving, writing, and evaluating until quality thresholds are met.",
    details: [
      "Hybrid RAG retrieval over knowledge base",
      "STAR-format bullet rewriting",
      "Up to 4 self-improvement iterations",
    ],
  },
  {
    number: "03",
    icon:   <FileCheck size={22} />,
    title:  "Receive ATS-Ready Output",
    description:
      "Receive a tailored resume, targeted cover letter, full evaluation scores, and a detailed change log explaining every optimization made.",
    details: [
      "ATS keyword coverage report",
      "Multi-dimensional quality scores",
      "Exportable Markdown output",
    ],
  },
];

// ── Step Card ─────────────────────────────────────────────────────────────────
function StepCard({ step, index }: { step: Step; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: "easeOut" }}
      className="relative flex flex-col rounded-xl border border-[#252d48]
                 bg-[#141829] p-6 xl:p-7"
    >
      {/* Step number + icon */}
      <div className="flex items-start justify-between mb-5">
        <div
          className="flex items-center justify-center w-11 h-11 rounded-lg
                     border border-[#10a37f]/30 bg-[#10a37f]/10 text-[#10a37f]"
        >
          {step.icon}
        </div>
        <span className="font-mono text-3xl font-bold text-[#252d48] select-none">
          {step.number}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-[#e0e0e0] mb-2">
        {step.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-[#888888] leading-relaxed mb-5">
        {step.description}
      </p>

      {/* Details list */}
      <ul className="mt-auto space-y-2">
        {step.details.map((detail) => (
          <li key={detail} className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-[#10a37f] flex-shrink-0" />
            <span className="font-mono text-xs text-[#888888]">{detail}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

// ── Connector Arrow (desktop only) ────────────────────────────────────────────
function ConnectorArrow() {
  return (
    <div className="hidden lg:flex items-center justify-center flex-shrink-0 pt-4">
      <ArrowRight size={20} className="text-[#252d48]" />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function HowItWorks() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-7xl mx-auto">

        {/* Section header */}
        <div className="text-center mb-14">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="font-mono text-xs text-[#10a37f] tracking-widest uppercase mb-3"
          >
            How It Works
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="text-3xl sm:text-4xl font-bold text-[#e0e0e0] tracking-tight"
          >
            Three steps to an optimized application
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-4 text-[#888888] max-w-xl mx-auto text-sm leading-relaxed"
          >
            From raw resume to ATS-ready output in under 90 seconds.
            No templates. No manual editing. Fully autonomous.
          </motion.p>
        </div>

        {/* Steps grid with connectors */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 lg:gap-0 lg:items-start">
          {STEPS.map((step, i) => (
            <>
              <StepCard key={step.number} step={step} index={i} />
              {i < STEPS.length - 1 && <ConnectorArrow key={`arrow-${i}`} />}
            </>
          ))}
        </div>

        {/* Bottom note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-10 text-center"
        >
          <p className="font-mono text-xs text-[#888888]">
            Average pipeline runtime:{" "}
            <span className="text-[#e0e0e0]">35–90 seconds</span> · Up to{" "}
            <span className="text-[#10a37f]">4 autonomous improvement iterations</span>
          </p>
        </motion.div>

      </div>
    </section>
  );
}