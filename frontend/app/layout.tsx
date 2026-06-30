// frontend/app/layout.tsx — CareerOS AI
import type { Metadata }      from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { ThemeProvider }      from "@/providers/ThemeProvider";
import "./globals.css";

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

export const metadata: Metadata = {
  title: {
    default:  "CareerOS AI — Job Application Command Centre",
    template: "%s · CareerOS AI",
  },
  description:
    "CareerOS AI — the complete AI-powered job search command centre. " +
    "Track applications, prepare for interviews, research companies, manage recruiter relationships, and optimize resumes with a multi-agent pipeline.",
  keywords: [
    "AI career platform",
    "AI resume optimizer",
    "ATS score checker",
    "multi-agent AI",
    "job application tracker",
    "interview preparation AI",
    "recruiter CRM",
    "offer tracker",
    "CareerOS AI",
  ],
  openGraph: {
    title:       "CareerOS AI — Job Application Command Centre",
    description: "Complete AI-powered career management platform with multi-agent intelligence.",
    type:        "website",
    siteName:    "CareerOS AI",
  },
  twitter: {
    card:        "summary_large_image",
    title:       "CareerOS AI — Job Application Command Centre",
    description: "Complete AI-powered career management with multi-agent intelligence.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={` ${ibmPlexSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
