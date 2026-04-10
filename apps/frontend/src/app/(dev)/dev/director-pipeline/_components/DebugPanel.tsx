import { useState } from "react"
import { Bug, ChevronDown, ChevronRight } from "lucide-react"
import type { AssembledPrompt } from "../_lib/promptAssembler"

interface DebugPanelProps {
  assembled: AssembledPrompt | null
  referenceCount: number
  model: string
  lastGenMs: number | null
}

export function DebugPanel({ assembled, referenceCount, model, lastGenMs }: DebugPanelProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-white/4 bg-white/2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-white/20" />
        ) : (
          <ChevronRight className="h-3 w-3 text-white/20" />
        )}
        <Bug className="h-3 w-3 text-white/20" />
        <span className="text-[9px] uppercase tracking-widest text-white/20">Debug</span>
      </button>

      {open && assembled && (
        <div className="border-t border-white/4 px-2 py-2 text-[10px] leading-relaxed text-white/30">
          <div className="mb-1">
            <span className="text-white/20">Mode:</span> {assembled.mode}
          </div>
          <div className="mb-1">
            <span className="text-white/20">Model:</span> {model}
          </div>
          <div className="mb-1">
            <span className="text-white/20">Refs:</span> {referenceCount} images
          </div>
          {lastGenMs !== null && (
            <div className="mb-1">
              <span className="text-white/20">Last gen:</span> {(lastGenMs / 1000).toFixed(1)}s
            </div>
          )}
          <div className="mt-2 max-h-40 overflow-auto rounded bg-black/30 p-1.5 font-mono text-[9px] text-white/25">
            {assembled.raw}
          </div>
        </div>
      )}
    </div>
  )
}
