"use client";

// frontend/app/dashboard/interviews/page.tsx — Interview Prep
import { useState } from "react";
import { motion } from "framer-motion";
import { Target, Sparkles, CheckCircle2, BookOpen, Code2, Users, BarChart3, Clock } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

function FadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

interface Interview {
  id: string; company: string; role: string; type: string; date: string; status: "Scheduled" | "Completed" | "Upcoming";
  prep: number;
}

const INTERVIEWS: Interview[] = [
  { id: "i1", company: "Anthropic",  role: "Staff ML Infra Eng",    type: "System Design",   date: "Today 3PM",   status: "Scheduled", prep: 84 },
  { id: "i2", company: "OpenAI",     role: "Senior Backend Eng",    type: "Technical + LC",  date: "Jul 3",        status: "Upcoming",  prep: 61 },
  { id: "i3", company: "Stripe",     role: "Staff Software Eng",    type: "Behavioural",     date: "Jul 5",        status: "Upcoming",  prep: 45 },
  { id: "i4", company: "Perplexity", role: "ML Platform Lead",      type: "System Design",   date: "Jun 20",       status: "Completed", prep: 100 },
];

interface PrepTopic {
  id: string; label: string; icon: React.ElementType; progress: number; questions: number;
}

const PREP_TOPICS: PrepTopic[] = [
  { id: "sd",  label: "System Design",       icon: BarChart3,   progress: 72, questions: 18 },
  { id: "lc",  label: "LeetCode / DSA",      icon: Code2,       progress: 58, questions: 42 },
  { id: "beh", label: "Behavioural (STAR)",  icon: Users,       progress: 85, questions: 24 },
  { id: "ml",  label: "ML Fundamentals",     icon: Sparkles,    progress: 67, questions: 31 },
];

const STATUS_STYLE: Record<Interview["status"], string> = {
  Scheduled: "text-amber        bg-amber-subtle   border-amber/20",
  Completed: "text-text-accent  bg-accent-subtle  border-accent/20",
  Upcoming:  "text-text-muted   bg-surface-raised border-border",
};

export default function InterviewsPage() {
  const [activePrep, setActivePrep] = useState<string | null>(null);

  return (
    <div className="max-w-[1280px] space-y-5">
      <FadeUp>
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">Interview Prep Centre</h1>
          <p className="font-mono text-xs text-text-muted mt-1">
            AI-powered interview preparation, question banks, and progress tracking.
          </p>
        </div>
      </FadeUp>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Scheduled",    value: "4",   icon: Clock,       color: "text-amber"       },
          { label: "Prep Score",   value: "72%",  icon: Target,      color: "text-text-accent" },
          { label: "Qs Practiced", value: "115", icon: BookOpen,    color: "text-text-accent" },
          { label: "Success Rate", value: "71%",  icon: CheckCircle2,color: "text-text-accent" },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <FadeUp key={s.label} delay={i * 0.06}>
              <GlassCard className="p-4">
                <div className="flex items-start justify-between mb-2.5">
                  <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">{s.label}</span>
                  <Icon className={cn("h-3.5 w-3.5", s.color)} />
                </div>
                <p className="font-mono text-2xl font-bold text-text-primary leading-none">{s.value}</p>
              </GlassCard>
            </FadeUp>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
        {/* Upcoming Interviews */}
        <FadeUp delay={0.1}>
          <GlassCard className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-text-accent" />
                <h2 className="font-mono text-sm font-semibold text-text-primary">Upcoming Interviews</h2>
              </div>
            </div>
            <div className="divide-y divide-border">
              {INTERVIEWS.map((iv, i) => (
                <motion.div
                  key={iv.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25, delay: 0.12 + i * 0.06 }}
                  className="px-4 py-3 hover:bg-surface-raised transition-colors duration-150"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-mono text-xs font-semibold text-text-primary">{iv.company}</p>
                      <p className="font-mono text-[10px] text-text-muted">{iv.role} · {iv.type}</p>
                    </div>
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full border font-mono text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap", STATUS_STYLE[iv.status])}>
                      {iv.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${iv.prep}%` }} />
                    </div>
                    <span className="font-mono text-[10px] text-text-accent flex-shrink-0">{iv.prep}% ready</span>
                    <span className="font-mono text-[10px] text-text-muted flex-shrink-0">{iv.date}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </FadeUp>

        {/* Prep Topics */}
        <FadeUp delay={0.14}>
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="h-4 w-4 text-text-accent" />
              <h2 className="font-mono text-sm font-semibold text-text-primary">Preparation Topics</h2>
              <span className="ml-auto font-mono text-[9px] text-text-muted bg-surface-raised border border-border px-2 py-0.5 rounded">
                AI Coach
              </span>
            </div>
            <div className="space-y-4">
              {PREP_TOPICS.map((topic, i) => {
                const Icon = topic.icon;
                return (
                  <motion.div
                    key={topic.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: 0.16 + i * 0.07 }}
                    className={cn(
                      "rounded-lg border p-3.5 cursor-pointer transition-all duration-150",
                      activePrep === topic.id
                        ? "border-accent/30 bg-accent-subtle"
                        : "border-border bg-background-secondary hover:border-border-strong"
                    )}
                    onClick={() => setActivePrep(activePrep === topic.id ? null : topic.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-text-accent" />
                        <span className="font-mono text-xs font-semibold text-text-primary">{topic.label}</span>
                      </div>
                      <span className="font-mono text-[10px] text-text-muted">{topic.questions} questions</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${topic.progress}%` }}
                        transition={{ duration: 0.7, delay: 0.2 + i * 0.08 }}
                        className="h-full bg-accent rounded-full"
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="font-mono text-[10px] text-text-accent">{topic.progress}% complete</span>
                      {activePrep === topic.id && (
                        <span className="font-mono text-[10px] text-text-accent">Tap to practice →</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </GlassCard>
        </FadeUp>
      </div>

      {/* AI Question Bank */}
      <FadeUp delay={0.2}>
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-text-accent" />
            <h2 className="font-mono text-sm font-semibold text-text-primary">AI-Generated Question Bank</h2>
            <span className="ml-auto font-mono text-[9px] text-text-muted">Tailored for Anthropic · System Design</span>
          </div>
          <div className="space-y-3">
            {[
              "Design a distributed job queue system that can handle 100K concurrent pipeline executions with exactly-once semantics.",
              "How would you architect a vector similarity search service to support 50M embeddings with sub-100ms p99 latency?",
              "Walk me through designing a multi-agent orchestration system — how do you handle state, retries, and partial failures?",
              "Design a real-time ATS scoring service that can evaluate 10K resumes per minute with ML model inference.",
            ].map((q, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.22 + i * 0.06 }}
                className="flex items-start gap-3 rounded-lg border border-border bg-background-secondary p-3.5"
              >
                <span className="font-mono text-[10px] text-text-accent font-bold flex-shrink-0 mt-0.5">Q{i + 1}</span>
                <p className="font-mono text-xs text-text-secondary leading-relaxed">{q}</p>
              </motion.div>
            ))}
          </div>
        </GlassCard>
      </FadeUp>
    </div>
  );
}
