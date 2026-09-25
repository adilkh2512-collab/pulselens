import { Search, Sparkles } from "lucide-react"
import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import type { AnalyzeRequest, SortOrder } from "@/types/api"

interface Props {
  onSubmit: (req: AnalyzeRequest) => void
  busy: boolean
  maxSampleSize: number
  initialQuery?: string
}

const LANGS = [
  { value: "en", label: "English" },
  { value: "", label: "Any language" },
]

export function SearchBar({ onSubmit, busy, maxSampleSize, initialQuery = "" }: Props) {
  const [query, setQuery] = useState(initialQuery)
  const [sampleSize, setSampleSize] = useState(500)
  const [sort, setSort] = useState<SortOrder>("latest")
  const [lang, setLang] = useState("en")
  const [force, setForce] = useState(false)

  const max = Math.max(100, maxSampleSize)
  const size = Math.min(sampleSize, max)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    onSubmit({ query: q, sample_size: size, sort, lang: lang || null, force })
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Topic, brand, person or event — e.g. IIT Bombay, ChatGPT, Boeing"
              className="h-11 pl-9 text-base"
              maxLength={200}
              disabled={busy}
            />
          </div>
          <Button type="submit" size="lg" className="h-11 gap-2" disabled={busy || !query.trim()}>
            <Sparkles className="size-4" />
            {busy ? "Analysing…" : "Analyze Pulse"}
          </Button>
        </form>

        <div className="grid gap-5 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Sample size</span>
              <span className="font-semibold tabular-nums">{size.toLocaleString()} posts</span>
            </div>
            <Slider
              min={100}
              max={max}
              step={100}
              value={[size]}
              onValueChange={(v) => setSampleSize(Array.isArray(v) ? v[0] : (v as number))}
              disabled={busy}
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>100</span>
              <span>{max.toLocaleString()}</span>
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Ranking</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOrder)}
              disabled={busy}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs"
            >
              <option value="latest">Latest</option>
              <option value="top">Top engagement</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Language</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              disabled={busy}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs"
            >
              {LANGS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm md:h-9">
            <Switch checked={force} onCheckedChange={(c) => setForce(Boolean(c))} disabled={busy} />
            <span className="text-muted-foreground">Fresh fetch</span>
          </label>
        </div>
      </CardContent>
    </Card>
  )
}