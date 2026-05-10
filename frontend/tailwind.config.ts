// frontend/tailwind.config.ts

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        mono:    ["var(--font-mono)", "JetBrains Mono", "Fira Code", "monospace"],
        sans:    ["var(--font-sans)", "IBM Plex Sans", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "IBM Plex Mono", "monospace"],
      },
      colors: {
        // Base zinc palette
        surface: {
          DEFAULT: "#09090b",
          50:      "#fafafa",
          100:     "#f4f4f5",
          900:     "#18181b",
          950:     "#09090b",
        },
        panel: {
          DEFAULT: "#111113",
          border:  "#27272a",
          hover:   "#1c1c1f",
        },
        // Accent system
        emerald: {
          DEFAULT: "#10b981",
          dim:     "#064e3b",
          glow:    "#059669",
        },
        amber: {
          DEFAULT: "#f59e0b",
          dim:     "#451a03",
          glow:    "#d97706",
        },
        rose: {
          DEFAULT: "#f43f5e",
          dim:     "#4c0519",
          glow:    "#e11d48",
        },
        // Data / UI chrome
        chrome: {
          muted:   "#52525b",
          DEFAULT: "#71717a",
          bright:  "#a1a1aa",
        },
      },
      backgroundImage: {
        "grid-zinc": `linear-gradient(rgba(39,39,42,.4) 1px, transparent 1px),
                       linear-gradient(90deg, rgba(39,39,42,.4) 1px, transparent 1px)`,
        "scanline":  `repeating-linear-gradient(0deg, transparent, transparent 2px,
                       rgba(0,0,0,.08) 2px, rgba(0,0,0,.08) 4px)`,
      },
      backgroundSize: {
        "grid-sm": "24px 24px",
        "grid-md": "40px 40px",
      },
      boxShadow: {
        "emerald-glow": "0 0 12px rgba(16,185,129,.35), 0 0 32px rgba(16,185,129,.15)",
        "amber-glow":   "0 0 12px rgba(245,158,11,.35), 0 0 32px rgba(245,158,11,.15)",
        "rose-glow":    "0 0 12px rgba(244,63,94,.35), 0 0 32px rgba(244,63,94,.15)",
        "panel":        "0 0 0 1px rgba(39,39,42,.8), 0 4px 24px rgba(0,0,0,.4)",
        "panel-hover":  "0 0 0 1px rgba(63,63,70,.9), 0 8px 32px rgba(0,0,0,.5)",
      },
      animation: {
        "pulse-slow":   "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "scan":         "scan 2s linear infinite",
        "blink":        "blink .8s step-end infinite",
        "slide-up":     "slideUp .3s ease-out",
        "fade-in":      "fadeIn .4s ease-out",
        "shimmer":      "shimmer 1.5s ease-in-out infinite",
      },
      keyframes: {
        scan: {
          "0%":   { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        blink: {
          "50%": { opacity: "0" },
        },
        slideUp: {
          "0%":   { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)",    opacity: "1" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition:  "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;