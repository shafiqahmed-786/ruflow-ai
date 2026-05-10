// frontend/lib/types.ts

export type EvalStatus =
  | "pending"
  | "improving"
  | "passed"
  | "failed"
  | "max_iter_reached";

export type AgentName =
  | "planner"
  | "jd_analyzer"
  | "retrieval"
  | "resume_tailor"
  | "cover_letter"
  | "evaluator"
  | "improver"
  | "packager";

export type AgentStatus = "waiting" | "running" | "done" | "error";

export interface EvalScores {
  keyword_coverage:     number | null;
  relevance:            number | null;
  impact:               number | null;
  tone_match:           number | null;
  cover_letter_quality: number | null;
  overall:              number | null;
}

export interface ChangeLogEntry {
  iteration:   number;
  target:      string;
  description: string;
}

export interface ApplicationResponse {
  session_id:   string;
  user_id:      string;
  status:       EvalStatus;
  scores:       EvalScores;
  resume:       string;
  cover_letter: string;
  iterations:   number;
  change_log:   ChangeLogEntry[];
  errors:       string[];
  focus_areas:  string[];
  jd_role:      string | null;
  company:      string | null;
}

export interface ApplicationRequest {
  resume_text:    string;
  jd_text:        string;
  user_id:        string;
  jd_url?:        string;
  linkedin_data?: Record<string, unknown>;
}

export interface ApplicationSummary {
  session_id:    string;
  jd_role:       string;
  company:       string;
  overall_score: number | null;
  iterations:    number;
  timestamp:     string;
}

export interface ApplicationListResponse {
  user_id:      string;
  total:        number;
  applications: ApplicationSummary[];
}

// ── Dashboard-specific types ──────────────────────────────────────────────

export interface AgentStep {
  name:        AgentName;
  label:       string;
  description: string;
  status:      AgentStatus;
  duration_ms: number | null;
}

export interface IterationScore {
  iteration:            number;
  keyword_coverage:     number;
  relevance:            number;
  impact:               number;
  tone_match:           number;
  cover_letter_quality: number;
  overall:              number;
}

export type ExecutionPhase =
  | "idle"
  | "running"
  | "complete"
  | "error";

export interface DashboardState {
  phase:           ExecutionPhase;
  agents:          AgentStep[];
  result:          ApplicationResponse | null;
  iterationScores: IterationScore[];
  history:         ApplicationSummary[];
  activeSessionId: string | null;
  errorMessage:    string | null;
}

export type DashboardAction =
  | { type: "START_EXECUTION" }
  | { type: "ADVANCE_AGENT"; agentIndex: number }
  | { type: "COMPLETE_AGENT"; agentIndex: number; duration_ms: number }
  | { type: "SET_RESULT"; result: ApplicationResponse }
  | { type: "ADD_ITERATION_SCORE"; score: IterationScore }
  | { type: "SET_HISTORY"; history: ApplicationSummary[] }
  | { type: "SET_ERROR"; message: string }
  | { type: "RESET" };

export interface ScoreColorConfig {
  bg:     string;
  text:   string;
  border: string;
  glow:   string;
}

export type ResumeViewMode = "rich" | "semantic" | "edit" | "raw";

export interface FilterState {
  include:
    | "all"
    | {
        minScore: number;
        maxScore: number;
        scope?: "thisRun" | "pastRuns" | "all";
      };
  exclude?: {
    minScore: number;
    maxScore: number;
    scope?: "thisRun" | "pastRuns" | "all";
  };
}