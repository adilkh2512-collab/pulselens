import { AlertTriangle, Check, Loader2 } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { STAGES } from "@/lib/sentiment"
import type { RunStatus } from "@/types/api"

export function AnalysisProgress({ status }: { status: RunStatus }) {
  const failed = status.status === "failed"
  const activeIndex = STAGES.findIndex((s) => s.key === status.status)

  return (
    <Card className={cn(failed && "border-rose-500/40")}>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            {failed ? (
              <AlertTriangle className="size-4 text-rose-500" />
            ) : (
              <Loader2 className="size-4 animate-spin text-primary" />
            )}
            {failed ? "Analysis failed" : status.message}
          </div>
          <span className="font-mono text-xs text-muted-foreground">run {status.run_id}</span>
        </div>

        {!failed && <Progress value={status.progress_pct} />}

        {failed ? (
          <p className="rounded-md bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
            {status.error ?? "Unknown error"}
          </p>
        ) : (
          <ol className="grid gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
            {STAGES.map((stage, i) => {
              const done = activeIndex > i || status.status === "loading_model" && i > 1 && false
              const active = i === activeIndex
              return (
                <li
                  key={stage.key}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2.5 py-1.5",
                    active && "border-primary/50 bg-primary/5 text-foreground",
                    done && "text-muted-foreground",
                    !active && !done && "text-muted-foreground/60",
                  )}
                >
                  {done ? (
                    <Check className="size-3.5 text-emerald-500" />
                  ) : active ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <span className="size-3.5 rounded-full border" />
                  )}
                  {stage.label}
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}