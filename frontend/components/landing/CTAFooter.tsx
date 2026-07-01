"use client";

// frontend/components/landing/CTAFooter.tsx
import { motion }    from "framer-motion";
import { ShieldCheck, Zap } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button }    from "@/components/ui/Button";

// ── Trust indicators ──────────────────────────────────────────────────────────
const TRUST_ITEMS = [
  "Free tier included",
  "No credit card required",
  "Cancel anytime",
];

// ── Section ───────────────────────────────────────────────────────────────────
export function CTAFooter() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <GlassCard glow className="relative overflow-hidden px-8 py-14 text-center">

            {/* Subtle radial glow accent behind content */}
            <div
              className="absolute inset-0 pointer-events-none"
              aria-hidden="true"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 0%, rgba(16,163,127,.08) 0%, transparent 65%)",
              }}
            />

            {/* Eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.4, delay: 0.08 }}
              className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/30 bg-accent-subtle mb-6"
            >
              <Zap className="h-3 w-3 text-text-accent" aria-hidden="true" />
              <span className="font-mono text-xs text-text-accent tracking-wider uppercase">
                Get Started Free
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.45, delay: 0.12 }}
              className="relative text-3xl sm:text-4xl xl:text-5xl font-bold text-text-primary tracking-tight leading-tight mb-4"
            >
              Build better applications{" "}
              <span className="text-text-accent">with autonomous AI.</span>
            </motion.h2>

            {/* Sub */}
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.4, delay: 0.18 }}
              className="relative text-text-secondary text-sm sm:text-base leading-relaxed max-w-lg mx-auto mb-10"
            >
              Eight autonomous agents collaborate to optimize every application.
              Get started in under 2 minutes — no setup required.
            </motion.p>

            {/* CTA buttons — using Button primitives exclusively */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.4, delay: 0.24 }}
              className="relative flex flex-col sm:flex-row items-center justify-center gap-3 mb-8"
            >
              <Button
                href="/dashboard"
                variant="primary"
                size="lg"
                className="w-full sm:w-auto"
              >
                Start Building
              </Button>

              <Button
                href="/dashboard/docs"
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto"
              >
                View Architecture
              </Button>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.4, delay: 0.32 }}
              className="relative flex flex-wrap items-center justify-center gap-4"
            >
              {TRUST_ITEMS.map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <ShieldCheck
                    className="h-3 w-3 text-text-accent flex-shrink-0"
                    aria-hidden="true"
                  />
                  <span className="font-mono text-[10px] text-text-muted">{item}</span>
                </div>
              ))}
            </motion.div>

          </GlassCard>
        </motion.div>
      </div>
    </section>
  );
}