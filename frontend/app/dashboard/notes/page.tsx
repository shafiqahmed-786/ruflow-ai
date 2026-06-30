"use client";

// frontend/app/dashboard/notes/page.tsx — Notes
import { motion } from "framer-motion";
import { BookOpen, Plus, Tag, Clock } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

function FadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

interface Note {
  id: string; title: string; content: string; tag: string; updated: string;
  color: string;
}

const NOTES: Note[] = [
  { id: "n1", title: "Anthropic Interview Notes",      content: "System design: distributed job queue. Think about exactly-once semantics, worker heartbeats, dead letter queues. Review Constitutional AI paper before interview. Ask about team structure and mission alignment.",    tag: "Interview",   updated: "Today",      color: "border-amber/30 bg-amber-subtle"   },
  { id: "n2", title: "Resume Keywords — ML Roles",     content: "High-signal keywords: LangGraph, LangChain, RAG, vector search, ChromaDB, FAISS, async Python, distributed inference, CUDA optimization, model serving, A/B experimentation, production ML pipelines.",           tag: "Resume",      updated: "Yesterday",  color: "border-accent/30 bg-accent-subtle" },
  { id: "n3", title: "Company Research: Mistral AI",   content: "Paris HQ, fully open-weights philosophy. CEO: Arthur Mensch. Strong research culture. Mixtral MoE architecture. ~200 employees. Remote-friendly but HQ trips quarterly. Comp: competitive with US market.",         tag: "Research",    updated: "2 days ago", color: "border-border bg-background-secondary" },
  { id: "n4", title: "Offer Negotiation Prep",         content: "Stripe offer anchored at $195k. Industry data says counter at $210k base citing competing Perplexity offer. Emphasize equity interest. Request sign-on bonus if base is firm. Timeline: respond by Jul 10.",       tag: "Negotiation", updated: "3 days ago", color: "border-danger/30 bg-danger-subtle" },
  { id: "n5", title: "Behavioural STAR Stories",       content: "Leadership: Led 5-person SIH hackathon team to Top 5. Conflict: disagreed with teammate on arch, resolved via data. Failure: first Django project had N+1 queries, fixed with prefetch_related. Impact: ATS +12 pts.",tag: "Prep",       updated: "4 days ago", color: "border-border bg-background-secondary" },
];

const TAG_STYLE: Record<string, string> = {
  Interview:   "text-amber        bg-amber-subtle   border-amber/20",
  Resume:      "text-text-accent  bg-accent-subtle  border-accent/20",
  Research:    "text-text-muted   bg-surface-raised border-border",
  Negotiation: "text-danger       bg-danger-subtle  border-danger/20",
  Prep:        "text-text-muted   bg-surface-raised border-border",
};

export default function NotesPage() {
  return (
    <div className="max-w-[1280px] space-y-5">
      <FadeUp>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Notes</h1>
            <p className="font-mono text-xs text-text-muted mt-1">Company research, interview prep, recruiter notes, and career insights.</p>
          </div>
          <button className="flex items-center gap-1.5 font-mono text-[10px] text-text-accent border border-accent/30 bg-accent-subtle px-3 py-2 rounded-lg hover:border-accent/60 transition-colors">
            <Plus className="h-3.5 w-3.5" /> New Note
          </button>
        </div>
      </FadeUp>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {NOTES.map((note, i) => (
          <motion.div
            key={note.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.06 + i * 0.07 }}
          >
            <GlassCard className={cn("p-4 h-full cursor-pointer", note.color)} hover>
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-mono text-xs font-semibold text-text-primary leading-snug flex-1 pr-2">{note.title}</h3>
                <span className={cn("flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full border font-mono text-[8px] font-semibold uppercase tracking-wider", TAG_STYLE[note.tag])}>
                  {note.tag}
                </span>
              </div>
              <p className="font-mono text-[10px] text-text-secondary leading-relaxed mb-3 line-clamp-4">{note.content}</p>
              <div className="flex items-center gap-1.5 text-text-muted">
                <Clock className="h-3 w-3" />
                <span className="font-mono text-[9px]">{note.updated}</span>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
