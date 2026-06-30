"use client";

// frontend/app/dashboard/companies/page.tsx — Company Intelligence
import { motion } from "framer-motion";
import { Building2, Star, Globe, Users, Zap, TrendingUp, ExternalLink } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

function FadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

interface Company {
  id: string; name: string; stage: string; size: string; techStack: string[];
  interviewDiff: "Easy" | "Medium" | "Hard"; rating: number; notes: string; tracked: boolean;
}

const COMPANIES: Company[] = [
  { id: "c1", name: "Anthropic",  stage: "Series E",  size: "500-1k",   techStack: ["Python","Rust","AWS","Kubernetes"],          interviewDiff: "Hard",   rating: 4.8, notes: "Constitutional AI focus. 4-stage process: recruiter → technical → system design → values. Prep STAR well.", tracked: true  },
  { id: "c2", name: "OpenAI",    stage: "Private",   size: "1k-2k",    techStack: ["Python","Go","Azure","CUDA"],                  interviewDiff: "Hard",   rating: 4.6, notes: "Speed of deployment matters. Strong ML theory + systems focus. Notorious for long processes (6-8 weeks).",   tracked: true  },
  { id: "c3", name: "Vercel",    stage: "Series C",  size: "200-500",  techStack: ["TypeScript","Rust","Next.js","Turborepo"],     interviewDiff: "Medium", rating: 4.4, notes: "Frontend infra expertise valued. Ship mindset. Take-home coding assessment typical first step.",          tracked: true  },
  { id: "c4", name: "Mistral AI",stage: "Series B",  size: "50-200",   techStack: ["Python","C++","CUDA","HuggingFace"],           interviewDiff: "Hard",   rating: 4.5, notes: "Research-led culture. Strong publication record helps. Paris-HQ but remote-friendly. Fast decisions.",    tracked: false },
  { id: "c5", name: "Perplexity",stage: "Series B",  size: "100-200",  techStack: ["Python","TypeScript","Ray","Triton"],          interviewDiff: "Medium", rating: 4.3, notes: "Lean team, high ownership. Speed is a core value. RAG and retrieval experience highly valued.",           tracked: true  },
];

const DIFF_STYLE: Record<Company["interviewDiff"], string> = {
  Easy:   "text-text-accent bg-accent-subtle  border-accent/20",
  Medium: "text-amber       bg-amber-subtle   border-amber/20",
  Hard:   "text-danger      bg-danger-subtle  border-danger/20",
};

export default function CompaniesPage() {
  return (
    <div className="max-w-[1280px] space-y-5">
      <FadeUp>
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">Company Intelligence</h1>
          <p className="font-mono text-xs text-text-muted mt-1">
            AI-researched company profiles, interview intelligence, and culture signals.
          </p>
        </div>
      </FadeUp>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Tracked",     value: "12",  icon: Building2  },
          { label: "Bookmarked",  value: "4",   icon: Star       },
          { label: "Researched",  value: "18",  icon: Globe      },
          { label: "Active Intel",value: "5",   icon: TrendingUp },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <FadeUp key={s.label} delay={i * 0.06}>
              <GlassCard className="p-4">
                <div className="flex items-start justify-between mb-2.5">
                  <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">{s.label}</span>
                  <Icon className="h-3.5 w-3.5 text-text-accent" />
                </div>
                <p className="font-mono text-2xl font-bold text-text-primary leading-none">{s.value}</p>
              </GlassCard>
            </FadeUp>
          );
        })}
      </div>

      {/* Company Cards */}
      <FadeUp delay={0.12}>
        <div className="space-y-4">
          {COMPANIES.map((co, i) => (
            <motion.div
              key={co.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: 0.14 + i * 0.07 }}
            >
              <GlassCard className="p-5" hover>
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  {/* Left */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-background-secondary flex-shrink-0">
                        <Building2 className="h-4 w-4 text-text-accent" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-mono text-sm font-bold text-text-primary">{co.name}</h3>
                          {co.tracked && (
                            <Star className="h-3.5 w-3.5 text-amber fill-amber" />
                          )}
                        </div>
                        <p className="font-mono text-[10px] text-text-muted">{co.stage} · {co.size} employees</p>
                      </div>
                    </div>
                    <p className="font-mono text-xs text-text-secondary leading-relaxed mb-3">{co.notes}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {co.techStack.map((tech) => (
                        <span key={tech} className="font-mono text-[9px] text-text-muted bg-surface-raised border border-border px-1.5 py-0.5 rounded">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end gap-3 flex-shrink-0">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full border font-mono text-[9px] font-semibold uppercase tracking-wider", DIFF_STYLE[co.interviewDiff])}>
                      {co.interviewDiff} Interview
                    </span>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-amber fill-amber" />
                      <span className="font-mono text-xs text-text-secondary">{co.rating}</span>
                    </div>
                    <button className="flex items-center gap-1 text-text-accent hover:text-accent font-mono text-[10px] transition-colors">
                      <ExternalLink className="h-3 w-3" />
                      Research
                    </button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </FadeUp>
    </div>
  );
}
