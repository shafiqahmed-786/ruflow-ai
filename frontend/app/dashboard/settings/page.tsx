"use client";

// frontend/app/dashboard/settings/page.tsx
import { useState } from "react";
import { motion }   from "framer-motion";
import {
  User, Brain, FileText, BarChart3, Bell,
  Key, Cpu, ChevronDown, Eye, EyeOff, Save, ShieldCheck,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button }    from "@/components/ui/Button";
import { cn }        from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface NavSection { id: string; label: string; icon: React.ElementType }
interface ToggleSetting { key: string; label: string; desc: string }
interface SelectOption  { value: string; label: string }

// ── Data ──────────────────────────────────────────────────────────────────────
const NAV_SECTIONS: NavSection[] = [
  { id: "profile",       label: "Profile",                icon: User        },
  { id: "ai",            label: "AI Preferences",         icon: Brain       },
  { id: "resume",        label: "Resume Defaults",        icon: FileText    },
  { id: "ats",           label: "ATS Strictness",         icon: BarChart3   },
  { id: "notifications", label: "Notifications",          icon: Bell        },
  { id: "apikeys",       label: "API Keys",               icon: Key         },
  { id: "llm",           label: "LLM Providers",          icon: Cpu         },
];

const AI_TOGGLES: ToggleSetting[] = [
  { key: "ats_opt",     label: "ATS Optimization",        desc: "Automatically inject ATS keywords into every resume"   },
  { key: "cover_auto",  label: "Auto Cover Letter",       desc: "Generate cover letter on every pipeline run"           },
  { key: "iterative",   label: "Iterative Improvement",   desc: "Run up to 4 improvement loops to reach score target"   },
  { key: "web_search",  label: "Company Intelligence",    desc: "Fetch live company context via web search"             },
  { key: "memory",      label: "Persistent Memory",       desc: "Learn from past applications across sessions"          },
];

const RESUME_TOGGLES: ToggleSetting[] = [
  { key: "star",        label: "STAR Format Bullets",     desc: "Enforce Situation-Task-Action-Result bullet structure"  },
  { key: "quantify",    label: "Quantification Prompts",  desc: "Flag bullets missing % / $ / scale metrics"            },
  { key: "summary",     label: "Auto Summary Section",    desc: "Prepend a tailored professional summary if absent"     },
];

const NOTIF_TOGGLES: ToggleSetting[] = [
  { key: "pipeline_done",   label: "Pipeline Completed",   desc: "Notify when a full optimization run finishes"         },
  { key: "score_threshold", label: "Score Threshold Met",  desc: "Alert when overall score exceeds target"             },
  { key: "new_patterns",    label: "New Pattern Insights", desc: "Notify when memory engine identifies new patterns"    },
];

const LLM_PROVIDERS: SelectOption[] = [
  { value: "openai",    label: "OpenAI (GPT-4o)"              },
  { value: "anthropic", label: "Anthropic (Claude Sonnet)"    },
  { value: "gemini",    label: "Google (Gemini 2.0 Flash)"    },
];

const FALLBACK_PROVIDERS: SelectOption[] = [
  { value: "gpt4o-mini",  label: "GPT-4o-mini"                },
  { value: "haiku",       label: "Claude Haiku"               },
  { value: "gemini-lite", label: "Gemini Flash Lite"          },
];

const ATS_LEVELS: SelectOption[] = [
  { value: "lenient",    label: "Lenient — broad keyword matching"    },
  { value: "standard",   label: "Standard — balanced (recommended)"  },
  { value: "strict",     label: "Strict — exact term matching only"  },
  { value: "aggressive", label: "Aggressive — maximum coverage"      },
];

const ENHANCEMENT_LEVELS: SelectOption[] = [
  { value: "conservative", label: "Conservative — minimal rewrites"  },
  { value: "standard",     label: "Standard — balanced polish"       },
  { value: "aggressive",   label: "Aggressive — full optimization"   },
];

// ── Primitives ─────────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold text-text-primary mb-4 tracking-tight">{children}</h2>;
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="font-mono text-[10px] text-text-muted uppercase tracking-widest block mb-1.5">
      {children}
    </label>
  );
}

function TextInput({
  id, value, onChange, placeholder, disabled,
}: {
  id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean;
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full h-8 px-3 rounded-md border border-border bg-background-secondary font-mono text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong disabled:opacity-50 transition-colors"
    />
  );
}

function Toggle({
  checked, onChange, label, id,
}: { checked: boolean; onChange: () => void; label: string; id: string }) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "relative w-8 h-4 rounded-full border transition-colors duration-200 flex-shrink-0",
        checked ? "bg-accent border-accent" : "bg-background-secondary border-border"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-4" : "translate-x-0.5"
        )}
        aria-hidden="true"
      />
    </button>
  );
}

function ToggleRow({
  setting, checked, onToggle,
}: { setting: ToggleSetting; checked: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div>
        <label htmlFor={`toggle-${setting.key}`} className="font-mono text-xs text-text-primary cursor-pointer">
          {setting.label}
        </label>
        <p className="font-mono text-[10px] text-text-muted mt-0.5">{setting.desc}</p>
      </div>
      <Toggle id={`toggle-${setting.key}`} checked={checked} onChange={onToggle} label={setting.label} />
    </div>
  );
}

function SelectInput({
  id, value, onChange, options,
}: { id: string; value: string; onChange: (v: string) => void; options: SelectOption[] }) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-8 px-3 pr-8 rounded-md border border-border bg-background-secondary font-mono text-xs text-text-primary focus:outline-none focus:border-border-strong transition-colors appearance-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-2 h-3.5 w-3.5 text-text-muted pointer-events-none" aria-hidden="true" />
    </div>
  );
}

function SecretInput({ id, value, onChange, placeholder }: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-8 px-3 pr-9 rounded-md border border-border bg-background-secondary font-mono text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong transition-colors"
      />
      <button
        type="button"
        aria-label={show ? "Hide key" : "Show key"}
        onClick={() => setShow((p) => !p)}
        className="absolute right-2.5 top-2 text-text-muted hover:text-text-primary transition-colors"
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function Segmented({
  options, value, onChange,
}: { options: SelectOption[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex bg-background-secondary border border-border rounded-md overflow-hidden">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 px-3 py-1.5 font-mono text-[10px] transition-colors duration-150 text-center",
            value === o.value
              ? "bg-accent text-white"
              : "text-text-muted hover:text-text-primary"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("profile");
  const [saved, setSaved] = useState(false);

  // Profile
  const [name,  setName]  = useState("Alex Rivera");
  const [email, setEmail] = useState("alex.rivera@email.com");

  // AI
  const [aiToggles, setAiToggles] = useState<Record<string, boolean>>({
    ats_opt: true, cover_auto: true, iterative: true, web_search: true, memory: true,
  });
  const [enhancement, setEnhancement] = useState("standard");
  const [maxIter,     setMaxIter]     = useState("4");

  // Resume
  const [resumeToggles, setResumeToggles] = useState<Record<string, boolean>>({
    star: true, quantify: true, summary: true,
  });
  const [scoreTarget, setScoreTarget] = useState("80");

  // ATS
  const [atsLevel, setAtsLevel] = useState("standard");

  // Theme
  const [themeMode, setThemeMode] = useState("dark");

  // Notifications
  const [notifToggles, setNotifToggles] = useState<Record<string, boolean>>({
    pipeline_done: true, score_threshold: true, new_patterns: false,
  });

  // API Keys
  const [openaiKey,    setOpenaiKey]    = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [tavilyKey,    setTavilyKey]    = useState("");

  // LLM
  const [primaryLLM,  setPrimaryLLM]  = useState("openai");
  const [fallbackLLM, setFallbackLLM] = useState("gpt4o-mini");

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleAi     = (k: string) => setAiToggles((p) => ({ ...p, [k]: !p[k] }));
  const toggleResume  = (k: string) => setResumeToggles((p) => ({ ...p, [k]: !p[k] }));
  const toggleNotif   = (k: string) => setNotifToggles((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="max-w-[1280px] space-y-5">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-xl font-bold text-text-primary tracking-tight">Settings</h1>
        <p className="font-mono text-xs text-text-muted mt-1">Manage your profile, AI preferences, and platform configuration.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-5">
        {/* Sidebar nav */}
        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
          <GlassCard className="p-2 md:sticky md:top-4">
            <nav aria-label="Settings sections">
              {NAV_SECTIONS.map((sec) => {
                const Icon = sec.icon;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setActiveSection(sec.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-md font-mono text-xs text-left transition-colors duration-150",
                      activeSection === sec.id
                        ? "bg-accent-subtle text-text-accent border border-accent/20"
                        : "text-text-muted hover:text-text-primary hover:bg-surface-raised border border-transparent"
                    )}
                    aria-current={activeSection === sec.id ? "page" : undefined}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                    {sec.label}
                  </button>
                );
              })}
            </nav>
          </GlassCard>
        </motion.div>

        {/* Content panel */}
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
        >
          <GlassCard className="p-6 space-y-6">

            {activeSection === "profile" && (
              <div className="space-y-4">
                <SectionTitle>Profile</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><FieldLabel htmlFor="name">Full Name</FieldLabel><TextInput id="name" value={name} onChange={setName} placeholder="Full name" /></div>
                  <div><FieldLabel htmlFor="email">Email</FieldLabel><TextInput id="email" value={email} onChange={setEmail} placeholder="you@email.com" /></div>
                </div>
              </div>
            )}

            {activeSection === "ai" && (
              <div className="space-y-5">
                <SectionTitle>AI Preferences</SectionTitle>
                <div>
                  {AI_TOGGLES.map((s) => (
                    <ToggleRow key={s.key} setting={s} checked={!!aiToggles[s.key]} onToggle={() => toggleAi(s.key)} />
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <FieldLabel htmlFor="enhancement">Enhancement Level</FieldLabel>
                    <SelectInput id="enhancement" value={enhancement} onChange={setEnhancement} options={ENHANCEMENT_LEVELS} />
                  </div>
                  <div>
                    <FieldLabel htmlFor="maxiter">Max Iterations</FieldLabel>
                    <SelectInput id="maxiter" value={maxIter} onChange={setMaxIter} options={[
                      { value: "2", label: "2 — Fast" }, { value: "3", label: "3 — Balanced" },
                      { value: "4", label: "4 — Thorough (default)" },
                    ]} />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "resume" && (
              <div className="space-y-5">
                <SectionTitle>Resume Defaults</SectionTitle>
                <div>
                  {RESUME_TOGGLES.map((s) => (
                    <ToggleRow key={s.key} setting={s} checked={!!resumeToggles[s.key]} onToggle={() => toggleResume(s.key)} />
                  ))}
                </div>
                <div>
                  <FieldLabel htmlFor="target">ATS Score Target</FieldLabel>
                  <div className="flex items-center gap-3">
                    <input
                      id="target"
                      type="range"
                      min={60} max={95} step={5}
                      value={Number(scoreTarget)}
                      onChange={(e) => setScoreTarget(e.target.value)}
                      className="flex-1 accent-accent"
                      aria-label="ATS score target"
                    />
                    <span className="font-mono text-sm font-bold text-text-accent w-8 text-right">{scoreTarget}</span>
                  </div>
                  <p className="font-mono text-[10px] text-text-muted mt-1">Pipeline iterates until this threshold is met or max iterations reached.</p>
                </div>
              </div>
            )}

            {activeSection === "ats" && (
              <div className="space-y-4">
                <SectionTitle>ATS Strictness</SectionTitle>
                <div>
                  <FieldLabel htmlFor="atslevel">Keyword Matching Mode</FieldLabel>
                  <SelectInput id="atslevel" value={atsLevel} onChange={setAtsLevel} options={ATS_LEVELS} />
                  <p className="font-mono text-[10px] text-text-muted mt-2">Controls how aggressively the Evaluator scores keyword presence.</p>
                </div>
              </div>
            )}

            {activeSection === "notifications" && (
              <div className="space-y-4">
                <SectionTitle>Notification Settings</SectionTitle>
                {NOTIF_TOGGLES.map((s) => (
                  <ToggleRow key={s.key} setting={s} checked={!!notifToggles[s.key]} onToggle={() => toggleNotif(s.key)} />
                ))}
              </div>
            )}

            {activeSection === "apikeys" && (
              <div className="space-y-4">
                <SectionTitle>API Keys</SectionTitle>
                <div className="p-3 rounded-lg border border-accent/20 bg-accent-subtle flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-text-accent flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="font-mono text-[10px] text-text-secondary leading-relaxed">Keys are encrypted at rest and never logged. They are used only for LLM API calls.</p>
                </div>
                {[
                  { id: "openai-key",    label: "OpenAI API Key",    value: openaiKey,    set: setOpenaiKey,    ph: "sk-..." },
                  { id: "anthropic-key", label: "Anthropic API Key", value: anthropicKey, set: setAnthropicKey, ph: "sk-ant-..." },
                  { id: "tavily-key",    label: "Tavily API Key",    value: tavilyKey,    set: setTavilyKey,    ph: "tvly-... (optional)" },
                ].map((k) => (
                  <div key={k.id}>
                    <FieldLabel htmlFor={k.id}>{k.label}</FieldLabel>
                    <SecretInput id={k.id} value={k.value} onChange={k.set} placeholder={k.ph} />
                  </div>
                ))}
              </div>
            )}

            {activeSection === "llm" && (
              <div className="space-y-5">
                <SectionTitle>LLM Provider Configuration</SectionTitle>
                <div>
                  <FieldLabel>Primary Provider</FieldLabel>
                  <Segmented
                    value={primaryLLM}
                    onChange={setPrimaryLLM}
                    options={[
                      { value: "openai",    label: "OpenAI"    },
                      { value: "anthropic", label: "Anthropic" },
                      { value: "gemini",    label: "Gemini"    },
                    ]}
                  />
                  <p className="font-mono text-[10px] text-text-muted mt-1.5">Used for high-reasoning tasks (resume tailoring, evaluation, improvement).</p>
                </div>
                <div>
                  <FieldLabel htmlFor="fallback">Fallback Provider</FieldLabel>
                  <SelectInput id="fallback" value={fallbackLLM} onChange={setFallbackLLM} options={FALLBACK_PROVIDERS} />
                  <p className="font-mono text-[10px] text-text-muted mt-1.5">Activated automatically on primary rate-limit or timeout.</p>
                </div>
                <div>
                  <FieldLabel htmlFor="primary-llm-select">Primary Model (extraction tasks)</FieldLabel>
                  <SelectInput id="primary-llm-select" value={primaryLLM} onChange={setPrimaryLLM} options={LLM_PROVIDERS} />
                </div>
              </div>
            )}

            {/* Save CTA */}
            <div className="pt-2 border-t border-border">
              <Button
                variant="primary"
                size="md"
                onClick={handleSave}
                type="button"
                className="min-w-[140px]"
              >
                {saved ? (
                  <><Save className="h-3.5 w-3.5" aria-hidden="true" /> Saved</>
                ) : (
                  <><Save className="h-3.5 w-3.5" aria-hidden="true" /> Save Changes</>
                )}
              </Button>
              {saved && (
                <motion.span
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="ml-3 font-mono text-xs text-text-accent"
                >
                  Settings saved successfully.
                </motion.span>
              )}
            </div>

          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}