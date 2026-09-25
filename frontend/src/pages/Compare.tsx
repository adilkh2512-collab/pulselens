import { addDays, addMonths, format, startOfMonth, subDays } from "date-fns"
import { GitCompareArrows, Loader2, Plus, X } from "lucide-react"
import { useState, type FormEvent } from "react"
import { useSearchParams } from "react-router-dom"

import { CompareView } from "@/components/CompareView"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { useCompareRun, useHealth, useStartCompare } from "@/hooks/useAnalysis"
import type { ComparePeriodInput, SortOrder } from "@/types/api"

const iso = (d: Date) => format(d, "yyyy-MM-dd")

interface Preset {
  name: string
  build: () => ComparePeriodInput[]
}

// 'until' is exclusive on the Bluesky API, so windows end on the day AFTER the last included day.
const PRESETS: Preset[] = [
  {
    name: "Last 7 days vs previous 7",
    build: () => {
      const tomorrow = addDays(new Date(), 1)
      const weekAgo = subDays(tomorrow, 7)
      const twoWeeksAgo = subDays(tomorrow, 14)
      return [
        { label: "Previous 7 days", since: iso(twoWeeksAgo), until: iso(weekAgo) },
        { label: "Last 7 days", since: iso(weekAgo), until: iso(tomorrow) },
      ]
    },
  },
  {
    name: "This month vs last month",
    build: () => {
      const now = new Date()
      const thisStart = startOfMonth(now)
      const lastStart = addMonths(thisStart, -1)
      return [
        { label: format(lastStart, "MMMM yyyy"), since: iso(lastStart), until: iso(thisStart) },
        { label: `${format(thisStart, "MMMM yyyy")} (to date)`, since: iso(thisStart), until: iso(addDays(now, 1)) },
      ]
    },
  },
  {
    name: "Last 30 days vs previous 30",
    build: () => {
      const tomorrow = addDays(new Date(), 1)
      const monthAgo = subDays(tomorrow, 30)
      const twoMonthsAgo = subDays(tomorrow, 60)
      return [
        { label: "Previous 30 days", since: iso(twoMonthsAgo), until: iso(monthAgo) },
        { label: "Last 30 days", since: iso(monthAgo), until: iso(tomorrow) },
      ]
    },
  },
  {
    name: "Last 3 months, month by month",
    build: () => {
      const now = new Date()
      const thisStart = startOfMonth(now)
      return [-2, -1, 0].map((offset) => {
        const start = addMonths(thisStart, offset)
        const end = offset === 0 ? addDays(now, 1) : addMonths(start, 1)
        return { label: format(start, "MMM yyyy"), since: iso(start), until: iso(end) }
      })
    },
  },
]

export default function Compare() {
  const [params, setParams] = useSearchParams()
  const compareId = params.get("cmp")
  const health = useHealth()
  const job = useCompareRun(compareId)
  const start = useStartCompare((accepted) => setParams({ cmp: accepted.compare_id }))

  const [query, setQuery] = useState("")
  const [sampleSize, setSampleSize] = useState(200)
  const [sort, setSort] = useState<SortOrder>("latest")
  const [lang, setLang] = useState("en")
  const [force, setForce] = useState(false)
  const [periods, setPeriods] = useState<ComparePeriodInput[]>(PRESETS[0].build())

  const max = Math.max(100, health.data?.max_sample_size ?? 1500)
  const size = Math.min(sampleSize, max)
  const status = job.data
  const running = Boolean(compareId) && (!status || (status.status !== "done" && status.status !== "failed"))
  const result = status?.status === "done" ? status.result : null

  function updatePeriod(i: number, patch: Partial<ComparePeriodInput>) {
    setPeriods((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  }

  function addPeriod() {
    if (periods.length >= 4) return
    const last = periods[periods.length - 1]
    const lastUntil = new Date(last.until)
    const span = Math.max(1, Math.round((lastUntil.getTime() - new Date(last.since).getTime()) / 86_400_000))
    setPeriods([...periods, { label: "", since: iso(lastUntil), until: iso(addDays(lastUntil, span)) }])
  }

  function removePeriod(i: number) {
    if (periods.length <= 2) return
    setPeriods(periods.filter((_, idx) => idx !== i))
  }

  const valid = query.trim().length > 0 && periods.every((p) => p.since && p.until && p.since < p.until)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    start.mutate({
      query: query.trim(),
      sample_size: size,
      sort,
      lang: lang || null,
      force,
      periods: periods.map((p) => ({ ...p, label: p.label?.trim() || undefined })),
    })
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitCompareArrows className="size-4" /> Compare Periods
          </CardTitle>
          <CardDescription>
            Fetch the same topic across two to four time windows and measure how sentiment moved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Topic</span>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. iPhone 18, Boeing, IIT Bombay" maxLength={200} disabled={running} className="h-10" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Ranking</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortOrder)} disabled={running} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="latest">Latest</option>
                  <option value="top">Top engagement</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Language</span>
                <select value={lang} onChange={(e) => setLang(e.target.value)} disabled={running} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="en">English</option>
                  <option value="">Any</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm md:h-9">
                <Switch checked={force} onCheckedChange={(c) => setForce(Boolean(c))} disabled={running} />
                <span className="text-muted-foreground">Fresh fetch</span>
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Posts per period</span>
                <span className="font-semibold tabular-nums">{size.toLocaleString()}</span>
              </div>
              <Slider min={100} max={max} step={100} value={[size]} onValueChange={(v) => setSampleSize(Array.isArray(v) ? v[0] : (v as number))} disabled={running} />
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Presets:</span>
                {PRESETS.map((p) => (
                  <Button key={p.name} type="button" variant="outline" size="sm" disabled={running} onClick={() => setPeriods(p.build())}>
                    {p.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Periods ('until' is exclusive)</div>
              <div className="space-y-2">
                {periods.map((p, i) => (
                  <div key={i} className="grid items-center gap-2 rounded-md border p-2 sm:grid-cols-[auto_1fr_1fr_1fr_auto]">
                    <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
                    <Input value={p.label ?? ""} onChange={(e) => updatePeriod(i, { label: e.target.value })} placeholder="Label (optional)" disabled={running} className="h-9" />
                    <Input type="date" value={p.since} onChange={(e) => updatePeriod(i, { since: e.target.value })} disabled={running} className="h-9" />
                    <Input type="date" value={p.until} onChange={(e) => updatePeriod(i, { until: e.target.value })} disabled={running} className="h-9" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removePeriod(i)} disabled={running || periods.length <= 2} aria-label="Remove period">
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <Button type="button" variant="outline" size="sm" onClick={addPeriod} disabled={running || periods.length >= 4} className="gap-1">
                  <Plus className="size-3.5" /> Add period
                </Button>
                <Button type="submit" disabled={running || !valid || start.isPending} className="gap-2">
                  {running ? <Loader2 className="size-4 animate-spin" /> : <GitCompareArrows className="size-4" />}
                  {running ? "Comparing…" : "Compare Periods"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {status && status.status !== "done" && (
        <Card className={status.status === "failed" ? "border-rose-500/40" : undefined}>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium">
                {status.status !== "failed" && <Loader2 className="size-4 animate-spin text-primary" />}
                {status.message}
              </span>
              <span className="text-xs text-muted-foreground">period {Math.min(status.current_period + 1, status.total_periods)} / {status.total_periods}</span>
            </div>
            {status.status === "failed" ? (
              <p className="rounded-md bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">{status.error}</p>
            ) : (
              <Progress value={status.progress_pct} />
            )}
          </CardContent>
        </Card>
      )}

      {result && (
        <ErrorBoundary title="Comparison view">
          <CompareView result={result} />
        </ErrorBoundary>
      )}
    </>
  )
}