"use client";

// frontend/components/dashboard/Sidebar.tsx
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import Link                    from "next/link";
import { usePathname }         from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Briefcase,
  GitMerge,
  BrainCircuit,
  LineChart,
  Settings,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface NavItem {
  label: string;
  href:  string;
  icon:  React.ElementType;
}

interface SidebarContextValue {
  isOpen:  boolean;
  open:    () => void;
  close:   () => void;
  toggle:  () => void;
}

// ── Navigation data ────────────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  { label: "Overview",       href: "/dashboard",              icon: LayoutDashboard },
  { label: "Applications",   href: "/dashboard/applications", icon: Briefcase       },
  { label: "AI Pipeline",    href: "/dashboard/pipeline",     icon: GitMerge        },
  { label: "Resume Memory",  href: "/dashboard/memory",       icon: BrainCircuit    },
  { label: "ATS Analytics",  href: "/dashboard/analytics",    icon: LineChart       },
  { label: "Settings",       href: "/dashboard/settings",     icon: Settings        },
];

// ── Context ───────────────────────────────────────────────────────────────────
const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open    = useCallback(() => setIsOpen(true),  []);
  const close   = useCallback(() => setIsOpen(false), []);
  const toggle  = useCallback(() => setIsOpen((p) => !p), []);

  return (
    <SidebarContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

// ── Nav link ──────────────────────────────────────────────────────────────────
function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;
  const Icon     = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-lg",
        "font-mono text-xs transition-all duration-150",
        "focus-visible:outline focus-visible:outline-2",
        "focus-visible:outline-offset-2 focus-visible:outline-accent",
        isActive
          ? "bg-accent-subtle border border-accent/25 text-text-accent"
          : "text-text-muted hover:text-text-primary hover:bg-surface-raised border border-transparent"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 flex-shrink-0 transition-colors duration-150",
          isActive ? "text-text-accent" : "text-text-muted group-hover:text-text-primary"
        )}
        aria-hidden="true"
      />
      {item.label}
      {isActive && (
        <span className="ml-auto w-1 h-1 rounded-full bg-accent flex-shrink-0" aria-hidden="true" />
      )}
    </Link>
  );
}

// ── Desktop sidebar ────────────────────────────────────────────────────────────
function DesktopSidebar() {
  return (
    <aside
      className={cn(
        "hidden md:flex flex-col w-56 flex-shrink-0",
        "border-r border-border bg-background",
        "h-screen sticky top-0 overflow-y-auto"
      )}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-accent-subtle border border-accent/30 flex-shrink-0">
          <Zap className="h-3.5 w-3.5 text-text-accent" aria-hidden="true" />
        </div>
        <span className="font-mono text-sm font-bold text-text-primary tracking-widest">
          RUFLOW
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Dashboard navigation">
        <p className="font-mono text-[9px] text-text-muted uppercase tracking-widest px-3 mb-3">
          Workspace
        </p>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border">
        <p className="font-mono text-[10px] text-text-muted">
          <span className="text-text-accent">●</span> All systems operational
        </p>
      </div>
    </aside>
  );
}

// ── Mobile sidebar drawer ──────────────────────────────────────────────────────
function MobileSidebar() {
  const { isOpen, close } = useSidebar();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.aside
            key="drawer"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={cn(
              "md:hidden fixed left-0 top-0 bottom-0 z-50",
              "w-64 flex flex-col",
              "border-r border-border bg-background shadow-card-dark"
            )}
            aria-label="Mobile navigation"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-5 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-accent-subtle border border-accent/30">
                  <Zap className="h-3.5 w-3.5 text-text-accent" aria-hidden="true" />
                </div>
                <span className="font-mono text-sm font-bold text-text-primary tracking-widest">
                  RUFLOW
                </span>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close navigation"
                className="flex items-center justify-center w-8 h-8 rounded-md border border-border text-text-muted hover:text-text-primary transition-colors duration-150"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.href} item={item} onClick={close} />
              ))}
            </nav>

            <div className="px-4 py-4 border-t border-border">
              <p className="font-mono text-[10px] text-text-muted">
                <span className="text-text-accent">●</span> All systems operational
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Exported compound component ────────────────────────────────────────────────
export function Sidebar() {
  return (
    <>
      <DesktopSidebar />
      <MobileSidebar />
    </>
  );
}