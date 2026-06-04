"use client";

// frontend/components/dashboard/TransitionOverlay.tsx
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useRouter }   from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Zap }         from "lucide-react";
import { cn }          from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TransitionContextValue {
  /** Call to trigger the full-screen transition, then navigate. */
  startTransition: (href: string) => void;
  isTransitioning: boolean;
}

// ── Context ───────────────────────────────────────────────────────────────────
const TransitionContext = createContext<TransitionContextValue | null>(null);

export function useTransitionOverlay(): TransitionContextValue {
  const ctx = useContext(TransitionContext);
  if (!ctx) throw new Error("useTransitionOverlay must be used within TransitionProvider");
  return ctx;
}

// ── Progress steps shown during transition ─────────────────────────────────────
const STEPS = [
  "Initialising agent pipeline…",
  "Loading retrieval memory…",
  "Connecting evaluation engine…",
  "Orchestration ready.",
];

// ── Overlay UI ─────────────────────────────────────────────────────────────────
function Overlay({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <motion.div
      key="transition-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center",
        "bg-background"
      )}
      aria-live="polite"
      aria-label="Loading AI pipeline"
    >
      {/* Subtle radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(16,163,127,.07) 0%, transparent 65%)",
        }}
      />

      {/* Logo mark */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative flex flex-col items-center gap-6"
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-xl border border-accent/30 bg-accent-subtle">
          <Zap className="h-5 w-5 text-text-accent" aria-hidden="true" />
        </div>

        <span className="font-mono text-xs font-bold text-text-primary tracking-widest uppercase">
          RUFLOW
        </span>

        {/* Progress bar */}
        <div className="w-48 h-px bg-border overflow-hidden rounded-full">
          <motion.div
            className="h-full bg-accent rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        {/* Step text */}
        <AnimatePresence mode="wait">
          <motion.p
            key={currentStep}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="font-mono text-[11px] text-text-muted tracking-wide"
          >
            {steps[currentStep] ?? steps[steps.length - 1]}
          </motion.p>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ── Provider ───────────────────────────────────────────────────────────────────
export function TransitionProvider({ children }: { children: ReactNode }) {
  const router                          = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentStep,     setCurrentStep]     = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTransition = useCallback(
    (href: string) => {
      if (isTransitioning) return;
      setIsTransitioning(true);
      setCurrentStep(0);

      // Advance through steps at ~380ms each
      STEPS.forEach((_, i) => {
        timerRef.current = setTimeout(
          () => setCurrentStep(i),
          i * 380
        );
      });

      // Navigate after all steps complete + short hold
      const totalMs = STEPS.length * 380 + 200;
      timerRef.current = setTimeout(() => {
        router.push(href);
        // Give Next.js a moment to load before clearing overlay
        setTimeout(() => {
          setIsTransitioning(false);
          setCurrentStep(0);
        }, 350);
      }, totalMs);
    },
    [isTransitioning, router]
  );

  return (
    <TransitionContext.Provider value={{ startTransition, isTransitioning }}>
      {children}
      <AnimatePresence>
        {isTransitioning && (
          <Overlay steps={STEPS} currentStep={currentStep} />
        )}
      </AnimatePresence>
    </TransitionContext.Provider>
  );
}