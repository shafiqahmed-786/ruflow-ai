"use client";

// frontend/components/dashboard/ApplicationCalendar.tsx
import { motion } from "framer-motion";
import { Calendar, Bell } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

interface CalEvent {
  id: string;
  company: string;
  type: "Interview" | "Follow-up" | "Deadline" | "Offer Review";
  date: string;
  time: string;
  urgent: boolean;
}

const EVENTS: CalEvent[] = [
  { id: "e1", company: "Anthropic",  type: "Interview",    date: "Today",     time: "3:00 PM", urgent: true  },
  { id: "e2", company: "Stripe",     type: "Follow-up",    date: "Tomorrow",  time: "9:00 AM", urgent: false },
  { id: "e3", company: "Vercel",     type: "Deadline",     date: "Jul 2",     time: "11:59 PM",urgent: true  },
  { id: "e4", company: "OpenAI",     type: "Interview",    date: "Jul 3",     time: "2:30 PM", urgent: false },
  { id: "e5", company: "Perplexity", type: "Offer Review", date: "Jul 5",     time: "EOD",     urgent: false },
];

const TYPE_STYLE: Record<CalEvent["type"], string> = {
  "Interview":    "text-text-primary bg-surface-raised    border-border-strong",
  "Follow-up":    "text-text-accent  bg-accent-subtle      border-accent/20",
  "Deadline":     "text-danger       bg-danger-subtle      border-danger/20",
  "Offer Review": "text-amber        bg-amber-subtle       border-amber/20",
};

export function ApplicationCalendar() {
  return (
    <GlassCard className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-text-accent" aria-hidden="true" />
          <h2 className="font-mono text-sm font-semibold text-text-primary">
            Upcoming Deadlines
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5 text-amber animate-pulse" aria-hidden="true" />
          <span className="font-mono text-[10px] text-amber">2 urgent</span>
        </div>
      </div>

      <div className="divide-y divide-border">
        {EVENTS.map((ev, i) => (
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.08 + i * 0.06 }}
            className={cn(
              "flex items-center justify-between px-4 py-3 hover:bg-surface-raised transition-colors duration-150",
              ev.urgent && "bg-danger-subtle/30"
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              {ev.urgent && (
                <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-text-primary truncate">
                  {ev.company}
                </p>
                <p className="font-mono text-[10px] text-text-muted">
                  {ev.date} · {ev.time}
                </p>
              </div>
            </div>
            <span className={cn(
              "flex-shrink-0 ml-3 inline-flex items-center px-2 py-0.5 rounded-full border",
              "font-mono text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap",
              TYPE_STYLE[ev.type]
            )}>
              {ev.type}
            </span>
          </motion.div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-border">
        <a href="/dashboard/calendar" className="font-mono text-[10px] text-text-accent hover:underline">
          View full calendar →
        </a>
      </div>
    </GlassCard>
  );
}
