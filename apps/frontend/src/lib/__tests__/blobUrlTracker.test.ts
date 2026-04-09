import { describe, it, expect, vi, beforeEach } from "vitest"
import { createBlobUrlTracker, globalBlobTracker } from "../blobUrlTracker"

const revokeObjectURL = vi.fn()
const createObjectURL = vi.fn((blob: Blob) => `blob:http://localhost/${Math.random().toString(36).slice(2)}`)
vi.stubGlobal("URL", { ...URL, revokeObjectURL, createObjectURL })

describe("createBlobUrlTracker", () => {
  let tracker: ReturnType<typeof createBlobUrlTracker>

  beforeEach(() => {
    revokeObjectURL.mockClear()
    createObjectURL.mockClear()
    tracker = createBlobUrlTracker()
  })

  it("should track blob URLs", () => {
    tracker.track("blob:http://localhost/abc")
    tracker.track("blob:http://localhost/def")
    expect(tracker.size).toBe(2)
  })

  it("should not duplicate already-tracked URLs", () => {
    tracker.track("blob:http://localhost/abc")
    tracker.track("blob:http://localhost/abc")
    expect(tracker.size).toBe(1)
  })

  it("should revoke a single URL", () => {
    tracker.track("blob:http://localhost/abc")
    tracker.revoke("blob:http://localhost/abc")
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/abc")
    expect(tracker.size).toBe(0)
  })

  it("should ignore non-blob URLs on revoke", () => {
    tracker.revoke("https://example.com/image.png")
    tracker.revoke(null)
    tracker.revoke(undefined)
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it("should revoke all tracked URLs", () => {
    tracker.track("blob:http://localhost/1")
    tracker.track("blob:http://localhost/2")
    tracker.track("blob:http://localhost/3")
    tracker.revokeAll()
    expect(revokeObjectURL).toHaveBeenCalledTimes(3)
    expect(tracker.size).toBe(0)
  })

  it("should trackFromBlob and return tracked blob URL", () => {
    const blob = new Blob(["test"], { type: "image/png" })
    const url = tracker.trackFromBlob(blob)
    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(url).toMatch(/^blob:/)
    expect(tracker.size).toBe(1)
  })

  it("should evict oldest URLs when LRU cap exceeded", () => {
    const small = createBlobUrlTracker(3)
    small.track("blob:http://localhost/a")
    small.track("blob:http://localhost/b")
    small.track("blob:http://localhost/c")
    expect(small.size).toBe(3)

    small.track("blob:http://localhost/d")
    expect(small.size).toBe(3)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/a")
  })

  it("should evict multiple oldest URLs when cap is much smaller", () => {
    const small = createBlobUrlTracker(2)
    small.track("blob:http://localhost/1")
    small.track("blob:http://localhost/2")
    small.track("blob:http://localhost/3")
    expect(small.size).toBe(2)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/1")
  })

  it("should expose maxSize", () => {
    const small = createBlobUrlTracker(10)
    expect(small.maxSize).toBe(10)
  })
})

describe("globalBlobTracker", () => {
  it("should be a shared tracker instance", () => {
    expect(globalBlobTracker).toBeDefined()
    expect(globalBlobTracker.maxSize).toBe(500)
  })
})
