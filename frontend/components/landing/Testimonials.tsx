"use client";

// frontend/components/landing/Testimonials.tsx
import { motion }    from "framer-motion";
import { Quote }     from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn }        from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Testimonial {
  name:        string;
  role:        string;
  company:     string;
  quote:       string;
  improvement: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const TESTIMONIALS: Testimonial[] = [
  {
    name:        "Aarav Sharma",
    role:        "ML Engineer",
    company:     "Applied AI Startup",
    quote:       "RuFlow improved my ATS score from 61 to 89 and completely changed how I approach applications.",
    improvement: "+28 ATS",
  },
  {
    name:        "Priya Verma",
    role:        "Data Scientist",
    company:     "Fintech Platform",
    quote:       "The multi-agent pipeline rewrote my resume better than paid services I previously used.",
    improvement: "3.2x Response Rate",
  },
  {
    name:        "Rahul Iyer",
    role:        "Backend Engineer",
    company:     "Cloud Infrastructure Company",
    quote:       "The semantic retrieval layer actually helped me understand why recruiters ignored my previous applications.",
    improvement: "+41% Match Accuracy",
  },
];

// ── Avatar initials ───────────────────────────────────────────────────────────
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Testimonial card ──────────────────────────────────────────────────────────
function TestimonialCard({
  testimonial,
  index,
}: {
  testimonial: Testimonial;
  index:       number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.45, delay: index * 0.1, ease: "easeOut" }}
    >
      <GlassCard
        hover
        glow
        className="flex flex-col p-6 h-full group"
      >
        {/* Quote icon */}
        <Quote
          className="h-5 w-5 text-text-accent mb-5 flex-shrink-0"
          aria-hidden="true"
        />

        {/* Quote text */}
        <blockquote className="text-sm text-text-secondary leading-relaxed flex-1 mb-6 italic">
          &ldquo;{testimonial.quote}&rdquo;
        </blockquote>

        {/* Author row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div
              className="flex items-center justify-center w-9 h-9 rounded-full border border-border bg-background-secondary flex-shrink-0"
              aria-hidden="true"
            >
              <span className="font-mono text-xs font-semibold text-text-accent">
                {getInitials(testimonial.name)}
              </span>
            </div>

            <div>
              <p className="text-sm font-semibold text-text-primary leading-none mb-0.5">
                {testimonial.name}
              </p>
              <p className="font-mono text-[10px] text-text-muted">
                {testimonial.role} · {testimonial.company}
              </p>
            </div>
          </div>

          {/* Improvement badge */}
          <span className="flex-shrink-0 font-mono text-[10px] font-semibold px-2.5 py-1 rounded-full border border-amber/30 bg-amber-subtle text-amber whitespace-nowrap">
            {testimonial.improvement}
          </span>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
export function Testimonials() {
  return (
    <section className="py-20 px-6">
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
            Social Proof
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4, delay: 0.06 }}
            className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight"
          >
            Engineers who landed the role
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4, delay: 0.12 }}
            className="mt-4 text-text-secondary text-sm max-w-md mx-auto leading-relaxed"
          >
            Real outcomes from real job seekers — not curated marketing copy.
          </motion.p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard key={t.name} testimonial={t} index={i} />
          ))}
        </div>

      </div>
    </section>
  );
}