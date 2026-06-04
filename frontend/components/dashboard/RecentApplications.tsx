"use client";

// frontend/components/dashboard/RecentApplications.tsx
import { motion }    from "framer-motion";
import { Briefcase, ExternalLink } from "lucide-react";
import Link          from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn }        from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type AppStatus = "Optimized" | "Processing" | "Interview" | "Revision Needed";

interface Application {
  id:         string;
  company:    string;
  role:       string;
  atsScore:   number;
  status:     AppStatus;
  updated:    string;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const APPLICATIONS: Application[] = [
  {
    id:       "app-001",
    company:  "Anthropic",
    role:     "Staff ML Infrastructure Engineer",
    atsScore: 91,
    status:   "Optimized",
    updated:  "2 hours ago",
  },
  {
    id:       "app-002",
    company:  "OpenAI",
    role:     "Senior Backend Engineer",
    atsScore: 88,
    status:   "Interview",
    updated:  "Yesterday",
  },
  {
    id:       "app-003",
    company:  "Vercel",
    role:     "Principal Systems Engineer",
    atsScore: 74,
    status:   "Revision Needed",
    updated:  "2 days ago",
  },
  {
    id:       "app-004",
    company:  "Perplexity",
    role:     "ML Platform Lead",
    atsScore: 83,
    status:   "Processing",
    updated:  "3 days ago",
  },
  {
    id:       "app-005",
    company:  "Stripe",
    role:     "Staff Software Engineer",
    atsScore: 90,
    status:   "Optimized",
    updated:  "4 days ago",
  },
];

// ── Status badge config ────────────────────────────────────────────────────────
const STATUS_STYLE: Record<AppStatus, string> = {
  "Optimized":       "text-text-accent bg-accent-subtle border-accent/25",
  "Processing":      "text-amber      bg-amber-subtle   border-amber/25",
  "Interview":       "text-text-primary bg-surface-raised border-border-strong",
  "Revision Needed": "text-danger     bg-danger-subtle  border-danger/25",
};

function scoreColor(score: number): string {
  if (score >= 85) return "text-text-accent";
  if (score >= 70) return "text-amber";
  return "text-danger";
}

// ── Table row ─────────────────────────────────────────────────────────────────
function ApplicationRow({ app, index }: { app: Application; index: number }) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 + index * 0.06, ease: "easeOut" }}
      className="group border-b border-border last:border-0 hover:bg-surface-raised transition-colors duration-150"
    >
      {/* Company + role */}
      <td className="px-4 py-3">
        <p className="font-mono text-xs font-semibold text-text-primary leading-none mb-0.5">
          {app.company}
        </p>
        <p className="font-mono text-[10px] text-text-muted truncate max-w-[180px]">
          {app.role}
        </p>
      </td>

      {/* ATS Score — hidden on smallest screens */}
      <td className="hidden sm:table-cell px-4 py-3">
        <span className={cn("font-mono text-sm font-bold", scoreColor(app.atsScore))}>
          {app.atsScore}
        </span>
        <span className="font-mono text-[10px] text-text-muted ml-0.5">/100</span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full border",
            "font-mono text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap",
            STATUS_STYLE[app.status]
          )}
        >
          {app.status}
        </span>
      </td>

      {/* Updated — hidden on mobile */}
      <td className="hidden md:table-cell px-4 py-3">
        <span className="font-mono text-[10px] text-text-muted">{app.updated}</span>
      </td>

      {/* Action */}
      <td className="px-4 py-3">
        <Link
          href={`/dashboard/applications/${app.id}`}
          aria-label={`View ${app.company} application`}
          className={cn(
            "inline-flex items-center justify-center w-7 h-7 rounded-md",
            "border border-transparent text-text-muted",
            "hover:border-border hover:text-text-primary",
            "opacity-0 group-hover:opacity-100",
            "transition-all duration-150",
            "focus-visible:opacity-100 focus-visible:outline",
            "focus-visible:outline-2 focus-visible:outline-offset-2",
            "focus-visible:outline-accent",
          )}
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      </td>
    </motion.tr>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
export function RecentApplications() {
  return (
    <GlassCard className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-text-accent" aria-hidden="true" />
          <h2 className="font-mono text-sm font-semibold text-text-primary">
            Recent Applications
          </h2>
          <span className="font-mono text-[10px] text-text-muted bg-surface-raised border border-border px-1.5 py-0.5 rounded">
            {APPLICATIONS.length}
          </span>
        </div>
        <Link
          href="/dashboard/applications"
          className="font-mono text-[10px] text-text-accent hover:text-accent-muted transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          View all →
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full" aria-label="Recent applications">
          <thead>
            <tr className="border-b border-border bg-background-secondary">
              <th className="px-4 py-2.5 text-left font-mono text-[10px] text-text-muted uppercase tracking-widest">
                Company / Role
              </th>
              <th className="hidden sm:table-cell px-4 py-2.5 text-left font-mono text-[10px] text-text-muted uppercase tracking-widest">
                ATS Score
              </th>
              <th className="px-4 py-2.5 text-left font-mono text-[10px] text-text-muted uppercase tracking-widest">
                Status
              </th>
              <th className="hidden md:table-cell px-4 py-2.5 text-left font-mono text-[10px] text-text-muted uppercase tracking-widest">
                Updated
              </th>
              <th className="px-4 py-2.5 w-10" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {APPLICATIONS.map((app, i) => (
              <ApplicationRow key={app.id} app={app} index={i} />
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}