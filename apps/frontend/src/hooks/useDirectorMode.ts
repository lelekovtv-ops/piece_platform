/**
 * useDirectorMode — facade hook over existing stores.
 *
 * Provides the Director Mode API from the spec without creating a new store.
 * Reads from scriptStore (blocks) + timelineStore (shots) + scenesStore (scenes).
 * Delegates write actions to the appropriate store.
 */

import { useCallback, useMemo, useState } from "react"
import { useScriptStore } from "@/store/script"
import { useTimelineStore } from "@/store/timeline"
import { useScenesStore } from "@/store/scenes"
import { useBibleStore } from "@/store/bible"
import { computeSlateNumbers } from "@/lib/shotNumbering"
import {
  timelineShotToShotCard,
  shotCardToTimelinePatch,
  attachBlocksToAction,
  type ShotCard,
  type ActionBlockView,
  type DirectorShotGroup,
} from "@/lib/directorTypes"
import type { Block } from "@/lib/screenplayFormat"

export type EditorMode = "screenplay" | "freeform"
export type ViewMode = "actions" | "storyboard"

export function useDirectorMode() {
  const blocks = useScriptStore((s) => s.blocks)
  const shots = useTimelineStore((s) => s.shots)
  const scenes = useScenesStore((s) => s.scenes)
  const characters = useBibleStore((s) => s.characters)
  const locations = useBibleStore((s) => s.locations)

  // ── Local UI state ──
  const [editorMode, setEditorMode] = useState<EditorMode>("screenplay")
  const [viewMode, setViewMode] = useState<ViewMode>("actions")
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)
  const [activeShotId, setActiveShotId] = useState<string | null>(null)

  // ── Slate numbers ──
  const slateNumbers = useMemo(
    () => computeSlateNumbers(blocks, shots),
    [blocks, shots],
  )

  // ── Scene lookup: blockId → sceneId ──
  const blockToScene = useMemo(() => {
    const map = new Map<string, string>()
    for (const scene of scenes) {
      for (const blockId of scene.blockIds) {
        map.set(blockId, scene.id)
      }
    }
    return map
  }, [scenes])

  // ── Bible lookup for character/location names per shot ──
  const charNames = useMemo(() => new Set(characters.map((c) => c.name.toUpperCase())), [characters])
  const locNames = useMemo(() => new Set(locations.map((l) => l.name.toUpperCase())), [locations])

  // ── Action blocks (only type="action") → ActionBlockView[] ──
  const actionBlocks: ActionBlockView[] = useMemo(() => {
    const result: ActionBlockView[] = []
    let order = 0

    for (const block of blocks) {
      if (block.type !== "action") continue
      order++

      const blockShots = shots.filter(
        (s) => s.parentBlockId === block.id || s.blockRange?.[0] === block.id,
      )

      result.push({
        id: block.id,
        sceneId: blockToScene.get(block.id) ?? null,
        text: block.text,
        order,
        shotCount: blockShots.length || 1,
        shotIds: blockShots.map((s) => s.id),
      })
    }

    return result
  }, [blocks, shots, blockToScene])

  // ── Shot cards: TimelineShot → ShotCard with attached dialogue/vo/sfx ──
  const shotCards: ShotCard[] = useMemo(() => {
    return shots.map((shot) => {
      const slateNum = slateNumbers.get(shot.id) ?? String(shot.order + 1)
      const card = timelineShotToShotCard(shot, slateNum)

      // Attach dialogue/vo/sfx from blocks following the action block
      if (shot.parentBlockId) {
        const attached = attachBlocksToAction(blocks, shot.parentBlockId)
        card.dialogue = attached.dialogue
        card.vo = attached.vo
        card.sfx = attached.sfx
        if (attached.notes) card.notes = attached.notes
      }

      // Resolve character/location names from caption
      const capWords = (shot.caption + " " + shot.sourceText).toUpperCase()
      card.characters = characters
        .filter((c) => capWords.includes(c.name.toUpperCase()))
        .map((c) => c.name)
      card.locations = locations
        .filter((l) => capWords.includes(l.name.toUpperCase()))
        .map((l) => l.name)

      return card
    })
  }, [shots, slateNumbers, blocks, characters, locations])

  // ── Shot groups: grouped by actionBlockId ──
  const shotGroups: DirectorShotGroup[] = useMemo(() => {
    // Build groups keyed by actionBlockId, maintaining action block order
    const groupMap = new Map<string, ShotCard[]>()

    for (const card of shotCards) {
      const key = card.actionBlockId
      if (!key) continue
      const arr = groupMap.get(key) ?? []
      arr.push(card)
      groupMap.set(key, arr)
    }

    // Order groups by action block order in screenplay
    const result: DirectorShotGroup[] = []
    for (const ab of actionBlocks) {
      const cards = groupMap.get(ab.id)
      if (!cards || cards.length === 0) continue
      result.push({
        actionBlockId: ab.id,
        sourceText: ab.text,
        sceneId: ab.sceneId,
        shots: cards,
      })
    }

    return result
  }, [shotCards, actionBlocks])

  // ── Actions ──

  const selectBlock = useCallback((blockId: string | null) => {
    setActiveBlockId(blockId)
    if (blockId) {
      // Find first shot for this block
      const firstShot = shots.find(
        (s) => s.parentBlockId === blockId || s.blockRange?.[0] === blockId,
      )
      setActiveShotId(firstShot?.id ?? null)
    }
  }, [shots])

  const selectShot = useCallback((shotId: string | null) => {
    setActiveShotId(shotId)
    if (shotId) {
      const shot = shots.find((s) => s.id === shotId)
      setActiveBlockId(shot?.parentBlockId ?? null)
    }
  }, [shots])

  const clearSelection = useCallback(() => {
    setActiveBlockId(null)
    setActiveShotId(null)
  }, [])

  const updateDirection = useCallback((shotId: string, text: string) => {
    useTimelineStore.getState().updateShot(shotId, { directorNote: text }, "storyboard")
  }, [])

  const updateShotCard = useCallback((shotId: string, patch: Partial<ShotCard>) => {
    const timelinePatch = shotCardToTimelinePatch(patch)
    useTimelineStore.getState().updateShot(shotId, timelinePatch, "storyboard")
  }, [])

  const toggleView = useCallback(() => {
    setViewMode((v) => (v === "actions" ? "storyboard" : "actions"))
  }, [])

  return {
    // Mode
    editorMode,
    setEditorMode,
    viewMode,
    setViewMode,
    toggleView,

    // Data
    blocks,
    scenes,
    actionBlocks,
    shotCards,
    shotGroups,
    slateNumbers,

    // Selection
    activeBlockId,
    activeShotId,
    selectBlock,
    selectShot,
    clearSelection,

    // Mutations
    updateDirection,
    updateShotCard,
  }
}
