"use client";

// frontend/app/dashboard/applications/page.tsx
import { motion } from "framer-motion";
import {
  Briefcase,
  TrendingUp,
  BarChart3,
  MessageSquare,
  Mail,
  Download,
  Eye,
  Reply,
  Sparkles,
  ArrowUpRight,
  Brain,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button }    from "@/components/ui/Button";
import { cn }        from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Stat {
  label:   string;
  value:   string;
  trend:   string;
  up:      boolean;
  icon:    React.ElementType;
}

type AppStatus = "Applied" | "Optimized" | "Interview" | "Rejected" | "Revision Needed";

interface Application {
  id:      string;
  company: string;
  role:    string;
  score:   number;
  status:  AppStatus;
  updated: string;
}

interface EngagementMetric {
  label:   string;
  value:   string;
  delta:   string;
  up:      boolean;
  icon:    React.ElementType;
}

interface Insight {
  id:      string;
  text:    string;
  tag:     string;
  impact:  "high" | "medium" | "low";
}

// ── Data ──────────────────────────────────────────────────────────────────────
const STATS: Stat[] = [
  { label: "Total Applications", value: "24",   trend: "+5 this month",    up: true,  icon: Briefcase   },
  { label: "Interview Rate",     value: "29%",  trend: "+8% vs last month",up: true,  icon: TrendingUp  },
  { label: "ATS Avg Score",      value: "86.4", trend: "+12.1 uplift",     up: true,  icon: BarChart3   },
  { label: "Response Rate",      value: "42%",  trend: "+6% this quarter", up: true,  icon: MessageSquare },
];

const APPLICATIONS: Application[] = [
  { id: "a-001", company: "Anthropic",   role: "Staff ML Infrastructure Engineer",   score: 91, status: "Interview",        updated: "Today, 2:14pm"   },
  { id: "a-002", company: "OpenAI",      role: "Senior Backend Engineer",             score: 88, status: "Optimized",        updated: "Yesterday"       },
  { id: "a-003", company: "Vercel",      role: "Principal Systems Engineer",          score: 74, status: "Revision Needed",  updated: "2 days ago"      },
  { id: "a-004", company: "Perplexity",  role: "ML Platform Lead",                    score: 83, status: "Applied",          updated: "3 days ago"      },
  { id: "a-005", company: "Stripe",      role: "Staff Software Engineer",             score: 90, status: "Interview",        updated: "4 days ago"      },
  { id: "a-006", company: "Cohere",      role: "Senior AI Research Engineer",         score: 61, status: "Rejected",         updated: "5 days ago"      },
  { id: "a-007", company: "Mistral AI",  role: "Senior MLOps Engineer",               score: 79, status: "Optimized",        updated: "1 week ago"      },
];

const ENGAGEMENT: EngagementMetric[] = [
  { label: "Email Opens",        value: "18",  delta: "+4 this week",   up: true,  icon: Mail     },
  { label: "Resume Downloads",   value: "9",   delta: "+2 this week",   up: true,  icon: Download },
  { label: "Profile Views",      value: "34",  delta: "+11 this week",  up: true,  icon: Eye      },
  { label: "Recruiter Replies",  value: "6",   delta: "+1 this week",   up: true,  icon: Reply    },
];

const INSIGHTS: Insight[] = [
  {
    id:     "ins-001",
    text:   "Backend-focused resumes are outperforming ML resumes by 21% in ATS scoring — consider leading with systems experience for ML roles.",
    tag:    "ATS Pattern",
    impact: "high",
  },
  {
    id:     "ins-002",
    text:   "Applications with quantified impact metrics (%, $, scale) receive 34% higher ATS scores on average across your submission history.",
    tag:    "Impact Signals",
    impact: "high",
  },
  {
    id:     "ins-003",
    text:   "3 of your top-scoring applications include LangGraph or LangChain keywords — retrieval-native roles are responding well.",
    tag:    "Keyword Insight",
    impact: "medium",
  },
  {
    id:     "ins-004",
    text:   "Cover letter quality scores above 82 correlate with 2.1× higher recruiter response rates in your current cohort.",
    tag:    "Conversion",
    impact: "medium",
  },
];

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<AppStatus, string> = {
  "Applied":          "text-text-secondary bg-surface-raised    border-border",
  "Optimized":        "text-text-accent    bg-accent-subtle      border-accent/20",
  "Interview":        "text-text-primary   bg-surface-raised     border-border-strong",
  "Rejected":         "text-danger         bg-danger-subtle      border-danger/20",
  "Revision Needed":  "text-amber          bg-amber-subtle       border-amber/20",
};

const IMPACT_STYLE: Record<Insight["impact"], string> = {
  high:   "text-text-accent bg-accent-subtle  border-accent/25",
  medium: "text-amber       bg-amber-subtle   border-amber/25",
  low:    "text-text-muted  bg-surface-raised border-border",
};

function scoreColor(s: number) {
  if (s >= 85) return "text-text-accent";
  if (s >= 70) return "text-amber";
  return "text-danger";
}

// ── Fade-up helper ─────────────────────────────────────────────────────────────
function FadeUp({ children, delay = 0, className }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────
function StatsRow() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {STATS.map((s, i) => {
        const Icon = s.icon;
        return (
          <FadeUp key={s.label} delay={i * 0.06}>
            <GlassCard className="p-4">
              <div className="flex items-start justify-between mb-2.5">
                <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest leading-none">
                  {s.label}
                </span>
                <Icon className="h-3.5 w-3.5 text-text-accent flex-shrink-0" aria-hidden="true" />
              </div>
              <p className="font-mono text-2xl font-bold text-text-primary leading-none mb-1">
                {s.value}
              </p>
              <p className={cn("font-mono text-[10px]", s.up ? "text-text-accent" : "text-danger")}>
                {s.trend}
              </p>
            </GlassCard>
          </FadeUp>
        );
      })}
    </div>
  );
}

function ApplicationsTable() {
  return (
    <FadeUp delay={0.12}>
      <GlassCard className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-sm font-semibold text-text-primary">Applications</h2>
            <span className="font-mono text-[10px] text-text-muted bg-surface-raised border border-border px-2 py-0.5 rounded">
              {APPLICATIONS.length}
            </span>
          </div>
          <Button href="/dashboard/applications/new" variant="primary" size="sm">
            + New
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" aria-label="Applications">
            <thead>
              <tr className="border-b border-border bg-background-secondary">
                {["Company", "Role", "ATS Score", "Status", "Updated"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-mono text-[10px] text-text-muted uppercase tracking-widest whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {APPLICATIONS.map((app, i) => (
                <motion.tr
                  key={app.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25, delay: 0.15 + i * 0.05 }}
                  className="group border-b border-border last:border-0 hover:bg-surface-raised transition-colors duration-150"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-text-primary">{app.company}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-text-secondary truncate block max-w-[200px]">{app.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("font-mono text-sm font-bold", scoreColor(app.score))}>{app.score}</span>
                    <span className="font-mono text-[10px] text-text-muted ml-0.5">/100</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full border",
                      "font-mono text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap",
                      STATUS_STYLE[app.status]
                    )}>
                      {app.status}
                    </span>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3">
                    <span className="font-mono text-[10px] text-text-muted whitespace-nowrap">{app.updated}</span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </FadeUp>
  );
}

function EngagementPanel() {
  return (
    <FadeUp delay={0.18}>
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <ArrowUpRight className="h-4 w-4 text-text-accent" aria-hidden="true" />
          <h2 className="font-mono text-sm font-semibold text-text-primary">Recruiter Engagement</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {ENGAGEMENT.map((m, i) => {
            const Icon = m.icon;
            return (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.2 + i * 0.06 }}
                className="rounded-lg border border-border bg-background-secondary p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className="h-3.5 w-3.5 text-text-accent" aria-hidden="true" />
                  <span className={cn(
                    "font-mono text-[9px] font-semibold",
                    m.up ? "text-text-accent" : "text-danger"
                  )}>
                    {m.delta}
                  </span>
                </div>
                <p className="font-mono text-xl font-bold text-text-primary leading-none mb-0.5">{m.value}</p>
                <p className="font-mono text-[10px] text-text-muted">{m.label}</p>
              </motion.div>
            );
          })}
        </div>
      </GlassCard>
    </FadeUp>
  );
}

function InsightsPanel() {
  return (
    <FadeUp delay={0.22}>
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-4 w-4 text-text-accent" aria-hidden="true" />
          <h2 className="font-mono text-sm font-semibold text-text-primary">AI Insights</h2>
          <span className="ml-auto font-mono text-[9px] text-text-muted bg-surface-raised border border-border px-2 py-0.5 rounded">
            Pattern Engine
          </span>
        </div>

        <div className="space-y-3">
          {INSIGHTS.map((insight, i) => (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.24 + i * 0.07 }}
              className="rounded-lg border border-border bg-background-secondary p-3.5"
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3 w-3 text-text-accent flex-shrink-0" aria-hidden="true" />
                <span className={cn(
                  "font-mono text-[9px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                  IMPACT_STYLE[insight.impact]
                )}>
                  {insight.tag}
                </span>
              </div>
              <p className="font-mono text-[11px] text-text-secondary leading-relaxed">
                {insight.text}
              </p>
            </motion.div>
          ))}
        </div>
      </GlassCard>
    </FadeUp>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ApplicationsPage() {
  return (
    <div className="space-y-5 max-w-[1280px]">
      {/* Header */}
      <FadeUp>
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Application Intelligence
          </h1>
          <p className="font-mono text-xs text-text-muted mt-1">
            Track optimized applications, ATS performance, and recruiter engagement.
          </p>
        </div>
      </FadeUp>

      <StatsRow />
      <ApplicationsTable />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <EngagementPanel />
        <InsightsPanel />
      </div>
    </div>
  );
}