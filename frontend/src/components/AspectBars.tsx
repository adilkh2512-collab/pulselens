import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fmtNss, SENTIMENT } from "@/lib/sentiment"
import { cn } from "@/lib/utils"
import type { AspectMetric } from "@/types/api"

interface Props {
  aspects: AspectMetric[]
  selected: string | null
  onSelect: (aspect: string | null) => void
}

export function AspectBars({ aspects, selected, onSelect }: Props) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Aspect Sentiment Split</CardTitle>
        <CardDescription>
          Topics discovered automatically from the posts · click one to filter the evidence feed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {aspects.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No topic was mentioned often enough in this sample. Try a larger sample size.
          </p>
        )}
        {aspects.map((a) => {
          const active = selected === a.aspect
          const nssClass = a.nss >= 20 ? SENTIMENT.positive.text : a.nss < 0 ? SENTIMENT.negative.text : "text-amber-600 dark:text-amber-400"
          return (
            <button
              key={a.aspect}
              type="button"
              onClick={() => onSelect(active ? null : a.aspect)}
              className={cn(
                "w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent/50",
                active && "border-primary/60 bg-primary/5",
              )}
            >
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">{a.display}</span>
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{a.mentions} mentions</span>
                  <span className={cn("font-semibold tabular-nums", nssClass)}>{fmtNss(a.nss)}</span>
                </span>
              </div>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <span className="bg-emerald-500" style={{ width: `${a.positive_pct}%` }} title={`Positive ${a.positive_pct}%`} />
                <span className="bg-slate-400/70" style={{ width: `${a.neutral_pct}%` }} title={`Neutral ${a.neutral_pct}%`} />
                <span className="bg-rose-500" style={{ width: `${a.negative_pct}%` }} title={`Negative ${a.negative_pct}%`} />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted-foreground">
                <span className={SENTIMENT.positive.text}>{a.positive_pct.toFixed(0)}% positive</span>
                <span>{a.neutral_pct.toFixed(0)}% neutral</span>
                <span className={SENTIMENT.negative.text}>{a.negative_pct.toFixed(0)}% negative</span>
              </div>
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}