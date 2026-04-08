/**
 * Director Mode Types
 *
 * ShotCard is the primary visual unit in Director Mode.
 * Each ShotCard links to an action block via actionBlockId.
 * Sub-shots use slate numbering: 1, 2A, 2B, 2C, 3...
 */

import type { TimelineShot, GenerationHistoryEntry } from "@/store/timeline"
import type { Block } from "@/lib/screenplayFormat"

// ─── ShotCard ────────────────────────────────────────────────

export interface ShotDialogue {
  characterName: string
  text: string
  parenthetical?: string
}

export interface ShotCard {
  id: string
  actionBlockId: string       // always links back to source action block
  shotNumber: string           // slate numbering: '1', '2A', '2B', '2C'
  direction: string            // director's description (editable)
  prompt: string               // AI generation prompt
  shotType: string             // WIDE, MS, MCU, CU, ECU, etc.
  lens: string                 // '24mm', '50mm', '85mm'
  cameraMove: string           // STATIC, PUSH IN, HANDHELD, etc.
  duration: number             // seconds
  dialogue: ShotDialogue[]
  vo: string
  sfx: string[]
  notes: string                // excluded from generation
  characters: string[]
  locations: string[]

  // Visual / generation
  thumbnailUrl: string | null
  originalUrl: string | null
  thumbnailBlobKey: string | null
  originalBlobKey: string | null
  generationHistory: GenerationHistoryEntry[]
  activeHistoryIndex: number | null

  // State
  locked: boolean
  autoSynced: boolean
  sceneId: string | null
}

// ─── ActionBlockView (derived, for left panel) ───────────────

export interface ActionBlockView {
  id: string                   // block.id
  sceneId: string | null
  text: string                 // action block text (source of truth)
  order: number                // position in screenplay
  shotCount: number            // number of linked shot cards
  shotIds: string[]            // linked shot card IDs
}

// ─── ShotGroup (for grouped view in right panel) ─────────────

export interface DirectorShotGroup {
  actionBlockId: string
  sourceText: string           // readonly, from action block
  sceneId: string | null
  shots: ShotCard[]
}

// ─── Adapters: TimelineShot ↔ ShotCard ───────────────────────

export function timelineShotToShotCard(
  shot: TimelineShot,
  slateNumber: string,
): ShotCard {
  return {
    id: shot.id,
    actionBlockId: shot.parentBlockId ?? "",
    shotNumber: slateNumber,
    direction: shot.directorNote,
    prompt: shot.imagePrompt,
    shotType: shot.shotSize,
    lens: "",
    cameraMove: shot.cameraMotion,
    duration: shot.duration / 1000,
    dialogue: [],
    vo: "",
    sfx: [],
    notes: shot.notes,
    characters: [],
    locations: [],
    thumbnailUrl: shot.thumbnailUrl,
    originalUrl: shot.originalUrl,
    thumbnailBlobKey: shot.thumbnailBlobKey,
    originalBlobKey: shot.originalBlobKey,
    generationHistory: shot.generationHistory,
    activeHistoryIndex: shot.activeHistoryIndex,
    locked: shot.locked,
    autoSynced: shot.autoSynced,
    sceneId: shot.sceneId,
  }
}

export function shotCardToTimelinePatch(
  card: Partial<ShotCard>,
): Partial<TimelineShot> {
  const patch: Partial<TimelineShot> = {}
  if (card.direction !== undefined) patch.directorNote = card.direction
  if (card.prompt !== undefined) patch.imagePrompt = card.prompt
  if (card.shotType !== undefined) patch.shotSize = card.shotType
  if (card.cameraMove !== undefined) patch.cameraMotion = card.cameraMove
  if (card.duration !== undefined) patch.duration = card.duration * 1000
  if (card.notes !== undefined) patch.notes = card.notes
  if (card.locked !== undefined) patch.locked = card.locked
  return patch
}

// ─── Helpers: extract dialogue/vo/sfx from blocks ────────────

export function attachBlocksToAction(
  blocks: Block[],
  actionBlockId: string,
): { dialogue: ShotDialogue[]; vo: string; sfx: string[]; notes: string } {
  const dialogue: ShotDialogue[] = []
  let vo = ""
  const sfx: string[] = []
  let notes = ""

  // Find blocks between this action and the next action/scene_heading
  const startIdx = blocks.findIndex((b) => b.id === actionBlockId)
  if (startIdx < 0) return { dialogue, vo, sfx, notes }

  let currentChar: string | null = null

  for (let i = startIdx + 1; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.type === "action" || b.type === "scene_heading") break

    if (b.type === "character") {
      currentChar = b.text.replace(/\s*\(.*\)\s*$/, "").trim()
      continue
    }

    if (b.type === "parenthetical") continue

    if (b.type === "dialogue" && currentChar) {
      const isVO = /V\.?O\.?/i.test(currentChar)
      if (isVO) {
        vo = b.text.trim()
      } else {
        dialogue.push({ characterName: currentChar, text: b.text.trim() })
      }
      continue
    }

    // SFX hints from block
    if (b.sfxHints && b.sfxHints.length > 0) {
      sfx.push(...b.sfxHints)
    }
  }

  return { dialogue, vo, sfx, notes }
}
