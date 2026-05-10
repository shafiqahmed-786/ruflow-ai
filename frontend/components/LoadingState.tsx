"use client";

// frontend/components/LoadingState.tsx

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, Loader2, XCircle, Activity } from "lucide-react";
import { useDashboardContext } from "@/app/page";
import type { AgentStatus, AgentStep } from "@/lib/types";

function AgentIcon({ status }: { status: AgentStatus }) {
  switch (status) {
    case "done":
      return <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />;
    case "running":
      return (
        <Loader2
          size={14}
          className="text-amber-400 flex-shrink-0 animate-spin"
        />
      );
    case "error":
      return <XCircle size={14} className="text-rose-400 flex-shrink-0" />;
    default:
      return <Circle size={14} className="text-zinc-700 flex-shrink-0" />;
  }
}

function AgentRow({ agent, index }: { agent: AgentStep; index: number }) {
  const isRunning = agent.status === "running";
  const isDone    = agent.status === "done";

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.25 }}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-md border transition-all duration-300
        ${isRunning
          ? "bg-amber-950/20 border-amber-800/40 shadow-amber-glow"
          : isDone
          ? "bg-emerald-950/15 border-emerald-900/40"
          : "bg-transparent border-transparent"
        }
      `}
    >
      <span className="font-mono text-[10px] text-zinc-600 w-5 text-right flex-shrink-0">
        {String(index + 1).padStart(2, "0")}
      </span>

      <AgentIcon status={agent.status} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`font-mono text-xs font-medium transition-colors ${
              isRunning
                ? "text-amber-300"
                : isDone
                ? "text-emerald-300"
                : "text-zinc-500"
            }`}
          >
            {agent.label}
          </span>
          {isRunning && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="font-mono text-[9px] text-amber-500 tracking-widest uppercase"
            >
              PROCESSING
            </motion.span>
          )}
          {isDone && agent.duration_ms !== null && (
            <span className="font-mono text-[9px] text-zinc-600">
              {(agent.duration_ms / 1000).toFixed(1)}s
            </span>
          )}
        </div>
        <p className="font-mono text-[10px] text-zinc-600 truncate mt-0.5">
          {agent.description}
        </p>
      </div>

      {/* Progress connector */}
      {isDone && (
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          className="w-8 h-[1px] bg-emerald-800/60"
        />
      )}
    </motion.div>
  );
}

function IterationScoreFeed() {
  const { state } = useDashboardContext();
  const { iterationScores } = state;

  if (iterationScores.length === 0) return null;

  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity size={12} className="text-zinc-500" />
        <span className="label-mono">Evaluation Loop</span>
      </div>
      <div className="space-y-2">
        <AnimatePresence>
          {iterationScores.map((score) => (
            <motion.div
              key={score.iteration}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between py-2 px-3 bg-zinc-900/60 rounded border border-zinc-800"
            >
              <span className="font-mono text-[10px] text-zinc-500">
                Iteration {score.iteration}
              </span>
              <div className="flex items-center gap-4">
                {(
                  [
                    ["KW", score.keyword_coverage],
                    ["REL", score.relevance],
                    ["IMP", score.impact],
                  ] as [string, number][]
                ).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-1">
                    <span className="font-mono text-[9px] text-zinc-600">{k}</span>
                    <span
                      className={`font-mono text-[10px] font-semibold ${
                        v >= 80
                          ? "text-emerald-400"
                          : v >= 60
                          ? "text-amber-400"
                          : "text-rose-400"
                      }`}
                    >
                      {v}
                    </span>
                  </div>
                ))}
                <div className="h-3 w-[1px] bg-zinc-700" />
                <span
                  className={`font-mono text-xs font-bold ${
                    score.overall >= 80
                      ? "text-emerald-400"
                      : score.overall >= 60
                      ? "text-amber-400"
                      : "text-rose-400"
                  }`}
                >
                  {score.overall.toFixed(0)}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function LoadingState() {
  const { state } = useDashboardContext();
  const { agents } = state;

  const completed = agents.filter((a) => a.status === "done").length;
  const progress  = (completed / agents.length) * 100;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
      {/* Left: agent pipeline */}
      <div className="panel p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-zinc-100 tracking-tight">
              Agent Execution
            </h2>
            <p className="font-mono text-[11px] text-zinc-500 mt-0.5">
              Multi-agent pipeline running — {completed}/{agents.length} nodes complete
            </p>
          </div>
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="flex items-center gap-1.5"
          >
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="font-mono text-[10px] text-amber-400 tracking-widest">LIVE</span>
          </motion.div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between font-mono text-[10px] text-zinc-600">
            <span>PIPELINE PROGRESS</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
            />
          </div>
        </div>

        {/* Agent list */}
        <div className="space-y-1">
          {agents.map((agent, i) => (
            <AgentRow key={agent.name} agent={agent} index={i} />
          ))}
        </div>
      </div>

      {/* Right: iteration scores + system log */}
      <div className="space-y-5">
        <IterationScoreFeed />
        <SystemLog />
      </div>
    </div>
  );
}

function SystemLog() {
  const { state } = useDashboardContext();
  const running = state.agents.find((a) => a.status === "running");
  const done    = state.agents.filter((a) => a.status === "done");

  const lines = [
    ...done.map((a) => ({
      ts:  new Date().toISOString().split("T")[1].split(".")[0],
      msg: `[${a.name.toUpperCase()}] completed in ${((a.duration_ms ?? 0) / 1000).toFixed(2)}s`,
      type: "done" as const,
    })),
    ...(running
      ? [
          {
            ts:   new Date().toISOString().split("T")[1].split(".")[0],
            msg:  `[${running.name.toUpperCase()}] executing...`,
            type: "running" as const,
          },
        ]
      : []),
  ].slice(-10);

  return (
    <div className="panel p-4 space-y-3">
      <span className="label-mono">System Log</span>
      <div className="space-y-1 max-h-[280px] overflow-y-auto">
        {lines.length === 0 ? (
          <p className="font-mono text-[11px] text-zinc-700">Initialising…</p>
        ) : (
          lines.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`font-mono text-[10px] flex items-start gap-2 ${
                line.type === "done"    ? "text-emerald-500/80" :
                line.type === "running" ? "text-amber-400 cursor-blink" :
                "text-zinc-600"
              }`}
            >
              <span className="text-zinc-700 flex-shrink-0">{line.ts}</span>
              <span>{line.msg}</span>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}