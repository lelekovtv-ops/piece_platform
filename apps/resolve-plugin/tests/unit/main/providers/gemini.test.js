import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

describe("Gemini Provider", () => {
  let gemini;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    vi.resetModules();
    gemini = await import("../../../../src/main/providers/gemini.js");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("provider shape", () => {
    it("should export a valid provider object", () => {
      const p = gemini.geminiProvider;
      expect(p.id).toBe("gemini");
      expect(p.name).toBe("Google Gemini");
      expect(p.kind).toBe("image");
      expect(typeof p.generate).toBe("function");
    });
  });

  describe("generate", () => {
    it("should send prompt and return base64 image as bytes result", async () => {
      const fakeB64 = Buffer.from("fake-png-data").toString("base64");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    { inlineData: { mimeType: "image/png", data: fakeB64 } },
                  ],
                },
              },
            ],
          }),
      });

      const result = await gemini.geminiProvider.generate({
        apiKey: "test-key",
        prompt: "a sunset over mountains",
      });

      expect(result.type).toBe("bytes");
      expect(result.suffix).toBe(".png");
      expect(result.mimeType).toBe("image/png");
      expect(Buffer.isBuffer(result.value)).toBe(true);

      const [url, opts] = globalThis.fetch.mock.calls[0];
      expect(url).toContain("gemini-2.5-flash-image:generateContent");
      expect(opts.headers["x-goog-api-key"]).toBe("test-key");

      const body = JSON.parse(opts.body);
      expect(body.contents[0].parts).toEqual(
        expect.arrayContaining([{ text: "a sunset over mountains" }]),
      );
      expect(body.generationConfig.responseModalities).toContain("IMAGE");
    });

    it("should include reference images as inlineData parts", async () => {
      const fakeB64 = Buffer.from("result").toString("base64");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    { inlineData: { mimeType: "image/png", data: fakeB64 } },
                  ],
                },
              },
            ],
          }),
      });

      await gemini.geminiProvider.generate({
        apiKey: "test-key",
        prompt: "same style",
        references: [{ mimeType: "image/jpeg", base64: "abc123" }],
      });

      const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      const parts = body.contents[0].parts;
      expect(parts[0]).toEqual({
        inlineData: { mimeType: "image/jpeg", data: "abc123" },
      });
      expect(parts[1]).toEqual({ text: "same style" });
    });

    it("should pass aspectRatio in generationConfig", async () => {
      const fakeB64 = Buffer.from("result").toString("base64");

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    { inlineData: { mimeType: "image/png", data: fakeB64 } },
                  ],
                },
              },
            ],
          }),
      });

      await gemini.geminiProvider.generate({
        apiKey: "test-key",
        prompt: "wide landscape",
        aspectRatio: "16:9",
      });

      const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      expect(body.generationConfig.aspectRatio).toBe("16:9");
    });

    it("should throw when no image part in response", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: "I cannot generate that image" }],
                },
              },
            ],
          }),
      });

      await expect(
        gemini.geminiProvider.generate({
          apiKey: "test-key",
          prompt: "something",
        }),
      ).rejects.toThrow(/no image/i);
    });

    it("should throw ProviderHttpError on API failure", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: () => Promise.resolve("rate limited"),
      });

      await expect(
        gemini.geminiProvider.generate({
          apiKey: "test-key",
          prompt: "anything",
        }),
      ).rejects.toThrow(/429/);
    });
  });
});
