"use client";

// frontend/providers/ThemeProvider.tsx
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps }             from "next-themes";

/**
 * Thin wrapper around next-themes ThemeProvider.
 *
 * Placed in /providers so layout.tsx stays a pure Server Component
 * while theme state (client-only) is isolated here.
 *
 * Props forwarded verbatim to NextThemesProvider — callers can override
 * defaultTheme, storageKey, etc. without touching this file.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      disableTransitionOnChange={false}
      enableSystem={false}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}