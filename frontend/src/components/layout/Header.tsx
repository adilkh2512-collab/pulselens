import { Activity, Database } from "lucide-react"
import { useLocation } from "react-router-dom"

import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { Badge } from "@/components/ui/badge"
import { useHealth } from "@/hooks/useAnalysis"

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/compare": "Compare Periods",
  "/history": "History",
}

export function Header() {
  const { pathname } = useLocation()
  const health = useHealth()

  const status = health.isError
    ? { text: "API offline", cls: "bg-rose-500/10 text-rose-600 border-rose-500/30" }
    : health.data?.model_loaded
      ? { text: "Model ready", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" }
      : { text: "Loading model…", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2">
        <Activity className="size-4 md:hidden" />
        <h1 className="text-sm font-semibold md:text-base">{TITLES[pathname] ?? "PulseLens"}</h1>
      </div>
      <div className="flex items-center gap-2">
        {health.data && (
          <Badge variant="outline" className="hidden gap-1 sm:inline-flex">
            <Database className="size-3" />
            {health.data.runs_stored} runs stored
          </Badge>
        )}
        <Badge variant="outline" className={status.cls}>{status.text}</Badge>
        <ThemeToggle />
      </div>
    </header>
  )
}