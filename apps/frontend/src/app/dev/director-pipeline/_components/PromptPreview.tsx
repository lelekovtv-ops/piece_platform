import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { PromptSegment } from "../_lib/promptAssembler"

interface PromptPreviewProps {
  segments: PromptSegment[]
  rawPrompt: string
  onOverride: (prompt: string) => void
}

const SEGMENT_COLORS: Record<string, string> = {
  source: "rgba(255,255,255,0.4)",
  vision: "#D4A853",
  camera: "#4A7C6F",
  element: "#9B72CF",
  style: "rgba(255,255,255,0.25)",
}

export function PromptPreview({ segments, rawPrompt, onOverride }: PromptPreviewProps) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState("")

  const startEdit = () => {
    setEditValue(rawPrompt)
    setEditing(true)
  }

  const saveEdit = () => {
    onOverride(editValue)
    setEditing(false)
  }

  return (
    <div className="rounded-lg border border-white/6 bg-white/2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-white/30" />
        ) : (
          <ChevronRight className="h-3 w-3 text-white/30" />
        )}
        <span className="text-[10px] uppercase tracking-widest text-white/30">Prompt</span>
        <span className="ml-auto text-[10px] text-white/20">{rawPrompt.length} chars</span>
      </button>

      {open && (
        <div className="border-t border-white/6 px-2 py-2">
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="min-h-[80px] w-full resize-y rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] leading-relaxed text-white/70 outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveEdit}
                  className="rounded px-2 py-0.5 text-[10px] text-[#D4A853] border border-[#D4A853]/30 hover:bg-[#D4A853]/10"
                >
                  Apply
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="rounded px-2 py-0.5 text-[10px] text-white/40 hover:text-white/60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              className="cursor-pointer text-[11px] leading-relaxed"
              onClick={startEdit}
              title="Click to edit"
            >
              {segments.map((seg, i) => (
                <span key={i} style={{ color: SEGMENT_COLORS[seg.type] || "rgba(255,255,255,0.4)" }}>
                  {seg.text}
                  {i < segments.length - 1 && " "}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
