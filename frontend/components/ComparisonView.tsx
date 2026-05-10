"use client";

// frontend/components/ComparisonView.tsx

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SplitSquareHorizontal, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { useDashboardContext } from "@/app/page";
import type { IterationScore } from "@/lib/types";

interface DeltaProps {
  from: number;
  to:   number;
}

function DeltaBadge({ from, to }: DeltaProps) {
  const delta = to - from;
  const abs   = Math.abs(delta).toFixed(1);

  if (Math.abs(delta) < 0.5) {
    return (
      <span className="flex items-center gap-0.5 font-mono text-[10px] text-zinc-600">
        <Minus size={9} /> {abs}
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className="flex items-center gap-0.5 font-mono text-[10px] text-emerald-400">
        <ArrowUpRight size={9} /> +{abs}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 font-mono text-[10px] text-rose-400">
      <ArrowDownRight size={9} /> -{abs}
    </span>
  );
}

const METRIC_LABELS: Record<string, string> = {
  overall:              "Overall",
  keyword_coverage:     "ATS Keywords",
  relevance:            "Relevance",
  impact:               "Impact",
  tone_match:           "Tone Match",
  cover_letter_quality: "Cover Letter",
};

const METRICS = Object.keys(METRIC_LABELS) as Array<keyof IterationScore>;

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="relative h-1 bg-zinc-800 rounded-full overflow-hidden w-full">
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: score / 100 }}
        style={{ transformOrigin: "left", background: color }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="absolute inset-y-0 left-0 rounded-full"
      />
    </div>
  );
}

export function ComparisonView() {
  const { state } = useDashboardContext();
  const { iterationScores } = state;
  const [leftIdx,  setLeftIdx]  = useState(0);
  const [rightIdx, setRightIdx] = useState(
    Math.max(0, iterationScores.length - 1)
  );

  if (iterationScores.length < 2) return null;

  const left  = iterationScores[leftIdx];
  const right = iterationScores[rightIdx];

  const metricColor = (score: number) =>
    score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#f43f5e";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="panel p-5 space-y-4"
    >
      <div className="flex items-center gap-2">
        <SplitSquareHorizontal size={13} className="text-zinc-500" />
        <span className="font-display text-sm font-semibold text-zinc-200 tracking-tight">
          Iteration Comparison
        </span>
      </div>

      {/* Iteration selectors */}
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            { label: "Baseline", idx: leftIdx,  setIdx: setLeftIdx,  side: "left"  },
            { label: "Compare",  idx: rightIdx, setIdx: setRightIdx, side: "right" },
          ] as const
        ).map(({ label, idx, setIdx }) => (
          <div key={label} className="space-y-1.5">
            <label className="label-mono">{label}</label>
            <select
              value={idx}
              onChange={(e) => setIdx(Number(e.target.value))}
              className="w-full bg-zinc-900 border border-zinc-700 rounded font-mono text-xs
                         text-zinc-300 px-2 py-1.5 focus:outline-none focus:border-zinc-500"
            >
              {iterationScores.map((s, i) => (
                <option key={i} value={i}>
                  Iteration {s.iteration}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Comparison grid */}
      <div className="space-y-3">
        {METRICS.filter((m) => m !== "iteration").map((metric) => {
          const l = left[metric]  as number;
          const r = right[metric] as number;
          return (
            <div key={metric} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-zinc-500">
                  {METRIC_LABELS[metric]}
                </span>
                <DeltaBadge from={l} to={r} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="flex justify-between font-mono text-[9px] text-zinc-600">
                    <span>Iter {left.iteration}</span>
                    <span className="font-semibold" style={{ color: metricColor(l) }}>
                      {l.toFixed(1)}
                    </span>
                  </div>
                  <ScoreBar score={l} color={metricColor(l)} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between font-mono text-[9px] text-zinc-600">
                    <span>Iter {right.iteration}</span>
                    <span className="font-semibold" style={{ color: metricColor(r) }}>
                      {r.toFixed(1)}
                    </span>
                  </div>
                  <ScoreBar score={r} color={metricColor(r)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary delta */}
      <div className="border-t border-[#27272a] pt-3 flex items-center justify-between">
        <span className="font-mono text-[10px] text-zinc-500">Overall improvement</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-400">
            {(left.overall).toFixed(1)} → {(right.overall).toFixed(1)}
          </span>
          <DeltaBadge from={left.overall} to={right.overall} />
        </div>
      </div>
    </motion.div>
  );
}