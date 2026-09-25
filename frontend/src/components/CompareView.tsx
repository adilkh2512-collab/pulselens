import { ArrowRight, ExternalLink, Minus, TrendingDown, TrendingUp } from "lucide-react"
import { Link } from "react-router-dom"
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fmtNss, fmtPct, nssTone, SENTIMENT } from "@/lib/sentiment"
import { cn } from "@/lib/utils"
import type { CompareResult, TrendDirection } from "@/types/api"

const TREND: Record<TrendDirection, { label: string; cls: string; Icon: typeof TrendingUp }> = {
  improving: { label: "Sentiment improving", cls: SENTIMENT.positive.soft, Icon: TrendingUp },
  worsening: { label: "Sentiment worsening", cls: SENTIMENT.negative.soft, Icon: TrendingDown },
  stable: {
    label: "Sentiment stable",
    cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    Icon: Minus,
  },
}

const signed = (n: number, suffix = "") => `${n > 0 ? "+" : ""}${n.toFixed(1)}${suffix}`

function deltaCls(n: number, invert = false) {
  if (Math.abs(n) < 0.05) return "text-muted-foreground"
  const good = invert ? n < 0 : n > 0
  return good ? SENTIMENT.positive.text : SENTIMENT.negative.text
}

function nssCls(v: number) {
  if (v >= 20) return SENTIMENT.positive.text
  if (v < 0) return SENTIMENT.negative.text
  return "text-amber-600 dark:text-amber-400"
}

const tooltipStyle = {
  borderRadius: 8,
  fontSize: 12,
  background: "var(--popover)",
  border: "1px solid var(--border)",
  color: "var(--popover-foreground)",
}

const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" }

export function CompareView({ result }: { result: CompareResult }) {
  const trend = TREND[result.trend]
  const TrendIcon = trend.Icon

  const chartData = result.periods.map((p) => ({
    label: p.label,
    Positive: p.summary.percentages.positive,
    Neutral: p.summary.percentages.neutral,
    Negative: p.summary.percentages.negative,
    NSS: p.summary.nss,
  }))

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">
              “{result.query}”
              <span className="ml-2 font-normal text-muted-foreground">period comparison</span>
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={cn("gap-1", trend.cls)}>
                <TrendIcon className="size-3" />
                {trend.label}
              </Badge>
              <Badge variant="outline">{result.sample_size} posts / period</Badge>
              <Badge variant="outline" className="capitalize">{result.sort}</Badge>
              <Badge variant="outline">{result.duration_seconds}s</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Period cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {result.periods.map((p, i) => {
          const tone = nssTone(p.summary.nss_band)
          const delta = i > 0 ? result.deltas[i - 1] : null
          return (
            <Card key={p.run_id} className="relative">
              {delta && (
                <div className="absolute -left-3 top-1/2 hidden -translate-y-1/2 rounded-full border bg-background p-1 lg:block">
                  <ArrowRight className="size-3 text-muted-foreground" />
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{p.label}</CardTitle>
                <CardDescription className="text-xs">
                  {p.since} → {p.until} · {p.analyzed} posts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className={cn("text-3xl font-semibold tabular-nums", tone.text)}>{fmtNss(p.summary.nss)}</div>
                  {delta ? (
                    <div className={cn("text-xs tabular-nums", deltaCls(delta.nss_delta))}>
                      {signed(delta.nss_delta)} vs previous
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">baseline</div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1 text-center text-xs">
                  {(["positive", "neutral", "negative"] as const).map((k) => (
                    <div key={k} className="rounded-md border p-1.5">
                      <div className={cn("font-semibold tabular-nums", SENTIMENT[k].text)}>
                        {fmtPct(p.summary.percentages[k], 0)}
                      </div>
                      <div className="text-[10px] capitalize text-muted-foreground">{k}</div>
                    </div>
                  ))}
                </div>
                <Link
                  to={`/?run=${p.run_id}`}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-3" /> open full analysis
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sentiment share by period</CardTitle>
            <CardDescription>Positive / neutral / negative percentage per window</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} unit="%" tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Positive" fill={SENTIMENT.positive.hex} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Neutral" fill={SENTIMENT.neutral.hex} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Negative" fill={SENTIMENT.negative.hex} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Net Sentiment Score trajectory</CardTitle>
            <CardDescription>Above 0 is net positive; +20 marks strong consensus</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis domain={[-100, 100]} tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtNss(Number(v))} />
                <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
                <ReferenceLine y={20} stroke={SENTIMENT.positive.hex} strokeDasharray="2 6" />
                <Line
                  type="monotone"
                  dataKey="NSS"
                  stroke="var(--foreground)"
                  strokeWidth={2.5}
                  dot={{ r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Deltas */}
      {result.deltas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Period-over-period change</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Transition</th>
                  <th className="py-2 pr-4 font-medium">NSS Δ</th>
                  <th className="py-2 pr-4 font-medium">Positive Δ</th>
                  <th className="py-2 pr-4 font-medium">Negative Δ</th>
                  <th className="py-2 pr-4 font-medium">Volume Δ</th>
                  <th className="py-2 font-medium">Direction</th>
                </tr>
              </thead>
              <tbody>
                {result.deltas.map((d) => {
                  const t = TREND[d.direction]
                  const DIcon = t.Icon
                  return (
                    <tr key={`${d.from_label}-${d.to_label}`} className="border-t">
                      <td className="py-2 pr-4">
                        {d.from_label} <ArrowRight className="inline size-3 text-muted-foreground" /> {d.to_label}
                      </td>
                      <td className={cn("py-2 pr-4 font-semibold tabular-nums", deltaCls(d.nss_delta))}>
                        {signed(d.nss_delta)}
                      </td>
                      <td className={cn("py-2 pr-4 tabular-nums", deltaCls(d.positive_pct_delta))}>
                        {signed(d.positive_pct_delta, "%")}
                      </td>
                      <td className={cn("py-2 pr-4 tabular-nums", deltaCls(d.negative_pct_delta, true))}>
                        {signed(d.negative_pct_delta, "%")}
                      </td>
                      <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                        {d.volume_delta > 0 ? "+" : ""}{d.volume_delta} posts
                      </td>
                      <td className="py-2">
                        <Badge variant="outline" className={cn("gap-1 capitalize", t.cls)}>
                          <DIcon className="size-3" />
                          {d.direction}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Aspect shift */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Aspect shift</CardTitle>
          <CardDescription>
            How each discovered topic's NSS moved between periods (— = not among that period's top aspects)
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {result.aspect_shift.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No repeated aspects found in these windows.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Aspect</th>
                  {result.periods.map((p) => (
                    <th key={p.run_id} className="py-2 pr-4 font-medium">{p.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.aspect_shift.map((s) => (
                  <tr key={s.aspect} className="border-t">
                    <td className="py-2 pr-4 font-medium">{s.display}</td>
                    {s.nss.map((v, i) => (
                      <td key={i} className="py-2 pr-4 tabular-nums">
                        {v === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={nssCls(v)}>
                            {fmtNss(v)}{" "}
                            <span className="text-[11px] text-muted-foreground">({s.mentions[i]})</span>
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}