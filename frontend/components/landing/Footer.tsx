"use client";

// frontend/components/landing/Footer.tsx
import Link               from "next/link";
import { Github, Twitter, Linkedin, Zap } from "lucide-react";
import { cn }             from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FooterLink {
  label: string;
  href:  string;
}

interface SocialLink {
  label: string;
  href:  string;
  icon:  React.ElementType;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const FOOTER_LINKS: Record<string, FooterLink[]> = {
  Product: [
    { label: "Features",  href: "#features"  },
    { label: "Agents",    href: "#agents"    },
    { label: "Pipeline",  href: "#pipeline"  },
    { label: "Dashboard", href: "/dashboard" },
  ],
  Resources: [
    { label: "Documentation", href: "/docs"      },
    { label: "Blog",          href: "/blog"      },
    { label: "Community",     href: "/community" },
  ],
  Company: [
    { label: "About",   href: "/about"   },
    { label: "Careers", href: "/careers" },
    { label: "Contact", href: "/contact" },
  ],
};

const SOCIAL_LINKS: SocialLink[] = [
  { label: "GitHub",   href: "https://github.com",   icon: Github   },
  { label: "Twitter",  href: "https://twitter.com",  icon: Twitter  },
  { label: "LinkedIn", href: "https://linkedin.com", icon: Linkedin },
];

// ── Sub-components ────────────────────────────────────────────────────────────
function FooterLink({ link }: { link: FooterLink }) {
  const isAnchor = link.href.startsWith("#");
  const cls      = "font-mono text-xs text-text-muted hover:text-text-primary transition-colors duration-150";

  return isAnchor ? (
    <a href={link.href} className={cls}>{link.label}</a>
  ) : (
    <Link href={link.href} className={cls}>{link.label}</Link>
  );
}

function SocialIcon({ social }: { social: SocialLink }) {
  const Icon = social.icon;
  return (
    <a
      href={social.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={social.label}
      className={cn(
        "flex items-center justify-center w-8 h-8 rounded-md",
        "border border-border bg-surface",
        "text-text-muted hover:text-text-primary hover:border-border-strong",
        "transition-colors duration-150",
        "focus-visible:outline focus-visible:outline-2",
        "focus-visible:outline-offset-2 focus-visible:outline-accent"
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
export function Footer() {
  return (
    <footer className="border-t border-border bg-background px-6 pt-14 pb-8">
      <div className="max-w-content mx-auto">

        {/* Top grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

          {/* Brand column */}
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-accent-subtle border border-accent/30">
                <Zap className="h-3.5 w-3.5 text-text-accent" aria-hidden="true" />
              </div>
              <span className="font-mono text-sm font-bold text-text-primary tracking-widest">
                RUFLOW
              </span>
            </Link>

            <p className="font-mono text-xs text-text-muted leading-relaxed max-w-[200px]">
              Multi-agent AI infrastructure for job application intelligence.
            </p>

            <div className="flex items-center gap-2">
              {SOCIAL_LINKS.map((s) => (
                <SocialIcon key={s.label} social={s} />
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <p className="font-mono text-[10px] text-text-primary uppercase tracking-widest mb-4">
                {heading}
              </p>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <FooterLink link={link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Hardcoded year — avoids new Date() hydration mismatch */}
          <p className="font-mono text-[10px] text-text-muted">
            © 2025 CareerOS AI. All rights reserved.
          </p>

          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />
            <span className="font-mono text-[10px] text-text-muted">
              All systems operational
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
}