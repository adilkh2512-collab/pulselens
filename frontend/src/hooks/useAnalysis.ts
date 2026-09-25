import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { api, ApiError } from "@/api/client"
import { TERMINAL_STAGES } from "@/lib/sentiment"
import type { AnalyzeRequest, CompareAccepted, CompareRequest, RunAccepted } from "@/types/api"

const POLL_MS = 1200

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Could not reach the PulseLens API"
}

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: (query) => (query.state.data?.model_loaded ? 60_000 : 4_000),
    retry: 1,
  })
}

// ---------------------------------------------------------------- analysis

export function useRun(runId: string | null) {
  return useQuery({
    queryKey: ["run", runId],
    queryFn: () => api.getRun(runId as string),
    enabled: Boolean(runId),
    staleTime: Number.POSITIVE_INFINITY,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && TERMINAL_STAGES.includes(status) ? false : POLL_MS
    },
  })
}

export function useStartAnalysis(onStarted: (accepted: RunAccepted) => void) {
  return useMutation({
    mutationFn: (body: AnalyzeRequest) => api.startAnalysis(body),
    onSuccess: (accepted) => {
      if (accepted.cached) toast.info("Reused an identical analysis from the last few minutes.")
      onStarted(accepted)
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
}

// ----------------------------------------------------------------- compare

export function useCompareRun(compareId: string | null) {
  return useQuery({
    queryKey: ["compare", compareId],
    queryFn: () => api.getCompare(compareId as string),
    enabled: Boolean(compareId),
    staleTime: Number.POSITIVE_INFINITY,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === "done" || status === "failed" ? false : POLL_MS
    },
  })
}

export function useStartCompare(onStarted: (accepted: CompareAccepted) => void) {
  return useMutation({
    mutationFn: (body: CompareRequest) => api.startCompare(body),
    onSuccess: onStarted,
    onError: (err) => toast.error(errorMessage(err)),
  })
}