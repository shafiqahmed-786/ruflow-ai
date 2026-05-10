"use client";

// frontend/components/ActionToolbar.tsx

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RotateCcw, Copy, Download, SplitSquareHorizontal,
  CheckCheck, ChevronRight, Layers,
} from "lucide-react";
import { useDashboardContext } from "@/app/page";
import { ComparisonView } from "./ComparisonView";

function CopyButton({
  content,
  label,
}: {
  content: string;
  label:   string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [content]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-700
                 font-mono text-[10px] text-zinc-400 uppercase tracking-wider
                 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
    >
      {copied ? (
        <>
          <CheckCheck size={11} className="text-emerald-400" />
          <span className="text-emerald-400">Copied</span>
        </>
      ) : (
        <>
          <Copy size={11} />
          {label}
        </>
      )}
    </button>
  );
}

function DownloadButton({
  content,
  filename,
  label,
}: {
  content:  string;
  filename: string;
  label:    string;
}) {
  const handleDownload = useCallback(() => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [content, filename]);

  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-700
                 font-mono text-[10px] text-zinc-400 uppercase tracking-wider
                 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
    >
      <Download size={11} />
      {label}
    </button>
  );
}

export function ActionToolbar() {
  const { state, reset } = useDashboardContext();
  const [showComparison, setShowComparison] = useState(false);
  const { result, iterationScores } = state;

  if (!result) return null;

  const sessionLabel = result.session_id.slice(0, 14).toUpperCase();
  const canCompare   = iterationScores.length >= 2;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="panel px-5 py-3 flex flex-wrap items-center gap-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mr-3">
          <Layers size={12} className="text-zinc-500" />
          <span className="font-mono text-[10px] text-zinc-500">
            {result.company ?? "Application"}
          </span>
          <ChevronRight size={10} className="text-zinc-700" />
          <span className="font-mono text-[10px] text-zinc-400">
            {result.jd_role ?? "Result"}
          </span>
          <ChevronRight size={10} className="text-zinc-700" />
          <span className="font-mono text-[10px] text-zinc-600">{sessionLabel}</span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-zinc-800 mx-1" />

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {result.resume && (
            <>
              <CopyButton content={result.resume} label="Copy Resume" />
              <DownloadButton
                content={result.resume}
                filename={`resume-${result.session_id.slice(0, 8)}.md`}
                label="Resume"
              />
            </>
          )}
          {result.cover_letter && (
            <>
              <CopyButton content={result.cover_letter} label="Copy CL" />
              <DownloadButton
                content={result.cover_letter}
                filename={`cover-letter-${result.session_id.slice(0, 8)}.txt`}
                label="Cover Letter"
              />
            </>
          )}

          {canCompare && (
            <button
              onClick={() => setShowComparison((p) => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded border font-mono
                          text-[10px] uppercase tracking-wider transition-colors
                          ${showComparison
                            ? "border-emerald-700/60 text-emerald-400 bg-emerald-950/20"
                            : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                          }`}
            >
              <SplitSquareHorizontal size={11} />
              Compare Iterations
            </button>
          )}
        </div>

        {/* Right section */}
        <div className="ml-auto flex items-center gap-3">
          {/* Score badge */}
          {result.scores.overall !== null && (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[9px] text-zinc-600 uppercase tracking-wider">
                Final Score
              </span>
              <span
                className={`font-mono text-sm font-bold ${
                  result.scores.overall >= 80
                    ? "text-emerald-400"
                    : result.scores.overall >= 60
                    ? "text-amber-400"
                    : "text-rose-400"
                }`}
              >
                {result.scores.overall.toFixed(1)}
              </span>
            </div>
          )}

          <div className="h-4 w-px bg-zinc-800" />

          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-700
                       font-mono text-[10px] text-zinc-400 uppercase tracking-wider
                       hover:border-rose-800 hover:text-rose-400 transition-colors"
          >
            <RotateCcw size={11} />
            New Application
          </button>
        </div>
      </div>

      {/* Comparison panel (expandable) */}
      <AnimatePresence>
        {showComparison && canCompare && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <ComparisonView />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}