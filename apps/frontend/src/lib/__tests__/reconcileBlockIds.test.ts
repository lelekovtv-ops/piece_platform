import { describe, it, expect } from "vitest"
import { reconcileBlockIds, type Block } from "@/lib/screenplayFormat"

function b(id: string, type: Block["type"], text: string): Block {
  return { id, type, text }
}

describe("reconcileBlockIds", () => {
  it("fast path — same IDs, returns as-is", () => {
    const old = [b("a", "action", "Hello")]
    const nw = [b("a", "action", "Hello changed")]
    const result = reconcileBlockIds(old, nw)
    expect(result[0].id).toBe("a")
    expect(result[0].text).toBe("Hello changed")
  })

  it("exact text match — inherits old ID", () => {
    const old = [
      b("old-1", "scene_heading", "EXT. ПЛАНЕТА ЛЮМОС — СУМЕРКИ"),
      b("old-2", "action", "Чужой мир. Небо — фиолетовое."),
      b("old-3", "character", "МАЙЯ"),
      b("old-4", "dialogue", "Дан, посмотри."),
    ]
    const nw = [
      b("x1", "scene_heading", "EXT. ПЛАНЕТА ЛЮМОС — СУМЕРКИ"),
      b("x2", "action", "Чужой мир. Небо — фиолетовое."),
      b("x3", "character", "МАЙЯ"),
      b("x4", "dialogue", "Дан, посмотри."),
    ]
    const result = reconcileBlockIds(old, nw)
    expect(result.map((r) => r.id)).toEqual(["old-1", "old-2", "old-3", "old-4"])
  })

  it("fuzzy match — minor text edit keeps old ID", () => {
    const old = [
      b("old-1", "scene_heading", "EXT. ПЛАНЕТА ЛЮМОС — ПОЗДНИЕ СУМЕРКИ"),
      b("old-2", "action", "Чужой мир. Небо — фиолетовое с тремя лунами."),
    ]
    const nw = [
      b("x1", "scene_heading", "EXT. ПЛАНЕТА ЛЮМОС — РАННИЕ СУМЕРКИ"),
      b("x2", "action", "Чужой мир. Небо — фиолетовое с двумя лунами."),
    ]
    const result = reconcileBlockIds(old, nw)
    expect(result[0].id).toBe("old-1")
    expect(result[1].id).toBe("old-2")
    // Text should be from new blocks
    expect(result[0].text).toBe("EXT. ПЛАНЕТА ЛЮМОС — РАННИЕ СУМЕРКИ")
    expect(result[1].text).toBe("Чужой мир. Небо — фиолетовое с двумя лунами.")
  })

  it("completely different text — gets new ID", () => {
    const old = [b("old-1", "action", "Тёмный лес.")]
    const nw = [b("x1", "action", "Яркий солнечный берег у моря.")]
    const result = reconcileBlockIds(old, nw)
    expect(result[0].id).toBe("x1") // no match → keep new ID
  })

  it("handles inserted block in the middle", () => {
    const old = [
      b("old-1", "scene_heading", "EXT. ЛЕС — ДЕНЬ"),
      b("old-2", "action", "Тишина."),
      b("old-3", "character", "МАЙЯ"),
    ]
    const nw = [
      b("x1", "scene_heading", "EXT. ЛЕС — ДЕНЬ"),
      b("x2", "action", "Тишина."),
      b("x3", "action", "Новый абзац описания."),  // inserted
      b("x4", "character", "МАЙЯ"),
    ]
    const result = reconcileBlockIds(old, nw)
    expect(result[0].id).toBe("old-1")
    expect(result[1].id).toBe("old-2")
    expect(result[2].id).toBe("x3") // new block, no old match
    expect(result[3].id).toBe("old-3")
  })

  it("handles deleted block", () => {
    const old = [
      b("old-1", "scene_heading", "INT. КАБИНЕТ — НОЧЬ"),
      b("old-2", "action", "Удалённый абзац."),
      b("old-3", "character", "ДАНИЛ"),
    ]
    const nw = [
      b("x1", "scene_heading", "INT. КАБИНЕТ — НОЧЬ"),
      b("x2", "character", "ДАНИЛ"),
    ]
    const result = reconcileBlockIds(old, nw)
    expect(result[0].id).toBe("old-1")
    expect(result[1].id).toBe("old-3")
  })

  it("does not double-claim same old block", () => {
    const old = [
      b("old-1", "character", "МАЙЯ"),
      b("old-2", "dialogue", "Привет."),
      b("old-3", "character", "МАЙЯ"),
      b("old-4", "dialogue", "Пока."),
    ]
    const nw = [
      b("x1", "character", "МАЙЯ"),
      b("x2", "dialogue", "Привет."),
      b("x3", "character", "МАЙЯ"),
      b("x4", "dialogue", "Пока."),
    ]
    const result = reconcileBlockIds(old, nw)
    expect(result.map((r) => r.id)).toEqual(["old-1", "old-2", "old-3", "old-4"])
    // Each old ID used exactly once
    const ids = result.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("empty old blocks — returns new as-is", () => {
    const result = reconcileBlockIds([], [b("x1", "action", "Hello")])
    expect(result[0].id).toBe("x1")
  })

  it("preserves production fields from new blocks", () => {
    const old = [b("old-1", "action", "Тишина.")]
    const nw: Block[] = [{ id: "x1", type: "action", text: "Тишина.", durationMs: 5000, durationSource: "manual" }]
    const result = reconcileBlockIds(old, nw)
    expect(result[0].id).toBe("old-1")
    expect(result[0].durationMs).toBe(5000)
    expect(result[0].durationSource).toBe("manual")
  })
})
