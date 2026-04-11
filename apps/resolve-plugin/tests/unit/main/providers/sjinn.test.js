import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const SJINN_BASE = "https://sjinn.ai/api/un-api";

function mockFetchSequence(responses) {
  let callIndex = 0;
  globalThis.fetch = vi.fn().mockImplementation(() => {
    const r = responses[callIndex++];
    if (!r) throw new Error("Unexpected fetch call");
    return Promise.resolve(r);
  });
}

describe("Sjinn Provider", () => {
  let sjinn;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    vi.resetModules();
    sjinn = await import("../../../../src/main/providers/sjinn.js");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("provider shape", () => {
    it("should export legacy sjinnProvider pointing to nano-banana", () => {
      const p = sjinn.sjinnProvider;
      expect(p.id).toBe("sjinn-nano-banana");
      expect(p.kind).toBe("image");
      expect(typeof p.generate).toBe("function");
    });

    it("should export all sjinn providers", () => {
      expect(sjinn.sjinnNanoBananaProvider.id).toBe("sjinn-nano-banana");
      expect(sjinn.sjinnVeo3TextProvider.id).toBe("sjinn-veo3-text");
      expect(sjinn.sjinnVeo3TextProvider.kind).toBe("video");
      expect(sjinn.sjinnSora2TextProvider.id).toBe("sjinn-sora2-text");
      expect(sjinn.sjinnKling3TextProvider.id).toBe("sjinn-kling3-text");
      expect(sjinn.sjinnLipsyncProvider.id).toBe("sjinn-lipsync");
    });
  });

  describe("createSjinnTask", () => {
    it("should call create_tool_task and return taskId", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: { task_id: "t-123" },
          }),
      });

      const result = await sjinn.createSjinnTask({
        apiKey: "key-1",
        toolType: "txt2img",
        input: { prompt: "a cat" },
      });

      expect(result).toEqual({ taskId: "t-123" });
      const [url, opts] = globalThis.fetch.mock.calls[0];
      expect(url).toBe(`${SJINN_BASE}/create_tool_task`);
      expect(opts.headers.Authorization).toBe("Bearer key-1");
      expect(JSON.parse(opts.body)).toEqual({
        tool_type: "txt2img",
        input: { prompt: "a cat" },
      });
    });

    it("should throw on API error response", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve("boom"),
      });

      await expect(
        sjinn.createSjinnTask({
          apiKey: "key-1",
          toolType: "txt2img",
          input: {},
        }),
      ).rejects.toThrow(/500/);
    });

    it("should throw when success is false", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: false,
            errorMsg: "invalid tool",
          }),
      });

      await expect(
        sjinn.createSjinnTask({
          apiKey: "key-1",
          toolType: "bad",
          input: {},
        }),
      ).rejects.toThrow("invalid tool");
    });
  });

  describe("pollSjinnTask", () => {
    it("should return status and output urls", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              task_id: "t-123",
              status: 3,
              output_urls: ["https://cdn.sjinn.ai/img.png"],
            },
          }),
      });

      const result = await sjinn.pollSjinnTask({
        apiKey: "key-1",
        taskId: "t-123",
      });

      expect(result.status).toBe(3);
      expect(result.outputUrls).toEqual(["https://cdn.sjinn.ai/img.png"]);
    });

    it("should include error when status is -1", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: { task_id: "t-123", status: -1 },
            errorMsg: "generation failed",
          }),
      });

      const result = await sjinn.pollSjinnTask({
        apiKey: "key-1",
        taskId: "t-123",
      });

      expect(result.error).toBe("generation failed");
    });
  });

  describe("generate (provider interface)", () => {
    it("should create task, poll until done, return url result", async () => {
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: { task_id: "t-gen" },
            }),
        },
        {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: { task_id: "t-gen", status: 1, output_urls: [] },
            }),
        },
        {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                task_id: "t-gen",
                status: 3,
                output_urls: ["https://cdn.sjinn.ai/result.png"],
              },
            }),
        },
      ]);

      const result = await sjinn.sjinnNanoBananaProvider.generate({
        apiKey: "key-1",
        prompt: "sunset",
      });

      expect(result).toEqual({
        type: "url",
        url: "https://cdn.sjinn.ai/result.png",
        suffix: ".png",
      });
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);

      const createBody = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      expect(createBody.tool_type).toBe("nano-banana-image-api");
      expect(createBody.input.prompt).toBe("sunset");
    });

    it("should throw when task fails (status -1)", async () => {
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: { task_id: "t-fail" },
            }),
        },
        {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: { task_id: "t-fail", status: -1 },
              errorMsg: "NSFW content",
            }),
        },
      ]);

      await expect(
        sjinn.sjinnNanoBananaProvider.generate({
          apiKey: "key-1",
          prompt: "bad",
        }),
      ).rejects.toThrow(/NSFW content/);
    });

    it("should throw on poll timeout", async () => {
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: { task_id: "t-slow" },
            }),
        },
        {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: { task_id: "t-slow", status: 1, output_urls: [] },
            }),
        },
        {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: { task_id: "t-slow", status: 1, output_urls: [] },
            }),
        },
      ]);

      await expect(
        sjinn.sjinnNanoBananaProvider.generate({
          apiKey: "key-1",
          prompt: "test",
          pollIntervalMs: 10,
          maxPollAttempts: 2,
        }),
      ).rejects.toThrow(/timed out/i);
    });
  });
});
