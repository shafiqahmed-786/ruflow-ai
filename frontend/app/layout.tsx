// frontend/app/layout.tsx
// Server Component — layout only. No interactive logic here.
// ThemeProvider (client) wraps children to keep this file a pure Server Component.

import type { Metadata }      from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { ThemeProvider }      from "@/providers/ThemeProvider";
import "./globals.css";

// ── Fonts ──────────────────────────────────────────────────────────────────────
const ibmPlexSans = IBM_Plex_Sans({
  subsets:  ["latin"],
  weight:   ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display:  "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets:  ["latin"],
  weight:   ["400", "500", "600"],
  variable: "--font-mono",
  display:  "swap",
});

// ── Metadata ───────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: {
    default:  "RuFlow — AI-Powered Job Application Intelligence",
    template: "%s · RuFlow",
  },
  description:
    "Multi-agent AI system that optimizes resumes, generates cover letters, " +
    "scores ATS compatibility, and learns from your application history.",
  keywords: [
    "AI resume optimizer",
    "ATS score checker",
    "multi-agent AI",
    "job application AI",
    "cover letter generator",
  ],
  openGraph: {
    title:       "RuFlow — AI-Powered Job Application Intelligence",
    description: "Autonomous multi-agent system for ATS-optimized job applications.",
    type:        "website",
    siteName:    "RuFlow",
  },
  twitter: {
    card:        "summary_large_image",
    title:       "RuFlow — AI-Powered Job Application Intelligence",
    description: "Autonomous multi-agent system for ATS-optimized job applications.",
  },
};

// ── Root layout ────────────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      // next-themes will hydrate and manage the class after mount.
      className={` ${ibmPlexSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      {/*
        suppressHydrationWarning on <body> because next-themes injects a
        data-theme attribute client-side, which would otherwise cause a
        React hydration warning.
      */}
      <body suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}