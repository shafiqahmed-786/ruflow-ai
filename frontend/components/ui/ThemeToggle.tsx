"use client";

// frontend/components/ui/ThemeToggle.tsx
import { useState, useEffect } from "react";
import { useTheme }            from "next-themes";
import { Sun, Moon }           from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Hydration-safe theme toggle.
 *
 * Returns null until mounted === true so the server-rendered HTML and the
 * first client paint are identical — no icon flicker, no hydration mismatch.
 *
 * Uses:
 *   - next-themes `useTheme` for theme state
 *   - lucide-react Sun / Moon icons (no inline SVG)
 *   - Semantic Tailwind classes (bg-surface, border-border, etc.)
 *   - framer-motion for icon swap animation
 */
export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme }   = useTheme();

  // Only run on the client — prevents hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Render nothing on the server / first paint
  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        className="w-8 h-8 rounded-md border border-border bg-surface"
      />
    );
  }

  const isDark  = theme === "dark";
  const label   = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className="relative flex items-center justify-center
                 w-8 h-8 rounded-md
                 border border-border bg-surface
                 text-text-muted hover:text-text-primary
                 hover:border-border-strong hover:bg-surface-raised
                 focus-visible:outline focus-visible:outline-2
                 focus-visible:outline-offset-2 focus-visible:outline-accent
                 transition-colors duration-150"
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="moon"
            initial={{ opacity: 0, rotate: -30, scale: 0.8 }}
            animate={{ opacity: 1, rotate:   0, scale: 1.0 }}
            exit={{    opacity: 0, rotate:  30, scale: 0.8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Moon className="h-3.5 w-3.5" />
          </motion.span>
        ) : (
          <motion.span
            key="sun"
            initial={{ opacity: 0, rotate:  30, scale: 0.8 }}
            animate={{ opacity: 1, rotate:   0, scale: 1.0 }}
            exit={{    opacity: 0, rotate: -30, scale: 0.8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Sun className="h-3.5 w-3.5" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}