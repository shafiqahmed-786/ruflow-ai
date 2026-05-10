"use client";

// frontend/components/MetricCard.tsx

import React from "react";
import { motion } from "framer-motion";
import type { ScoreColorConfig } from "@/lib/types";

function getScoreConfig(score: number | null): ScoreColorConfig & { label: string } {
  if (score === null) {
    return {
      bg:     "bg-zinc-900",
      text:   "text-zinc-500",
      border: "border-zinc-800",
      glow:   "",
      label:  "N/A",
    };
  }
  if (score >= 80) {
    return {
      bg:     "bg-emerald-950/40",
      text:   "text-emerald-400",
      border: "border-emerald-800/60",
      glow:   "shadow-emerald-glow",
      label:  "STRONG",
    };
  }
  if (score >= 60) {
    return {
      bg:     "bg-amber-950/30",
      text:   "text-amber-400",
      border: "border-amber-800/50",
      glow:   "shadow-amber-glow",
      label:  "MODERATE",
    };
  }
  return {
    bg:     "bg-rose-950/30",
    text:   "text-rose-400",
    border: "border-rose-800/50",
    glow:   "shadow-rose-glow",
    label:  "WEAK",
  };
}

interface MetricCardProps {
  label:    string;
  score:    number | null;
  icon?:    React.ReactNode;
  sublabel?: string;
  delay?:   number;
  large?:   boolean;
}

export function MetricCard({
  label,
  score,
  icon,
  sublabel,
  delay = 0,
  large = false,
}: MetricCardProps) {
  const config = getScoreConfig(score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
      className={`
        relative overflow-hidden rounded-lg border p-4
        ${config.bg} ${config.border}
        transition-shadow duration-300 hover:${config.glow}
        ${large ? "p-5" : "p-4"}
      `}
    >
      {/* Background score bar */}
      {score !== null && (
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: score / 100 }}
          transition={{ duration: 0.8, delay: delay + 0.15, ease: "easeOut" }}
          style={{ transformOrigin: "left" }}
          className={`absolute bottom-0 left-0 h-[2px] w-full ${
            score >= 80
              ? "bg-emerald-500/50"
              : score >= 60
              ? "bg-amber-500/50"
              : "bg-rose-500/50"
          }`}
        />
      )}

      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="label-mono mb-2">{label}</p>
          <div className="flex items-baseline gap-2">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: delay + 0.1 }}
              className={`font-mono font-bold ${large ? "text-3xl" : "text-2xl"} ${config.text} glow-${
                score !== null && score >= 80
                  ? "emerald"
                  : score !== null && score >= 60
                  ? "amber"
                  : "rose"
              }`}
            >
              {score !== null ? score.toFixed(1) : "—"}
            </motion.span>
            {score !== null && (
              <span className="font-mono text-[10px] text-zinc-600">/100</span>
            )}
          </div>
          {sublabel && (
            <p className="font-mono text-[10px] text-zinc-600 mt-1">{sublabel}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {icon && (
            <div className={`${config.text} opacity-60`}>{icon}</div>
          )}
          <span
            className={`font-mono text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded
              ${
                score === null
                  ? "text-zinc-600 bg-zinc-800/50"
                  : score >= 80
                  ? "text-emerald-400 bg-emerald-950/60"
                  : score >= 60
                  ? "text-amber-400 bg-amber-950/60"
                  : "text-rose-400 bg-rose-950/60"
              }
            `}
          >
            {config.label}
          </span>
        </div>
      </div>
    </motion.div>
  );
}