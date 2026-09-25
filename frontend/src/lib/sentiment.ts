import type { NssBand, RunStage, SentimentLabel } from "@/types/api"

export const SENTIMENT: Record<SentimentLabel, {
  label: string; hex: string; text: string; bg: string; soft: string
}> = {
  positive: {
    label: "Positive", hex: "#10b981",
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500",
    soft: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  negative: {
    label: "Negative", hex: "#f43f5e",
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500",
    soft: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  },
  neutral: {
    label: "Neutral", hex: "#94a3b8",
    text: "text-slate-500 dark:text-slate-400",
    bg: "bg-slate-400",
    soft: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30",
  },
}

export function nssTone(band: NssBand) {
  switch (band) {
    case "strong_positive":
      return {
        label: "Strong positive consensus",
        text: "text-emerald-600 dark:text-emerald-400",
        soft: SENTIMENT.positive.soft,
        bar: "bg-emerald-500",
      }
    case "neutral":
      return {
        label: "Balanced perception",
        text: "text-amber-600 dark:text-amber-400",
        soft: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
        bar: "bg-amber-500",
      }
    case "critical":
      return {
        label: "Critical reputation warning",
        text: "text-rose-600 dark:text-rose-400",
        soft: SENTIMENT.negative.soft,
        bar: "bg-rose-500",
      }
  }
}

export const fmtPct = (n: number, digits = 1) => `${n.toFixed(digits)}%`
export const fmtNss = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}`
export const fmtInt = (n: number) => n.toLocaleString()

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

export function truncate(text: string, max = 140): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export const STAGES: { key: RunStage; label: string }[] = [
  { key: "fetching", label: "Fetching posts" },
  { key: "cleaning", label: "Cleaning" },
  { key: "analyzing", label: "Sentiment inference" },
  { key: "extracting_aspects", label: "Discovering aspects" },
  { key: "aggregating", label: "Aggregating" },
  { key: "saving", label: "Saving" },
]

export const TERMINAL_STAGES: RunStage[] = ["done", "failed"]