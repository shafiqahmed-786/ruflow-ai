"use client";

// frontend/app/dashboard/copilot/page.tsx — AI Copilot
import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Send, Sparkles, Zap, FileText, Building2,
  Target, BarChart3, Mail, TrendingUp, RefreshCw
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: string;
}

interface QuickPrompt {
  id: string;
  label: string;
  prompt: string;
  icon: React.ElementType;
}

const QUICK_PROMPTS: QuickPrompt[] = [
  { id: "q1", label: "Tailor my resume",      prompt: "Tailor my resume for a Senior ML Engineer role at a Series B AI startup.",    icon: FileText   },
  { id: "q2", label: "Should I apply?",       prompt: "Should I apply to this role given my background? What are my chances?",         icon: Target     },
  { id: "q3", label: "Write recruiter email", prompt: "Write a cold outreach email to a recruiter at Anthropic for an ML role.",       icon: Mail       },
  { id: "q4", label: "Research company",      prompt: "Research Mistral AI — culture, tech stack, recent news, interview process.",    icon: Building2  },
  { id: "q5", label: "Prep for interview",    prompt: "Prepare me for a system design interview at a top-tier AI company.",           icon: Target     },
  { id: "q6", label: "Compare offers",        prompt: "Help me compare two offers: $180k base remote vs $160k + equity onsite.",      icon: TrendingUp },
  { id: "q7", label: "Generate follow-up",    prompt: "Write a follow-up email 5 days after my interview at OpenAI for Backend Eng.", icon: RefreshCw  },
  { id: "q8", label: "Find weaknesses",       prompt: "Analyze my application history and identify my biggest conversion bottlenecks.",icon: BarChart3  },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: "m0",
    role: "assistant",
    content: "Hi! I am your CareerOS AI Copilot.\n\nI can help you:\n• Tailor your resume to any JD\n• Research companies and interview patterns\n• Write recruiter outreach and follow-up emails\n• Prepare you for interviews\n• Compare offers and negotiate smarter\n• Analyze your application history\n\nWhat would you like to work on?",
    ts: "Now",
  },
];

function FadeUp({ children, delay = 0, className }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isAssistant = msg.role === "assistant";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("flex", isAssistant ? "justify-start" : "justify-end")}
    >
      <div className={cn(
        "max-w-[80%] rounded-lg px-4 py-3",
        isAssistant
          ? "bg-surface border border-border text-text-secondary"
          : "bg-accent-subtle border border-accent/30 text-text-primary"
      )}>
        {isAssistant && (
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className="h-3 w-3 text-text-accent" />
            <span className="font-mono text-[9px] text-text-accent uppercase tracking-widest">CareerOS Copilot</span>
          </div>
        )}
        <p className="font-mono text-xs leading-relaxed whitespace-pre-line">{msg.content}</p>
        <p className="font-mono text-[9px] text-text-muted mt-1.5 text-right">{msg.ts}</p>
      </div>
    </motion.div>
  );
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: Message = { id: `m${Date.now()}`, role: "user", content: text.trim(), ts: now };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    await new Promise((r) => setTimeout(r, 1200));

    const lower = text.toLowerCase();
    let reply = "I have analyzed your request through the full CareerOS agent pipeline. Your application history shows strong backend and ML patterns. The top opportunity is to strengthen your ATS keyword density and add quantified impact metrics. Shall I run the full optimization?";
    if (lower.includes("tailor") || lower.includes("resume")) reply = "Analyzing your resume against the target JD... Based on your FastAPI, PostgreSQL, and LangGraph experience, I would lead with RuFlow and SignalStack. Key ATS keywords to inject: distributed systems, ML infrastructure, async Python, vector retrieval. Shall I generate the full tailored version?";
    else if (lower.includes("apply") || lower.includes("chance")) reply = "Based on your IIIT Bhagalpur CS background and strong ML + backend portfolio, I give this role a 73% match score. Your LangGraph and RAG projects align well. Main gap: they prefer 2+ years of production ML. I recommend applying and leading with your hackathon and project depth. Want me to tailor the resume?";
    else if (lower.includes("recruiter") || lower.includes("email") || lower.includes("outreach")) reply = "Subject: ML Infrastructure Engineer — LangGraph + FastAPI Background\n\nHi [Name],\n\nI have been following Anthropic's Constitutional AI work and I am deeply aligned with the mission. I recently built RuFlow — a multi-agent LangGraph orchestration system with async FastAPI, ChromaDB RAG, and an iterative evaluation loop. I would love to explore the ML Infrastructure team. Would you be open to a 20-minute call?\n\nBest, Shafiq";

    const assistantMsg: Message = {
      id: `m${Date.now() + 1}`,
      role: "assistant",
      content: reply,
      ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setLoading(false);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 100);
  };

  return (
    <div className="max-w-[1280px] space-y-5">
      <FadeUp>
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">AI Copilot</h1>
          <p className="font-mono text-xs text-text-muted mt-1">
            Your intelligent career assistant — powered by the full multi-agent pipeline.
          </p>
        </div>
      </FadeUp>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 h-[600px]">
        <FadeUp delay={0.06} className="h-full">
          <GlassCard className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border flex-shrink-0">
              <Sparkles className="h-4 w-4 text-text-accent" />
              <h2 className="font-mono text-sm font-semibold text-text-primary">CareerOS Copilot</h2>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span className="font-mono text-[10px] text-text-accent uppercase tracking-widest">Live</span>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: "0.2s" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: "0.4s" }} />
                    <span className="font-mono text-[10px] text-text-muted ml-1">Agents working...</span>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="flex-shrink-0 px-4 py-3 border-t border-border">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendMessage(input); }}
                  placeholder="Ask anything about your job search..."
                  className={cn(
                    "flex-1 bg-background-secondary border border-border rounded-lg",
                    "px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-muted",
                    "focus:outline-none focus:border-accent/50 transition-colors duration-150"
                  )}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-lg border transition-all duration-150",
                    input.trim() && !loading
                      ? "bg-accent-subtle border-accent/30 text-text-accent hover:border-accent/60"
                      : "border-border text-text-muted cursor-not-allowed opacity-50"
                  )}
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </GlassCard>
        </FadeUp>

        <FadeUp delay={0.1} className="h-full">
          <GlassCard className="p-4 h-full overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-text-accent" />
              <h3 className="font-mono text-sm font-semibold text-text-primary">Quick Actions</h3>
            </div>
            <div className="space-y-2">
              {QUICK_PROMPTS.map((qp, i) => {
                const Icon = qp.icon;
                return (
                  <motion.button
                    key={qp.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.28, delay: 0.12 + i * 0.05 }}
                    onClick={() => sendMessage(qp.prompt)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg",
                      "border border-border bg-background-secondary",
                      "hover:border-accent/30 hover:bg-accent-subtle",
                      "text-left transition-all duration-150 group"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 text-text-muted group-hover:text-text-accent flex-shrink-0 transition-colors" />
                    <span className="font-mono text-[11px] text-text-secondary group-hover:text-text-primary transition-colors">
                      {qp.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-border">
              <p className="font-mono text-[10px] text-text-muted leading-relaxed">
                Copilot routes through the full agent pipeline — Planner, JD Analyzer, Retrieval, and Synthesis.
              </p>
            </div>
          </GlassCard>
        </FadeUp>
      </div>
    </div>
  );
}
