import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { api } from "@/api/client"

export function useRunHistory(q: string, limit = 50) {
  return useQuery({
    queryKey: ["history", "runs", q, limit],
    queryFn: () => api.listHistory({ q: q || undefined, limit }),
  })
}

export function useCompareHistory(limit = 50) {
  return useQuery({
    queryKey: ["history", "compares", limit],
    queryFn: () => api.listCompares({ limit }),
  })
}

export function useDeleteRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) => api.deleteRun(runId),
    onSuccess: () => {
      toast.success("Analysis deleted")
      qc.invalidateQueries({ queryKey: ["history"] })
      qc.invalidateQueries({ queryKey: ["health"] })
    },
    onError: () => toast.error("Could not delete analysis"),
  })
}

export function useDeleteCompare() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (compareId: string) => api.deleteCompare(compareId),
    onSuccess: () => {
      toast.success("Comparison deleted")
      qc.invalidateQueries({ queryKey: ["history"] })
    },
    onError: () => toast.error("Could not delete comparison"),
  })
}