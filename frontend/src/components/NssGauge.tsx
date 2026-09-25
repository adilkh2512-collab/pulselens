import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fmtNss, nssTone } from "@/lib/sentiment"
import { cn } from "@/lib/utils"
import type { SentimentSummary } from "@/types/api"

const CX = 110
const CY = 105
const R = 88

function point(value: number, radius = R) {
  const clamped = Math.max(-100, Math.min(100, value))
  const angle = Math.PI * (1 - (clamped + 100) / 200) // 180° at -100, 0° at +100
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) }
}

function arc(from: number, to: number) {
  const a = point(from)
  const b = point(to)
  return `M ${a.x} ${a.y} A ${R} ${R} 0 0 1 ${b.x} ${b.y}`
}

const ZONES = [
  { from: -100, to: 0, color: "#f43f5e", label: "Critical" },
  { from: 0, to: 20, color: "#f59e0b", label: "Balanced" },
  { from: 20, to: 100, color: "#10b981", label: "Strong" },
]

export function NssGauge({ summary }: { summary: SentimentSummary }) {
  const tone = nssTone(summary.nss_band)
  const needle = point(summary.nss, R - 14)

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Net Sentiment Score</CardTitle>
        <CardDescription>% positive − % negative, from −100 to +100</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <svg viewBox="0 0 220 125" className="w-full max-w-xs">
          {ZONES.map((z) => (
            <path key={z.label} d={arc(z.from, z.to)} stroke={z.color} strokeWidth={14} fill="none" strokeLinecap="butt" opacity={0.9} />
          ))}
          {[-100, -50, 0, 20, 50, 100].map((v) => {
            const p = point(v, R + 14)
            return (
              <text key={v} x={p.x} y={p.y} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)">
                {v > 0 ? `+${v}` : v}
              </text>
            )
          })}
          <line x1={CX} y1={CY} x2={needle.x} y2={needle.y} stroke="var(--foreground)" strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={CX} cy={CY} r={5} fill="var(--foreground)" />
        </svg>
        <div className={cn("-mt-2 text-4xl font-semibold tabular-nums tracking-tight", tone.text)}>{fmtNss(summary.nss)}</div>
        <div className={cn("mt-1 rounded-full border px-3 py-0.5 text-xs", tone.soft)}>{tone.label}</div>
      </CardContent>
    </Card>
  )
}