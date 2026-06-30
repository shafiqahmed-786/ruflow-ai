"use client";

// frontend/app/dashboard/calendar/page.tsx
import { motion } from "framer-motion";
import { Calendar, Clock, Bell, Plus } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

function FadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DATES = [26, 27, 28, 29, 30, 1, 2];
const TODAY_IDX = 3;

const WEEK_EVENTS: Record<number, { label: string; type: string; color: string }[]> = {
  0: [{ label: "Follow-up: Vercel",    type: "Follow-up", color: "bg-accent-subtle border-accent/30 text-text-accent" }],
  1: [{ label: "Resume: Stripe",        type: "Task",      color: "bg-surface-raised border-border text-text-muted" }],
  3: [{ label: "Interview: Anthropic",  type: "Interview", color: "bg-amber-subtle border-amber/30 text-amber" }],
  4: [{ label: "Interview: OpenAI",     type: "Interview", color: "bg-amber-subtle border-amber/30 text-amber" }],
  6: [{ label: "Offer Deadline: Perf.", type: "Deadline",  color: "bg-danger-subtle border-danger/30 text-danger" }],
};

export default function CalendarPage() {
  return (
    <div className="max-w-[1280px] space-y-5">
      <FadeUp>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Application Calendar</h1>
            <p className="font-mono text-xs text-text-muted mt-1">Track interviews, deadlines, and follow-up reminders in one view.</p>
          </div>
          <button className="flex items-center gap-1.5 font-mono text-[10px] text-text-accent border border-accent/30 bg-accent-subtle px-3 py-2 rounded-lg hover:border-accent/60 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Event
          </button>
        </div>
      </FadeUp>

      {/* Week View */}
      <FadeUp delay={0.08}>
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-text-accent" />
              <h2 className="font-mono text-sm font-semibold text-text-primary">Week of Jun 26 – Jul 2</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
              <span className="font-mono text-[10px] text-amber">2 this week</span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map((day, i) => (
              <div key={day} className={cn(
                "rounded-lg border p-2.5 min-h-[100px] transition-colors",
                i === TODAY_IDX
                  ? "border-accent/30 bg-accent-subtle"
                  : "border-border bg-background-secondary"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <span className={cn("font-mono text-[9px] uppercase tracking-widest", i === TODAY_IDX ? "text-text-accent" : "text-text-muted")}>{day}</span>
                  <span className={cn("font-mono text-xs font-bold", i === TODAY_IDX ? "text-text-accent" : "text-text-secondary")}>{DATES[i]}</span>
                </div>
                {WEEK_EVENTS[i]?.map((ev, j) => (
                  <div key={j} className={cn("mb-1 px-1.5 py-1 rounded border font-mono text-[8px] leading-tight", ev.color)}>
                    {ev.label}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </GlassCard>
      </FadeUp>

      {/* Upcoming list */}
      <FadeUp delay={0.14}>
        <GlassCard className="overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
            <Bell className="h-4 w-4 text-text-accent" />
            <h2 className="font-mono text-sm font-semibold text-text-primary">Upcoming Reminders</h2>
          </div>
          <div className="divide-y divide-border">
            {[
              { label: "Interview: Anthropic System Design",  time: "Today 3:00 PM",  type: "Interview", urgent: true  },
              { label: "Follow-up: Vercel recruiter (7 days)",time: "Tomorrow 9:00 AM",type: "Follow-up", urgent: false },
              { label: "Offer Deadline: Perplexity",          time: "Jul 5 11:59 PM", type: "Deadline",  urgent: true  },
              { label: "Interview: OpenAI Technical",         time: "Jul 3 2:30 PM",  type: "Interview", urgent: false },
              { label: "Resume update: Stripe Rust keywords", time: "Jul 2 EOD",      type: "Task",      urgent: false },
            ].map((ev, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: 0.16 + i * 0.06 }}
                className={cn("flex items-center justify-between px-4 py-3 hover:bg-surface-raised transition-colors", ev.urgent && "bg-danger-subtle/20")}
              >
                <div className="flex items-center gap-3">
                  <Clock className={cn("h-3.5 w-3.5 flex-shrink-0", ev.urgent ? "text-danger" : "text-text-muted")} />
                  <div>
                    <p className="font-mono text-xs text-text-primary">{ev.label}</p>
                    <p className="font-mono text-[10px] text-text-muted">{ev.time}</p>
                  </div>
                </div>
                <span className="font-mono text-[9px] text-text-muted bg-surface-raised border border-border px-2 py-0.5 rounded whitespace-nowrap">{ev.type}</span>
              </motion.div>
            ))}
          </div>
        </GlassCard>
      </FadeUp>
    </div>
  );
}
