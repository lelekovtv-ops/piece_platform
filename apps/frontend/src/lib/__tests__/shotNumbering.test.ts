import { describe, it, expect } from "vitest"
import { computeSlateNumbers } from "@/lib/shotNumbering"
import type { Block } from "@/lib/screenplayFormat"
import type { TimelineShot } from "@/store/timeline"

function block(id: string, type: Block["type"], text = ""): Block {
  return { id, type, text }
}

function shot(id: string, parentBlockId: string, order = 0): TimelineShot {
  return {
    id, order, parentBlockId,
    duration: 5000, type: "image",
    thumbnailUrl: null, originalUrl: null,
    thumbnailBlobKey: null, originalBlobKey: null,
    generationHistory: [], activeHistoryIndex: null,
    sceneId: null, label: "", notes: "",
    shotSize: "", cameraMotion: "", caption: "",
    directorNote: "", cameraNote: "",
    videoPrompt: "", imagePrompt: "",
    visualDescription: "", svg: "",
    blockRange: null, shotId: null,
    locked: false, autoSynced: false, sourceText: "",
  }
}

describe("computeSlateNumbers", () => {
  it("assigns sequential numbers for 1:1 mapping", () => {
    const blocks = [
      block("b1", "scene_heading", "EXT. PARK"),
      block("b2", "action", "Birds sing."),
      block("b3", "action", "Man walks."),
      block("b4", "action", "Sits down."),
    ]
    const shots = [
      shot("s1", "b2", 0),
      shot("s2", "b3", 0),
      shot("s3", "b4", 0),
    ]
    const result = computeSlateNumbers(blocks, shots)
    expect(result.get("s1")).toBe("1")
    expect(result.get("s2")).toBe("2")
    expect(result.get("s3")).toBe("3")
  })

  it("assigns letters for sub-shots (breakdown)", () => {
    const blocks = [
      block("b1", "action", "Scene opens."),
      block("b2", "action", "Man walks and talks."),
      block("b3", "action", "Sits down."),
    ]
    const shots = [
      shot("s1", "b1", 0),
      shot("s2a", "b2", 0),
      shot("s2b", "b2", 1),
      shot("s2c", "b2", 2),
      shot("s3", "b3", 0),
    ]
    const result = computeSlateNumbers(blocks, shots)
    expect(result.get("s1")).toBe("1")
    expect(result.get("s2a")).toBe("2A")
    expect(result.get("s2b")).toBe("2B")
    expect(result.get("s2c")).toBe("2C")
    expect(result.get("s3")).toBe("3")
  })

  it("handles multiple breakdowns", () => {
    const blocks = [
      block("b1", "action", "A"),
      block("b2", "action", "B"),
      block("b3", "action", "C"),
    ]
    const shots = [
      shot("s1a", "b1", 0),
      shot("s1b", "b1", 1),
      shot("s2", "b2", 0),
      shot("s3a", "b3", 0),
      shot("s3b", "b3", 1),
    ]
    const result = computeSlateNumbers(blocks, shots)
    expect(result.get("s1a")).toBe("1A")
    expect(result.get("s1b")).toBe("1B")
    expect(result.get("s2")).toBe("2")
    expect(result.get("s3a")).toBe("3A")
    expect(result.get("s3b")).toBe("3B")
  })

  it("skips non-action blocks in numbering", () => {
    const blocks = [
      block("b1", "scene_heading", "INT. ROOM"),
      block("b2", "action", "He enters."),
      block("b3", "character", "JOHN"),
      block("b4", "dialogue", "Hello."),
      block("b5", "action", "He leaves."),
    ]
    const shots = [
      shot("s1", "b2", 0),
      shot("s2", "b5", 0),
    ]
    const result = computeSlateNumbers(blocks, shots)
    expect(result.get("s1")).toBe("1")
    expect(result.get("s2")).toBe("2")
  })

  it("handles orphan shots without parentBlockId", () => {
    const blocks = [block("b1", "action", "A")]
    const shots = [
      shot("s1", "b1", 0),
      { ...shot("s2", "", 0), parentBlockId: null },
    ]
    const result = computeSlateNumbers(blocks, shots)
    expect(result.get("s1")).toBe("1")
    expect(result.has("s2")).toBe(true) // gets a fallback number
  })

  it("handles empty input", () => {
    expect(computeSlateNumbers([], []).size).toBe(0)
  })
})
