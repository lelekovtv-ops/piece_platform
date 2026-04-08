"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft, Clapperboard, PanelLeft, PanelLeftClose, Plus,
} from "lucide-react"
import { useBoardStore } from "@/store/board"
import { useTimelineStore, type TimelineShot } from "@/store/timeline"
import { useScriptStore } from "@/store/script"
import { useScenesStore } from "@/store/scenes"
import { useBibleStore } from "@/store/bible"
import { computeSlateNumbers } from "@/lib/shotNumbering"
import { useSceneSync } from "@/hooks/useSceneSync"
import { generateShotImage } from "@/components/editor/screenplay/DirectorShotCard"
import { BibleSidebar } from "./_components/BibleSidebar"
import { UnifiedShotCard } from "./_components/BasicShotCard"

export default function DirectorPipelinePage() {
  const blocks = useScriptStore((s) => s.blocks)
  const shots = useTimelineStore((s) => s.shots)
  const updateShot = useTimelineStore((s) => s.updateShot)
  const addShot = useTimelineStore((s) => s.addShot)
  const removeShot = useTimelineStore((s) => s.removeShot)
  const selectShot = useTimelineStore((s) => s.selectShot)
  const selectedShotId = useTimelineStore((s) => s.selectedShotId)
  const scenes = useScenesStore((s) => s.scenes)
  const selectedSceneId = useScenesStore((s) => s.selectedSceneId)
  const selectScene = useScenesStore((s) => s.selectScene)
  const characters = useBibleStore((s) => s.characters)
  const locations = useBibleStore((s) => s.locations)
  const bibleProps = useBibleStore((s) => s.props)
  // Trigger scene parsing from blocks (normally done in workspace)
  useSceneSync()

  const selectedModel = useBoardStore((s) => s.selectedImageGenModel) || "nano-banana-2"
  const setModel = useBoardStore((s) => s.setSelectedImageGenModel)

  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Shot generation state
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set())
  const [enhancingIds, setEnhancingIds] = useState<Set<string>>(new Set())
  const [buildingPromptIds, setBuildingPromptIds] = useState<Set<string>>(new Set())
  const [scanningIds, setScanningIds] = useState<Set<string>>(new Set())
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set())
  const [lightbox, setLightbox] = useState<{ src: string; shotId: string } | null>(null)

  // Slate numbers
  const slateNumbers = useMemo(() => computeSlateNumbers(blocks, shots), [blocks, shots])
  const shotLabel = useCallback((shotId: string) => slateNumbers.get(shotId) ?? "?", [slateNumbers])

  // Shots by scene
  const shotsBySceneId = useMemo(() => {
    const map = new Map<string, TimelineShot[]>()
    for (const shot of shots) {
      const sid = shot.sceneId
      if (!sid) continue
      const arr = map.get(sid) || []
      arr.push(shot)
      map.set(sid, arr)
    }
    return map
  }, [shots])

  // Scene click
  const handleSceneClick = useCallback((sceneId: string) => {
    selectScene(selectedSceneId === sceneId ? null : sceneId)
  }, [selectedSceneId, selectScene])

  const handleSceneDoubleClick = useCallback((sceneId: string) => {
    setExpandedScenes((prev) => {
      const next = new Set(prev)
      if (next.has(sceneId)) next.delete(sceneId)
      else next.add(sceneId)
      return next
    })
  }, [])

  // Generate image
  const handleGenerateImage = useCallback(async (shotId: string) => {
    const shot = shots.find((s) => s.id === shotId)
    if (!shot) return
    setGeneratingIds((prev) => new Set(prev).add(shotId))
    try {
      const result = await generateShotImage(shot)
      const history = [...(shot.generationHistory || []), {
        url: result.objectUrl,
        blobKey: result.blobKey,
        prompt: "",
        timestamp: Date.now(),
      }]
      updateShot(shotId, {
        thumbnailUrl: result.objectUrl,
        thumbnailBlobKey: result.blobKey,
        generationHistory: history,
      }, "storyboard")
    } catch (err) {
      console.error("Generation failed:", err)
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev)
        next.delete(shotId)
        return next
      })
    }
  }, [shots, updateShot])

  // Shot update
  const handleShotUpdate = useCallback((shotId: string, patch: Partial<TimelineShot>) => {
    updateShot(shotId, patch, "storyboard")
  }, [updateShot])

  return (
    <main className="flex h-screen flex-col bg-[#0E0D0B] text-white">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/8 px-4 py-2.5">
        <Link
          href="/dev"
          className="rounded-full p-1.5 text-white/30 transition hover:bg-white/5 hover:text-white/60"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-sm font-semibold text-white/80">Director Pipeline</h1>
        <span className="text-[10px] text-white/20">
          {scenes.length} scenes &middot; {shots.length} shots
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded p-1.5 text-white/30 hover:bg-white/5 hover:text-white/60"
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Bible sidebar */}
        <div className={`${sidebarOpen ? "p-4" : ""}`}>
          <BibleSidebar collapsed={!sidebarOpen} />
        </div>

        {/* Director Cut — exact same layout as StoryboardPanel */}
        <div className="flex-1 overflow-y-auto p-4">
          {scenes.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-white/20">
              <Clapperboard size={28} className="text-white/15" />
              <p className="text-sm">No scenes yet</p>
              <p className="text-xs">Load a screenplay with scene headings (INT./EXT.)</p>
              <Link
                href="/workspace"
                className="mt-2 rounded-lg border border-[#D4A853]/30 bg-[#D4A853]/10 px-3 py-1.5 text-xs text-[#D4A853] hover:bg-[#D4A853]/20"
              >
                Go to Workspace
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {scenes.map((scene) => {
                const isSelected = selectedSceneId === scene.id
                const relatedShots = shotsBySceneId.get(scene.id) ?? []
                const isShotsExpanded = expandedScenes.has(scene.id)
                const sceneChars = characters.filter((c) => c.sceneIds.includes(scene.id))
                const sceneLocs = locations.filter((l) => l.sceneIds.includes(scene.id))
                const sceneProps = bibleProps.filter((p) => p.sceneIds.includes(scene.id))

                return (
                  <div key={scene.id} className="flex flex-col">
                    {/* Scene header — identical to StoryboardPanel */}
                    <div
                      className={`relative flex items-stretch gap-3 rounded-lg px-3 py-2 text-left transition-colors cursor-pointer overflow-hidden ${
                        isSelected
                          ? "bg-white/5 border-l-2"
                          : "hover:bg-white/3 border-l-2 border-transparent"
                      }`}
                      style={isSelected ? { borderLeftColor: scene.color } : undefined}
                      onClick={() => handleSceneClick(scene.id)}
                      onDoubleClick={() => handleSceneDoubleClick(scene.id)}
                    >
                      <div
                        className="z-[1] w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: scene.color }}
                      />
                      <div className="z-[1] min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[#8D919B]">
                          Scene {scene.index}
                        </p>
                        <p className="mt-0.5 truncate text-[13px] font-medium text-[#E7E3DC]">
                          {scene.title}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-[10px] text-[#7F8590]">
                          <span>{scene.blockIds.length} blocks</span>
                          <span>{relatedShots.length} shots</span>
                          <span>{Math.round(scene.estimatedDurationMs / 1000)}s</span>
                          {relatedShots.length > 0 && (
                            <span>{isShotsExpanded ? "shots open" : "double click to open"}</span>
                          )}
                        </div>
                      </div>
                      <div className="z-[1] flex shrink-0 items-center gap-1">
                        <span className="rounded-md border border-white/8 bg-white/3 px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-[#9FA4AE]">
                          Enter
                        </span>
                      </div>
                    </div>

                    {/* Expanded shots — block-grouped like Director Cut */}
                    {relatedShots.length > 0 && isShotsExpanded && (
                      <div className="ml-5 mt-4 flex flex-col gap-3 border-l border-white/8 pl-3">
                        {(() => {
                          const blockGroups = new Map<string, TimelineShot[]>()
                          const ungrouped: TimelineShot[] = []
                          for (const shot of relatedShots) {
                            if (shot.parentBlockId) {
                              const group = blockGroups.get(shot.parentBlockId) || []
                              group.push(shot)
                              blockGroups.set(shot.parentBlockId, group)
                            } else {
                              ungrouped.push(shot)
                            }
                          }

                          let globalIndex = 0
                          return (
                            <>
                              {Array.from(blockGroups.entries()).map(([blockId, blockShots]) => {
                                const block = blocks.find((b) => b.id === blockId)
                                const totalMs = blockShots.reduce((sum, s) => sum + s.duration, 0)
                                const totalS = (totalMs / 1000).toFixed(1)

                                return (
                                  <div key={blockId} className="flex flex-col gap-2 pt-4 mt-4 border-t border-white/6 first:mt-0 first:pt-0 first:border-t-0">
                                    {/* Block header — action text + duration budget + add shot */}
                                    <div className="flex items-start gap-3 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 cursor-pointer transition-colors hover:border-[#D4A853]/20 hover:bg-white/[0.05]">
                                      <div className="shrink-0 flex flex-col items-center gap-0.5 pt-0.5">
                                        <input
                                          type="text"
                                          defaultValue={totalS}
                                          key={totalS}
                                          onBlur={(e) => {
                                            const newTotal = parseFloat(e.currentTarget.value)
                                            if (isNaN(newTotal) || newTotal <= 0) return
                                            const newTotalMs = newTotal * 1000
                                            const ratio = newTotalMs / totalMs
                                            for (const s of blockShots) {
                                              updateShot(s.id, { duration: Math.max(500, Math.round(s.duration * ratio)) })
                                            }
                                          }}
                                          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                                          onClick={(e) => e.stopPropagation()}
                                          className="w-[44px] rounded bg-white/5 text-center text-[15px] font-bold tabular-nums text-[#E5E0DB] outline-none focus:bg-white/8 focus:ring-1 focus:ring-[#D4A853]/30"
                                        />
                                        <span className="text-[7px] uppercase tracking-wider text-white/25">sec</span>
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[12px] leading-snug text-[#C8C1B6] font-mono">
                                          {block?.text ?? blockId.slice(0, 12)}
                                        </p>
                                        <div className="mt-1.5 flex items-center gap-2">
                                          <span className="text-[9px] tabular-nums text-white/25">
                                            {blockShots.length} shot{blockShots.length !== 1 ? "s" : ""}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              const lastShot = blockShots[blockShots.length - 1]
                                              const halfDur = Math.max(1000, Math.round((lastShot?.duration ?? 4000) / 2))
                                              if (lastShot) updateShot(lastShot.id, { duration: halfDur })
                                              const newShotId = addShot({
                                                parentBlockId: blockId,
                                                sceneId: scene.id,
                                                order: (lastShot?.order ?? 0) + 1,
                                                duration: halfDur,
                                                caption: "",
                                                sourceText: block?.text ?? "",
                                                label: block?.text?.slice(0, 60) ?? "",
                                                autoSynced: false,
                                              })
                                              selectShot(newShotId)
                                            }}
                                            className="flex items-center gap-1 rounded-md border border-dashed border-white/10 px-2 py-0.5 text-[9px] text-white/30 transition-colors hover:border-[#D4A853]/30 hover:bg-[#D4A853]/8 hover:text-[#D4A853]"
                                          >
                                            <Plus size={10} />
                                            Add shot
                                          </button>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Shot cards — indented under action */}
                                    <div className="ml-6 flex flex-col gap-3 border-l border-white/6 pl-3">
                                      {blockShots.map((shot) => {
                                        const idx = globalIndex++
                                        return (
                                          <UnifiedShotCard
                                            key={shot.id}
                                            shot={shot}
                                            index={idx}
                                            slateNumber={shotLabel(shot.id)}
                                            selected={selectedShotId === shot.id}
                                            bibleChars={sceneChars}
                                            bibleLocs={sceneLocs}
                                            bibleProps={sceneProps}
                                            onSelect={() => selectShot(shot.id)}
                                            onUpdate={(patch) => handleShotUpdate(shot.id, patch)}
                                            onGenerate={() => void handleGenerateImage(shot.id)}
                                            isGenerating={generatingIds.has(shot.id)}
                                            onDelete={() => {
                                              const siblings = shot.parentBlockId
                                                ? shots.filter((s) => s.parentBlockId === shot.parentBlockId && s.id !== shot.id)
                                                : []
                                              if (siblings.length > 0) {
                                                const bonus = Math.round(shot.duration / siblings.length)
                                                for (const sib of siblings) updateShot(sib.id, { duration: sib.duration + bonus })
                                              }
                                              removeShot(shot.id, "screenplay")
                                            }}
                                          />
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })}

                              {/* Ungrouped shots */}
                              {ungrouped.map((shot) => {
                                const idx = globalIndex++
                                return (
                                  <UnifiedShotCard
                                    key={shot.id}
                                    shot={shot}
                                    index={idx}
                                    slateNumber={shotLabel(shot.id)}
                                    selected={selectedShotId === shot.id}
                                    bibleChars={sceneChars}
                                    bibleLocs={sceneLocs}
                                    bibleProps={sceneProps}
                                    onSelect={() => selectShot(shot.id)}
                                    onUpdate={(patch) => handleShotUpdate(shot.id, patch)}
                                    onGenerate={() => void handleGenerateImage(shot.id)}
                                    isGenerating={generatingIds.has(shot.id)}
                                    onDelete={() => removeShot(shot.id, "screenplay")}
                                  />
                                )
                              })}
                            </>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox.src}
            alt=""
            className="max-h-[85vh] max-w-[85vw] rounded-xl shadow-2xl"
          />
        </div>
      )}
    </main>
  )
}
