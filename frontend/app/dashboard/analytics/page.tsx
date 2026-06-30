"use client";

// frontend/app/dashboard/analytics/page.tsx — ATS Analytics
import { motion } from "framer-motion";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, Target, Award, Activity } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

function FadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

const ATS_TREND = [
  { week: "W1", score: 71 }, { week: "W2", score: 76 }, { week: "W3", score: 79 },
  { week: "W4", score: 82 }, { week: "W5", score: 85 }, { week: "W6", score: 86.4 },
];

const FUNNEL_DATA = [
  { stage: "Applied", count: 24 }, { stage: "Screen", count: 14 },
  { stage: "Interview", count: 7 }, { stage: "Final", count: 3 }, { stage: "Offer", count: 1 },
];

const SCORE_BREAKDOWN = [
  { name: "Keyword Coverage",  value: 88, color: "#10a37f" },
  { name: "Relevance",         value: 84, color: "#22d3ee" },
  { name: "Impact",            value: 79, color: "#d97706" },
  { name: "Tone Match",        value: 91, color: "#a78bfa" },
];

const COLORS = ["#10a37f", "#22d3ee", "#d97706", "#a78bfa"];

export default function AnalyticsPage() {
  return (
    <div className="max-w-[1280px] space-y-5">
      <FadeUp>
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">ATS Analytics</h1>
          <p className="font-mono text-xs text-text-muted mt-1">
            Score trends, funnel conversion, and evaluation breakdowns across all applications.
          </p>
        </div>
      </FadeUp>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Avg ATS Score",   value: "86.4", icon: Target,     trend: "+15.4 since W1" },
          { label: "Best Score",      value: "94",   icon: Award,      trend: "Stripe app"     },
          { label: "Interview Rate",  value: "29%",  icon: TrendingUp, trend: "+8% this month"  },
          { label: "Pipeline Runs",   value: "31",   icon: Activity,   trend: "across 24 apps"  },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <FadeUp key={s.label} delay={i * 0.06}>
              <GlassCard className="p-4">
                <div className="flex items-start justify-between mb-2.5">
                  <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">{s.label}</span>
                  <Icon className="h-3.5 w-3.5 text-text-accent" />
                </div>
                <p className="font-mono text-2xl font-bold text-text-primary leading-none mb-1">{s.value}</p>
                <p className="font-mono text-[10px] text-text-accent">{s.trend}</p>
              </GlassCard>
            </FadeUp>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-5">
        {/* ATS Trend */}
        <FadeUp delay={0.1}>
          <GlassCard className="p-5">
            <h2 className="font-mono text-sm font-semibold text-text-primary mb-4">ATS Score Trend</h2>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <AreaChart data={ATS_TREND}>
                  <defs>
                    <linearGradient id="atsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10a37f" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10a37f" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#71717a", fontFamily: "monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
                  <YAxis domain={[60, 100]} tick={{ fontSize: 10, fill: "#71717a", fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#16161a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11, fontFamily: "monospace" }} />
                  <Area type="monotone" dataKey="score" stroke="#10a37f" strokeWidth={2} fill="url(#atsGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </FadeUp>

        {/* Score breakdown pie */}
        <FadeUp delay={0.14}>
          <GlassCard className="p-5">
            <h2 className="font-mono text-sm font-semibold text-text-primary mb-4">Latest Score Breakdown</h2>
            <div style={{ width: "100%", height: 180 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={SCORE_BREAKDOWN} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={3}>
                    {SCORE_BREAKDOWN.map((entry, i) => (
                      <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#16161a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11, fontFamily: "monospace" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 mt-2">
              {SCORE_BREAKDOWN.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i] }} />
                    <span className="font-mono text-[10px] text-text-muted">{item.name}</span>
                  </div>
                  <span className="font-mono text-[10px] text-text-secondary">{item.value}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </FadeUp>
      </div>

      {/* Funnel bar chart */}
      <FadeUp delay={0.18}>
        <GlassCard className="p-5">
          <h2 className="font-mono text-sm font-semibold text-text-primary mb-4">Application Funnel</h2>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={FUNNEL_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="stage" tick={{ fontSize: 10, fill: "#71717a", fontFamily: "monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#71717a", fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#16161a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11, fontFamily: "monospace" }} />
                <Bar dataKey="count" fill="#10a37f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </FadeUp>
    </div>
  );
}
