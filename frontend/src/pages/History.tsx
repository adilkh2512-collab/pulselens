import { ExternalLink, Search, Trash2 } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useCompareHistory, useDeleteCompare, useDeleteRun, useRunHistory } from "@/hooks/useHistory"
import { fmtDateTime, fmtNss, nssTone, SENTIMENT } from "@/lib/sentiment"
import { cn } from "@/lib/utils"
import type { TrendDirection } from "@/types/api"

type Tab = "runs" | "compares"

const TREND_CLS: Record<TrendDirection, string> = {
  improving: SENTIMENT.positive.soft,
  worsening: SENTIMENT.negative.soft,
  stable: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
}

const linkButton = cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")

function SplitBar({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
  const total = positive + neutral + negative || 1
  return (
    <div className="flex h-2 w-28 overflow-hidden rounded-full bg-muted" title={`${positive} / ${neutral} / ${negative}`}>
      <span className="bg-emerald-500" style={{ width: `${(100 * positive) / total}%` }} />
      <span className="bg-slate-400/70" style={{ width: `${(100 * neutral) / total}%` }} />
      <span className="bg-rose-500" style={{ width: `${(100 * negative) / total}%` }} />
    </div>
  )
}

export default function History() {
  const [tab, setTab] = useState<Tab>("runs")
  const [q, setQ] = useState("")
  const runs = useRunHistory(q)
  const compares = useCompareHistory()
  const deleteRun = useDeleteRun()
  const deleteCompare = useDeleteCompare()

  function confirmDelete(label: string, action: () => void) {
    if (window.confirm(`Delete ${label}? This cannot be undone.`)) action()
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">History</CardTitle>
            <CardDescription>Every analysis and comparison is stored locally in sentiment.db</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border p-0.5 text-xs">
              {(["runs", "compares"] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded px-3 py-1 transition-colors",
                    tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t === "runs"
                    ? `Analyses (${runs.data?.total ?? "…"})`
                    : `Comparisons (${compares.data?.total ?? "…"})`}
                </button>
              ))}
            </div>
            {tab === "runs" && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Filter by topic"
                  className="h-8 w-48 pl-8 text-xs"
                />
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="overflow-x-auto">
        {tab === "runs" && (
          runs.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Topic</th>
                  <th className="py-2 pr-3 font-medium">Window</th>
                  <th className="py-2 pr-3 font-medium">Posts</th>
                  <th className="py-2 pr-3 font-medium">Split</th>
                  <th className="py-2 pr-3 font-medium">NSS</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.data?.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">No analyses saved yet.</td>
                  </tr>
                )}
                {runs.data?.items.map((r) => {
                  const tone = nssTone(r.nss_band)
                  return (
                    <tr key={r.run_id} className="border-b last:border-0">
                      <td className="whitespace-nowrap py-2 pr-3 text-xs text-muted-foreground">{fmtDateTime(r.created_at)}</td>
                      <td className="py-2 pr-3 font-medium">
                        {r.query}
                        <span className="ml-2 text-[11px] font-normal capitalize text-muted-foreground">{r.sort}</span>
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-xs text-muted-foreground">
                        {r.since || r.until ? `${r.since ?? "…"} → ${r.until ?? "…"}` : "latest"}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {r.analyzed}
                        <span className="text-[11px] text-muted-foreground"> / {r.sample_size}</span>
                      </td>
                      <td className="py-2 pr-3"><SplitBar positive={r.positive} neutral={r.neutral} negative={r.negative} /></td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className={cn("tabular-nums", tone.soft)}>{fmtNss(r.nss)}</Badge>
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Link to={`/?run=${r.run_id}`} className={linkButton}>
                            <ExternalLink className="size-3.5" /> Open
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete analysis"
                            disabled={deleteRun.isPending}
                            onClick={() => confirmDelete(`the “${r.query}” analysis`, () => deleteRun.mutate(r.run_id))}
                          >
                            <Trash2 className="size-3.5 text-muted-foreground hover:text-rose-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        )}

        {tab === "compares" && (
          compares.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Topic</th>
                  <th className="py-2 pr-3 font-medium">Periods</th>
                  <th className="py-2 pr-3 font-medium">First → Last NSS</th>
                  <th className="py-2 pr-3 font-medium">Trend</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {compares.data?.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">No comparisons saved yet.</td>
                  </tr>
                )}
                {compares.data?.items.map((c) => (
                  <tr key={c.compare_id} className="border-b last:border-0">
                    <td className="whitespace-nowrap py-2 pr-3 text-xs text-muted-foreground">{fmtDateTime(c.created_at)}</td>
                    <td className="py-2 pr-3 font-medium">{c.query}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {c.period_count}
                      <span className="text-[11px] text-muted-foreground"> × {c.sample_size} posts</span>
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {fmtNss(c.first_nss)} <span className="text-muted-foreground">→</span> {fmtNss(c.last_nss)}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className={cn("capitalize", TREND_CLS[c.trend])}>{c.trend}</Badge>
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Link to={`/compare?cmp=${c.compare_id}`} className={linkButton}>
                          <ExternalLink className="size-3.5" /> Open
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete comparison"
                          disabled={deleteCompare.isPending}
                          onClick={() => confirmDelete(`the “${c.query}” comparison`, () => deleteCompare.mutate(c.compare_id))}
                        >
                          <Trash2 className="size-3.5 text-muted-foreground hover:text-rose-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </CardContent>
    </Card>
  )
}