// frontend/lib/api.ts

import type {
  ApplicationRequest,
  ApplicationResponse,
  ApplicationListResponse,
} from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

const GET_CACHE_TTL_MS = 5_000;
const GET_CACHE_MAX_ENTRIES = 128;
const GET_CACHE = new Map<string, { expiresAt: number; value: unknown }>();
const IN_FLIGHT_GETS = new Map<string, Promise<unknown>>();

function pruneExpiredGetCache() {
  const now = Date.now();
  for (const [url, entry] of GET_CACHE.entries()) {
    if (entry.expiresAt <= now) {
      GET_CACHE.delete(url);
    }
  }
}

function pruneGetCache() {
  pruneExpiredGetCache();
  while (GET_CACHE.size > GET_CACHE_MAX_ENTRIES) {
    const oldestKey = GET_CACHE.keys().next().value;
    if (oldestKey === undefined) break;
    GET_CACHE.delete(oldestKey);
  }
}

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
  const method = (options.method ?? "GET").toUpperCase();
  const shouldCacheGet = method === "GET" && options.cache !== "no-store";

  if (shouldCacheGet) {
    pruneExpiredGetCache();
    const cached = GET_CACHE.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    const inflight = IN_FLIGHT_GETS.get(url);
    if (inflight) {
      return inflight as Promise<T>;
    }
  }

  const request = (async (): Promise<T> => {
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

    const payload = (await res.json()) as T;

    if (shouldCacheGet) {
      GET_CACHE.set(url, {
        expiresAt: Date.now() + GET_CACHE_TTL_MS,
        value: payload,
      });
      pruneGetCache();
    }

    return payload;
  })();

  if (shouldCacheGet) {
    IN_FLIGHT_GETS.set(url, request as Promise<unknown>);
  }

  try {
    return await request;
  } finally {
    if (shouldCacheGet) {
      IN_FLIGHT_GETS.delete(url);
    }
  }
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