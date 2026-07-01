"use client";

// frontend/components/dashboard/Topbar.tsx
import { Bell, ChevronRight, Menu, User } from "lucide-react";
import { ThemeToggle }  from "@/components/ui/ThemeToggle";
import { useSidebar }   from "@/components/dashboard/Sidebar";
import { cn }           from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TopbarProps {
  title?:    string;
  subtitle?: string;
}

// ── Main component ─────────────────────────────────────────────────────────────
export function Topbar({ title = "Overview", subtitle }: TopbarProps) {
  const { toggle } = useSidebar();

  return (
    <header
      className={cn(
        "sticky top-0 z-30",
        "flex items-center justify-between",
        "h-14 px-5",
        "border-b border-border",
        "bg-background/95 backdrop-blur-xl",
      )}
    >
      {/* Left — mobile menu + breadcrumb */}
      <div className="flex items-center gap-3">
        {/* Mobile sidebar toggle */}
        <button
          type="button"
          onClick={toggle}
          aria-label="Toggle navigation"
          className={cn(
            "md:hidden flex items-center justify-center w-8 h-8 rounded-md",
            "border border-border bg-surface",
            "text-text-muted hover:text-text-primary hover:border-border-strong",
            "transition-colors duration-150",
            "focus-visible:outline focus-visible:outline-2",
            "focus-visible:outline-offset-2 focus-visible:outline-accent",
          )}
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-text-muted hidden sm:block">
            CareerOS
          </span>
          <ChevronRight
            className="h-3 w-3 text-text-muted hidden sm:block"
            aria-hidden="true"
          />
          <span className="font-mono text-[11px] font-semibold text-text-primary">
            {title}
          </span>
          {subtitle && (
            <>
              <ChevronRight className="h-3 w-3 text-text-muted" aria-hidden="true" />
              <span className="font-mono text-[11px] text-text-muted">{subtitle}</span>
            </>
          )}
        </nav>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-2">
        <ThemeToggle />

        {/* Notifications */}
        <button
          type="button"
          aria-label="View notifications"
          className={cn(
            "relative flex items-center justify-center w-8 h-8 rounded-md",
            "border border-border bg-surface",
            "text-text-muted hover:text-text-primary hover:border-border-strong",
            "transition-colors duration-150",
            "focus-visible:outline focus-visible:outline-2",
            "focus-visible:outline-offset-2 focus-visible:outline-accent",
          )}
        >
          <Bell className="h-3.5 w-3.5" aria-hidden="true" />
          {/* Notification dot */}
          <span
            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent"
            aria-hidden="true"
          />
        </button>

        {/* User avatar placeholder */}
        <button
          type="button"
          aria-label="Open user menu"
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full",
            "border border-border bg-surface-raised",
            "text-text-muted hover:text-text-primary hover:border-border-strong",
            "transition-colors duration-150",
            "focus-visible:outline focus-visible:outline-2",
            "focus-visible:outline-offset-2 focus-visible:outline-accent",
          )}
        >
          <User className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}