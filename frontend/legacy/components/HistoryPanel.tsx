"use client";

// frontend/components/HistoryPanel.tsx

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ExternalLink, ChevronRight, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useDashboardContext } from "@/app/page";
import type { ApplicationSummary } from "@/lib/types";

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null)
    return <span className="font-mono text-[10px] text-zinc-600">—</span>;

  const [bg, text] =
    score >= 80
      ? ["bg-emerald-950/60 border-emerald-800/40", "text-emerald-400"]
      : score >= 60
      ? ["bg-amber-950/60 border-amber-800/40", "text-amber-400"]
      : ["bg-rose-950/60 border-rose-800/40", "text-rose-400"];

  return (
    <span
      className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded border ${bg} ${text}`}
    >
      {score.toFixed(0)}
    </span>
  );
}

function StatusIcon({ score }: { score: number | null }) {
  if (score === null) return <AlertCircle size={12} className="text-zinc-600" />;
  if (score >= 80)  return <CheckCircle size={12} className="text-emerald-500" />;
  if (score >= 60)  return <AlertCircle size={12} className="text-amber-500" />;
  return <XCircle size={12} className="text-rose-500" />;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins  / 60);
  const days  = Math.floor(hours / 24);

  if (days  > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins  > 0) return `${mins}m ago`;
  return "just now";
}

/**
 * Returns the relative-time string only after the component has mounted
 * on the client. Returns null during SSR / first render to prevent the
 * server→client HTML mismatch that causes the hydration error.
 */
function useRelativeTime(iso: string): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    // Populate immediately on mount
    setLabel(formatRelativeTime(iso));
    // Keep the label fresh every 30 s
    const id = setInterval(() => setLabel(formatRelativeTime(iso)), 30_000);
    return () => clearInterval(id);
  }, [iso]);

  return label;
}

function RelativeTime({ iso }: { iso: string }) {
  const label = useRelativeTime(iso);
  // Empty string during SSR; hydrated value appears after mount — no mismatch.
  return <span suppressHydrationWarning>{label ?? ""}</span>;
}

function HistoryRow({
  app,
  index,
  isActive,
  onClick,
}: {
  app:      ApplicationSummary;
  index:    number;
  isActive: boolean;
  onClick:  () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left
        transition-all duration-150 group
        ${isActive
          ? "bg-emerald-950/30 border border-emerald-800/40"
          : "hover:bg-zinc-900/60 border border-transparent hover:border-zinc-800"
        }
      `}
    >
      <StatusIcon score={app.overall_score} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-200 truncate font-medium">
            {app.company}
          </span>
          <ChevronRight size={10} className="text-zinc-600 flex-shrink-0" />
          <span className="font-mono text-[10px] text-zinc-500 truncate">
            {app.jd_role}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="font-mono text-[9px] text-zinc-600 flex items-center gap-1">
            <Clock size={8} />
            <RelativeTime iso={app.timestamp} />
          </span>
          <span className="font-mono text-[9px] text-zinc-700">
            {app.iterations} iter{app.iterations !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <ScoreBadge score={app.overall_score} />
    </motion.button>
  );
}

function HistoryDetail({ app }: { app: ApplicationSummary }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mx-3 mb-2 bg-zinc-900/40 rounded border border-zinc-800 overflow-hidden"
    >
      <div className="p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          {[
            ["Session",    app.session_id.slice(0, 20) + "…"],
            ["Company",    app.company],
            ["Role",       app.jd_role],
            ["Iterations", String(app.iterations)],
            ["Score",      app.overall_score?.toFixed(1) ?? "—"],
          ].map(([k, v]) => (
            <div key={k}>
              <span className="text-zinc-600">{k}: </span>
              <span className="text-zinc-300">{v}</span>
            </div>
          ))}
          {/* Time rendered client-only to avoid hydration mismatch */}
          <div>
            <span className="text-zinc-600">Time: </span>
            <span className="text-zinc-300">
              <RelativeTime iso={app.timestamp} />
            </span>
          </div>
        </div>
        <a
          href={`#session/${app.session_id}`}
          className="flex items-center gap-1 text-[10px] font-mono text-emerald-500 hover:text-emerald-400 transition-colors"
        >
          <ExternalLink size={9} />
          View full application
        </a>
      </div>
    </motion.div>
  );
}

export function HistoryPanel({ compact = false }: { compact?: boolean }) {
  const { state } = useDashboardContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { history } = state;

  const displayed = compact ? history.slice(0, 4) : history;

  const toggleDetail = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between p-4 pb-3 border-b border-[#27272a]">
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-zinc-500" />
          <span className="font-display text-sm font-semibold text-zinc-200 tracking-tight">
            History
          </span>
          {history.length > 0 && (
            <span className="font-mono text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
              {history.length}
            </span>
          )}
        </div>

        {compact && history.length > 4 && (
          <span className="font-mono text-[10px] text-zinc-600">
            +{history.length - 4} more
          </span>
        )}
      </div>

      <div className="p-2 space-y-0.5">
        {displayed.length === 0 ? (
          <p className="font-mono text-xs text-zinc-600 p-3">
            No applications yet. Run your first pipeline above.
          </p>
        ) : (
          displayed.map((app, i) => (
            <React.Fragment key={app.session_id}>
              <HistoryRow
                app={app}
                index={i}
                isActive={selectedId === app.session_id}
                onClick={() => toggleDetail(app.session_id)}
              />
              <AnimatePresence>
                {selectedId === app.session_id && (
                  <HistoryDetail app={app} />
                )}
              </AnimatePresence>
            </React.Fragment>
          ))
        )}
      </div>

      {/* Stats footer */}
      {history.length > 0 && (
        <div className="border-t border-[#27272a] px-4 py-2 flex items-center gap-4">
          {[
            {
              label: "Avg Score",
              value: (
                history
                  .filter((a) => a.overall_score !== null)
                  .reduce((s, a) => s + (a.overall_score ?? 0), 0) /
                  Math.max(1, history.filter((a) => a.overall_score !== null).length)
              ).toFixed(1),
            },
            {
              label: "Passed",
              value: String(history.filter((a) => (a.overall_score ?? 0) >= 80).length),
            },
            {
              label: "Total",
              value: String(history.length),
            },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="font-mono text-[9px] text-zinc-600 uppercase tracking-wider">
                {label}
              </span>
              <span className="font-mono text-[11px] text-zinc-300 font-semibold">
                {value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}