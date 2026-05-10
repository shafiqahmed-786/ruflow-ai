// frontend/components/ui/GlassCard.tsx
import React from "react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children:   React.ReactNode;
  className?: string;
  /** Adds a subtle emerald glow border on dark surfaces */
  glow?:      boolean;
  /** Enables scale + shadow on hover */
  hover?:     boolean;
  /** Surface depth variant */
  variant?:   "default" | "secondary";
}

// ── Base styles ───────────────────────────────────────────────────────────────
const BASE =
  "relative rounded-lg border transition-all duration-300";

const VARIANTS: Record<NonNullable<GlassCardProps["variant"]>, string> = {
  default:
    "bg-surface border-border shadow-card-dark",
  secondary:
    "bg-background-secondary border-border",
};

const HOVER =
  "hover:scale-[1.02] hover:shadow-elevated hover:border-border-strong cursor-pointer";

const GLOW =
  "hover:border-accent/40 hover:shadow-accent-glow";

// ── Component ─────────────────────────────────────────────────────────────────
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      className,
      glow    = false,
      hover   = false,
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
          glow  && GLOW,
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