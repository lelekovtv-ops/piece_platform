"use client"

import { SmartImage } from "@/components/ui/SmartImage"
import { useCallback, useMemo, useState } from "react"
import { ChevronDown, Copy, Loader2, Sparkles, Trash2, Wand2 } from "lucide-react"
import type { TimelineShot } from "@/store/timeline"
import { useTimelineStore } from "@/store/timeline"
import { useBibleStore } from "@/store/bible"
import { useBoardStore } from "@/store/board"
import { DebouncedTextarea } from "@/components/editor/screenplay/DirectorShotCard"
import { buildImagePrompt } from "@/lib/promptBuilder"
import type { CharacterEntry, LocationEntry, PropEntry } from "@/lib/bibleParser"
import { CameraPanel, cameraToPromptParts, DEFAULT_CAMERA, type CameraState } from "./CameraPanel"
import { PromptPanel, type PromptSource } from "./PromptPanel"

interface UnifiedShotCardProps {
  shot: TimelineShot
  index: number
  slateNumber: string
  selected: boolean
  bibleChars: CharacterEntry[]
  bibleLocs: LocationEntry[]
  bibleProps: PropEntry[]
  onSelect: () => void
  onUpdate: (patch: Partial<TimelineShot>) => void
  onGenerate: () => void
  isGenerating: boolean
  onDelete: () => void
}

export function UnifiedShotCard({
  shot, index, slateNumber, selected,
  bibleChars, bibleLocs, bibleProps,
  onSelect, onUpdate, onGenerate, isGenerating, onDelete,
}: UnifiedShotCardProps) {
  const [cameraOpen, setCameraOpen] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [camera, setCamera] = useState<CameraState>(DEFAULT_CAMERA)
  const [promptManualEdit, setPromptManualEdit] = useState(false)
  const projectStyle = useBoardStore((s) => s.projectStyle)

  const previewSrc = shot.thumbnailUrl || shot.svg || null

  // Bible pills
  const excluded = new Set(shot.excludedBibleIds ?? [])
  const allEntries = [
    ...bibleChars.map((c) => ({ id: `char-${c.id}`, label: c.name, type: "char" as const, imageUrl: c.generatedPortraitUrl, prompt: c.appearancePrompt })),
    ...bibleLocs.map((l) => ({ id: `loc-${l.id}`, label: l.name, type: "loc" as const, imageUrl: l.generatedImageUrl, prompt: l.appearancePrompt })),
    ...bibleProps.map((p) => ({ id: `prop-${p.id}`, label: p.name, type: "prop" as const, imageUrl: p.generatedImageUrl, prompt: p.appearancePrompt })),
  ]

  // Auto-build prompt from vision + camera + bible
  const autoPrompt = useMemo(() => {
    const parts: string[] = []

    // Source text
    if (shot.sourceText) parts.push(shot.sourceText)

    // Vision
    if (shot.directorNote) parts.push(shot.directorNote)

    // Camera
    const camParts = cameraToPromptParts(camera)
    if (camParts.length > 0) parts.push(camParts.join(", "))

    // Character/location elements
    const activeEntries = allEntries.filter((e) => !excluded.has(e.id))
    for (const e of activeEntries) {
      if (e.prompt) parts.push(`${e.label}: ${e.prompt}`)
    }

    if (projectStyle) parts.push(projectStyle)

    parts.push("--ar 16:9")
    return parts.join("\n\n")
  }, [shot.sourceText, shot.directorNote, camera, allEntries, excluded, projectStyle])

  // Prompt sources for chips
  const promptSources = useMemo<PromptSource[]>(() => {
    const sources: PromptSource[] = []
    if (shot.sourceText) sources.push({ label: "source text", type: "source" })
    if (shot.directorNote) sources.push({ label: "vision", type: "vision" })
    if (camera.shotSize) sources.push({ label: camera.shotSize, type: "camera" })
    if (camera.movement) sources.push({ label: camera.movement.replace("-", " "), type: "camera" })
    if (camera.lens) sources.push({ label: camera.lens.match(/^\d/) ? `${camera.lens}mm` : camera.lens, type: "camera" })
    const activeElements = allEntries.filter((e) => !excluded.has(e.id))
    for (const e of activeElements) sources.push({ label: `@${e.label}`, type: "element" })
    return sources
  }, [shot.sourceText, shot.directorNote, camera, allEntries, excluded])

  // Effective prompt
  const effectivePrompt = promptManualEdit ? (shot.imagePrompt || autoPrompt) : autoPrompt

  // Prompt change
  const handlePromptChange = useCallback((value: string) => {
    setPromptManualEdit(true)
    onUpdate({ imagePrompt: value })
  }, [onUpdate])

  // Prompt reset
  const handlePromptReset = useCallback(() => {
    setPromptManualEdit(false)
    onUpdate({ imagePrompt: "" })
  }, [onUpdate])

  // Camera change → also update shotSize/cameraMotion on TimelineShot for prompt builder compat
  const handleCameraChange = useCallback((next: CameraState) => {
    setCamera(next)
    onUpdate({
      shotSize: next.shotSize,
      cameraMotion: next.movement ? next.movement.replace("-", " ") : "",
      cameraNote: cameraToPromptParts(next).join(". "),
    })
  }, [onUpdate])

  return (
    <article
      data-director-shot-id={shot.id}
      className={`rounded-[18px] border overflow-hidden text-[#E5E0DB] transition-[border-color,background,box-shadow] duration-100 ease-out ${
        selected
          ? "border-[#DCC7A3]/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.04)_100%)] shadow-[0_0_0_1px_rgba(220,199,163,0.16),0_0_0_6px_rgba(212,168,83,0.08),0_24px_52px_rgba(0,0,0,0.24)]"
          : "border-white/8 bg-white/3 shadow-[0_20px_45px_rgba(0,0,0,0.18)] hover:border-white/10 hover:bg-white/4"
      }`}
      onClick={onSelect}
    >
      {/* ── Top: fields + thumbnail ── */}
      <div className="flex">
        <div className="flex-1 p-3">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[14px] font-bold tabular-nums tracking-[0.06em] ${
                selected ? "bg-[#D4A853]/20 text-[#D4A853]" : "bg-white/8 text-white/70"
              }`}>
                {slateNumber}
              </span>
              <input
                type="text"
                defaultValue={(shot.duration / 1000).toFixed(1)}
                key={shot.duration}
                onBlur={(e) => {
                  const val = parseFloat(e.currentTarget.value)
                  if (!isNaN(val) && val > 0) onUpdate({ duration: Math.round(val * 1000) })
                }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                onClick={(e) => e.stopPropagation()}
                className="w-9 rounded bg-white/5 text-center text-[12px] font-semibold tabular-nums text-white/50 outline-none focus:bg-white/8 focus:text-white/80 focus:ring-1 focus:ring-[#D4A853]/30"
              />
              <span className="text-[8px] text-white/20">sec</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation() }}
                disabled={!shot.directorNote?.trim()}
                className="flex h-8 items-center gap-1 rounded-md border border-white/10 bg-white/4 px-2 text-[10px] uppercase tracking-[0.14em] text-[#D7CDC1] transition-colors hover:bg-white/7 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Wand2 size={12} />
                Enhance
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation() }}
                disabled={!shot.directorNote?.trim()}
                className="flex h-8 items-center gap-1 rounded-md border border-[#D4A853]/20 bg-[#D4A853]/8 px-2 text-[10px] uppercase tracking-[0.14em] text-[#D4A853] transition-colors hover:bg-[#D4A853]/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Wand2 size={12} />
                Build
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onGenerate() }}
                disabled={isGenerating}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-[#D4A853]/15 text-[#D4A853] transition-colors hover:bg-[#D4A853]/25 disabled:opacity-40"
              >
                {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-red-400/20 bg-red-400/6 text-red-200/80 transition-colors hover:bg-red-400/10 hover:text-red-100"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Vision field */}
          <div className={`flex gap-3 rounded-xl border px-3 items-start py-2 transition-[border-color,background-color] duration-100 ease-out ${
            selected ? "border-[#DCC7A3]/22 bg-white/5" : "border-white/8 bg-white/3"
          }`}>
            <DebouncedTextarea
              value={shot.directorNote || ""}
              onCommit={(value) => onUpdate({ directorNote: value })}
              placeholder="How do you see this shot..."
              rows={2}
              autoGrow
              className="w-full min-h-[40px] resize-none overflow-hidden bg-transparent px-0 py-0 text-[13px] leading-5 text-[#ECE5D8] outline-none placeholder:text-white/20"
            />
          </div>

          {/* Tags */}
          {allEntries.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {allEntries.map((entry) => {
                const isOff = excluded.has(entry.id)
                return (
                  <div key={entry.id} className="group/pill relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        const next = new Set(excluded)
                        if (isOff) next.delete(entry.id)
                        else next.add(entry.id)
                        onUpdate({ excludedBibleIds: Array.from(next) })
                      }}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono border transition-colors ${
                        isOff
                          ? "bg-white/3 text-white/20 border-white/5 line-through"
                          : entry.type === "char" ? "bg-[#D4A853]/10 text-[#D4A853]/80 border-[#D4A853]/20"
                          : entry.type === "loc" ? "bg-emerald-500/10 text-emerald-400/70 border-emerald-500/20"
                          : "bg-sky-500/10 text-sky-400/70 border-sky-500/20"
                      }`}
                    >
                      {entry.imageUrl && <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-60" />}
                      {entry.label}
                    </button>
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 rounded-lg border border-white/10 bg-black/90 p-1.5 opacity-0 shadow-xl backdrop-blur-xl transition-opacity group-hover/pill:opacity-100">
                      {entry.imageUrl ? (
                        <img src={entry.imageUrl} alt={entry.label} className="h-16 w-16 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-md bg-white/5 text-[8px] text-white/30">No image</div>
                      )}
                      <p className="mt-1 max-w-[120px] truncate text-center text-[8px] text-white/50">{entry.prompt || entry.label}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Thumbnail */}
        <div className={`w-[200px] shrink-0 border-l border-white/8 bg-[#1a1a2a] flex items-center justify-center ${previewSrc ? "cursor-pointer" : ""}`}>
          {previewSrc ? (
            <div className="relative w-full aspect-video">
                            <SmartImage src={previewSrc} alt="" fill className="object-cover" sizes="200px" />
            </div>
          ) : (
            <div className="text-center py-6">
              <span className="inline-flex items-center justify-center rounded-md bg-white/8 px-2.5 py-1 text-[18px] font-bold tabular-nums text-white/30">{slateNumber}</span>
              <p className="mt-1.5 text-[10px] text-white/20">No thumbnail</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Collapsible: Camera ── */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setCameraOpen(!cameraOpen) }}
        className={`w-full flex items-center justify-between px-3.5 py-2 border-t transition-colors ${
          cameraOpen ? "border-[#2a2a2a] bg-[#1e1e1e]" : "border-white/6 hover:bg-white/2"
        }`}
      >
        <span className={`text-[10px] uppercase tracking-widest font-mono ${cameraOpen ? "text-white/40" : "text-white/20"}`}>camera</span>
        <ChevronDown size={10} className={`text-white/20 transition-transform ${cameraOpen ? "rotate-180" : ""}`} />
      </button>
      {cameraOpen && (
        <CameraPanel camera={camera} onChange={handleCameraChange} />
      )}

      {/* ── Collapsible: Prompt ── */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setPromptOpen(!promptOpen) }}
        className={`w-full flex items-center justify-between px-3.5 py-2 border-t transition-colors ${
          promptOpen ? "border-[#2a2a2a] bg-[#1e1e1e]" : "border-white/6 hover:bg-white/2"
        }`}
      >
        <span className={`text-[10px] uppercase tracking-widest font-mono ${promptOpen ? "text-white/40" : "text-white/20"}`}>prompt</span>
        <div className="flex items-center gap-2">
          {effectivePrompt.length > 0 && (
            <span className="text-[8px] tabular-nums text-white/15 font-mono">{effectivePrompt.length} chars</span>
          )}
          <ChevronDown size={10} className={`text-white/20 transition-transform ${promptOpen ? "rotate-180" : ""}`} />
        </div>
      </button>
      {promptOpen && (
        <PromptPanel
          prompt={effectivePrompt}
          sources={promptSources}
          isManuallyEdited={promptManualEdit}
          onPromptChange={handlePromptChange}
          onReset={handlePromptReset}
        />
      )}
    </article>
  )
}
