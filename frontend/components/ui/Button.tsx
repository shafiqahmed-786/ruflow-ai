// frontend/components/ui/Button.tsx
import React        from "react";
import Link         from "next/link";
import { Loader2 }  from "lucide-react";
import { cn }       from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children:  React.ReactNode;
  variant?:  "primary" | "secondary" | "tertiary" | "ghost";
  size?:     "sm" | "md" | "lg";
  disabled?: boolean;
  loading?:  boolean;
  className?: string;
  /** When provided renders a Next.js Link instead of a <button> */
  href?:     string;
}

// ── Style maps ────────────────────────────────────────────────────────────────
const BASE =
  "inline-flex items-center justify-center gap-2 font-mono font-semibold " +
  "tracking-wide rounded-md border transition-all duration-200 " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-accent " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

const VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-accent border-transparent text-white " +
    "hover:bg-accent-muted shadow-lg shadow-accent-glow/30 " +
    "active:scale-[.98]",

  secondary:
    "bg-surface border-border text-text-primary " +
    "hover:border-border-strong hover:bg-surface-raised " +
    "active:scale-[.98]",

  tertiary:
    "bg-transparent border-border text-text-secondary " +
    "hover:border-border-strong hover:text-text-primary " +
    "active:scale-[.98]",

  ghost:
    "bg-transparent border-transparent text-text-muted " +
    "hover:text-text-primary hover:bg-surface " +
    "active:scale-[.98]",
};

const SIZES: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm:  "px-3 py-1.5 text-[11px] h-7",
  md:  "px-4 py-2   text-xs     h-9",
  lg:  "px-6 py-3   text-sm     h-11",
};

// ── Shared inner content ──────────────────────────────────────────────────────
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
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant  = "primary",
      size     = "md",
      disabled = false,
      loading  = false,
      className,
      href,
      type     = "button",
      onClick,
      ...rest
    },
    ref
  ) => {
    const classes = cn(BASE, VARIANTS[variant], SIZES[size], className);
    const isDisabled = disabled || loading;

    // ── Link variant ──────────────────────────────────────────────────────────
    if (href && !isDisabled) {
      return (
        <Link href={href} className={classes} onClick={onClick}>
          <ButtonContent loading={loading}>{children}</ButtonContent>
        </Link>
      );
    }

    // ── Button variant ────────────────────────────────────────────────────────
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
        <ButtonContent loading={loading}>{children}</ButtonContent>
      </button>
    );
  }
);

Button.displayName = "Button";