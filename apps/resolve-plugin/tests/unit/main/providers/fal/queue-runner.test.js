import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

describe("fal.ai Queue Runner", () => {
  let queueRunner;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    vi.resetModules();
    queueRunner =
      await import("../../../../../src/main/providers/fal/queue-runner.js");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("submitToQueue", () => {
    it("should POST to queue.fal.run and return request_id", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ request_id: "req-123" }),
      });

      const result = await queueRunner.submitToQueue({
        apiKey: "fal-key",
        modelId: "fal-ai/flux/schnell",
        input: { prompt: "a cat" },
      });

      expect(result).toBe("req-123");
      const [url, opts] = globalThis.fetch.mock.calls[0];
      expect(url).toBe("https://queue.fal.run/fal-ai/flux/schnell");
      expect(opts.headers.Authorization).toBe("Key fal-key");
      expect(JSON.parse(opts.body)).toEqual({ prompt: "a cat" });
    });
  });

  describe("pollQueueStatus", () => {
    it("should GET status endpoint", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: "COMPLETED" }),
      });

      const result = await queueRunner.pollQueueStatus({
        apiKey: "fal-key",
        modelId: "fal-ai/flux/schnell",
        requestId: "req-123",
      });

      expect(result).toBe("COMPLETED");
      const [url] = globalThis.fetch.mock.calls[0];
      expect(url).toBe(
        "https://queue.fal.run/fal-ai/flux/schnell/requests/req-123/status",
      );
    });
  });

  describe("fetchQueueResult", () => {
    it("should GET result endpoint", async () => {
      const payload = { images: [{ url: "https://fal.ai/img.png" }] };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      });

      const result = await queueRunner.fetchQueueResult({
        apiKey: "fal-key",
        modelId: "fal-ai/flux/schnell",
        requestId: "req-123",
      });

      expect(result).toEqual(payload);
    });
  });

  describe("runQueue", () => {
    it("should submit, poll until complete, fetch result", async () => {
      let callIndex = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        const responses = [
          {
            ok: true,
            status: 200,
            json: () => Promise.resolve({ request_id: "req-1" }),
          },
          {
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: "IN_PROGRESS" }),
          },
          {
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: "COMPLETED" }),
          },
          {
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({ images: [{ url: "https://fal.ai/out.png" }] }),
          },
        ];
        return Promise.resolve(responses[callIndex++]);
      });

      const result = await queueRunner.runQueue({
        apiKey: "fal-key",
        modelId: "fal-ai/flux/schnell",
        input: { prompt: "test" },
        pollIntervalMs: 10,
      });

      expect(result).toEqual({ images: [{ url: "https://fal.ai/out.png" }] });
      expect(globalThis.fetch).toHaveBeenCalledTimes(4);
    });

    it("should throw on poll timeout", async () => {
      let callIndex = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        const responses = [
          {
            ok: true,
            status: 200,
            json: () => Promise.resolve({ request_id: "req-slow" }),
          },
          {
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: "IN_QUEUE" }),
          },
          {
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: "IN_QUEUE" }),
          },
        ];
        return Promise.resolve(responses[callIndex++]);
      });

      await expect(
        queueRunner.runQueue({
          apiKey: "fal-key",
          modelId: "fal-ai/flux/schnell",
          input: {},
          pollIntervalMs: 10,
          maxPollAttempts: 2,
        }),
      ).rejects.toThrow(/timed out|max poll/i);
    });
  });
});
