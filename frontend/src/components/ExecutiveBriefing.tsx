import { FileText, Printer } from "lucide-react"
import { useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { buildRecommendation } from "@/lib/recommendation"
import { fmtDateTime, fmtNss, fmtPct, nssTone } from "@/lib/sentiment"
import { cn } from "@/lib/utils"
import type { AnalysisResult, AnalyzedPost, TimelineBucket } from "@/types/api"

const MAX_TIMELINE_ROWS = 14

function topQuotes(posts: AnalyzedPost[], label: "positive" | "negative", n = 3) {
  return posts
    .filter((p) => p.effective_label === label && !p.low_confidence)
    .sort((a, b) => b.likes + b.reposts - (a.likes + a.reposts) || b.confidence - a.confidence)
    .slice(0, n)
}

function sampleBuckets(items: TimelineBucket[], max = MAX_TIMELINE_ROWS): TimelineBucket[] {
  if (items.length <= max) return items
  const step = (items.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => items[Math.round(i * step)])
}

function SplitBar({ positive, neutral, negative, className }: { positive: number; neutral: number; negative: number; className?: string }) {
  return (
    <div className={cn("flex h-2 overflow-hidden rounded-full border", className)}>
      <span style={{ width: `${positive}%`, background: "#10b981" }} />
      <span style={{ width: `${neutral}%`, background: "#94a3b8" }} />
      <span style={{ width: `${negative}%`, background: "#f43f5e" }} />
    </div>
  )
}

/** The briefing content. Rendered once in the dialog (preview) and once in #print-root (printing). */
function BriefingDocument({ result }: { result: AnalysisResult }) {
  const s = result.summary
  const tone = nssTone(s.nss_band)
  const rec = buildRecommendation(result)
  const negatives = topQuotes(result.posts, "negative")
  const positives = topQuotes(result.posts, "positive")
  const dropped = Object.values(result.dropped).reduce((a, b) => a + b, 0)
  const hasTimeline = result.timeline.buckets.length > 1
  const timelineRows = sampleBuckets(result.timeline.buckets)

  return (
    <article className="space-y-6 text-sm leading-relaxed">
      <header className="border-b pb-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">PulseLens · Executive Sentiment Briefing</div>
        <h1 className="mt-1 text-2xl font-semibold">“{result.query}” — public sentiment on Bluesky</h1>
        <div className="mt-2 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
          <span>Prepared: {fmtDateTime(new Date().toISOString())}</span>
          <span>Run ID: {result.run_id}</span>
          <span>Posts window: {fmtDateTime(result.oldest)} → {fmtDateTime(result.newest)}</span>
          <span>Ranking: {result.sort}{result.lang ? ` · language ${result.lang}` : ""}</span>
          {(result.since || result.until) && <span>Requested window: {result.since ?? "…"} → {result.until ?? "…"}</span>}
          <span>Model: {result.model}</span>
        </div>
      </header>

      <section className="grid grid-cols-4 gap-3">
        <div className={cn("rounded-lg border p-3", tone.soft)}>
          <div className="text-[11px] uppercase tracking-wide opacity-80">Net Sentiment Score</div>
          <div className="text-3xl font-semibold tabular-nums">{fmtNss(s.nss)}</div>
          <div className="text-xs">{tone.label}</div>
        </div>
        {(["positive", "neutral", "negative"] as const).map((k) => (
          <div key={k} className="rounded-lg border p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</div>
            <div className="text-2xl font-semibold tabular-nums">{fmtPct(s.percentages[k])}</div>
            <div className="text-xs text-muted-foreground">{s.counts[k]} posts</div>
          </div>
        ))}
      </section>

      <SplitBar positive={s.percentages.positive} neutral={s.percentages.neutral} negative={s.percentages.negative} className="h-3 w-full" />

      <section>
        <h2 className="mb-2 text-base font-semibold">1. Scope and method</h2>
        <p>
          {result.fetched} public posts were retrieved from the Bluesky network ({result.pages_fetched} API pages);
          {" "}{dropped} were excluded as link-only, too short or hashtag spam, leaving <strong>{result.analyzed}</strong> posts
          for analysis. Each post was classified by a transformer model trained on social-media text. Posts with model
          confidence below {result.confidence_floor} ({result.low_confidence_count} posts) were counted as neutral.
          Mean model confidence: <strong>{fmtPct(s.mean_confidence * 100, 0)}</strong>.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">2. Discussion aspects</h2>
        {result.aspects.length === 0 ? (
          <p className="text-muted-foreground">No topic recurred often enough to form an aspect in this sample.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-1.5 pr-3 font-medium">Aspect</th>
                <th className="py-1.5 pr-3 font-medium">Mentions</th>
                <th className="py-1.5 pr-3 font-medium">Positive</th>
                <th className="py-1.5 pr-3 font-medium">Neutral</th>
                <th className="py-1.5 pr-3 font-medium">Negative</th>
                <th className="py-1.5 pr-3 font-medium">NSS</th>
                <th className="py-1.5 font-medium">Split</th>
              </tr>
            </thead>
            <tbody>
              {result.aspects.map((a) => (
                <tr key={a.aspect} className="border-b last:border-0">
                  <td className="py-1.5 pr-3 font-medium">{a.display}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{a.mentions}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{fmtPct(a.positive_pct, 0)}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{fmtPct(a.neutral_pct, 0)}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{fmtPct(a.negative_pct, 0)}</td>
                  <td className="py-1.5 pr-3 font-semibold tabular-nums">{fmtNss(a.nss)}</td>
                  <td className="py-1.5"><SplitBar positive={a.positive_pct} neutral={a.neutral_pct} negative={a.negative_pct} className="w-28" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {hasTimeline && (
        <section>
          <h2 className="mb-2 text-base font-semibold">3. Sentiment over time</h2>
          {timelineRows.length < result.timeline.buckets.length && (
            <p className="mb-2 text-xs text-muted-foreground">
              Showing {timelineRows.length} evenly spaced of {result.timeline.buckets.length} {result.timeline.granularity?.replace("_", "-")} buckets.
            </p>
          )}
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-1.5 pr-3 font-medium">Bucket start</th>
                <th className="py-1.5 pr-3 font-medium">Posts</th>
                <th className="py-1.5 pr-3 font-medium">Positive</th>
                <th className="py-1.5 pr-3 font-medium">Negative</th>
                <th className="py-1.5 pr-3 font-medium">Mean score</th>
                <th className="py-1.5 font-medium">Split</th>
              </tr>
            </thead>
            <tbody>
              {timelineRows.map((b) => (
                <tr key={b.bucket_start} className="border-b last:border-0">
                  <td className="py-1 pr-3 whitespace-nowrap">{fmtDateTime(b.bucket_start)}</td>
                  <td className="py-1 pr-3 tabular-nums">{b.count}</td>
                  <td className="py-1 pr-3 tabular-nums">{fmtPct(b.positive_pct, 0)}</td>
                  <td className="py-1 pr-3 tabular-nums">{fmtPct(b.negative_pct, 0)}</td>
                  <td className="py-1 pr-3 tabular-nums">{b.mean_score.toFixed(2)}</td>
                  <td className="py-1"><SplitBar positive={b.positive_pct} neutral={b.neutral_pct} negative={b.negative_pct} className="w-24" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="rounded-lg border p-4">
        <h2 className="text-base font-semibold">{hasTimeline ? "4" : "3"}. Strategic recommendation</h2>
        <p className="mt-1 font-medium">{rec.headline}</p>
        <p className="mt-1 text-muted-foreground">{rec.posture}</p>
        {rec.drivers.length > 0 && (
          <>
            <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What is driving the score</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5">{rec.drivers.map((d) => <li key={d}>{d}</li>)}</ul>
          </>
        )}
        <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended actions</h3>
        <ol className="mt-1 list-decimal space-y-1 pl-5">{rec.actions.map((a) => <li key={a}>{a}</li>)}</ol>
        <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Confidence and caveats</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">{rec.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">Representative public quotes</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { title: "Most-engaged negative", list: negatives },
            { title: "Most-engaged positive", list: positives },
          ].map(({ title, list }) => (
            <div key={title}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
              {list.length === 0 && <p className="text-xs text-muted-foreground">None in this sample.</p>}
              <ul className="space-y-2">
                {list.map((p) => (
                  <li key={p.post_id} className="rounded-md border p-2 text-xs">
                    <p className="leading-relaxed">“{p.clean_text}”</p>
                    <p className="mt-1 text-muted-foreground">
                      @{p.author_handle} · {fmtDateTime(p.created_at)} · {p.likes} likes · confidence {Math.round(p.confidence * 100)}%
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t pt-3 text-[11px] text-muted-foreground">
        Generated by PulseLens from public Bluesky posts for learning purposes. Sentiment labels are model estimates
        (three-class social-media classifier) and should be read as directional evidence, not individual verdicts.
      </footer>
    </article>
  )
}

export function ExecutiveBriefing({ result }: { result: AnalysisResult }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <FileText className="size-4" /> Generate Executive PDF
      </Button>

      <Dialog open={open} onOpenChange={(next) => setOpen(Boolean(next))}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Executive Briefing</DialogTitle>
            <DialogDescription>
              Preview of the printable memo. Click “Print / Save as PDF”, then choose “Save as PDF” as the destination
              and untick “Headers and footers” for a clean document.
            </DialogDescription>
          </DialogHeader>

          <BriefingDocument result={result} />

          <div className="flex justify-end pt-2">
            <Button onClick={() => window.print()} className="gap-2">
              <Printer className="size-4" /> Print / Save as PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print-only copy attached directly to <body>; see @media print rules in index.css */}
      {open &&
        createPortal(
          <div id="print-root" className="hidden print:block">
            <BriefingDocument result={result} />
          </div>,
          document.body,
        )}
    </>
  )
}