// frontend/lib/api.ts — CareerOS AI API client

import type {
  ApplicationRequest,
  ApplicationResponse,
  ApplicationListResponse,
} from "./types";

const BASE_URL =
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080") + "/api/v1";

// ── Generic fetch wrapper ─────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let detail: string | undefined;
    try {
      const body = await res.json();
      detail = body?.detail ?? JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => undefined);
    }
    throw new ApiError(
      res.status,
      `API request failed: ${res.status} ${res.statusText}`,
      detail
    );
  }
  return res.json() as Promise<T>;
}

// ── Original RuFlow endpoints (preserved) ────────────────────────────────────

export async function submitApplication(
  request: ApplicationRequest
): Promise<ApplicationResponse> {
  return apiFetch<ApplicationResponse>("/apply", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function submitApplicationWithPdf(
  userId: string,
  jdText: string,
  pdfFile: File,
  jdUrl?: string
): Promise<ApplicationResponse> {
  const form = new FormData();
  form.append("user_id", userId);
  form.append("jd_text", jdText);
  form.append("resume_pdf", pdfFile);
  if (jdUrl) form.append("jd_url", jdUrl);

  const url = `${BASE_URL}/apply/pdf`;
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) {
    let detail: string | undefined;
    try { const b = await res.json(); detail = b?.detail; } catch { /* noop */ }
    throw new ApiError(res.status, `PDF upload failed: ${res.statusText}`, detail);
  }
  return res.json() as Promise<ApplicationResponse>;
}

export async function getApplication(
  sessionId: string
): Promise<ApplicationResponse> {
  return apiFetch<ApplicationResponse>(`/applications/${sessionId}`);
}

export async function listUserApplications(
  userId: string,
  limit = 10
): Promise<ApplicationListResponse> {
  return apiFetch<ApplicationListResponse>(
    `/applications/user/${userId}?limit=${limit}`
  );
}

export async function checkHealth(): Promise<{ status: string; version: string }> {
  return apiFetch<{ status: string; version: string }>("/health");
}

// ── CareerOS AI — Interviews ──────────────────────────────────────────────────

export async function listInterviews(userId: string) {
  return apiFetch<{ interviews: unknown[]; total: number }>(
    `/interviews/${userId}`
  );
}

export async function createInterview(body: {
  user_id: string; company: string; role: string;
  interview_type?: string; scheduled_at?: string; notes?: string;
}) {
  return apiFetch("/interviews", { method: "POST", body: JSON.stringify(body) });
}

export async function generatePrepQuestions(body: {
  user_id: string; company: string; role: string;
  interview_type?: string; num_questions?: number;
}) {
  return apiFetch<{ questions: string[] }>("/interviews/prep-questions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── CareerOS AI — Recruiters ──────────────────────────────────────────────────

export async function listRecruiters(userId: string) {
  return apiFetch<{ recruiters: unknown[]; total: number }>(
    `/recruiters/${userId}`
  );
}

export async function generateFollowUp(body: {
  user_id: string; recruiter_id: string; recruiter_name: string;
  company: string; context?: string; days_since_contact?: number;
}) {
  return apiFetch<{ email_draft: string }>("/recruiters/follow-up", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── CareerOS AI — Companies ───────────────────────────────────────────────────

export async function listCompanies(userId: string) {
  return apiFetch<{ companies: unknown[] }>(`/companies/${userId}`);
}

export async function researchCompany(body: {
  company_name: string;
  focus_areas?: string[];
}) {
  return apiFetch("/companies/research", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── CareerOS AI — Offers ──────────────────────────────────────────────────────

export async function listOffers(userId: string) {
  return apiFetch<{ offers: unknown[]; total: number }>(`/offers/${userId}`);
}

export async function createOffer(body: {
  user_id: string; company: string; role: string;
  base_salary: number; equity_percent?: number; bonus?: number;
  sign_on?: number; deadline?: string; notes?: string;
}) {
  return apiFetch("/offers", { method: "POST", body: JSON.stringify(body) });
}

export async function compareOffers(userId: string, offerIds: string[]) {
  return apiFetch("/offers/compare", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, offer_ids: offerIds }),
  });
}

// ── CareerOS AI — Analytics ───────────────────────────────────────────────────

export async function getAtsTrend(userId: string) {
  return apiFetch(`/analytics/${userId}/ats-trend`);
}

export async function getApplicationFunnel(userId: string) {
  return apiFetch(`/analytics/${userId}/funnel`);
}

export async function getCareerSummary(userId: string) {
  return apiFetch(`/analytics/${userId}/career-summary`);
}

// ── CareerOS AI — Copilot ─────────────────────────────────────────────────────

export async function copilotChat(body: {
  user_id: string;
  message: string;
  history?: Array<{ role: string; content: string }>;
}) {
  return apiFetch<{ response: string; intent_detected: string; agent_used: string }>(
    "/copilot/chat",
    { method: "POST", body: JSON.stringify(body) }
  );
}
