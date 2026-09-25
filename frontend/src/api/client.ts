import type {
  AnalyzeRequest,
  AnalysisResult,
  CompareAccepted,
  CompareHistoryResponse,
  CompareRequest,
  CompareStatus,
  Health,
  HistoryResponse,
  RunAccepted,
  RunStatus,
} from "@/types/api"

const API_BASE = "/api"

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body)
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  const s = search.toString()
  return s ? `?${s}` : ""
}

export const api = {
  health: () => request<Health>("/health"),

  // ---- analysis
  startAnalysis: (body: AnalyzeRequest) =>
    request<RunAccepted>("/analyze", { method: "POST", body: JSON.stringify(body) }),

  getRun: (runId: string) => request<RunStatus>(`/analyze/${runId}`),

  // ---- compare
  startCompare: (body: CompareRequest) =>
    request<CompareAccepted>("/compare", { method: "POST", body: JSON.stringify(body) }),

  getCompare: (compareId: string) => request<CompareStatus>(`/compare/${compareId}`),

  // ---- history
  listHistory: (params: { limit?: number; offset?: number; q?: string } = {}) =>
    request<HistoryResponse>(`/history${qs(params)}`),

  getHistoryItem: (runId: string) => request<AnalysisResult>(`/history/${runId}`),

  deleteRun: (runId: string) => request<void>(`/history/${runId}`, { method: "DELETE" }),

  listCompares: (params: { limit?: number; offset?: number } = {}) =>
    request<CompareHistoryResponse>(`/history/compares${qs(params)}`),

  deleteCompare: (compareId: string) =>
    request<void>(`/history/compares/${compareId}`, { method: "DELETE" }),
}