"use client";

// frontend/app/dashboard/copilot/page.tsx — AI Copilot (wired to backend)
import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Send, Sparkles, Zap, FileText, Building2,
  Target, BarChart3, Mail, TrendingUp, RefreshCw, AlertCircle
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { copilotChat } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: string;
  agent?: string;
  error?: boolean;
}

interface QuickPrompt {
  id: string; label: string; prompt: string; icon: React.ElementType;
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
    content: "Hi! I am your CareerOS AI Copilot, powered by the full 8-agent pipeline.\n\nI can help you:\n• Tailor your resume to any job description\n• Research companies, culture, and interview patterns\n• Write recruiter outreach and follow-up emails\n• Prepare you for interviews with role-specific questions\n• Compare offers and negotiate smarter\n• Analyze your application history for patterns\n\nWhat would you like to work on?",
    ts: "Now",
    agent: "System",
  },
];

function FadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isAssistant = msg.role === "assistant";
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      className={cn("flex", isAssistant ? "justify-start" : "justify-end")}>
      <div className={cn(
        "max-w-[82%] rounded-lg px-4 py-3",
        isAssistant
          ? msg.error ? "bg-danger-subtle border border-danger/30" : "bg-surface border border-border"
          : "bg-accent-subtle border border-accent/30"
      )}>
        {isAssistant && (
          <div className="flex items-center gap-1.5 mb-2">
            {msg.error ? <AlertCircle className="h-3 w-3 text-danger" /> : <Zap className="h-3 w-3 text-text-accent" />}
            <span className={cn("font-mono text-[9px] uppercase tracking-widest", msg.error ? "text-danger" : "text-text-accent")}>
              {msg.agent ?? "CareerOS Copilot"}
            </span>
          </div>
        )}
        <p className="font-mono text-xs leading-relaxed whitespace-pre-line text-text-secondary">{msg.content}</p>
        <p className="font-mono text-[9px] text-text-muted mt-1.5 text-right">{msg.ts}</p>
      </div>
    </motion.div>
  );
}

const USER_ID = "demo-user";

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<Array<{ role: string; content: string }>>([]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 80);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: Message = { id: `m${Date.now()}`, role: "user", content: text.trim(), ts: now };

    setMessages(prev => [...prev, userMsg]);
    historyRef.current = [...historyRef.current, { role: "user", content: text.trim() }];
    setInput("");
    setLoading(true);
    scrollToBottom();

    try {
      const data = await copilotChat({
        user_id: USER_ID,
        message: text.trim(),
        history: historyRef.current.slice(-6), // keep last 6 turns for context
      });

      const assistantMsg: Message = {
        id: `m${Date.now() + 1}`,
        role: "assistant",
        content: data.response,
        ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        agent: data.agent_used,
      };
      setMessages(prev => [...prev, assistantMsg]);
      historyRef.current = [...historyRef.current, { role: "assistant", content: data.response }];
    } catch (err) {
      const errMsg: Message = {
        id: `m${Date.now() + 1}`,
        role: "assistant",
        content: "Backend is not reachable. Make sure the CareerOS API server is running on port 8080.",
        ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        error: true,
        agent: "System",
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [loading, scrollToBottom]);

  return (
    <div className="max-w-[1280px] space-y-5">
      <FadeUp>
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">AI Copilot</h1>
          <p className="font-mono text-xs text-text-muted mt-1">
            Intelligent career assistant — routes through the full 8-agent pipeline.
          </p>
        </div>
      </FadeUp>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5" style={{ height: "600px" }}>
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

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
              {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center gap-2">
                    {[0, 0.15, 0.3].map((delay, i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: `${delay}s` }} />
                    ))}
                    <span className="font-mono text-[10px] text-text-muted ml-1">Pipeline running...</span>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="flex-shrink-0 px-4 py-3 border-t border-border">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                  placeholder="Ask anything about your job search..."
                  disabled={loading}
                  className={cn(
                    "flex-1 bg-background-secondary border border-border rounded-lg",
                    "px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-muted",
                    "focus:outline-none focus:border-accent/50 disabled:opacity-50 transition-colors duration-150"
                  )}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-lg border transition-all duration-150 flex-shrink-0",
                    input.trim() && !loading
                      ? "bg-accent-subtle border-accent/30 text-text-accent hover:border-accent/60"
                      : "border-border text-text-muted cursor-not-allowed opacity-50"
                  )}
                  aria-label="Send message"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="font-mono text-[9px] text-text-muted mt-1.5">Enter to send · Routes through Planner → JD Analyzer → Retrieval → Synthesis</p>
            </div>
          </GlassCard>
        </FadeUp>

        <FadeUp delay={0.1} className="h-full">
          <GlassCard className="p-4 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-4 flex-shrink-0">
              <Zap className="h-4 w-4 text-text-accent" />
              <h3 className="font-mono text-sm font-semibold text-text-primary">Quick Actions</h3>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto">
              {QUICK_PROMPTS.map((qp, i) => {
                const Icon = qp.icon;
                return (
                  <motion.button
                    key={qp.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: 0.12 + i * 0.04 }}
                    onClick={() => sendMessage(qp.prompt)}
                    disabled={loading}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left",
                      "border border-border bg-background-secondary",
                      "hover:border-accent/30 hover:bg-accent-subtle",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "transition-all duration-150 group"
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
            <div className="mt-3 pt-3 border-t border-border flex-shrink-0">
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
