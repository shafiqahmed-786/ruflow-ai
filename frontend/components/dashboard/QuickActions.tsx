"use client";

// frontend/components/dashboard/QuickActions.tsx
import { motion }    from "framer-motion";
import { Upload, FileText, PenTool, Sparkles } from "lucide-react";
import Link          from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn }        from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface QuickAction {
  id:          string;
  label:       string;
  description: string;
  href:        string;
  icon:        React.ElementType;
  accent:      boolean;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const QUICK_ACTIONS: QuickAction[] = [
  {
    id:          "upload",
    label:       "Upload Resume",
    description: "Ingest a new resume and begin optimization.",
    href:        "/dashboard/applications/new",
    icon:        Upload,
    accent:      true,
  },
  {
    id:          "analyze-jd",
    label:       "Analyze Job Description",
    description: "Extract ATS keywords, seniority, and requirements.",
    href:        "/dashboard/pipeline",
    icon:        FileText,
    accent:      false,
  },
  {
    id:          "cover-letter",
    label:       "Generate Cover Letter",
    description: "Create a targeted, role-aware cover letter.",
    href:        "/dashboard/pipeline",
    icon:        PenTool,
    accent:      false,
  },
  {
    id:          "optimize",
    label:       "Run ATS Optimization",
    description: "Launch the full multi-agent pipeline end-to-end.",
    href:        "/dashboard/pipeline",
    icon:        Sparkles,
    accent:      false,
  },
];

// ── Action card ────────────────────────────────────────────────────────────────
function ActionCard({ action, index }: { action: QuickAction; index: number }) {
  const Icon = action.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: 0.05 + index * 0.08, ease: "easeOut" }}
    >
      <Link
        href={action.href}
        aria-label={action.label}
        className="block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent rounded-lg"
      >
        <GlassCard
          hover
          glow={action.accent}
          className={cn(
            "group flex flex-col p-5 h-full",
            action.accent && "border-accent/30"
          )}
        >
          {/* Icon */}
          <div
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-lg border mb-4 flex-shrink-0",
              "transition-colors duration-200",
              action.accent
                ? "border-accent/30 bg-accent-subtle group-hover:border-accent/60"
                : "border-border bg-background-secondary group-hover:border-border-strong"
            )}
          >
            <Icon
              className={cn(
                "h-4.5 w-4.5 transition-colors duration-200",
                action.accent
                  ? "text-text-accent"
                  : "text-text-muted group-hover:text-text-primary"
              )}
              aria-hidden="true"
            />
          </div>

          {/* Label */}
          <h3
            className={cn(
              "font-mono text-xs font-semibold mb-1.5 leading-snug transition-colors duration-150",
              action.accent
                ? "text-text-accent"
                : "text-text-primary group-hover:text-text-accent"
            )}
          >
            {action.label}
          </h3>

          {/* Description */}
          <p className="font-mono text-[10px] text-text-muted leading-relaxed">
            {action.description}
          </p>
        </GlassCard>
      </Link>
    </motion.div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
export function QuickActions() {
  return (
    <section aria-label="Quick actions">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-mono text-sm font-semibold text-text-primary">Quick Actions</h2>
        <div className="flex-1 h-px bg-border" aria-hidden="true" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_ACTIONS.map((action, i) => (
          <ActionCard key={action.id} action={action} index={i} />
        ))}
      </div>
    </section>
  );
}