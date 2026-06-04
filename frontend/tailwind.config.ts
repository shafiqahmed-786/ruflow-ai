// frontend/tailwind.config.ts

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./providers/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  darkMode: "class",

  theme: {
    extend: {
      // ── Semantic Design Tokens ────────────────────────────────────────────
      colors: {
        background:             "var(--bg)",
        "background-secondary": "var(--bg-secondary)",

        surface:                "var(--surface)",
        "surface-raised":       "var(--surface-raised)",

        border:                 "var(--border)",
        "border-strong":        "var(--border-strong)",

        accent:                 "var(--accent)",
        "accent-muted":         "var(--accent-muted)",
        "accent-subtle":        "var(--accent-subtle)",

        "text-primary":         "var(--text-primary)",
        "text-secondary":       "var(--text-secondary)",
        "text-muted":           "var(--text-muted)",
        "text-accent":          "var(--text-accent)",

        amber:                  "var(--amber)",
        "amber-subtle":         "var(--amber-subtle)",

        danger:                 "var(--danger)",
        "danger-subtle":        "var(--danger-subtle)",

        // Legacy support palettes
        panel: {
          DEFAULT: "#111113",
          border:  "#27272a",
          hover:   "#1c1c1f",
        },

        chrome: {
          muted:   "#52525b",
          DEFAULT: "#71717a",
          bright:  "#a1a1aa",
        },

        emerald: {
          DEFAULT: "#10b981",
          dim:     "#064e3b",
          glow:    "#059669",
        },

        rose: {
          DEFAULT: "#f43f5e",
          dim:     "#4c0519",
          glow:    "#e11d48",
        },
      },

      // ── Typography ───────────────────────────────────────────────────────
      fontFamily: {
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "Fira Code",
          "monospace",
        ],

        sans: [
          "var(--font-sans)",
          "IBM Plex Sans",
          "system-ui",
          "sans-serif",
        ],

        display: [
          "var(--font-display)",
          "IBM Plex Mono",
          "monospace",
        ],
      },

      // ── Radius ───────────────────────────────────────────────────────────
      borderRadius: {
        DEFAULT: "8px",
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
      },

      // ── Shadows ──────────────────────────────────────────────────────────
      boxShadow: {
        // Theme-aware semantic shadows
        card:         "var(--shadow-card)",
        elevated:     "var(--shadow-elevated)",
        "accent-glow":"var(--shadow-glow)",

        // Explicit utility shadows
        "card-light":
          "0 1px 2px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04)",

        "card-dark":
          "0 1px 3px rgba(0,0,0,.4), 0 4px 24px rgba(0,0,0,.28)",

        "elevated-light":
          "0 4px 12px rgba(0,0,0,.08), 0 1px 3px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04)",

        "panel":
          "0 0 0 1px rgba(39,39,42,.8), 0 4px 24px rgba(0,0,0,.4)",

        "panel-hover":
          "0 0 0 1px rgba(63,63,70,.9), 0 8px 32px rgba(0,0,0,.5)",

        "emerald-glow":
          "0 0 12px rgba(16,185,129,.35), 0 0 32px rgba(16,185,129,.15)",

        "amber-glow":
          "0 0 12px rgba(245,158,11,.35), 0 0 32px rgba(245,158,11,.15)",

        "rose-glow":
          "0 0 12px rgba(244,63,94,.35), 0 0 32px rgba(244,63,94,.15)",
      },

      // ── Layout ───────────────────────────────────────────────────────────
      maxWidth: {
        content: "1280px",
      },

      // ── Backgrounds ──────────────────────────────────────────────────────
      backgroundImage: {
        "grid-zinc": `
          linear-gradient(rgba(39,39,42,.4) 1px, transparent 1px),
          linear-gradient(90deg, rgba(39,39,42,.4) 1px, transparent 1px)
        `,

        "scanline": `
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,.08) 2px,
            rgba(0,0,0,.08) 4px
          )
        `,
      },

      backgroundSize: {
        "grid-sm": "24px 24px",
        "grid-md": "40px 40px",
      },

      // ── Animations ───────────────────────────────────────────────────────
      animation: {
        "pulse-slow":
          "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",

        "scan":
          "scan 2s linear infinite",

        "blink":
          "blink .8s step-end infinite",

        "slide-up":
          "slideUp .3s ease-out",

        "fade-in":
          "fadeIn .4s ease-out",

        "shimmer":
          "shimmer 1.5s ease-in-out infinite",
      },

      // ── Keyframes ────────────────────────────────────────────────────────
      keyframes: {
        scan: {
          "0%": {
            transform: "translateY(-100%)",
          },

          "100%": {
            transform: "translateY(100%)",
          },
        },

        blink: {
          "50%": {
            opacity: "0",
          },
        },

        slideUp: {
          "0%": {
            transform: "translateY(8px)",
            opacity: "0",
          },

          "100%": {
            transform: "translateY(0)",
            opacity: "1",
          },
        },

        fadeIn: {
          "0%": {
            opacity: "0",
          },

          "100%": {
            opacity: "1",
          },
        },

        shimmer: {
          "0%": {
            backgroundPosition: "-200% 0",
          },

          "100%": {
            backgroundPosition: "200% 0",
          },
        },
      },
    },
  },

  plugins: [],
};

export default config;