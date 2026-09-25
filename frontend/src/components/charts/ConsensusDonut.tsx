import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fmtPct, SENTIMENT } from "@/lib/sentiment"
import type { SentimentLabel, SentimentSummary } from "@/types/api"

const ORDER: SentimentLabel[] = ["positive", "neutral", "negative"]

export function ConsensusDonut({ summary }: { summary: SentimentSummary }) {
  const data = ORDER.map((key) => ({
    key,
    name: SENTIMENT[key].label,
    value: summary.counts[key],
    pct: summary.percentages[key],
    color: SENTIMENT[key].hex,
  }))

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Consensus Polarization</CardTitle>
        <CardDescription>Distribution of {summary.total} analysed posts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="92%" paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}>
                {data.map((d) => <Cell key={d.key} fill={d.color} />)}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${value} posts`, String(name)]}
                contentStyle={{ borderRadius: 8, fontSize: 12, background: "var(--popover)", border: "1px solid var(--border)", color: "var(--popover-foreground)" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-semibold tabular-nums ${SENTIMENT.positive.text}`}>
              {fmtPct(summary.percentages.positive)}
            </span>
            <span className="text-xs text-muted-foreground">positive</span>
          </div>
        </div>
        <ul className="mt-2 grid grid-cols-3 gap-2 text-xs">
          {data.map((d) => (
            <li key={d.key} className="flex flex-col items-center rounded-md border p-2">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 rounded-full" style={{ background: d.color }} />
                {d.name}
              </span>
              <span className="font-semibold tabular-nums">{fmtPct(d.pct)}</span>
              <span className="text-[11px] text-muted-foreground">{d.value} posts</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}