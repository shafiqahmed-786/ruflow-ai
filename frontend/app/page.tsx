"use client";

// frontend/app/page.tsx

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, Layers, Activity, ChevronRight } from "lucide-react";

import { ApplicationForm }   from "@/components/ApplicationForm";
import { LoadingState }      from "@/components/LoadingState";
import { ResultsPanel }      from "@/components/ResultsPanel";
import { ScoreChart }        from "@/components/ScoreChart";
import { HistoryPanel }      from "@/components/HistoryPanel";
import { ActionToolbar }     from "@/components/ActionToolbar";

import { submitApplication, listUserApplications, ApiError } from "@/lib/api";
import {
  MOCK_AGENT_STEPS,
  MOCK_ITERATION_SCORES,
  MOCK_RESULT,
  MOCK_HISTORY,
} from "@/lib/mockData";
import type {
  DashboardState,
  DashboardAction,
  AgentStep,
  IterationScore,
  ApplicationRequest,
  ApplicationResponse,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

const INITIAL_AGENTS: AgentStep[] = MOCK_AGENT_STEPS.map((a) => ({
  ...a,
  status: "waiting",
  duration_ms: null,
}));

const INITIAL_STATE: DashboardState = {
  phase:           "idle",
  agents:          INITIAL_AGENTS,
  result:          null,
  iterationScores: [],
  history:         MOCK_HISTORY,
  activeSessionId: null,
  errorMessage:    null,
};

function dashboardReducer(
  state: DashboardState,
  action: DashboardAction
): DashboardState {
  switch (action.type) {
    case "START_EXECUTION":
      return {
        ...state,
        phase:           "running",
        agents:          INITIAL_AGENTS,
        result:          null,
        iterationScores: [],
        activeSessionId: null,
        errorMessage:    null,
      };

    case "ADVANCE_AGENT": {
      const agents = state.agents.map((a, i) => {
        if (i === action.agentIndex) return { ...a, status: "running" as const };
        if (i < action.agentIndex) return { ...a, status: a.status === "running" ? "done" as const : a.status };
        return a;
      });
      return { ...state, agents };
    }

    case "COMPLETE_AGENT": {
      const agents = state.agents.map((a, i) =>
        i === action.agentIndex
          ? { ...a, status: "done" as const, duration_ms: action.duration_ms }
          : a
      );
      return { ...state, agents };
    }

    case "SET_RESULT":
      return {
        ...state,
        phase:           "complete",
        result:          action.result,
        activeSessionId: action.result.session_id,
        agents: state.agents.map((a) => ({
          ...a,
          status: a.status === "running" ? "done" : a.status,
        })),
      };

    case "ADD_ITERATION_SCORE":
      return {
        ...state,
        iterationScores: [...state.iterationScores, action.score],
      };

    case "SET_HISTORY":
      return { ...state, history: action.history };

    case "SET_ERROR":
      return {
        ...state,
        phase:        "error",
        errorMessage: action.message,
        agents: state.agents.map((a) => ({
          ...a,
          status: a.status === "running" ? "error" : a.status,
        })),
      };

    case "RESET":
      return INITIAL_STATE;

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface DashboardContextValue {
  state:    DashboardState;
  dispatch: React.Dispatch<DashboardAction>;
  runPipeline: (req: ApplicationRequest) => Promise<void>;
  runDemo:     () => void;
  reset:       () => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Simulation helpers
// ---------------------------------------------------------------------------

const AGENT_TIMINGS = [800, 1200, 1800, 2500, 2500, 2000, 2200, 600];
const ITER_SCORE_TIMINGS = [4500, 7000, 9500]; // when to inject iteration scores

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(dashboardReducer, INITIAL_STATE);
  const abortRef = useRef(false);

  const simulateAgentProgress = useCallback(
    async (totalMs: number) => {
      abortRef.current = false;
      let elapsed = 0;

      for (let i = 0; i < AGENT_TIMINGS.length; i++) {
        if (abortRef.current) return;
        dispatch({ type: "ADVANCE_AGENT", agentIndex: i });
        const t = Math.min(AGENT_TIMINGS[i], Math.max(200, totalMs / AGENT_TIMINGS.length));
        await sleep(t);
        if (abortRef.current) return;
        elapsed += t;
        dispatch({ type: "COMPLETE_AGENT", agentIndex: i, duration_ms: AGENT_TIMINGS[i] });
      }
    },
    []
  );

  const injectIterationScores = useCallback(
    async (scores: IterationScore[]) => {
      for (let i = 0; i < scores.length; i++) {
        await sleep(ITER_SCORE_TIMINGS[i] ?? 3000 * (i + 1));
        if (abortRef.current) return;
        dispatch({ type: "ADD_ITERATION_SCORE", score: scores[i] });
      }
    },
    []
  );

  const runPipeline = useCallback(
    async (req: ApplicationRequest) => {
      dispatch({ type: "START_EXECUTION" });

      // Kick off animation immediately
      const animPromise = simulateAgentProgress(18_000);
      const scorePromise = injectIterationScores(MOCK_ITERATION_SCORES);

      try {
        const result = await submitApplication(req);
        abortRef.current = true;
        await animPromise;
        dispatch({ type: "SET_RESULT", result });
        // Build iteration scores from result
        const finalScore: IterationScore = {
          iteration: result.iterations,
          keyword_coverage:     result.scores.keyword_coverage     ?? 0,
          relevance:            result.scores.relevance            ?? 0,
          impact:               result.scores.impact               ?? 0,
          tone_match:           result.scores.tone_match           ?? 0,
          cover_letter_quality: result.scores.cover_letter_quality ?? 0,
          overall:              result.scores.overall              ?? 0,
        };
        dispatch({ type: "ADD_ITERATION_SCORE", score: finalScore });
      } catch (err) {
        abortRef.current = true;
        const msg =
          err instanceof ApiError
            ? `${err.message}${err.detail ? ` — ${err.detail}` : ""}`
            : err instanceof Error
            ? err.message
            : "Unknown error";
        dispatch({ type: "SET_ERROR", message: msg });
      }
    },
    [simulateAgentProgress, injectIterationScores]
  );

  // Demo mode — uses mock data, no API call
  const runDemo = useCallback(async () => {
    dispatch({ type: "START_EXECUTION" });
    const animPromise = simulateAgentProgress(14_000);
    await injectIterationScores(MOCK_ITERATION_SCORES);
    await animPromise;
    dispatch({ type: "SET_RESULT", result: MOCK_RESULT });
  }, [simulateAgentProgress, injectIterationScores]);

  const reset = useCallback(() => {
    abortRef.current = true;
    dispatch({ type: "RESET" });
  }, []);

  return (
    <DashboardContext.Provider value={{ state, dispatch, runPipeline, runDemo, reset }}>
      {children}
    </DashboardContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

function DashboardShell() {
  const { state } = useDashboard();
  const { phase } = state;

  return (
    <div className="min-h-screen bg-[#09090b] grid-bg flex flex-col">
      {/* Top bar */}
      <header className="border-b border-[#27272a] bg-[#09090b]/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Cpu size={16} className="text-emerald-400" />
              <span className="font-mono text-sm font-semibold tracking-wider text-zinc-100">
                RUFLOW
              </span>
              <span className="font-mono text-[10px] text-zinc-600 ml-1">v0.1</span>
            </div>
            <ChevronRight size={12} className="text-zinc-700" />
            <span className="font-mono text-[11px] text-zinc-500 tracking-wider">
              MULTI-AGENT APPLICATION INTELLIGENCE
            </span>
          </div>

          <div className="flex items-center gap-4">
            <StatusPill phase={phase} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-6 py-6">
        <AnimatePresence mode="wait">
          {phase === "idle" || phase === "error" ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <IdleLayout />
            </motion.div>
          ) : phase === "running" ? (
            <motion.div
              key="running"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <LoadingState />
            </motion.div>
          ) : (
            <motion.div
              key="complete"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CompleteLayout />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#27272a] px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <span className="font-mono text-[10px] text-zinc-700 tracking-widest">
            RUFLOW INTELLIGENCE SYSTEM — ALL AGENTS OPERATIONAL
          </span>
          <div className="flex items-center gap-1">
            <Activity size={10} className="text-emerald-500" />
            <span className="font-mono text-[10px] text-emerald-600">ONLINE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout variants
// ---------------------------------------------------------------------------

function IdleLayout() {
  const { state } = useDashboard();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
      <div className="space-y-6">
        <ApplicationForm />
        {state.phase === "error" && state.errorMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="panel border-rose-900/60 bg-rose-950/20 p-4"
          >
            <p className="font-mono text-xs text-rose-400">
              <span className="text-rose-300 font-semibold">ERROR — </span>
              {state.errorMessage}
            </p>
          </motion.div>
        )}
      </div>
      <div className="space-y-6">
        <AgentMapPanel />
        <HistoryPanel />
      </div>
    </div>
  );
}

function CompleteLayout() {
  return (
    <div className="space-y-6">
      <ActionToolbar />
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
        <ResultsPanel />
        <div className="space-y-6">
          <ScoreChart />
          <HistoryPanel compact />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent map (idle sidebar)
// ---------------------------------------------------------------------------

function AgentMapPanel() {
  const { state } = useDashboard();

  return (
    <div className="panel p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Layers size={13} className="text-zinc-500" />
        <span className="label-mono">Agent Pipeline</span>
      </div>
      <div className="space-y-1">
        {state.agents.map((agent, i) => (
          <div
            key={agent.name}
            className="flex items-center gap-3 py-2 px-3 rounded hover:bg-zinc-900 transition-colors"
          >
            <span className="font-mono text-[10px] text-zinc-600 w-4 text-right">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-mono text-xs text-zinc-300">{agent.label}</p>
              <p className="font-mono text-[10px] text-zinc-600 truncate">
                {agent.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

function StatusPill({ phase }: { phase: DashboardState["phase"] }) {
  const configs = {
    idle:     { color: "text-zinc-500", dot: "bg-zinc-600", label: "STANDBY" },
    running:  { color: "text-amber-400", dot: "bg-amber-400 animate-pulse", label: "EXECUTING" },
    complete: { color: "text-emerald-400", dot: "bg-emerald-400", label: "COMPLETE" },
    error:    { color: "text-rose-400", dot: "bg-rose-400", label: "ERROR" },
  };

  const c = configs[phase];

  return (
    <div className={`flex items-center gap-2 font-mono text-[10px] ${c.color} tracking-widest`}>
      <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

export default function Page() {
  return (
    <DashboardProvider>
      <DashboardShell />
    </DashboardProvider>
  );
}

export { DashboardContext, useDashboard as useDashboardContext };