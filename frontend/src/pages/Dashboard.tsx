import { Clock, Cpu } from "lucide-react"
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"

import { AnalysisProgress } from "@/components/AnalysisProgress"
import { AspectBars } from "@/components/AspectBars"
import { ConsensusDonut } from "@/components/charts/ConsensusDonut"
import { PolarityAreaChart } from "@/components/charts/PolarityAreaChart"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { EvidenceFeed } from "@/components/EvidenceFeed"
import { ExecutiveBriefing } from "@/components/ExecutiveBriefing"
import { KpiCards } from "@/components/KpiCards"
import { NssGauge } from "@/components/NssGauge"
import { SearchBar } from "@/components/SearchBar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useHealth, useRun, useStartAnalysis } from "@/hooks/useAnalysis"
import { fmtDateTime, TERMINAL_STAGES } from "@/lib/sentiment"

export default function Dashboard() {
  const [params, setParams] = useSearchParams()
  const runId = params.get("run")
  const health = useHealth()
  const run = useRun(runId)
  const start = useStartAnalysis((accepted) => setParams({ run: accepted.run_id }))
  const [aspectFilter, setAspectFilter] = useState<string | null>(null)

  useEffect(() => {
    setAspectFilter(null)
  }, [runId])

  const status = run.data
  const inFlight = Boolean(runId) && (!status || !TERMINAL_STAGES.includes(status.status))
  const result = status?.status === "done" ? status.result : null

  return (
    <>
      <SearchBar
        onSubmit={(req) => start.mutate(req)}
        busy={start.isPending || inFlight}
        maxSampleSize={health.data?.max_sample_size ?? 1500}
      />

      {runId && !status && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-3 w-full" />
          </CardContent>
        </Card>
      )}

      {status && status.status !== "done" && <AnalysisProgress status={status} />}

      {result && (
        <>
          <Card>
            <CardHeader className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-lg">
                  “{result.query}”
                  <span className="ml-2 font-normal text-muted-foreground">public pulse</span>
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="gap-1">
                    <Clock className="size-3" />
                    {fmtDateTime(result.oldest)} → {fmtDateTime(result.newest)}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Cpu className="size-3" />
                    {result.model.split("/").pop()}
                  </Badge>
                  <Badge variant="outline">{result.duration_seconds}s</Badge>
                  <Badge variant="outline" className="capitalize">{result.sort}</Badge>
                  {status?.cached && <Badge variant="secondary">from history</Badge>}
                  <ExecutiveBriefing result={result} />
                </div>
              </div>
            </CardHeader>
          </Card>

          <ErrorBoundary title="KPI cards">
            <KpiCards result={result} />
          </ErrorBoundary>

          <div className="grid gap-4 lg:grid-cols-3">
            <ErrorBoundary title="NSS gauge">
              <NssGauge summary={result.summary} />
            </ErrorBoundary>
            <div className="lg:col-span-2">
              <ErrorBoundary title="Polarity chart">
                <PolarityAreaChart timeline={result.timeline} />
              </ErrorBoundary>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ErrorBoundary title="Consensus donut">
              <ConsensusDonut summary={result.summary} />
            </ErrorBoundary>
            <div className="lg:col-span-2">
              <ErrorBoundary title="Aspect bars">
                <AspectBars aspects={result.aspects} selected={aspectFilter} onSelect={setAspectFilter} />
              </ErrorBoundary>
            </div>
          </div>

          <ErrorBoundary title="Evidence feed">
            <EvidenceFeed
              posts={result.posts}
              aspects={result.aspects}
              aspectFilter={aspectFilter}
              onAspectFilter={setAspectFilter}
            />
          </ErrorBoundary>
        </>
      )}

      {!runId && (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Enter a topic above and click <span className="font-medium text-foreground">Analyze Pulse</span> to
            fetch live Bluesky posts and score public sentiment.
          </CardContent>
        </Card>
      )}
    </>
  )
}