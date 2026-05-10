"use client";

// frontend/components/landing/TemplateShowcase.tsx
import { motion }    from "framer-motion";
import { ArrowRight, TrendingUp, CheckCircle } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn }        from "@/lib/utils";

// ── Discriminated union types ─────────────────────────────────────────────────
interface ScoreDimension {
  label:  string;
  before: number;
  after:  number;
}

interface BulletPair {
  before: string;
  after:  string;
}

// ── Static data ───────────────────────────────────────────────────────────────
const SCORE_DIMENSIONS: ScoreDimension[] = [
  { label: "ATS Keywords",  before: 52, after: 91 },
  { label: "Relevance",     before: 58, after: 87 },
  { label: "Impact",        before: 44, after: 82 },
  { label: "Tone Match",    before: 61, after: 88 },
];

const BULLET_PAIRS: BulletPair[] = [
  {
    before: "Worked on fraud detection system using Python and Kafka.",
    after:
      "Reduced fraudulent transactions by 34% by architecting a real-time fraud detection pipeline using Python, Apache Kafka, and PyTorch — saving $12M annually.",
  },
  {
    before: "Led Kubernetes migration for the team.",
    after:
      "Led migration of 40+ microservices to Kubernetes (EKS), achieving 99.97% uptime and reducing infrastructure costs by 28% ($2.1M/year).",
  },
];

const COVER_LETTER_PREVIEW =
  `When I reduced checkout latency by 43% at Stripe, the hardest part wasn't the engineering — it was convincing stakeholders that speed is a safety feature. That tension between velocity and reliability is exactly the challenge I understand Anthropic is navigating as you scale Claude's inference infrastructure.

Anthropic's approach to Constitutional AI resonated with my systems-thinking at Databricks, where I owned an open-source SDK with 60k weekly downloads…`;

const HIGHLIGHTED_KEYWORDS = [
  "Python", "Kafka", "PyTorch", "Kubernetes", "EKS",
  "microservices", "infrastructure",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 80) return "text-accent";
  if (score >= 60) return "text-amber";
  return "text-danger";
}

function ScoreBar({ value, variant }: { value: number; variant: "before" | "after" }) {
  return (
    <div className="h-1 bg-border rounded-full overflow-hidden flex-1">
      <div
        className={cn(
          "h-full rounded-full",
          variant === "after" ? "bg-accent" : "bg-border-strong"
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function HighlightedText({ text }: { text: string }) {
  const parts = text.split(
    new RegExp(`(${HIGHLIGHTED_KEYWORDS.join("|")})`, "g")
  );
  return (
    <>
      {parts.map((part, i) =>
        HIGHLIGHTED_KEYWORDS.includes(part) ? (
          <mark key={i} className="bg-transparent text-text-accent font-semibold">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

// ── Left panel: Scores ────────────────────────────────────────────────────────
function ScorePanel() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <GlassCard className="p-6 h-full space-y-5">
        {/* Header */}
        <div>
          <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">
            Evaluation Scores
          </span>
          <h3 className="text-base font-semibold text-text-primary mt-1">
            Before → After Optimization
          </h3>
        </div>

        {/* Overall banner */}
        <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-background-secondary">
          <div className="text-center">
            <p className="font-mono text-2xl font-bold text-danger leading-none">62</p>
            <p className="font-mono text-[9px] text-text-muted uppercase mt-0.5">Before</p>
          </div>
          <ArrowRight className="h-4 w-4 text-border flex-shrink-0" />
          <div className="text-center">
            <p className="font-mono text-2xl font-bold text-accent leading-none">91</p>
            <p className="font-mono text-[9px] text-text-muted uppercase mt-0.5">After</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-accent/25 bg-accent-subtle">
            <TrendingUp className="h-3 w-3 text-text-accent" />
            <span className="font-mono text-xs text-text-accent font-semibold">+29</span>
          </div>
        </div>

        {/* Per-dimension */}
        <div className="space-y-3">
          {SCORE_DIMENSIONS.map((dim) => (
            <div key={dim.label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-text-muted">{dim.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-text-muted">{dim.before}</span>
                  <ArrowRight className="h-3 w-3 text-border" />
                  <span className={cn("font-mono text-[10px] font-semibold", scoreColor(dim.after))}>
                    {dim.after}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <ScoreBar value={dim.before} variant="before" />
                <ScoreBar value={dim.after}  variant="after"  />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 pt-3 border-t border-border">
          <CheckCircle className="h-4 w-4 text-text-accent flex-shrink-0" />
          <span className="font-mono text-xs text-text-secondary">
            Target reached in{" "}
            <span className="text-text-primary font-semibold">3 iterations</span>
            {" · "}8 changes logged
          </span>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ── Right panel: Bullets + Cover letter ───────────────────────────────────────
function ContentPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
    >
      <GlassCard className="p-6 h-full space-y-5">
        {/* Header */}
        <div>
          <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">
            Resume Optimization
          </span>
          <h3 className="text-base font-semibold text-text-primary mt-1">
            STAR-format bullet rewriting
          </h3>
        </div>

        {/* Before / after bullets */}
        {BULLET_PAIRS.map((pair, i) => (
          <div key={i} className="space-y-1.5">
            <div className="rounded-lg border border-danger/20 bg-danger-subtle p-3">
              <p className="font-mono text-[9px] text-danger uppercase tracking-widest mb-1.5">
                Before
              </p>
              <p className="font-mono text-[11px] text-text-muted leading-relaxed">
                {pair.before}
              </p>
            </div>
            <div className="rounded-lg border border-accent/20 bg-accent-subtle p-3">
              <p className="font-mono text-[9px] text-text-accent uppercase tracking-widest mb-1.5">
                After
              </p>
              <p className="font-mono text-[11px] text-text-primary leading-relaxed">
                <HighlightedText text={pair.after} />
              </p>
            </div>
          </div>
        ))}

        {/* Cover letter preview */}
        <div>
          <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest block mb-2">
            Generated Cover Letter
          </span>
          <div className="rounded-lg border border-border bg-background-secondary p-4">
            <p className="font-mono text-[11px] text-text-muted leading-relaxed line-clamp-4">
              {COVER_LETTER_PREVIEW}
            </p>
            <p className="font-mono text-[10px] text-text-accent mt-2">
              + 280 words · company-specific · hook-first
            </p>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
export function TemplateShowcase() {
  return (
    <section className="py-20 px-6 bg-background-secondary">
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
            Output Quality
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4, delay: 0.06 }}
            className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight"
          >
            Real output. Measurable improvement.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4, delay: 0.12 }}
            className="mt-4 text-text-secondary text-sm max-w-lg mx-auto leading-relaxed"
          >
            Not templates. AI-generated optimization with a full change log
            explaining every decision made.
          </motion.p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ScorePanel />
          <ContentPanel />
        </div>

      </div>
    </section>
  );
}