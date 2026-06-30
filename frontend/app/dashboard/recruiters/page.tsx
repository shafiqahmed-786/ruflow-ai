"use client";

// frontend/app/dashboard/recruiters/page.tsx — Recruiter CRM
import { motion } from "framer-motion";
import { Users, Mail, Phone, MessageSquare, Star, Clock, Plus } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

function FadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

interface Recruiter {
  id: string; name: string; title: string; company: string; email: string;
  lastContact: string; status: "Active" | "Warm" | "Cold" | "Replied"; priority: boolean; messages: number;
}

const RECRUITERS: Recruiter[] = [
  { id: "r1", name: "Sarah Chen",       title: "Senior Recruiter",       company: "Anthropic",  email: "s.chen@anthropic.com",    lastContact: "Today",      status: "Active",  priority: true,  messages: 6  },
  { id: "r2", name: "Mike Patel",       title: "Technical Recruiter",    company: "OpenAI",     email: "m.patel@openai.com",       lastContact: "2 days ago", status: "Replied", priority: true,  messages: 3  },
  { id: "r3", name: "Jessica Lau",      title: "Talent Partner",         company: "Stripe",     email: "j.lau@stripe.com",         lastContact: "4 days ago", status: "Warm",    priority: false, messages: 2  },
  { id: "r4", name: "Alex Thompson",    title: "Engineering Recruiter",  company: "Vercel",     email: "a.thompson@vercel.com",    lastContact: "1 week ago", status: "Cold",    priority: false, messages: 1  },
  { id: "r5", name: "Priya Krishnan",   title: "Senior TA Manager",      company: "Perplexity", email: "p.k@perplexity.ai",        lastContact: "3 days ago", status: "Active",  priority: true,  messages: 4  },
];

const STATUS_STYLE: Record<Recruiter["status"], string> = {
  Active:  "text-text-accent  bg-accent-subtle  border-accent/20",
  Replied: "text-text-primary bg-surface-raised border-border-strong",
  Warm:    "text-amber        bg-amber-subtle   border-amber/20",
  Cold:    "text-text-muted   bg-surface-raised border-border",
};

export default function RecruitersPage() {
  return (
    <div className="max-w-[1280px] space-y-5">
      <FadeUp>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Recruiter CRM</h1>
            <p className="font-mono text-xs text-text-muted mt-1">Manage recruiter relationships, track conversations, and automate follow-ups.</p>
          </div>
          <button className="flex items-center gap-1.5 font-mono text-[10px] text-text-accent border border-accent/30 bg-accent-subtle px-3 py-2 rounded-lg hover:border-accent/60 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Recruiter
          </button>
        </div>
      </FadeUp>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Contacts", value: "18",  icon: Users        },
          { label: "Active",         value: "6",   icon: Star         },
          { label: "Follow-ups Due", value: "3",   icon: Clock        },
          { label: "Unread",         value: "4",   icon: MessageSquare},
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

      <FadeUp delay={0.12}>
        <GlassCard className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-text-accent" />
              <h2 className="font-mono text-sm font-semibold text-text-primary">Recruiter Network</h2>
              <span className="font-mono text-[10px] text-text-muted bg-surface-raised border border-border px-1.5 py-0.5 rounded">{RECRUITERS.length}</span>
            </div>
          </div>
          <div className="divide-y divide-border">
            {RECRUITERS.map((rec, i) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: 0.14 + i * 0.06 }}
                className="flex items-center gap-4 px-4 py-3.5 hover:bg-surface-raised transition-colors duration-150"
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full border border-border bg-background-secondary flex items-center justify-center flex-shrink-0">
                  <span className="font-mono text-xs font-bold text-text-accent">{rec.name.split(" ").map((n) => n[0]).join("")}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-mono text-xs font-semibold text-text-primary">{rec.name}</p>
                    {rec.priority && <Star className="h-3 w-3 text-amber fill-amber flex-shrink-0" />}
                  </div>
                  <p className="font-mono text-[10px] text-text-muted truncate">{rec.title} · {rec.company}</p>
                </div>

                {/* Status */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full border font-mono text-[9px] font-semibold uppercase tracking-wider", STATUS_STYLE[rec.status])}>
                    {rec.status}
                  </span>
                  <span className="font-mono text-[10px] text-text-muted hidden lg:block">{rec.lastContact}</span>
                  <div className="flex items-center gap-2">
                    <button className="w-7 h-7 flex items-center justify-center rounded-md border border-border text-text-muted hover:text-text-primary hover:border-border-strong transition-colors">
                      <Mail className="h-3 w-3" />
                    </button>
                    <button className="w-7 h-7 flex items-center justify-center rounded-md border border-border text-text-muted hover:text-text-primary hover:border-border-strong transition-colors">
                      <MessageSquare className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </GlassCard>
      </FadeUp>

      {/* AI Follow-up Suggestions */}
      <FadeUp delay={0.2}>
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-4 w-4 text-text-accent" />
            <h2 className="font-mono text-sm font-semibold text-text-primary">AI Follow-up Suggestions</h2>
          </div>
          <div className="space-y-3">
            {[
              { recruiter: "Sarah Chen @ Anthropic", suggestion: "Send a follow-up referencing your system design interview tomorrow. Mention one specific Anthropic research paper you have read recently to signal cultural alignment." },
              { recruiter: "Alex Thompson @ Vercel", suggestion: "It has been 7 days since your last contact. Send a brief check-in about the Principal Systems Engineer role, attaching your updated resume with Rust and edge compute keywords." },
            ].map((item, i) => (
              <div key={i} className="rounded-lg border border-border bg-background-secondary p-3.5">
                <p className="font-mono text-[10px] font-semibold text-text-accent mb-1.5">{item.recruiter}</p>
                <p className="font-mono text-xs text-text-secondary leading-relaxed mb-2">{item.suggestion}</p>
                <button className="font-mono text-[10px] text-text-accent border border-accent/30 bg-accent-subtle px-2.5 py-1 rounded-md hover:border-accent/60 transition-colors">
                  Generate Email →
                </button>
              </div>
            ))}
          </div>
        </GlassCard>
      </FadeUp>
    </div>
  );
}
