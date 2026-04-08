/**
 * Slate Numbering — industry-standard clapperboard notation.
 *
 * Initial parse (1:1):   1, 2, 3, 4, 5, 6
 * After breakdown of 2:  1, 2A, 2B, 2C, 3, 4, 5, 6
 * After breakdown of 5:  1, 2A, 2B, 2C, 3, 4, 5A, 5B, 6
 *
 * Base number = action block order in screenplay.
 * Letters appended for sub-shots within the same action block.
 */

import type { Block } from "@/lib/screenplayFormat"
import type { TimelineShot } from "@/store/timeline"

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

/**
 * Compute slate numbers for all shots.
 *
 * @param blocks  Screenplay blocks (need action blocks for ordering)
 * @param shots   Timeline shots (need parentBlockId for grouping)
 * @returns Map<shotId, slateNumber> e.g. { "shot-1": "1", "shot-2a": "2A", "shot-2b": "2B" }
 */
export function computeSlateNumbers(
  blocks: Block[],
  shots: TimelineShot[],
): Map<string, string> {
  const result = new Map<string, string>()

  // Build action block order: blockId → 1-based position among action blocks
  const actionOrder = new Map<string, number>()
  let actionNum = 0
  for (const block of blocks) {
    if (block.type === "action") {
      actionNum++
      actionOrder.set(block.id, actionNum)
    }
  }

  // Group shots by parentBlockId
  const shotsByBlock = new Map<string, TimelineShot[]>()
  for (const shot of shots) {
    const key = shot.parentBlockId ?? shot.blockRange?.[0] ?? ""
    if (!key) continue
    const arr = shotsByBlock.get(key) ?? []
    arr.push(shot)
    shotsByBlock.set(key, arr)
  }

  // Assign slate numbers
  // For shots without a matching action block, fall back to sequential
  let fallbackNum = actionNum

  for (const [blockId, blockShots] of shotsByBlock) {
    // Sort by order within group
    blockShots.sort((a, b) => a.order - b.order)

    const baseNum = actionOrder.get(blockId) ?? ++fallbackNum

    if (blockShots.length === 1) {
      // Single shot — just number, no letter
      result.set(blockShots[0].id, String(baseNum))
    } else {
      // Multiple sub-shots — number + letter
      for (let i = 0; i < blockShots.length; i++) {
        const letter = i < LETTERS.length ? LETTERS[i] : `${i + 1}`
        result.set(blockShots[i].id, `${baseNum}${letter}`)
      }
    }
  }

  // Handle orphan shots (no parentBlockId)
  for (const shot of shots) {
    if (!result.has(shot.id)) {
      result.set(shot.id, String(++fallbackNum))
    }
  }

  return result
}

/**
 * Get a display label for a shot (e.g. "Shot 2A" or "Shot 5").
 */
export function formatSlateLabel(slateNumber: string): string {
  return `Shot ${slateNumber}`
}
