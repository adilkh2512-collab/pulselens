import { AlertTriangle } from "lucide-react"
import { Component, type ErrorInfo, type ReactNode } from "react"

import { Card, CardContent } from "@/components/ui/card"

interface Props { title: string; children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.title}]`, error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <Card className="border-rose-500/40">
          <CardContent className="space-y-2 p-5 text-sm">
            <div className="flex items-center gap-2 font-medium text-rose-600 dark:text-rose-400">
              <AlertTriangle className="size-4" /> {this.props.title} failed to render
            </div>
            <pre className="overflow-auto rounded bg-muted p-3 text-xs">{this.state.error.message}</pre>
          </CardContent>
        </Card>
      )
    }
    return this.props.children
  }
}