
"use client";

// frontend/components/landing/Navigation.tsx
import { useState, useEffect, useRef } from "react";
import Link                            from "next/link";
import { motion, AnimatePresence }     from "framer-motion";
import { Menu, X, Github, Zap }        from "lucide-react";
import { ThemeToggle }                 from "@/components/ui/ThemeToggle";
import { Button }                      from "@/components/ui/Button";
import { cn }                          from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface NavItem {
  label: string;
  href:  string;
}

// ── Data ──────────────────────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  { label: "Features",  href: "#features"  },
  { label: "Agents",    href: "#agents"    },
  { label: "Pipeline",  href: "#pipeline"  },
  { label: "Insights",  href: "#insights"  },
  { label: "Dashboard", href: "/dashboard" },
];

// ── Desktop nav link ──────────────────────────────────────────────────────────
function NavLink({ item }: { item: NavItem }) {
  const isAnchor = item.href.startsWith("#");
  const cls =
    "relative font-mono text-xs text-text-muted tracking-wide " +
    "hover:text-text-primary transition-colors duration-150 " +
    "after:absolute after:bottom-[-2px] after:left-0 after:h-px after:w-0 " +
    "after:bg-accent after:transition-[width] after:duration-200 " +
    "hover:after:w-full";

  return isAnchor ? (
    <a href={item.href} className={cls}>{item.label}</a>
  ) : (
    <Link href={item.href} className={cls}>{item.label}</Link>
  );
}

// ── Mobile nav link ───────────────────────────────────────────────────────────
function MobileNavLink({ item, onClose }: { item: NavItem; onClose: () => void }) {
  const isAnchor = item.href.startsWith("#");
  const cls =
    "block w-full px-4 py-3 font-mono text-sm text-text-secondary " +
    "hover:text-text-primary hover:bg-surface-raised " +
    "border-b border-border last:border-0 transition-colors duration-150";

  return isAnchor ? (
    <a href={item.href} className={cls} onClick={onClose}>{item.label}</a>
  ) : (
    <Link href={item.href} className={cls} onClick={onClose}>{item.label}</Link>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function Navigation() {
  const [isOpen,    setIsOpen]    = useState(false);
  const [scrolled,  setScrolled]  = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Scroll-based navbar opacity — threshold only, no per-pixel re-renders
  useEffect(() => {
    const onScroll = () => {
      const past = window.scrollY > 20;
      setScrolled((prev) => (prev !== past ? past : prev));
    };
    if (typeof window !== "undefined") {
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
    return () => {
      if (typeof window !== "undefined") window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Click-outside to close mobile menu
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (typeof window !== "undefined") {
      document.addEventListener("mousedown", onMouseDown);
    }
    return () => {
      if (typeof window !== "undefined") document.removeEventListener("mousedown", onMouseDown);
    };
  }, [isOpen]);

  const close = () => setIsOpen(false);

  return (
    <header
      ref={menuRef}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-border bg-background/95 backdrop-blur-md shadow-card-dark"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <div className="max-w-content mx-auto px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Link href="/" onClick={close} className="flex items-center gap-2.5 flex-shrink-0">
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-accent-subtle border border-accent/30">
                <Zap className="h-3.5 w-3.5 text-text-accent" />
              </div>
              <span className="font-mono text-sm font-bold text-text-primary tracking-widest">
                RUFLOW
              </span>
            </Link>
          </motion.div>

          {/* Desktop nav */}
          <motion.nav
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
            className="hidden md:flex items-center gap-7"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.label} item={item} />
            ))}
          </motion.nav>

          {/* Desktop right actions */}
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
            className="hidden md:flex items-center gap-2"
          >
            <ThemeToggle />

            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="flex items-center justify-center w-8 h-8 rounded-md border border-border bg-surface text-text-muted hover:text-text-primary hover:border-border-strong transition-colors duration-150"
            >
              <Github className="h-3.5 w-3.5" />
            </a>

            <Button href="/dashboard" variant="primary" size="sm">
              Start Building
            </Button>
          </motion.div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setIsOpen((p) => !p)}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-md border border-border bg-surface text-text-muted hover:text-text-primary transition-colors duration-150"
            aria-label={isOpen ? "Close menu" : "Open menu"}
          >
            {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="md:hidden absolute top-full left-0 right-0 z-40 border-b border-border bg-background shadow-card-dark"
          >
            <nav>
              {NAV_ITEMS.map((item) => (
                <MobileNavLink key={item.label} item={item} onClose={close} />
              ))}
            </nav>
            <div className="flex items-center justify-between gap-3 p-4 border-t border-border">
              <ThemeToggle />
              <Button href="/dashboard" variant="primary" size="sm" className="flex-1">
                Start Building
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
