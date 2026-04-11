import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

describe("HTTP utilities", () => {
  let http;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    vi.resetModules();
    http = await import("../../../../src/main/utils/http.js");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("jsonPost", () => {
    it("should POST JSON and parse response", async () => {
      const body = { task_id: "abc" };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: body }),
      });

      const result = await http.jsonPost("https://example.com/api", {
        body: { input: "hello" },
      });

      expect(globalThis.fetch).toHaveBeenCalledOnce();
      const [url, opts] = globalThis.fetch.mock.calls[0];
      expect(url).toBe("https://example.com/api");
      expect(opts.method).toBe("POST");
      expect(JSON.parse(opts.body)).toEqual({ input: "hello" });
      expect(opts.headers["Content-Type"]).toBe("application/json");
      expect(result).toEqual({ success: true, data: body });
    });

    it("should include custom headers", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      await http.jsonPost("https://example.com/api", {
        body: {},
        headers: { Authorization: "Bearer tok" },
      });

      const [, opts] = globalThis.fetch.mock.calls[0];
      expect(opts.headers.Authorization).toBe("Bearer tok");
    });

    it("should throw ProviderHttpError on non-ok response", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: () => Promise.resolve("rate limited"),
      });

      await expect(
        http.jsonPost("https://example.com/api", { body: {} }),
      ).rejects.toThrow(http.ProviderHttpError);

      try {
        await http.jsonPost("https://example.com/api", { body: {} });
      } catch (err) {
        expect(err.status).toBe(429);
        expect(err.message).toContain("429");
      }
    });

    it("should abort after timeout", async () => {
      globalThis.fetch = vi.fn().mockImplementation(
        (_url, opts) =>
          new Promise((_resolve, reject) => {
            opts.signal?.addEventListener("abort", () => {
              const err = new Error("aborted");
              err.name = "AbortError";
              reject(err);
            });
          }),
      );

      await expect(
        http.jsonPost("https://example.com/api", {
          body: {},
          timeoutMs: 50,
        }),
      ).rejects.toThrow(/timed out|abort/i);
    });
  });

  describe("jsonGet", () => {
    it("should GET and parse JSON", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [1, 2] }),
      });

      const result = await http.jsonGet("https://example.com/items", {
        headers: { "X-Key": "k" },
      });

      const [url, opts] = globalThis.fetch.mock.calls[0];
      expect(url).toBe("https://example.com/items");
      expect(opts.method).toBe("GET");
      expect(opts.headers["X-Key"]).toBe("k");
      expect(result).toEqual({ items: [1, 2] });
    });
  });

  describe("fetchBytes", () => {
    it("should return ArrayBuffer from URL", async () => {
      const buf = new ArrayBuffer(8);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(buf),
      });

      const result = await http.fetchBytes("https://example.com/img.png");
      expect(result).toBe(buf);
    });

    it("should throw ProviderHttpError on failure", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve("not found"),
      });

      await expect(
        http.fetchBytes("https://example.com/missing.png"),
      ).rejects.toThrow(http.ProviderHttpError);
    });
  });
});
