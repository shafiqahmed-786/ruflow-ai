"use client";

// frontend/components/landing/Footer.tsx
import Link from "next/link";
import { Github, Twitter, Linkedin, Zap } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FooterLink {
  label: string;
  href:  string;
}

interface FooterSection {
  heading: string;
  links:   FooterLink[];
}

interface SocialLink {
  label: string;
  href:  string;
  icon:  React.ElementType;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const FOOTER_SECTIONS: FooterSection[] = [
  {
    heading: "Company",
    links: [
      { label: "About",    href: "/about"   },
      { label: "Blog",     href: "/blog"    },
      { label: "Careers",  href: "/careers" },
      { label: "Contact",  href: "/contact" },
    ],
  },
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing",  href: "/pricing"  },
      { label: "Docs",     href: "/docs"     },
      { label: "API",      href: "/api"      },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy",  href: "/privacy"  },
      { label: "Terms",    href: "/terms"    },
      { label: "Security", href: "/security" },
    ],
  },
];

const SOCIAL_LINKS: SocialLink[] = [
  { label: "Twitter",  href: "https://twitter.com",  icon: Twitter  },
  { label: "GitHub",   href: "https://github.com",   icon: Github   },
  { label: "LinkedIn", href: "https://linkedin.com", icon: Linkedin },
];

// ── Sub-components ────────────────────────────────────────────────────────────
function FooterLinkItem({ link }: { link: FooterLink }) {
  return (
    <li>
      <Link
        href={link.href}
        className="font-mono text-xs text-[#888888] hover:text-[#e0e0e0]
                   transition-colors duration-150"
      >
        {link.label}
      </Link>
    </li>
  );
}

function FooterSectionBlock({ section }: { section: FooterSection }) {
  return (
    <div>
      <p className="font-mono text-[10px] text-[#e0e0e0] uppercase tracking-widest mb-4">
        {section.heading}
      </p>
      <ul className="space-y-2.5">
        {section.links.map((link) => (
          <FooterLinkItem key={link.label} link={link} />
        ))}
      </ul>
    </div>
  );
}

function SocialButton({ social }: { social: SocialLink }) {
  const Icon = social.icon;
  return (
    <a
      href={social.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={social.label}
      className="flex items-center justify-center w-8 h-8 rounded-md
                 border border-[#252d48] bg-[#141829] text-[#888888]
                 hover:text-[#e0e0e0] hover:border-zinc-600
                 transition-colors duration-150"
    >
      <Icon className="h-3.5 w-3.5" />
    </a>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function Footer() {
  return (
    <footer className="border-t border-[#252d48] bg-[#0a0e27] px-6 pt-16 pb-8">
      <div className="max-w-7xl mx-auto">

        {/* Top grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

          {/* Brand column */}
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center gap-2">
              <div
                className="flex items-center justify-center w-7 h-7 rounded-md
                           bg-[#10a37f]/15 border border-[#10a37f]/30"
              >
                <Zap className="h-3.5 w-3.5 text-[#10a37f]" />
              </div>
              <span className="font-mono text-sm font-bold text-[#e0e0e0] tracking-wider">
                RUFLOW
              </span>
            </Link>

            <p className="font-mono text-xs text-[#888888] leading-relaxed max-w-[200px]">
              Multi-agent AI infrastructure for job application intelligence.
            </p>

            <div className="flex items-center gap-2">
              {SOCIAL_LINKS.map((social) => (
                <SocialButton key={social.label} social={social} />
              ))}
            </div>
          </div>

          {/* Link sections */}
          {FOOTER_SECTIONS.map((section) => (
            <FooterSectionBlock key={section.heading} section={section} />
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-[#252d48] pt-6 flex flex-col sm:flex-row
                        items-center justify-between gap-3">
          <p className="font-mono text-[10px] text-[#888888]">
            © {new Date().getFullYear()} RuFlow. All rights reserved.
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10a37f]" />
            <span className="font-mono text-[10px] text-[#888888]">
              All systems operational
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
}