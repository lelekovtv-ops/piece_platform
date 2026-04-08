"use client"

import { useEffect, useRef } from "react"
import { Grid, List } from "lucide-react"
import type { DirectorShotGroup, ShotCard as ShotCardType } from "@/lib/directorTypes"
import type { Scene } from "@/lib/sceneParser"
import { ShotGroup } from "./ShotGroup"
import type { ViewMode } from "@/hooks/useDirectorMode"

interface ShotsPanelProps {
  shotGroups: DirectorShotGroup[]
  scenes: Scene[]
  selectedSceneId: string | null
  activeBlockId: string | null
  activeShotId: string | null
  viewMode: ViewMode
  onToggleView: () => void
  onSelectShot: (shotId: string) => void
  onUpdateDirection: (shotId: string, text: string) => void
  onUpdateCard: (shotId: string, patch: Partial<ShotCardType>) => void
}

export function ShotsPanel({
  shotGroups,
  scenes,
  selectedSceneId,
  activeBlockId,
  activeShotId,
  viewMode,
  onToggleView,
  onSelectShot,
  onUpdateDirection,
  onUpdateCard,
}: ShotsPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to active group
  useEffect(() => {
    if (!activeBlockId) return
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-group-id="${activeBlockId}"]`)
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [activeBlockId])

  // Filter groups by selected scene (if any)
  const visibleGroups = selectedSceneId
    ? shotGroups.filter((g) => g.sceneId === selectedSceneId)
    : shotGroups

  const totalShots = visibleGroups.reduce((sum, g) => sum + g.shots.length, 0)

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-2">
        <div className="text-[10px] uppercase tracking-widest text-white/25">
          {visibleGroups.length} groups · {totalShots} shots
        </div>
        <button
          type="button"
          onClick={onToggleView}
          className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[9px] text-white/30 transition-colors hover:text-white/50"
        >
          {viewMode === "actions" ? <List size={10} /> : <Grid size={10} />}
          {viewMode === "actions" ? "Actions" : "Storyboard"}
        </button>
      </div>

      {/* Shot groups */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {visibleGroups.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-[11px] text-white/15">
            No shots yet. Write action blocks in the screenplay.
          </div>
        ) : (
          visibleGroups.map((group) => (
            <ShotGroup
              key={group.actionBlockId}
              group={group}
              isActive={activeBlockId === group.actionBlockId}
              activeShotId={activeShotId}
              onSelectShot={onSelectShot}
              onUpdateDirection={onUpdateDirection}
              onUpdateCard={onUpdateCard}
            />
          ))
        )}
      </div>
    </div>
  )
}
