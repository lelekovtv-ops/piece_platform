/**
 * useSyncOrchestrator — forward sync between screenplay, scenes, timeline,
 * bible, dialogue, and voice.
 *
 * Forward sync: blocks → scenes → timeline (direct) → bible → dialogue → voice
 * Rundown removed from pipeline — now a read-only view computed in ScriptViewer.
 */

import { useEffect } from "react"
import { useScriptStore } from "@/store/script"
import { useScenesStore } from "@/store/scenes"
import { useTimelineStore, createTimelineShot } from "@/store/timeline"
import { useBibleStore } from "@/store/bible"
import { useDialogueStore, extractDialogueLines } from "@/store/dialogue"
import { useVoiceTrackStore, generateVoiceClipsFromDialogue } from "@/store/voiceTrack"
import { estimateBlockDurationMs } from "@/lib/durationEngine"
import type { Block } from "@/lib/screenplayFormat"
import type { Scene } from "@/lib/sceneParser"

/**
 * Build timeline shots directly from blocks + scenes (no rundown middleman).
 * Each action block → one TimelineShot (1:1 default).
 */
function blocksToTimelineShots(blocks: Block[], scenes: Scene[]) {
  // Scene lookup: blockId → scene
  const blockToScene = new Map<string, Scene>()
  for (const scene of scenes) {
    for (const bid of scene.blockIds) {
      blockToScene.set(bid, scene)
    }
  }

  const shots: ReturnType<typeof createTimelineShot>[] = []
  let order = 0

  for (const block of blocks) {
    if (block.type !== "action") continue

    const scene = blockToScene.get(block.id)
    const durationMs = block.durationMs ?? estimateBlockDurationMs(block.type, block.text)

    shots.push(createTimelineShot({
      id: `shot-${block.id}`,
      order: order++,
      duration: durationMs,
      parentBlockId: block.id,
      blockRange: [block.id, block.id],
      sceneId: scene?.id ?? null,
      label: block.text.slice(0, 60),
      caption: "",
      sourceText: block.text,
      autoSynced: true,
    }))
  }

  return shots
}

/**
 * Mount this hook at the workspace/studio level.
 * It handles forward data synchronization between modules.
 */
export function useSyncOrchestrator() {
  const blocks = useScriptStore((s) => s.blocks)
  const updateScenes = useScenesStore((s) => s.updateScenes)
  const scenes = useScenesStore((s) => s.scenes)
  const updateFromScreenplay = useBibleStore((s) => s.updateFromScreenplay)
  const characters = useBibleStore((s) => s.characters)
  const setDialogueLines = useDialogueStore((s) => s.setLines)

  // ── Forward sync: blocks → scenes (immediate) ──
  useEffect(() => {
    updateScenes(blocks)
  }, [blocks, updateScenes])

  // ── Forward sync: blocks+scenes → timeline (direct, 500ms debounce) ──
  useEffect(() => {
    if (blocks.length === 0) return

    const timer = window.setTimeout(() => {
      const projected = blocksToTimelineShots(blocks, scenes)
      const existing = useTimelineStore.getState().shots

      // Build lookups from existing shots
      const byBlockId = new Map<string, typeof existing[0]>()
      for (const s of existing) {
        if (s.parentBlockId) byBlockId.set(s.parentBlockId, s)
        if (s.blockRange?.[0]) byBlockId.set(s.blockRange[0], s)
      }
      const byId = new Map(existing.map((s) => [s.id, s]))

      const merged = projected.map((proj) => {
        const ex = byId.get(proj.id)
          ?? byBlockId.get(proj.parentBlockId ?? "")
          ?? byBlockId.get(proj.blockRange?.[0] ?? "")

        if (ex) {
          return {
            ...proj,
            id: ex.id, // keep persisted ID to preserve localStorage references
            // Preserve visual data
            thumbnailUrl: ex.thumbnailUrl || proj.thumbnailUrl,
            originalUrl: ex.originalUrl || proj.originalUrl,
            thumbnailBlobKey: ex.thumbnailBlobKey || proj.thumbnailBlobKey,
            originalBlobKey: ex.originalBlobKey || proj.originalBlobKey,
            generationHistory: ex.generationHistory.length > 0 ? ex.generationHistory : proj.generationHistory,
            activeHistoryIndex: ex.activeHistoryIndex ?? proj.activeHistoryIndex,
            // Preserve user-edited fields
            imagePrompt: ex.imagePrompt || proj.imagePrompt,
            videoPrompt: ex.videoPrompt || proj.videoPrompt,
            directorNote: ex.directorNote || proj.directorNote,
            cameraNote: ex.cameraNote || proj.cameraNote,
            shotSize: ex.shotSize || proj.shotSize,
            cameraMotion: ex.cameraMotion || proj.cameraMotion,
            // Keep user-written caption, skip if it just duplicated sourceText
            caption: (ex.caption && ex.caption !== ex.sourceText) ? ex.caption : proj.caption,
            customReferenceUrls: ex.customReferenceUrls,
            excludedBibleIds: ex.excludedBibleIds,
            bakedPrompt: ex.bakedPrompt,
            // For auto-synced shots: always use fresh estimate from durationEngine
            // For manual shots: keep user-set duration
            duration: ex.autoSynced ? proj.duration : ex.duration,
          }
        }
        return proj
      })

      // Keep existing shots that aren't in projected (manually added sub-shots, breakdown shots, etc.)
      const mergedIds = new Set(merged.map((m) => m.id))
      const extras = existing.filter((ex) => {
        if (mergedIds.has(ex.id)) return false // already merged
        // Keep manually added shots (sub-shots from "+ Add shot")
        if (!ex.autoSynced) return true
        // Keep shots with user data
        if (ex.thumbnailUrl || ex.imagePrompt || ex.directorNote) return true
        return false
      })

      useTimelineStore.getState().reorderShots([...merged, ...extras], "screenplay")
    }, 500)

    return () => window.clearTimeout(timer)
  }, [blocks, scenes])

  // ── Forward sync: blocks+scenes → bible (2s debounce) ──
  useEffect(() => {
    const timer = window.setTimeout(() => {
      updateFromScreenplay(blocks, scenes)
    }, 2000)
    return () => window.clearTimeout(timer)
  }, [blocks, scenes, updateFromScreenplay])

  // ── Forward sync: blocks+scenes → dialogue (2.5s debounce) ──
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (blocks.length === 0 || scenes.length === 0) return
      const charNameToId = new Map(
        characters.map((c) => [c.name.toUpperCase(), c.id]),
      )
      const lines = extractDialogueLines(blocks, scenes, charNameToId)
      setDialogueLines(lines)

      // Auto-create voice clips from dialogue lines
      const currentShots = useTimelineStore.getState().shots
      const shotRefs = currentShots.map((s) => ({
        id: s.id,
        sceneId: s.sceneId,
        order: s.order,
      }))
      const existingClips = useVoiceTrackStore.getState().clips
      const newClips = generateVoiceClipsFromDialogue(lines, shotRefs, existingClips)
      useVoiceTrackStore.getState().setClips(newClips)
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [blocks, scenes, characters, setDialogueLines])
}
