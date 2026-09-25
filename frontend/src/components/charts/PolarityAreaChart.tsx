import { format } from "date-fns"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SENTIMENT } from "@/lib/sentiment"
import type { Granularity, Timeline, TimelineBucket } from "@/types/api"

function labelFor(iso: string, granularity: Granularity | null): string {
  const d = new Date(iso)
  switch (granularity) {
    case "quarter_hour":
    case "hour":
      return format(d, "HH:mm")
    case "day":
      return format(d, "dd MMM")
    case "week":
      return `wk ${format(d, "dd MMM")}`
    default:
      return format(d, "dd MMM HH:mm")
  }
}

const GRANULARITY_TEXT: Record<Granularity, string> = {
  quarter_hour: "15-minute buckets",
  hour: "hourly buckets",
  day: "daily buckets",
  week: "weekly buckets",
}

interface TooltipPayload { payload: TimelineBucket & { label: string } }

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const b = payload[0].payload
  return (
    <div className="rounded-md border bg-popover p-3 text-xs shadow-md">
      <div className="mb-1 font-medium">{format(new Date(b.bucket_start), "dd MMM yyyy HH:mm")}</div>
      <div className="text-muted-foreground">{b.count} posts</div>
      <div className={SENTIMENT.positive.text}>Positive {b.positive_pct.toFixed(1)}% ({b.positive})</div>
      <div className={SENTIMENT.negative.text}>Negative {b.negative_pct.toFixed(1)}% ({b.negative})</div>
      <div className={SENTIMENT.neutral.text}>Neutral {b.neutral_pct.toFixed(1)}% ({b.neutral})</div>
    </div>
  )
}

export function PolarityAreaChart({ timeline }: { timeline: Timeline }) {
  const data = timeline.buckets.map((b) => ({ ...b, label: labelFor(b.bucket_start, timeline.granularity) }))
  const single = data.length < 2

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Sentiment Polarity Dynamics</CardTitle>
        <CardDescription>
          Share of positive vs negative posts over time
          {timeline.granularity ? ` · ${GRANULARITY_TEXT[timeline.granularity]}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="h-72">
        {single ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            All posts fall in a single time bucket — use Compare Periods or a larger sample for a trend curve.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="posFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SENTIMENT.positive.hex} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={SENTIMENT.positive.hex} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="negFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SENTIMENT.negative.hex} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={SENTIMENT.negative.hex} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} unit="%" />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)" }} />
              <Area type="monotone" dataKey="positive_pct" name="Positive" stroke={SENTIMENT.positive.hex} strokeWidth={2} fill="url(#posFill)" dot={data.length < 12} />
              <Area type="monotone" dataKey="negative_pct" name="Negative" stroke={SENTIMENT.negative.hex} strokeWidth={2} fill="url(#negFill)" dot={data.length < 12} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}