"use client";

// frontend/components/ResultsPanel.tsx

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Mail, GitBranch, ChevronDown, ChevronUp,
  Hash, Target, Zap, MessageSquare, Award, BarChart2,
} from "lucide-react";
import { useDashboardContext } from "@/app/page";
import { MetricCard } from "./MetricCard";

type Tab = "resume" | "cover_letter" | "changelog";

const METRIC_ICONS: Record<string, React.ReactNode> = {
  keyword_coverage:     <Hash size={13} />,
  relevance:            <Target size={13} />,
  impact:               <Zap size={13} />,
  tone_match:           <MessageSquare size={13} />,
  cover_letter_quality: <Mail size={13} />,
  overall:              <Award size={13} />,
};

const METRIC_LABELS: Record<string, string> = {
  keyword_coverage:     "ATS Keywords",
  relevance:            "Relevance",
  impact:               "Impact",
  tone_match:           "Tone Match",
  cover_letter_quality: "Cover Letter",
  overall:              "Overall Score",
};

const METRIC_SUBLABELS: Record<string, string> = {
  keyword_coverage:     "Keyword coverage",
  relevance:            "JD alignment",
  impact:               "Quantified bullets",
  tone_match:           "Seniority match",
  cover_letter_quality: "Hook + specificity",
  overall:              "Weighted composite",
};

function ScoreGrid() {
  const { state } = useDashboardContext();
  const scores = state.result?.scores;
  if (!scores) return null;

  const metrics: Array<keyof typeof METRIC_LABELS> = [
    "keyword_coverage", "relevance", "impact",
    "tone_match", "cover_letter_quality",
  ];

  return (
    <div className="space-y-3">
      {/* Overall — big card */}
      <MetricCard
        label={METRIC_LABELS.overall}
        score={scores.overall}
        icon={METRIC_ICONS.overall}
        sublabel={METRIC_SUBLABELS.overall}
        delay={0}
        large
      />
      {/* Sub-metrics — 2-col grid */}
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((key, i) => (
          <MetricCard
            key={key}
            label={METRIC_LABELS[key]}
            score={scores[key as keyof typeof scores] as number | null}
            icon={METRIC_ICONS[key]}
            sublabel={METRIC_SUBLABELS[key]}
            delay={0.05 * (i + 1)}
          />
        ))}
      </div>
    </div>
  );
}

function MarkdownOutput({ content }: { content: string }) {
  return (
    <pre className="font-mono text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed
                    bg-[#0a0a0c] border border-[#27272a] rounded-md p-5 overflow-auto
                    max-h-[520px]">
      {content}
    </pre>
  );
}

function ChangeLogTimeline() {
  const { state } = useDashboardContext();
  const log = state.result?.change_log ?? [];

  if (log.length === 0) {
    return (
      <p className="font-mono text-xs text-zinc-600 py-4">
        No changes recorded.
      </p>
    );
  }

  const grouped = log.reduce<Record<number, typeof log>>((acc, entry) => {
    const iter = entry.iteration;
    if (!acc[iter]) acc[iter] = [];
    acc[iter].push(entry);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([iter, entries]) => (
        <div key={iter} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
            <span className="font-mono text-[10px] text-amber-400 tracking-widest uppercase">
              Iteration {iter}
            </span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>
          {entries.map((entry, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="ml-4 flex items-start gap-3 py-2 px-3 bg-zinc-900/40 rounded border-l-2 border-zinc-700"
            >
              <GitBranch size={10} className="text-zinc-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider">
                  {entry.target}
                </span>
                <p className="font-mono text-[11px] text-zinc-300 mt-0.5 leading-relaxed">
                  {entry.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ResultsPanel() {
  const { state } = useDashboardContext();
  const [activeTab, setActiveTab] = useState<Tab>("resume");
  const [scoresExpanded, setScoresExpanded] = useState(true);

  const result = state.result;
  if (!result) return null;

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "resume",       label: "Tailored Resume",  icon: <FileText size={12} /> },
    { id: "cover_letter", label: "Cover Letter",      icon: <Mail size={12} /> },
    { id: "changelog",    label: `Changes (${result.change_log.length})`, icon: <GitBranch size={12} /> },
  ];

  return (
    <div className="space-y-5">
      {/* Score grid — collapsible */}
      <div className="panel overflow-hidden">
        <button
          onClick={() => setScoresExpanded((p) => !p)}
          className="w-full flex items-center justify-between p-5 hover:bg-zinc-900/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BarChart2 size={13} className="text-zinc-500" />
            <span className="font-display text-sm font-semibold text-zinc-200 tracking-tight">
              Evaluation Scores
            </span>
            <span className="font-mono text-[10px] text-zinc-600">
              {result.iterations} iteration{result.iterations !== 1 ? "s" : ""} · {result.status.toUpperCase()}
            </span>
          </div>
          {scoresExpanded ? (
            <ChevronUp size={14} className="text-zinc-500" />
          ) : (
            <ChevronDown size={14} className="text-zinc-500" />
          )}
        </button>

        <AnimatePresence>
          {scoresExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5">
                <ScoreGrid />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Outputs */}
      <div className="panel overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-[#27272a]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-5 py-3 font-mono text-xs tracking-wide
                border-b-2 transition-colors
                ${activeTab === tab.id
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
                }
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "resume" && (
                <MarkdownOutput content={result.resume} />
              )}
              {activeTab === "cover_letter" && (
                <MarkdownOutput content={result.cover_letter} />
              )}
              {activeTab === "changelog" && <ChangeLogTimeline />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Focus areas */}
      {result.focus_areas.length > 0 && (
        <div className="panel p-4 flex items-center gap-3 flex-wrap">
          <span className="label-mono">Focus Areas</span>
          {result.focus_areas.map((area) => (
            <span
              key={area}
              className="font-mono text-[10px] text-zinc-400 bg-zinc-800/80 border border-zinc-700 px-2 py-0.5 rounded"
            >
              {area.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}