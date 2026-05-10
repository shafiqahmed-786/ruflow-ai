"use client";

// frontend/components/landing/InsightsSection.tsx
import { motion } from "framer-motion";
import Link from "next/link";
import { BookOpen, Lightbulb, Sparkles, ArrowRight } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Insight {
  id:       number;
  title:    string;
  excerpt:  string;
  category: string;
  readTime: string;
  date:     string;
  author:   string;
  icon:     React.ElementType;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const INSIGHTS: Insight[] = [
  {
    id:       1,
    title:    "ATS Optimization Guide 2024",
    excerpt:  "Master the algorithms recruiters use. Learn keyword density, formatting tricks, and system-level optimizations.",
    category: "Guides",
    readTime: "8 min read",
    date:     "Jan 15, 2024",
    author:   "RuFlow Team",
    icon:     BookOpen,
  },
  {
    id:       2,
    title:    "Resume Engineering Best Practices",
    excerpt:  "How to structure bullets for both human readers and ATS systems. Data-driven formatting that actually works.",
    category: "Best Practices",
    readTime: "6 min read",
    date:     "Jan 10, 2024",
    author:   "RuFlow Research",
    icon:     Lightbulb,
  },
  {
    id:       3,
    title:    "AI Job Application Strategies",
    excerpt:  "How to leverage multi-agent AI for career growth. Patterns learned from 50K+ applications.",
    category: "Strategy",
    readTime: "10 min read",
    date:     "Jan 5, 2024",
    author:   "RuFlow Insights",
    icon:     Sparkles,
  },
];

// ── Category color map ────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  Guides:         "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  "Best Practices": "text-blue-400   bg-blue-500/10   border-blue-500/25",
  Strategy:       "text-amber-400  bg-amber-500/10  border-amber-500/25",
};

// ── Insight Card ──────────────────────────────────────────────────────────────
function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const Icon       = insight.icon;
  const badgeClass = CATEGORY_COLORS[insight.category] ?? "text-[#888888] bg-[#252d48] border-[#252d48]";

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay: index * 0.09, ease: "easeOut" }}
      className="group flex flex-col rounded-xl border border-[#252d48] bg-[#141829]
                 p-6 hover:border-[#10a37f]/30 transition-colors duration-200"
    >
      {/* Icon + category */}
      <div className="flex items-center justify-between mb-5">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-lg
                     border border-[#10a37f]/25 bg-[#10a37f]/10"
        >
          <Icon className="h-5 w-5 text-[#10a37f]" />
        </div>
        <span
          className={`font-mono text-[10px] tracking-wider uppercase px-2.5 py-1
                      rounded-full border font-semibold ${badgeClass}`}
        >
          {insight.category}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-[#e0e0e0] mb-2 leading-snug">
        {insight.title}
      </h3>

      {/* Excerpt */}
      <p className="text-xs text-[#888888] leading-relaxed flex-1 mb-5">
        {insight.excerpt}
      </p>

      {/* Meta row */}
      <div className="flex items-center justify-between pt-4 border-t border-[#252d48]">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-[#888888]">{insight.readTime}</span>
          <span className="w-px h-3 bg-[#252d48]" />
          <span className="font-mono text-[10px] text-[#888888]">{insight.date}</span>
        </div>
        <Link
          href="/blog"
          className="flex items-center gap-1 font-mono text-[10px] text-[#10a37f]
                     hover:text-emerald-300 transition-colors duration-150"
        >
          Read
          <ArrowRight className="h-3 w-3 transition-transform duration-150
                                 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </motion.article>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
export function InsightsSection() {
  return (
    <section className="py-20 px-6 bg-[#0d1120]">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="font-mono text-xs text-[#10a37f] tracking-widest uppercase mb-3"
            >
              Insights
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="text-3xl sm:text-4xl font-bold text-[#e0e0e0] tracking-tight"
            >
              From the research team
            </motion.h2>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 font-mono text-xs
                         text-[#888888] hover:text-[#e0e0e0] transition-colors duration-150"
            >
              View all posts
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {INSIGHTS.map((insight, i) => (
            <InsightCard key={insight.id} insight={insight} index={i} />
          ))}
        </div>

      </div>
    </section>
  );
}