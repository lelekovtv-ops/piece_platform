"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Copy, RotateCcw } from "lucide-react"

export interface PromptSource {
  label: string
  type: "source" | "vision" | "camera" | "element"
}

interface PromptPanelProps {
  prompt: string
  sources: PromptSource[]
  isManuallyEdited: boolean
  onPromptChange: (prompt: string) => void
  onReset: () => void
}

const CHIP_STYLES: Record<string, string> = {
  source: "bg-[#2a2525] text-[#a88] border-[#3a2a2a]",
  vision: "bg-[#252a25] text-[#8a8] border-[#2a3a2a]",
  camera: "bg-[#25252a] text-[#88a] border-[#2a2a3a]",
  element: "bg-[#2a252a] text-[#a8a] border-[#3a2a3a]",
}

export function PromptPanel({ prompt, sources, isManuallyEdited, onPromptChange, onReset }: PromptPanelProps) {
  const [localValue, setLocalValue] = useState(prompt)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    setLocalValue(prompt)
  }, [prompt])

  const handleChange = useCallback((value: string) => {
    setLocalValue(value)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      onPromptChange(value)
    }, 400)
  }, [onPromptChange])

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(localValue)
  }, [localValue])

  return (
    <div className="px-3.5 py-3 bg-[#1e1e1e]">
      {/* Built from chips */}
      {sources.length > 0 && (
        <div className="mb-2.5">
          <div className="mb-1.5 text-[9px] uppercase tracking-widest text-white/20 font-mono">built from</div>
          <div className="flex flex-wrap gap-1">
            {sources.map((s, i) => (
              <span
                key={i}
                className={`text-[9px] font-mono px-2 py-0.5 rounded border ${CHIP_STYLES[s.type] || CHIP_STYLES.source}`}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Editable prompt */}
      <textarea
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        rows={5}
        className="w-full rounded-lg border border-white/8 bg-[#252525] px-3 py-2.5 text-[12px] font-mono leading-relaxed text-white/60 outline-none resize-y focus:border-white/15 focus:text-white/75"
        placeholder="Prompt will be auto-generated from vision + camera..."
      />

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[9px] font-mono text-white/20">
          {localValue.length} chars · {isManuallyEdited ? "manually edited" : "auto-generated"}
        </span>
        <div className="flex gap-1.5">
          {isManuallyEdited && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 rounded-md border border-red-400/15 px-2.5 py-1 text-[9px] font-mono text-red-300/50 transition hover:border-red-400/30 hover:text-red-300/70"
            >
              <RotateCcw size={9} />
              reset to auto
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1 text-[9px] font-mono text-white/30 transition hover:border-white/20 hover:text-white/50"
          >
            <Copy size={9} />
            copy
          </button>
        </div>
      </div>
    </div>
  )
}
