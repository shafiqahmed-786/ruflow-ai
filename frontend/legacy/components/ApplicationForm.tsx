"use client";

// frontend/components/ApplicationForm.tsx

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Send, Zap, AlertCircle, FileText, Briefcase } from "lucide-react";
import { useDashboardContext } from "@/app/page";
import { DEMO_RESUME_TEXT, DEMO_JD_TEXT } from "@/lib/mockData";
import type { ApplicationRequest } from "@/lib/types";

const USER_ID = "user_demo_001";

function CharCounter({ value, max }: { value: number; max: number }) {
  const pct = value / max;
  const color = pct > 0.9 ? "text-rose-400" : pct > 0.7 ? "text-amber-400" : "text-zinc-600";
  return (
    <span className={`font-mono text-[10px] ${color}`}>
      {value.toLocaleString()} / {max.toLocaleString()}
    </span>
  );
}

export function ApplicationForm() {
  const { runPipeline, runDemo, state } = useDashboardContext();
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [errors, setErrors] = useState<{ resume?: string; jd?: string }>({});

  const isRunning = state.phase === "running";

  const validate = useCallback((): boolean => {
    const errs: typeof errors = {};
    if (!resumeText.trim() || resumeText.trim().length < 50)
      errs.resume = "Resume must be at least 50 characters";
    if (!jdText.trim() || jdText.trim().length < 30)
      errs.jd = "Job description must be at least 30 characters";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [resumeText, jdText]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;
      const req: ApplicationRequest = {
        resume_text: resumeText.trim(),
        jd_text:     jdText.trim(),
        user_id:     USER_ID,
      };
      runPipeline(req);
    },
    [validate, resumeText, jdText, runPipeline]
  );

  const handleDemo = useCallback(() => {
    setResumeText(DEMO_RESUME_TEXT);
    setJdText(DEMO_JD_TEXT);
    setErrors({});
    setTimeout(() => runDemo(), 100);
  }, [runDemo]);

  const handleLoadDemo = useCallback(() => {
    setResumeText(DEMO_RESUME_TEXT);
    setJdText(DEMO_JD_TEXT);
    setErrors({});
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="panel p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-zinc-100 tracking-tight">
            Application Intelligence
          </h2>
          <p className="font-mono text-[11px] text-zinc-500 mt-0.5">
            Paste resume + job description → agents optimise and score
          </p>
        </div>
        <button
          type="button"
          onClick={handleLoadDemo}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-800
                     font-mono text-[10px] text-zinc-400 tracking-wider uppercase
                     hover:border-zinc-600 hover:text-zinc-200 transition-colors disabled:opacity-40"
        >
          Load Demo
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Resume textarea */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 label-mono">
              <FileText size={11} className="text-zinc-500" />
              Resume Text
              <span className="text-rose-500">*</span>
            </label>
            <CharCounter value={resumeText.length} max={15000} />
          </div>
          <div className="relative">
            <textarea
              value={resumeText}
              onChange={(e) => {
                setResumeText(e.target.value);
                if (errors.resume) setErrors((p) => ({ ...p, resume: undefined }));
              }}
              disabled={isRunning}
              placeholder="Paste your resume here — plain text or markdown..."
              rows={12}
              maxLength={15000}
              className={`
                w-full bg-[#0d0d0f] border rounded-md font-mono text-xs text-zinc-300
                placeholder:text-zinc-700 resize-none p-4 leading-relaxed
                focus:outline-none focus:ring-1 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                ${errors.resume
                  ? "border-rose-800 focus:ring-rose-700/50"
                  : "border-[#27272a] focus:border-emerald-800 focus:ring-emerald-700/30"
                }
              `}
            />
            {isRunning && (
              <div className="absolute inset-0 bg-zinc-950/50 rounded-md flex items-center justify-center">
                <span className="font-mono text-[11px] text-zinc-500">Processing…</span>
              </div>
            )}
          </div>
          {errors.resume && (
            <div className="flex items-center gap-1.5 text-rose-400">
              <AlertCircle size={11} />
              <span className="font-mono text-[10px]">{errors.resume}</span>
            </div>
          )}
        </div>

        {/* JD textarea */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 label-mono">
              <Briefcase size={11} className="text-zinc-500" />
              Job Description
              <span className="text-rose-500">*</span>
            </label>
            <CharCounter value={jdText.length} max={8000} />
          </div>
          <textarea
            value={jdText}
            onChange={(e) => {
              setJdText(e.target.value);
              if (errors.jd) setErrors((p) => ({ ...p, jd: undefined }));
            }}
            disabled={isRunning}
            placeholder="Paste the full job description here..."
            rows={10}
            maxLength={8000}
            className={`
              w-full bg-[#0d0d0f] border rounded-md font-mono text-xs text-zinc-300
              placeholder:text-zinc-700 resize-none p-4 leading-relaxed
              focus:outline-none focus:ring-1 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
              ${errors.jd
                ? "border-rose-800 focus:ring-rose-700/50"
                : "border-[#27272a] focus:border-emerald-800 focus:ring-emerald-700/30"
              }
            `}
          />
          {errors.jd && (
            <div className="flex items-center gap-1.5 text-rose-400">
              <AlertCircle size={11} />
              <span className="font-mono text-[10px]">{errors.jd}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={isRunning}
            className="
              flex items-center gap-2 px-5 py-2.5 rounded-md font-mono text-xs font-semibold
              tracking-wider uppercase bg-emerald-600 text-white
              hover:bg-emerald-500 active:bg-emerald-700
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-150 shadow-emerald-glow
            "
          >
            <Send size={12} />
            Run Pipeline
          </button>

          <button
            type="button"
            onClick={handleDemo}
            disabled={isRunning}
            className="
              flex items-center gap-2 px-5 py-2.5 rounded-md font-mono text-xs font-semibold
              tracking-wider uppercase border border-amber-700/60 text-amber-400
              hover:border-amber-500 hover:bg-amber-950/30
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-150
            "
          >
            <Zap size={12} />
            Demo Mode
          </button>

          <p className="font-mono text-[10px] text-zinc-700 ml-auto hidden sm:block">
            Demo Mode uses mock data — no API key required
          </p>
        </div>
      </form>
    </motion.div>
  );
}