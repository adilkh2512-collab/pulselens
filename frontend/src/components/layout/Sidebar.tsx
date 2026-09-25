import { Activity, GitCompareArrows, History, LayoutDashboard } from "lucide-react"
import { NavLink } from "react-router-dom"

import { cn } from "@/lib/utils"

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/compare", label: "Compare Periods", icon: GitCompareArrows, end: false },
  { to: "/history", label: "History", icon: History, end: false },
]

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Activity className="size-4" />
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold">PulseLens</div>
          <div className="text-[11px] text-muted-foreground">Bluesky sentiment intelligence</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t p-4 text-[11px] text-muted-foreground">
        Learning project · Public Bluesky data only
      </div>
    </aside>
  )
}