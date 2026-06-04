// frontend/components/ui/GlassCard.tsx

import React from "react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface GlassCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;

  /** Adds subtle accent glow */
  glow?: boolean;

  /** Enables hover elevation */
  hover?: boolean;

  /** Surface hierarchy variant */
  variant?: "default" | "secondary";
}

// ── Base styles ───────────────────────────────────────────────────────────────

const BASE =
  // Uses semantic shadow token:
  // light → soft layered card
  // dark  → deep infrastructure elevation
  "relative rounded-lg border transition-all duration-300 shadow-card";

// ── Variants ──────────────────────────────────────────────────────────────────

const VARIANTS: Record<
  NonNullable<GlassCardProps["variant"]>,
  string
> = {
  default:
    // Light:
    // elevated white card
    // ultra-soft border
    //
    // Dark:
    // preserved deep navy surface
    "bg-surface border-border",

  secondary:
    "bg-background-secondary border-border",
};

// ── Hover states ──────────────────────────────────────────────────────────────

const HOVER =
  [
    "hover:shadow-elevated",
    "hover:border-border-strong",
    "hover:scale-[1.02]",
    "cursor-pointer",
  ].join(" ");

// ── Glow states ───────────────────────────────────────────────────────────────

const GLOW =
  [
    "hover:border-accent/40",
    "hover:shadow-accent-glow",
  ].join(" ");

// ── Component ─────────────────────────────────────────────────────────────────

export const GlassCard = React.forwardRef<
  HTMLDivElement,
  GlassCardProps
>(
  (
    {
      children,
      className,
      glow = false,
      hover = false,
      variant = "default",
      ...rest
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          BASE,
          VARIANTS[variant],
          hover && HOVER,
          glow && GLOW,
          className
        )}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";