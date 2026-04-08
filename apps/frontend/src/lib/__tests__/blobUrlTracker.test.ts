import { describe, it, expect, vi, beforeEach } from "vitest"
import { createBlobUrlTracker } from "../blobUrlTracker"

const revokeObjectURL = vi.fn()
vi.stubGlobal("URL", { ...URL, revokeObjectURL })

describe("createBlobUrlTracker", () => {
  let tracker: ReturnType<typeof createBlobUrlTracker>

  beforeEach(() => {
    revokeObjectURL.mockClear()
    tracker = createBlobUrlTracker()
  })

  it("should track blob URLs", () => {
    tracker.track("blob:http://localhost/abc")
    tracker.track("blob:http://localhost/def")
    expect(tracker.size).toBe(2)
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
})
