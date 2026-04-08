import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

let authFetch: typeof import("../auth-fetch").authFetch

const mockFetch = vi.fn()

vi.mock("../auth-client", () => ({
  getAccessToken: vi.fn(() => "test-token"),
  setAccessToken: vi.fn(),
  refreshApi: vi.fn(),
}))

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch)
  vi.useFakeTimers()
  mockFetch.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function loadModule() {
  vi.resetModules()
  const mod = await import("../auth-fetch")
  authFetch = mod.authFetch
  return mod
}

describe("authFetch retry with exponential backoff", () => {
  it("should retry on 503 with exponential backoff", async () => {
    await loadModule()

    mockFetch
      .mockResolvedValueOnce({ status: 503, ok: false })
      .mockResolvedValueOnce({ status: 503, ok: false })
      .mockResolvedValueOnce({ status: 200, ok: true })

    const promise = authFetch("/v1/test")

    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)

    const res = await promise
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it("should retry on 502", async () => {
    await loadModule()

    mockFetch
      .mockResolvedValueOnce({ status: 502, ok: false })
      .mockResolvedValueOnce({ status: 200, ok: true })

    const promise = authFetch("/v1/test")
    await vi.advanceTimersByTimeAsync(1000)

    const res = await promise
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("should NOT retry on 400", async () => {
    await loadModule()

    mockFetch.mockResolvedValueOnce({ status: 400, ok: false })

    const res = await authFetch("/v1/test")
    expect(res.status).toBe(400)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("should NOT retry on 404", async () => {
    await loadModule()

    mockFetch.mockResolvedValueOnce({ status: 404, ok: false })

    const res = await authFetch("/v1/test")
    expect(res.status).toBe(404)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("should return last failed response after max retries", async () => {
    await loadModule()

    mockFetch
      .mockResolvedValueOnce({ status: 503, ok: false })
      .mockResolvedValueOnce({ status: 503, ok: false })
      .mockResolvedValueOnce({ status: 503, ok: false })

    const promise = authFetch("/v1/test")
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)

    const res = await promise
    expect(res.status).toBe(503)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it("should retry on network error", async () => {
    await loadModule()

    mockFetch
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ status: 200, ok: true })

    const promise = authFetch("/v1/test")
    await vi.advanceTimersByTimeAsync(1000)

    const res = await promise
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("should throw after max retries on persistent network error", async () => {
    vi.useRealTimers()
    const origSetTimeout = globalThis.setTimeout
    vi.stubGlobal(
      "setTimeout",
      (fn: (...args: unknown[]) => void, _ms?: number, ...args: unknown[]) =>
        origSetTimeout(fn, 0, ...args),
    )
    await loadModule()

    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"))

    await expect(authFetch("/v1/test")).rejects.toThrow("Failed to fetch")
    expect(mockFetch).toHaveBeenCalledTimes(3)

    vi.stubGlobal("setTimeout", origSetTimeout)
    vi.useFakeTimers()
  })

  it("should respect Retry-After header (seconds)", async () => {
    await loadModule()

    mockFetch
      .mockResolvedValueOnce({
        status: 429,
        ok: false,
        headers: new Headers({ "Retry-After": "5" }),
      })
      .mockResolvedValueOnce({ status: 200, ok: true })

    const promise = authFetch("/v1/test")
    await vi.advanceTimersByTimeAsync(5000)

    const res = await promise
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

describe("authFetch X-Correlation-ID", () => {
  it("should add X-Correlation-ID header to every request", async () => {
    await loadModule()

    mockFetch.mockResolvedValueOnce({ status: 200, ok: true })

    await authFetch("/v1/test")

    const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers
    const correlationId = calledHeaders.get("X-Correlation-ID")
    expect(correlationId).toBeTruthy()
    expect(correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })
})

describe("authFetch timeout", () => {
  it("should abort request after 15 seconds", async () => {
    vi.useRealTimers()
    const origSetTimeout = globalThis.setTimeout
    vi.stubGlobal(
      "setTimeout",
      (fn: (...args: unknown[]) => void, _ms?: number, ...args: unknown[]) =>
        origSetTimeout(fn, 0, ...args),
    )
    await loadModule()

    mockFetch.mockImplementation(
      (_url: string, opts: { signal?: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          if (opts?.signal) {
            opts.signal.addEventListener("abort", () => {
              reject(
                new DOMException("The operation was aborted.", "AbortError"),
              )
            })
          }
        })
      },
    )

    await expect(authFetch("/v1/test")).rejects.toThrow(
      "The operation was aborted.",
    )

    vi.stubGlobal("setTimeout", origSetTimeout)
    vi.useFakeTimers()
  })

  it("should not override caller-provided signal", async () => {
    await loadModule()

    const callerController = new AbortController()
    mockFetch.mockResolvedValueOnce({ status: 200, ok: true })

    await authFetch("/v1/test", { signal: callerController.signal })

    const calledOpts = mockFetch.mock.calls[0][1]
    expect(calledOpts.signal).toBeDefined()
  })
})
