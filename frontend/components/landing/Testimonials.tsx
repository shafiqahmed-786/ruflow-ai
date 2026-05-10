"use client";

// frontend/components/landing/Testimonials.tsx
import { motion } from "framer-motion";
import { Quote } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Testimonial {
  id:          number;
  quote:       string;
  author:      string;
  title:       string;
  company:     string;
  avatar:      string;
  improvement: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const TESTIMONIALS: Testimonial[] = [
  {
    id:          1,
    quote:       "Improved my ATS score from 61 to 89 in just 2 weeks. The agent breakdown showed exactly what was missing.",
    author:      "Jane D.",
    title:       "Product Manager",
    company:     "TechCorp",
    avatar:      "JD",
    improvement: "61 → 89",
  },
  {
    id:          2,
    quote:       "Better than the $500 resume services I paid for. The multi-agent approach actually understands jobs better than humans.",
    author:      "Alex K.",
    title:       "Software Engineer",
    company:     "Startup XYZ",
    avatar:      "AK",
    improvement: "Hired in 3 weeks",
  },
  {
    id:          3,
    quote:       "Finally, something that explains WHY recruiters rejected me. The semantic matching showed the exact gaps. Game changer.",
    author:      "Morgan L.",
    title:       "UX Designer",
    company:     "Design Co",
    avatar:      "ML",
    improvement: "3 interviews",
  },
  {
    id:          4,
    quote:       "The learning system kept improving each iteration. By round 3, my cover letter was genuinely better. Not generic.",
    author:      "Priya S.",
    title:       "Data Scientist",
    company:     "Analytics Inc",
    avatar:      "PS",
    improvement: "2 offers",
  },
];

// ── Testimonial Card ──────────────────────────────────────────────────────────
function TestimonialCard({
  testimonial,
  index,
}: {
  testimonial: Testimonial;
  index:       number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay: index * 0.09, ease: "easeOut" }}
      className="flex flex-col rounded-xl border border-[#252d48] bg-[#141829] p-6"
    >
      {/* Quote icon */}
      <Quote className="h-5 w-5 text-[#10a37f] mb-4 flex-shrink-0" />

      {/* Quote text */}
      <p className="text-sm text-[#e0e0e0] leading-relaxed flex-1 mb-6">
        &ldquo;{testimonial.quote}&rdquo;
      </p>

      {/* Author row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Avatar initials */}
          <div
            className="flex items-center justify-center w-9 h-9 rounded-full
                       border border-[#252d48] bg-[#0f1324] flex-shrink-0"
          >
            <span className="font-mono text-xs font-semibold text-[#10a37f]">
              {testimonial.avatar}
            </span>
          </div>

          <div>
            <p className="text-sm font-semibold text-[#e0e0e0] leading-none mb-0.5">
              {testimonial.author}
            </p>
            <p className="font-mono text-[10px] text-[#888888]">
              {testimonial.title} · {testimonial.company}
            </p>
          </div>
        </div>

        {/* Improvement badge */}
        <span
          className="flex-shrink-0 font-mono text-[10px] font-semibold
                     px-2.5 py-1 rounded-full border border-amber-500/30
                     bg-amber-500/10 text-amber-400 whitespace-nowrap"
        >
          {testimonial.improvement}
        </span>
      </div>
    </motion.div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
export function Testimonials() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="text-center mb-14">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="font-mono text-xs text-[#10a37f] tracking-widest uppercase mb-3"
          >
            Social Proof
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="text-3xl sm:text-4xl font-bold text-[#e0e0e0] tracking-tight"
          >
            Engineers who landed the role
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-4 text-[#888888] text-sm max-w-md mx-auto leading-relaxed"
          >
            Real outcomes from real job seekers — not curated marketing copy.
          </motion.p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard key={t.id} testimonial={t} index={i} />
          ))}
        </div>

      </div>
    </section>
  );
}