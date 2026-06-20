"use client";

// frontend/components/ScoreChart.tsx

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  Radar, PolarRadiusAxis, ReferenceLine, Legend,
} from "recharts";
import { TrendingUp, Crosshair } from "lucide-react";
import { useDashboardContext } from "@/app/page";
import type { IterationScore } from "@/lib/types";

type ChartView = "line" | "radar";

const LINE_CONFIG = [
  { key: "overall",              color: "#10b981", label: "Overall",         dashed: false },
  { key: "keyword_coverage",     color: "#6366f1", label: "ATS Keywords",    dashed: true  },
  { key: "relevance",            color: "#f59e0b", label: "Relevance",       dashed: true  },
  { key: "impact",               color: "#ec4899", label: "Impact",          dashed: true  },
  { key: "cover_letter_quality", color: "#06b6d4", label: "Cover Letter",    dashed: true  },
] as const;

const AXIS_LABELS: Record<string, string> = {
  keyword_coverage:     "ATS Keywords",
  relevance:            "Relevance",
  impact:               "Impact",
  tone_match:           "Tone Match",
  cover_letter_quality: "Cover Letter",
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111113] border border-[#3f3f46] rounded-md p-3 shadow-xl">
      <p className="font-mono text-[10px] text-zinc-500 mb-2 tracking-widest uppercase">
        Iteration {label}
      </p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
          <span className="font-mono text-[10px]" style={{ color: p.color }}>
            {p.name}
          </span>
          <span className="font-mono text-[11px] font-semibold text-zinc-100">
            {p.value.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

function LineView({ data }: { data: IterationScore[] }) {
  const [visibleLines, setVisibleLines] = useState<Set<string>>(
    new Set(LINE_CONFIG.map((l) => l.key))
  );

  const toggle = (key: string) => {
    setVisibleLines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Legend toggles */}
      <div className="flex flex-wrap gap-2">
        {LINE_CONFIG.map((l) => (
          <button
            key={l.key}
            onClick={() => toggle(l.key)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono
              border transition-all ${
                visibleLines.has(l.key)
                  ? "border-transparent"
                  : "border-zinc-800 opacity-40"
              }`}
          >
            <span
              className="w-3 h-0.5 flex-shrink-0"
              style={{ background: l.color }}
            />
            <span style={{ color: l.color }}>{l.label}</span>
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="iteration"
            tick={{ fill: "#52525b", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={{ stroke: "#3f3f46" }}
            label={{
              value: "Iteration",
              position: "insideBottom",
              offset: -4,
              fill: "#52525b",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
            }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#52525b", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            tickCount={6}
          />
          <ReferenceLine y={80} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.4} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#3f3f46" }} />
          {LINE_CONFIG.map((l) =>
            visibleLines.has(l.key) ? (
              <Line
                key={l.key}
                type="monotone"
                dataKey={l.key}
                name={l.label}
                stroke={l.color}
                strokeWidth={l.dashed ? 1.5 : 2.5}
                strokeDasharray={l.dashed ? "4 3" : undefined}
                dot={{ fill: l.color, r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            ) : null
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function RadarView({ data }: { data: IterationScore[] }) {
  const last = data[data.length - 1];
  if (!last) return null;

  const radarData = Object.entries(AXIS_LABELS).map(([key, label]) => ({
    subject: label,
    score:   last[key as keyof IterationScore] as number,
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#27272a" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{
            fill: "#71717a",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
          }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: "#3f3f46", fontSize: 9 }}
          tickCount={4}
        />
        <Radar
          name="Score"
          dataKey="score"
          stroke="#10b981"
          fill="#10b981"
          fillOpacity={0.15}
          strokeWidth={2}
        />
        {data.length > 1 && (
          <Radar
            name="Iteration 1"
            dataKey="score"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.06}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function ScoreChart() {
  const { state } = useDashboardContext();
  const [view, setView] = useState<ChartView>("line");
  const { iterationScores } = state;

  if (iterationScores.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="panel p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={13} className="text-zinc-500" />
          <span className="font-display text-sm font-semibold text-zinc-200 tracking-tight">
            Score Progression
          </span>
        </div>

        <div className="flex bg-zinc-900 rounded border border-zinc-800 overflow-hidden">
          {(
            [
              { id: "line"  as ChartView, icon: <TrendingUp size={11} />,  label: "Line"  },
              { id: "radar" as ChartView, icon: <Crosshair size={11} />,   label: "Radar" },
            ] as const
          ).map((btn) => (
            <button
              key={btn.id}
              onClick={() => setView(btn.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] transition-colors ${
                view === btn.id
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {btn.icon}
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Threshold annotation */}
      {view === "line" && (
        <div className="flex items-center gap-2">
          <div className="w-6 h-px border-t border-dashed border-emerald-700/70" />
          <span className="font-mono text-[9px] text-emerald-700 tracking-wider">
            PASS THRESHOLD (80)
          </span>
        </div>
      )}

      {view === "line" ? (
        <LineView data={iterationScores} />
      ) : (
        <RadarView data={iterationScores} />
      )}
    </motion.div>
  );
}