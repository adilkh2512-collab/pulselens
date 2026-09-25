import { Gauge, MessageSquareText, ThumbsDown, ThumbsUp, Target } from "lucide-react"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { fmtInt, fmtNss, fmtPct, nssTone, SENTIMENT } from "@/lib/sentiment"
import type { AnalysisResult } from "@/types/api"

function Kpi({ icon, label, value, sub, valueClass, badge }: {
  icon: ReactNode; label: string; value: string; sub: string; valueClass?: string; badge?: ReactNode
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">{icon}{label}</span>
          {badge}
        </div>
        <div className={cn("text-3xl font-semibold tabular-nums tracking-tight", valueClass)}>{value}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  )
}

export function KpiCards({ result }: { result: AnalysisResult }) {
  const s = result.summary
  const tone = nssTone(s.nss_band)
  const dropped = Object.values(result.dropped).reduce((a, b) => a + b, 0)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Kpi
        icon={<Gauge className="size-3.5" />}
        label="Net Sentiment Score"
        value={fmtNss(s.nss)}
        valueClass={tone.text}
        sub={tone.label}
        badge={<Badge variant="outline" className={cn("text-[10px]", tone.soft)}>{s.nss_band.replace("_", " ")}</Badge>}
      />
      <Kpi
        icon={<MessageSquareText className="size-3.5" />}
        label="Posts analysed"
        value={fmtInt(result.analyzed)}
        sub={`${fmtInt(result.fetched)} fetched · ${dropped} filtered as noise`}
      />
      <Kpi
        icon={<ThumbsUp className="size-3.5" />}
        label="Positive"
        value={fmtPct(s.percentages.positive)}
        valueClass={SENTIMENT.positive.text}
        sub={`${fmtInt(s.counts.positive)} posts`}
      />
      <Kpi
        icon={<ThumbsDown className="size-3.5" />}
        label="Negative"
        value={fmtPct(s.percentages.negative)}
        valueClass={SENTIMENT.negative.text}
        sub={`${fmtInt(s.counts.negative)} posts · ${fmtPct(s.percentages.neutral)} neutral`}
      />
      <Kpi
        icon={<Target className="size-3.5" />}
        label="Mean model confidence"
        value={fmtPct(s.mean_confidence * 100, 0)}
        sub={`${result.low_confidence_count} low-confidence calls treated as neutral`}
      />
    </div>
  )
}