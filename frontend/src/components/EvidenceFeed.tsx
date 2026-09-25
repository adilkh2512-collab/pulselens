import { ExternalLink, Heart, MessageCircle, Repeat2, ShieldAlert } from "lucide-react"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fmtDateTime, SENTIMENT } from "@/lib/sentiment"
import { cn } from "@/lib/utils"
import type { AnalyzedPost, AspectMetric, SentimentLabel } from "@/types/api"

type LabelFilter = "all" | SentimentLabel
type SortKey = "latest" | "likes" | "confidence"
const PAGE = 20

interface Props {
  posts: AnalyzedPost[]
  aspects: AspectMetric[]
  aspectFilter: string | null
  onAspectFilter: (aspect: string | null) => void
}

export function EvidenceFeed({ posts, aspects, aspectFilter, onAspectFilter }: Props) {
  const [label, setLabel] = useState<LabelFilter>("all")
  const [sort, setSort] = useState<SortKey>("latest")
  const [shown, setShown] = useState(PAGE)

  const displayFor = useMemo(() => Object.fromEntries(aspects.map((a) => [a.aspect, a.display])), [aspects])

  const filtered = useMemo(() => {
    let list = posts
    if (label !== "all") list = list.filter((p) => p.effective_label === label)
    if (aspectFilter) list = list.filter((p) => p.aspects.includes(aspectFilter))
    const sorted = [...list]
    if (sort === "latest") sorted.sort((a, b) => b.created_at.localeCompare(a.created_at))
    if (sort === "likes") sorted.sort((a, b) => b.likes - a.likes || b.reposts - a.reposts)
    if (sort === "confidence") sorted.sort((a, b) => b.confidence - a.confidence)
    return sorted
  }, [posts, label, aspectFilter, sort])

  const visible = filtered.slice(0, shown)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Live Evidence Feed</CardTitle>
            <CardDescription>
              {filtered.length} of {posts.length} raw public posts backing the metrics above
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border p-0.5 text-xs">
              {(["all", "positive", "neutral", "negative"] as LabelFilter[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setLabel(k); setShown(PAGE) }}
                  className={cn(
                    "rounded px-2.5 py-1 capitalize transition-colors",
                    label === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="latest">Latest first</option>
              <option value="likes">Most liked</option>
              <option value="confidence">Most confident</option>
            </select>
          </div>
        </div>
        {aspectFilter && (
          <div className="flex items-center gap-2 pt-2 text-xs">
            <span className="text-muted-foreground">Aspect filter:</span>
            <Badge variant="secondary" className="gap-1">
              {displayFor[aspectFilter] ?? aspectFilter}
              <button type="button" onClick={() => onAspectFilter(null)} className="ml-1 opacity-70 hover:opacity-100" aria-label="Clear aspect filter">×</button>
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {visible.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No posts match the current filters.</p>
        )}
        {visible.map((p) => {
          const tone = SENTIMENT[p.effective_label]
          return (
            <article key={p.post_id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase">
                    {(p.author_name || p.author_handle).slice(0, 1)}
                  </span>
                  <div className="min-w-0 leading-tight">
                    <div className="truncate text-sm font-medium">{p.author_name}</div>
                    <div className="truncate text-xs text-muted-foreground">@{p.author_handle} · {fmtDateTime(p.created_at)}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={cn("capitalize", tone.soft)}>{p.effective_label}</Badge>
                  {p.low_confidence && (
                    <Badge variant="outline" className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                      <ShieldAlert className="size-3" /> low confidence · model said {p.label}
                    </Badge>
                  )}
                  <span className="text-[11px] tabular-nums text-muted-foreground">{Math.round(p.confidence * 100)}%</span>
                </div>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{p.text}</p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1"><Heart className="size-3.5" />{p.likes}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="size-3.5" />{p.replies}</span>
                  <span className="flex items-center gap-1"><Repeat2 className="size-3.5" />{p.reposts + p.quotes}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {p.aspects.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => onAspectFilter(aspectFilter === a ? null : a)}
                      className={cn(
                        "rounded-full border px-2 py-0.5 transition-colors hover:bg-accent",
                        aspectFilter === a && "border-primary bg-primary/10 text-foreground",
                      )}
                    >
                      #{displayFor[a] ?? a}
                    </button>
                  ))}
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground">
                      <ExternalLink className="size-3.5" /> open
                    </a>
                  )}
                </div>
              </div>
            </article>
          )
        })}
        {shown < filtered.length && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE)}>
              Show {Math.min(PAGE, filtered.length - shown)} more
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}