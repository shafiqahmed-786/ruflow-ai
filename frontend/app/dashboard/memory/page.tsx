"use client";

// frontend/app/dashboard/memory/page.tsx — Resume Memory (vector store browser)
import { motion } from "framer-motion";
import { BrainCircuit, Database, FileText, Search, GitBranch, Layers } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

function FadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

interface ResumeVersion {
  id: string; label: string; targetRole: string; atsAvg: number; usedIn: number; created: string;
}

const VERSIONS: ResumeVersion[] = [
  { id: "v1", label: "ML Infrastructure v3",   targetRole: "ML / Infra roles",     atsAvg: 89, usedIn: 7, created: "3 days ago"  },
  { id: "v2", label: "Backend Systems v2",     targetRole: "Backend / Platform",   atsAvg: 86, usedIn: 9, created: "1 week ago"  },
  { id: "v3", label: "GenAI Specialist v1",    targetRole: "GenAI / RAG roles",    atsAvg: 91, usedIn: 4, created: "2 weeks ago" },
  { id: "v4", label: "General SWE Baseline",   targetRole: "General SDE-1",        atsAvg: 78, usedIn: 4, created: "3 weeks ago" },
];

interface VectorChunk {
  id: string; source: string; type: string; similarity: number;
}

const RETRIEVED: VectorChunk[] = [
  { id: "c1", source: "RuFlow — multi-agent pipeline bullet", type: "Experience", similarity: 0.94 },
  { id: "c2", source: "AlphaForge — hexagonal architecture",  type: "Project",    similarity: 0.91 },
  { id: "c3", source: "SignalStack — async orchestration",    type: "Project",    similarity: 0.88 },
  { id: "c4", source: "Clary — multi-agent memory system",    type: "Project",    similarity: 0.85 },
];

export default function MemoryPage() {
  return (
    <div className="max-w-[1280px] space-y-5">
      <FadeUp>
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">Resume Memory</h1>
          <p className="font-mono text-xs text-text-muted mt-1">
            Vector-indexed resume versions and retrieval-augmented context powering the tailoring agents.
          </p>
        </div>
      </FadeUp>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Indexed Chunks", value: "342",  icon: Database  },
          { label: "Resume Versions",value: "4",    icon: Layers    },
          { label: "Avg Similarity", value: "0.89",  icon: GitBranch },
          { label: "Retrieval Calls",value: "1.2k",  icon: Search    },
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
        {/* Resume versions */}
        <FadeUp delay={0.1}>
          <GlassCard className="overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
              <FileText className="h-4 w-4 text-text-accent" />
              <h2 className="font-mono text-sm font-semibold text-text-primary">Resume Version Library</h2>
            </div>
            <div className="divide-y divide-border">
              {VERSIONS.map((v, i) => (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25, delay: 0.12 + i * 0.06 }}
                  className="flex items-center justify-between px-4 py-3 hover:bg-surface-raised transition-colors duration-150"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-text-primary truncate">{v.label}</p>
                    <p className="font-mono text-[10px] text-text-muted truncate">{v.targetRole} · {v.created}</p>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className={cn("font-mono text-xs font-bold", v.atsAvg >= 85 ? "text-text-accent" : "text-amber")}>{v.atsAvg}</p>
                      <p className="font-mono text-[9px] text-text-muted">ATS avg</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs font-bold text-text-secondary">{v.usedIn}</p>
                      <p className="font-mono text-[9px] text-text-muted">used in</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </FadeUp>

        {/* Retrieved chunks */}
        <FadeUp delay={0.14}>
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <BrainCircuit className="h-4 w-4 text-text-accent" />
              <h2 className="font-mono text-sm font-semibold text-text-primary">Last Retrieval Pass</h2>
              <span className="ml-auto font-mono text-[9px] text-text-muted bg-surface-raised border border-border px-2 py-0.5 rounded">
                ChromaDB
              </span>
            </div>
            <div className="space-y-2.5">
              {RETRIEVED.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.28, delay: 0.16 + i * 0.07 }}
                  className="flex items-center justify-between rounded-lg border border-border bg-background-secondary px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-text-secondary truncate">{c.source}</p>
                    <span className="font-mono text-[9px] text-text-muted">{c.type}</span>
                  </div>
                  <span className="font-mono text-[10px] text-text-accent font-semibold flex-shrink-0 ml-3">
                    {c.similarity.toFixed(2)}
                  </span>
                </motion.div>
              ))}
            </div>
            <p className="font-mono text-[10px] text-text-muted mt-3 pt-3 border-t border-border">
              Retrieved via HybridRetriever (dense ChromaDB + BM25 sparse, RRF-merged) during the most recent resume_tailor agent run.
            </p>
          </GlassCard>
        </FadeUp>
      </div>
    </div>
  );
}
