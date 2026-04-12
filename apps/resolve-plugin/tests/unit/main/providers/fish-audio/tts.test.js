import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

describe("Fish Audio TTS Provider", () => {
  let fishAudio;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    vi.resetModules();
    fishAudio =
      await import("../../../../../src/main/providers/fish-audio/tts.js");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("provider shape", () => {
    it("should export a valid provider object", () => {
      const p = fishAudio.fishAudioProvider;
      expect(p.id).toBe("fish-audio");
      expect(p.name).toBe("Fish Audio TTS");
      expect(p.kind).toBe("audio");
      expect(typeof p.generate).toBe("function");
    });
  });

  describe("generate", () => {
    it("should POST to fish.audio TTS and return bytes result", async () => {
      const fakeAudio = new ArrayBuffer(256);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(fakeAudio),
      });

      const result = await fishAudio.fishAudioProvider.generate({
        apiKey: "fish-key",
        text: "Hello world",
        referenceId: "voice-123",
      });

      expect(result.type).toBe("bytes");
      expect(result.suffix).toBe(".mp3");
      expect(result.mimeType).toBe("audio/mpeg");
      expect(result.value).toBeInstanceOf(ArrayBuffer);

      const [url, opts] = globalThis.fetch.mock.calls[0];
      expect(url).toBe("https://api.fish.audio/v1/tts");
      expect(opts.headers.Authorization).toBe("Bearer fish-key");
      expect(opts.headers.model).toBe("s2-pro");

      const body = JSON.parse(opts.body);
      expect(body.text).toBe("Hello world");
      expect(body.reference_id).toBe("voice-123");
      expect(body.format).toBe("mp3");
    });

    it("should support custom format and prosody settings", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(64)),
      });

      await fishAudio.fishAudioProvider.generate({
        apiKey: "fish-key",
        text: "Test",
        format: "wav",
        speed: 1.2,
        temperature: 0.5,
      });

      const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      expect(body.format).toBe("wav");
      expect(body.temperature).toBe(0.5);
      expect(body.prosody.speed).toBe(1.2);
    });

    it("should throw on API failure", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () => Promise.resolve("invalid key"),
      });

      await expect(
        fishAudio.fishAudioProvider.generate({
          apiKey: "bad-key",
          text: "Hello",
        }),
      ).rejects.toThrow(/401/);
    });
  });
});
