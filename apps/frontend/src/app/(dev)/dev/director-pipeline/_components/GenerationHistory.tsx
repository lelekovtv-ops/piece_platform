import { ChevronLeft, ChevronRight } from "lucide-react"

interface HistoryEntry {
  url: string
  timestamp?: number
}

interface GenerationHistoryProps {
  history: HistoryEntry[]
  activeIndex: number
  onNavigate: (index: number) => void
}

export function GenerationHistory({ history, activeIndex, onNavigate }: GenerationHistoryProps) {
  if (history.length <= 1) return null

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onNavigate(Math.max(0, activeIndex - 1))}
        disabled={activeIndex === 0}
        className="rounded p-0.5 text-white/30 hover:text-white/60 disabled:opacity-20"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <span className="text-[10px] tabular-nums text-white/40">
        {activeIndex + 1}/{history.length}
      </span>
      <button
        onClick={() => onNavigate(Math.min(history.length - 1, activeIndex + 1))}
        disabled={activeIndex === history.length - 1}
        className="rounded p-0.5 text-white/30 hover:text-white/60 disabled:opacity-20"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
