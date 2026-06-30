"use client";

// frontend/app/dashboard/offers/page.tsx — Offer Tracker
import { motion } from "framer-motion";
import { Trophy, DollarSign, Clock, TrendingUp, CheckCircle, Zap } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

function FadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

interface Offer {
  id: string; company: string; role: string; base: string; equity: string;
  bonus: string; total: string; deadline: string; status: "Active" | "Accepted" | "Declined" | "Expired"; score: number;
}

const OFFERS: Offer[] = [
  { id: "o1", company: "Perplexity", role: "ML Platform Lead",       base: "$170k", equity: "0.12%", bonus: "$20k",  total: "$210k+", deadline: "Jul 5",  status: "Active",   score: 88 },
  { id: "o2", company: "Stripe",     role: "Staff Software Engineer", base: "$195k", equity: "0.08%", bonus: "$30k",  total: "$265k+", deadline: "Jul 10", status: "Active",   score: 92 },
  { id: "o3", company: "Cohere",     role: "Senior AI Eng",          base: "$150k", equity: "0.18%", bonus: "$15k",  total: "$195k+", deadline: "Jun 25", status: "Declined", score: 74 },
];

const STATUS_STYLE: Record<Offer["status"], string> = {
  Active:   "text-text-accent  bg-accent-subtle  border-accent/20",
  Accepted: "text-text-primary bg-surface-raised border-border-strong",
  Declined: "text-danger       bg-danger-subtle  border-danger/20",
  Expired:  "text-text-muted   bg-surface-raised border-border",
};

export default function OffersPage() {
  return (
    <div className="max-w-[1280px] space-y-5">
      <FadeUp>
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">Offer Tracker</h1>
          <p className="font-mono text-xs text-text-muted mt-1">Compare offers, track deadlines, and negotiate smarter with AI analysis.</p>
        </div>
      </FadeUp>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Active Offers", value: "2",     icon: Trophy    },
          { label: "Total Value",   value: "$475k+", icon: DollarSign},
          { label: "Avg Score",     value: "90",    icon: TrendingUp},
          { label: "Days Left",     value: "10",    icon: Clock     },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <FadeUp key={s.label} delay={i * 0.06}>
              <GlassCard className="p-4">
                <div className="flex items-start justify-between mb-2.5">
                  <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">{s.label}</span>
                  <Icon className="h-3.5 w-3.5 text-text-accent" />
                </div>
                <p className="font-mono text-2xl font-bold text-text-primary leading-none">{s.value}</p>
              </GlassCard>
            </FadeUp>
          );
        })}
      </div>

      <FadeUp delay={0.12}>
        <div className="space-y-4">
          {OFFERS.map((offer, i) => (
            <motion.div key={offer.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, delay: 0.14 + i * 0.08 }}>
              <GlassCard className={cn("p-5", offer.status === "Active" && "border-accent/20")} hover>
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-mono text-sm font-bold text-text-primary">{offer.company}</h3>
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full border font-mono text-[9px] font-semibold uppercase tracking-wider", STATUS_STYLE[offer.status])}>
                        {offer.status}
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-text-muted mb-3">{offer.role}</p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { label: "Base",    value: offer.base   },
                        { label: "Equity",  value: offer.equity },
                        { label: "Bonus",   value: offer.bonus  },
                        { label: "Total TC",value: offer.total  },
                      ].map((f) => (
                        <div key={f.label} className="rounded-lg border border-border bg-background-secondary p-2.5">
                          <p className="font-mono text-[9px] text-text-muted uppercase tracking-widest mb-1">{f.label}</p>
                          <p className="font-mono text-xs font-bold text-text-primary">{f.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-row lg:flex-col items-center gap-3 flex-shrink-0">
                    <div className="text-center">
                      <p className={cn("font-mono text-2xl font-bold", offer.score >= 85 ? "text-text-accent" : "text-amber")}>{offer.score}</p>
                      <p className="font-mono text-[9px] text-text-muted">AI Score</p>
                    </div>
                    {offer.status === "Active" && (
                      <div className="text-center">
                        <p className="font-mono text-xs text-danger font-semibold">{offer.deadline}</p>
                        <p className="font-mono text-[9px] text-text-muted">Deadline</p>
                      </div>
                    )}
                    <button className="flex items-center gap-1 font-mono text-[10px] text-text-accent hover:underline">
                      <Zap className="h-3 w-3" /> Analyze
                    </button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </FadeUp>

      <FadeUp delay={0.22}>
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-text-accent" />
            <h2 className="font-mono text-sm font-semibold text-text-primary">AI Offer Analysis</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[
              { title: "Perplexity vs Stripe",    insight: "Stripe's TC is 26% higher ($265k vs $210k). At a 2x growth trajectory, the equity gap favors Perplexity long-term if ML Platform Lead scales with company growth." },
              { title: "Negotiation Opportunity", insight: "Both offers have room: Stripe historically accepts counter-offers within 8% of base. Perplexity's equity may be negotiable by 20-30% for engineering leadership roles." },
            ].map((item, i) => (
              <div key={i} className="rounded-lg border border-border bg-background-secondary p-3.5">
                <p className="font-mono text-[10px] font-semibold text-text-accent mb-1.5">{item.title}</p>
                <p className="font-mono text-xs text-text-secondary leading-relaxed">{item.insight}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </FadeUp>
    </div>
  );
}
