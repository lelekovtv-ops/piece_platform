import { useCallback, useMemo, useState } from "react"
import { Sparkles, Loader2 } from "lucide-react"
import { DebouncedTextarea } from "@/components/editor/screenplay/DirectorShotCard"

// lens lives on ShotCard (directorTypes) not TimelineShot — we track it locally

import { useBibleStore } from "@/store/bible"
import { useBoardStore } from "@/store/board"
import { useTimelineStore, type TimelineShot } from "@/store/timeline"
import { generateShotImage } from "@/components/editor/screenplay/DirectorShotCard"
import { CameraToggles } from "./CameraToggles"
import { PromptPreview } from "./PromptPreview"
import { GenerationHistory } from "./GenerationHistory"
import { DebugPanel } from "./DebugPanel"
import { assemblePrompt, type GenerationMode } from "../_lib/promptAssembler"
import { computeVisionHash, isStale } from "../_lib/staleDetection"
import type { ToolkitLevel } from "../_lib/cameraToolkit"
import type { ShotCard } from "@/lib/directorTypes"

interface PipelineShotCardProps {
  card: ShotCard
  shot: TimelineShot
  toolkit: ToolkitLevel
  genMode: GenerationMode
}

export function PipelineShotCard({ card, shot, toolkit, genMode }: PipelineShotCardProps) {
  const characters = useBibleStore((s) => s.characters)
  const locations = useBibleStore((s) => s.locations)
  const props = useBibleStore((s) => s.props)
  const projectStyle = useBoardStore((s) => s.projectStyle)
  const model = useBoardStore((s) => s.selectedImageGenModel) || "nano-banana-2"
  const updateShot = useTimelineStore((s) => s.updateShot)

  const [isGenerating, setIsGenerating] = useState(false)
  const [lastGenMs, setLastGenMs] = useState<number | null>(null)
  const [genHash, setGenHash] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(true)
  const [historyIndex, setHistoryIndex] = useState(0)
  const [localLens, setLocalLens] = useState(card.lens || "")

  // Prompt assembly
  const assembled = useMemo(
    () => assemblePrompt(shot, genMode, characters, locations, props, projectStyle),
    [shot, genMode, characters, locations, props, projectStyle],
  )

  // Stale detection
  const currentHash = useMemo(
    () => computeVisionHash(shot.directorNote || "", shot.shotSize || "", localLens, shot.cameraMotion || ""),
    [shot.directorNote, shot.shotSize, localLens, shot.cameraMotion],
  )
  const stale = isStale(currentHash, genHash)

  // Generation
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    const start = Date.now()
    try {
      const result = await generateShotImage(shot)
      const elapsed = Date.now() - start
      setLastGenMs(elapsed)
      setGenHash(currentHash)

      // Update shot with generated image
      const history = [...(shot.generationHistory || []), {
        url: result.objectUrl,
        blobKey: result.blobKey,
        prompt: assembled.raw,
        timestamp: Date.now(),
      }]
      updateShot(shot.id, {
        thumbnailUrl: result.objectUrl,
        thumbnailBlobKey: result.blobKey,
        generationHistory: history,
      }, "storyboard")
      setHistoryIndex(history.length - 1)
    } catch (err) {
      console.error("Generation failed:", err)
    } finally {
      setIsGenerating(false)
    }
  }, [shot, assembled.raw, currentHash, updateShot])

  // Camera change
  const handleCameraChange = useCallback(
    (patch: { shotSize?: string; lens?: string; cameraMotion?: string }) => {
      const { lens: newLens, ...timelinePatch } = patch
      if (newLens !== undefined) setLocalLens(newLens)
      if (Object.keys(timelinePatch).length > 0) {
        updateShot(shot.id, timelinePatch, "storyboard")
      }
    },
    [shot.id, updateShot],
  )

  // Vision change
  const handleVisionChange = useCallback(
    (text: string) => {
      updateShot(shot.id, { directorNote: text }, "storyboard")
    },
    [shot.id, updateShot],
  )

  // Prompt override
  const handlePromptOverride = useCallback(
    (prompt: string) => {
      updateShot(shot.id, { imagePrompt: prompt }, "storyboard")
    },
    [shot.id, updateShot],
  )

  // History navigation
  const history = shot.generationHistory || []
  const activeUrl = history[historyIndex]?.url || shot.thumbnailUrl

  // Bible pills
  const mentionedChars = characters.filter((c) => card.characters.includes(c.name))
  const mentionedLocs = locations.filter((l) => card.locations.includes(l.name))

  return (
    <div className="flex gap-3 rounded-xl border border-white/6 bg-white/[0.02] p-3">
      {/* ── Left: fields ── */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Slate + duration */}
        <div className="flex items-center gap-2">
          <span className="rounded bg-[#D4A853]/15 px-2 py-0.5 text-xs font-bold text-[#D4A853]">
            {card.shotNumber}
          </span>
          <span className="text-[10px] tabular-nums text-white/30">
            {card.duration.toFixed(1)}s
          </span>
        </div>

        {/* Vision field */}
        <div className="border-l-2 border-[#D4A853]/30 pl-2">
          <span className="text-[9px] uppercase tracking-widest text-[#D4A853]/40">Vision</span>
          <DebouncedTextarea
            value={shot.directorNote || ""}
            onCommit={handleVisionChange}
            placeholder="How do you see this shot..."
            className="mt-0.5 w-full resize-none rounded border-none bg-transparent text-xs leading-relaxed text-white/70 outline-none placeholder:text-white/15"
            rows={2}
          />
        </div>

        {/* Camera toggles */}
        <div>
          <button
            onClick={() => setCameraOpen(!cameraOpen)}
            className="mb-1 text-[9px] uppercase tracking-widest text-[#4A7C6F]/50 hover:text-[#4A7C6F]/80"
          >
            Camera {cameraOpen ? "▾" : "▸"}
          </button>
          {cameraOpen && (
            <CameraToggles
              shotType={shot.shotSize || ""}
              lens={localLens}
              cameraMove={shot.cameraMotion || ""}
              toolkit={toolkit}
              onChange={handleCameraChange}
            />
          )}
        </div>

        {/* Prompt preview */}
        <PromptPreview
          segments={assembled.segments}
          rawPrompt={assembled.raw}
          onOverride={handlePromptOverride}
        />

        {/* Bible pills */}
        {(mentionedChars.length > 0 || mentionedLocs.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {mentionedChars.map((c) => (
              <span
                key={c.id}
                className="rounded-full bg-[#D4A853]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#D4A853]/60"
              >
                {c.name}
                {c.referenceImages.length > 0 && ` (${c.referenceImages.length} ref)`}
              </span>
            ))}
            {mentionedLocs.map((l) => (
              <span
                key={l.id}
                className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400/60"
              >
                {l.name}
              </span>
            ))}
          </div>
        )}

        {/* Debug */}
        <DebugPanel
          assembled={assembled}
          referenceCount={mentionedChars.length + mentionedLocs.length}
          model={model}
          lastGenMs={lastGenMs}
        />
      </div>

      {/* ── Right: preview ── */}
      <div className="flex w-[220px] flex-shrink-0 flex-col items-center gap-2">
        {/* 16:9 preview */}
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/8 bg-black/40">
          {activeUrl ? (
            <img src={activeUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-white/15">
              No preview
            </div>
          )}

          {/* Stale indicator */}
          {stale && shot.thumbnailUrl && (
            <div className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-yellow-500/20 px-1.5 py-0.5">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />
              <span className="text-[8px] font-medium text-yellow-400">OUTDATED</span>
            </div>
          )}
        </div>

        {/* History nav */}
        <GenerationHistory
          history={history.map((h) => ({ url: h.url, timestamp: h.timestamp }))}
          activeIndex={historyIndex}
          onNavigate={setHistoryIndex}
        />

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#D4A853]/30 bg-[#D4A853]/10 px-3 py-1.5 text-xs font-medium text-[#D4A853] transition hover:bg-[#D4A853]/20 disabled:opacity-40"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Generate
            </>
          )}
        </button>
      </div>
    </div>
  )
}
