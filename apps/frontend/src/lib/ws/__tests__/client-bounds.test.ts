import { describe, it, expect, vi, beforeEach } from "vitest"
import { KozaWSClient } from "../client"

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1
  static CONNECTING = 0
  readyState = MockWebSocket.OPEN
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  send = vi.fn()
  close = vi.fn()
}

vi.stubGlobal("WebSocket", MockWebSocket)

describe("KozaWSClient bounded structures", () => {
  let client: KozaWSClient

  beforeEach(() => {
    client = new KozaWSClient("ws://localhost:8080")
  })

  describe("offlineQueue cap", () => {
    it("should not exceed MAX_OFFLINE_QUEUE_SIZE operations", async () => {
      // Client is not connected, so ops go to offlineQueue
      for (let i = 0; i < 1200; i++) {
        await client.sendOp({ type: "insert", path: `/test/${i}`, value: i })
      }

      expect(client.queueSize).toBeLessThanOrEqual(1000)
    })

    it("should drop oldest operations when queue is full", async () => {
      for (let i = 0; i < 1100; i++) {
        await client.sendOp({ type: "insert", path: `/test/${i}`, value: i })
      }

      expect(client.queueSize).toBe(1000)
    })
  })

  describe("pendingOps cap", () => {
    it("should reject new operations when pendingOps exceeds limit", () => {
      // Connect and authenticate client
      client.connect("token")
      const ws = (client as unknown as { ws: MockWebSocket }).ws!
      ws.onopen?.()
      ws.onmessage?.({ data: JSON.stringify({ type: "auth:ok" }) })

      const promises: Promise<void>[] = []
      for (let i = 0; i < 510; i++) {
        promises.push(
          client
            .sendOp({ type: "insert", path: `/test/${i}`, value: i })
            .catch(() => {}),
        )
      }

      const pendingOps = (
        client as unknown as {
          pendingOps: Map<number, unknown>
        }
      ).pendingOps
      expect(pendingOps.size).toBeLessThanOrEqual(500)
    })
  })
})
