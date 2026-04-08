import { useState, useCallback } from "react"
import { Loader2, Play } from "lucide-react"
import { useTimelineStore, type TimelineShot } from "@/store/timeline"
import { generateShotImage } from "@/components/editor/screenplay/DirectorShotCard"
import { PipelineShotCard } from "./PipelineShotCard"
import { GroupTimeline } from "./GroupTimeline"
import type { DirectorShotGroup, ShotCard } from "@/lib/directorTypes"
import type { ToolkitLevel } from "../_lib/cameraToolkit"
import type { GenerationMode } from "../_lib/promptAssembler"

interface ShotGroupPanelProps {
  group: DirectorShotGroup
  toolkit: ToolkitLevel
  genMode: GenerationMode
  isMultiShot: boolean
  onToggleMultiShot: () => void
}

export function ShotGroupPanel({
  group,
  toolkit,
  genMode,
  isMultiShot,
  onToggleMultiShot,
}: ShotGroupPanelProps) {
  const shots = useTimelineStore((s) => s.shots)
  const [buildingAll, setBuildingAll] = useState(false)

  const handleBuildAll = useCallback(async () => {
    setBuildingAll(true)
    try {
      for (const card of group.shots) {
        const shot = shots.find((s) => s.id === card.id)
        if (!shot) continue
        try {
          const result = await generateShotImage(shot)
          const history = [...(shot.generationHistory || []), {
            url: result.objectUrl,
            blobKey: result.blobKey,
            prompt: "",
            timestamp: Date.now(),
          }]
          useTimelineStore.getState().updateShot(shot.id, {
            thumbnailUrl: result.objectUrl,
            thumbnailBlobKey: result.blobKey,
            generationHistory: history,
          }, "storyboard")
        } catch (err) {
          console.error(`Build failed for ${card.shotNumber}:`, err)
        }
      }
    } finally {
      setBuildingAll(false)
    }
  }, [group.shots, shots])

  return (
    <div className="rounded-2xl border border-white/6 bg-white/[0.015] p-4">
      {/* Group header */}
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-mono text-xs leading-relaxed text-[#C8C1B6]/70">
            {group.sourceText}
          </p>
          <span className="text-[10px] text-white/25">
            {group.shots.length} shot{group.shots.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Multi-shot toggle */}
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={isMultiShot}
              onChange={onToggleMultiShot}
              className="h-3 w-3 rounded border-white/20 bg-white/5 accent-[#D4A853]"
            />
            <span className="text-[10px] text-white/30">Multi-shot</span>
          </label>

          {/* Build All */}
          <button
            onClick={handleBuildAll}
            disabled={buildingAll}
            className="flex items-center gap-1 rounded-lg border border-[#4A7C6F]/30 bg-[#4A7C6F]/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-[#4A7C6F] transition hover:bg-[#4A7C6F]/20 disabled:opacity-40"
          >
            {buildingAll ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            Build All
          </button>
        </div>
      </div>

      {/* Group timeline */}
      <GroupTimeline shots={group.shots} />

      {/* Shot cards */}
      <div className="mt-3 flex flex-col gap-3">
        {group.shots.map((card) => {
          const shot = shots.find((s) => s.id === card.id)
          if (!shot) return null
          return (
            <PipelineShotCard
              key={card.id}
              card={card}
              shot={shot}
              toolkit={toolkit}
              genMode={genMode}
            />
          )
        })}
      </div>
    </div>
  )
}
