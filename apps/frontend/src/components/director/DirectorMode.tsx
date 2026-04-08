"use client"

import { useCallback, useMemo, useState } from "react"
import { useDirectorMode } from "@/hooks/useDirectorMode"
import { useScriptStore } from "@/store/script"
import { useScenesStore } from "@/store/scenes"
import { ScreenplayPanel } from "./ScreenplayPanel"
import { ShotsPanel } from "./ShotsPanel"

interface DirectorModeProps {
  selectedSceneId: string | null
  onSceneClick: (sceneId: string) => void
}

export function DirectorMode({ selectedSceneId, onSceneClick }: DirectorModeProps) {
  const {
    blocks,
    scenes,
    actionBlocks,
    shotGroups,
    activeBlockId,
    activeShotId,
    selectBlock,
    selectShot,
    clearSelection,
    updateDirection,
    updateShotCard,
    viewMode,
    toggleView,
  } = useDirectorMode()

  const updateBlock = useScriptStore((s) => s.updateBlock)
  const [dividerX, setDividerX] = useState(38) // % width for left panel

  // Shot count per action block for badges
  const shotCountByBlock = useMemo(() => {
    const map = new Map<string, number>()
    for (const ab of actionBlocks) {
      map.set(ab.id, ab.shotCount)
    }
    return map
  }, [actionBlocks])

  const handleBlockClick = useCallback((blockId: string) => {
    selectBlock(blockId)
  }, [selectBlock])

  const handleBlockEdit = useCallback((blockId: string, text: string) => {
    const block = blocks.find((b) => b.id === blockId)
    if (block && text !== block.text) {
      updateBlock(blockId, text)
    }
  }, [blocks, updateBlock])

  const handleShotSelect = useCallback((shotId: string) => {
    selectShot(shotId)
  }, [selectShot])

  // Click outside panels → clear selection
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      clearSelection()
    }
  }, [clearSelection])

  // Divider drag
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const container = e.currentTarget.parentElement
    if (!container) return

    const rect = container.getBoundingClientRect()
    const onMove = (ev: MouseEvent) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      setDividerX(Math.max(25, Math.min(55, pct)))
    }
    const onUp = () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }, [])

  return (
    <div
      className="relative flex h-full w-full overflow-hidden bg-[#0E0D0B]"
      onClick={handleContainerClick}
    >
      {/* Left panel: Screenplay */}
      <div
        className="h-full shrink-0 overflow-hidden border-r border-white/8 bg-[#1A1816]"
        style={{ width: `${dividerX}%` }}
      >
        <ScreenplayPanel
          blocks={blocks}
          activeBlockId={activeBlockId}
          shotCountByBlock={shotCountByBlock}
          onBlockClick={handleBlockClick}
          onBlockEdit={handleBlockEdit}
        />
      </div>

      {/* Resizable divider */}
      <div
        className="h-full w-1 cursor-col-resize bg-white/5 transition-colors hover:bg-[#D4A853]/30 active:bg-[#D4A853]/50"
        onMouseDown={handleDividerMouseDown}
      />

      {/* Right panel: Shot Groups */}
      <div className="h-full flex-1 overflow-hidden bg-[#0E0D0B]">
        <ShotsPanel
          shotGroups={shotGroups}
          scenes={scenes}
          selectedSceneId={selectedSceneId}
          activeBlockId={activeBlockId}
          activeShotId={activeShotId}
          viewMode={viewMode}
          onToggleView={toggleView}
          onSelectShot={handleShotSelect}
          onUpdateDirection={updateDirection}
          onUpdateCard={updateShotCard}
        />
      </div>
    </div>
  )
}
