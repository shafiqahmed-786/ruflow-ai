// frontend/components/ui/Button.tsx

import React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;

  variant?: "primary" | "secondary" | "tertiary" | "ghost";

  size?: "sm" | "md" | "lg";

  disabled?: boolean;

  loading?: boolean;

  className?: string;

  /** Renders a Next.js Link instead of <button> */
  href?: string;
}

// ── Base styles ───────────────────────────────────────────────────────────────

const BASE =
  [
    "inline-flex items-center justify-center gap-2",
    "font-mono font-semibold tracking-wide",
    "rounded-md border",
    "transition-all duration-200",
    "focus-visible:outline",
    "focus-visible:outline-2",
    "focus-visible:outline-offset-2",
    "focus-visible:outline-accent",
    "disabled:opacity-50",
    "disabled:cursor-not-allowed",
    "disabled:pointer-events-none",
    "select-none",
  ].join(" ");

// ── Variant styles ────────────────────────────────────────────────────────────

const VARIANTS: Record<
  NonNullable<ButtonProps["variant"]>,
  string
> = {
  // ── Primary ────────────────────────────────────────────────────────────────
  primary:
    [
      "bg-accent",
      "border-transparent",
      "text-white",

      // Softer premium hover
      "hover:bg-accent-muted",

      // Light mode:
      // elegant soft shadow
      //
      // Dark mode:
      // accent glow depth
      "shadow-[0_1px_4px_rgba(0,0,0,.15)]",
      "hover:shadow-[0_2px_8px_rgba(0,0,0,.18)]",

      "dark:hover:shadow-accent-glow",

      "active:scale-[.98]",
    ].join(" "),

  // ── Secondary ─────────────────────────────────────────────────────────────
  secondary:
    [
      // Slightly lifted surface for light mode layering
      "bg-surface-raised",

      // Stronger but still elegant border
      "border-border-strong",

      "text-text-primary",

      // Premium soft hover
      "hover:bg-surface",
      "hover:border-border-strong",
      "hover:text-text-primary",

      // Subtle elevation
      "shadow-[0_1px_2px_rgba(0,0,0,.06)]",
      "hover:shadow-[0_2px_6px_rgba(0,0,0,.09)]",

      "active:scale-[.98]",
    ].join(" "),

  // ── Tertiary ──────────────────────────────────────────────────────────────
  tertiary:
    [
      "bg-transparent",

      "border-border",

      "text-text-secondary",

      "hover:border-border-strong",
      "hover:text-text-primary",

      "active:scale-[.98]",
    ].join(" "),

  // ── Ghost ─────────────────────────────────────────────────────────────────
  ghost:
    [
      "bg-transparent",

      "border-transparent",

      "text-text-muted",

      // Softer hover for premium light mode feel
      "hover:text-text-primary",
      "hover:bg-surface-raised",

      "active:scale-[.98]",
    ].join(" "),
};

// ── Sizes ─────────────────────────────────────────────────────────────────────

const SIZES: Record<
  NonNullable<ButtonProps["size"]>,
  string
> = {
  sm: "px-3 py-1.5 text-[11px] h-7",

  md: "px-4 py-2 text-xs h-9",

  lg: "px-6 py-3 text-sm h-11",
};

// ── Shared content ────────────────────────────────────────────────────────────

function ButtonContent({
  loading,
  children,
}: {
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      {loading && (
        <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
      )}

      {children}
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export const Button = React.forwardRef<
  HTMLButtonElement,
  ButtonProps
>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      disabled = false,
      loading = false,
      className,
      href,
      type = "button",
      onClick,
      ...rest
    },
    ref
  ) => {
    const classes = cn(
      BASE,
      VARIANTS[variant],
      SIZES[size],
      className
    );

    const isDisabled = disabled || loading;

    // ── Link mode ───────────────────────────────────────────────────────────
    if (href && !isDisabled) {
      return (
        <Link
          href={href}
          className={classes}
          onClick={onClick}
        >
          <ButtonContent loading={loading}>
            {children}
          </ButtonContent>
        </Link>
      );
    }

    // ── Button mode ─────────────────────────────────────────────────────────
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        onClick={onClick}
        className={classes}
        aria-disabled={isDisabled}
        {...rest}
      >
        <ButtonContent loading={loading}>
          {children}
        </ButtonContent>
      </button>
    );
  }
);

Button.displayName = "Button";