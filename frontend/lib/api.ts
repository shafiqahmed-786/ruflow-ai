// frontend/lib/api.ts

import type {
  ApplicationRequest,
  ApplicationResponse,
  ApplicationListResponse,
} from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

// ---------------------------------------------------------------------------
// Generic fetch wrapper
// ---------------------------------------------------------------------------

class ApiError extends Error {
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

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

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
  const res = await fetch(url, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    let detail: string | undefined;
    try {
      const body = await res.json();
      detail = body?.detail;
    } catch {
      detail = await res.text().catch(() => undefined);
    }
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

// ---------------------------------------------------------------------------
// Re-export error type for consumers
// ---------------------------------------------------------------------------

export { ApiError };