import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../../../../../src/main/providers/fal/queue-runner.js", () => ({
  runQueue: vi.fn(),
}));

describe("fal.ai providers", () => {
  let runQueue;

  beforeEach(async () => {
    vi.resetModules();
    const qr =
      await import("../../../../../src/main/providers/fal/queue-runner.js");
    runQueue = qr.runQueue;
    vi.mocked(runQueue).mockReset();
  });

  describe("flux-schnell", () => {
    it("should have correct provider shape", async () => {
      const { fluxSchnellProvider } =
        await import("../../../../../src/main/providers/fal/flux-schnell.js");
      expect(fluxSchnellProvider.id).toBe("fal-flux-schnell");
      expect(fluxSchnellProvider.kind).toBe("image");
    });

    it("should call runQueue with correct model and return url", async () => {
      vi.mocked(runQueue).mockResolvedValue({
        images: [{ url: "https://fal.ai/schnell.png" }],
      });
      const { fluxSchnellProvider } =
        await import("../../../../../src/main/providers/fal/flux-schnell.js");
      const result = await fluxSchnellProvider.generate({
        apiKey: "k",
        prompt: "cat",
      });
      expect(runQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: "fal-ai/flux/schnell",
          input: expect.objectContaining({ prompt: "cat" }),
        }),
      );
      expect(result).toEqual({
        type: "url",
        url: "https://fal.ai/schnell.png",
        suffix: ".png",
      });
    });
  });

  describe("flux-pro", () => {
    it("should have correct provider shape", async () => {
      const { fluxProProvider } =
        await import("../../../../../src/main/providers/fal/flux-pro.js");
      expect(fluxProProvider.id).toBe("fal-flux-pro");
      expect(fluxProProvider.kind).toBe("image");
    });

    it("should call runQueue with correct model", async () => {
      vi.mocked(runQueue).mockResolvedValue({
        images: [{ url: "https://fal.ai/pro.png" }],
      });
      const { fluxProProvider } =
        await import("../../../../../src/main/providers/fal/flux-pro.js");
      const result = await fluxProProvider.generate({
        apiKey: "k",
        prompt: "dog",
      });
      expect(runQueue).toHaveBeenCalledWith(
        expect.objectContaining({ modelId: "fal-ai/flux-pro/v1.1" }),
      );
      expect(result.type).toBe("url");
    });
  });

  describe("kling-v2", () => {
    it("should have video kind", async () => {
      const { klingV2Provider } =
        await import("../../../../../src/main/providers/fal/kling-v2.js");
      expect(klingV2Provider.id).toBe("fal-kling-v2");
      expect(klingV2Provider.kind).toBe("video");
    });

    it("should return video url", async () => {
      vi.mocked(runQueue).mockResolvedValue({
        video: { url: "https://fal.ai/kling.mp4" },
      });
      const { klingV2Provider } =
        await import("../../../../../src/main/providers/fal/kling-v2.js");
      const result = await klingV2Provider.generate({
        apiKey: "k",
        prompt: "walk",
      });
      expect(runQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: "fal-ai/kling-video/v2/master",
        }),
      );
      expect(result).toEqual({
        type: "url",
        url: "https://fal.ai/kling.mp4",
        suffix: ".mp4",
      });
    });
  });

  describe("veo3", () => {
    it("should have video kind", async () => {
      const { veo3Provider } =
        await import("../../../../../src/main/providers/fal/veo3.js");
      expect(veo3Provider.id).toBe("fal-veo3");
      expect(veo3Provider.kind).toBe("video");
    });

    it("should return video url", async () => {
      vi.mocked(runQueue).mockResolvedValue({
        video: { url: "https://fal.ai/veo.mp4" },
      });
      const { veo3Provider } =
        await import("../../../../../src/main/providers/fal/veo3.js");
      const result = await veo3Provider.generate({
        apiKey: "k",
        prompt: "fly",
      });
      expect(runQueue).toHaveBeenCalledWith(
        expect.objectContaining({ modelId: "fal-ai/veo3" }),
      );
      expect(result.suffix).toBe(".mp4");
    });
  });

  describe("luma", () => {
    it("should have video kind", async () => {
      const { lumaProvider } =
        await import("../../../../../src/main/providers/fal/luma.js");
      expect(lumaProvider.id).toBe("fal-luma");
      expect(lumaProvider.kind).toBe("video");
    });

    it("should return video url", async () => {
      vi.mocked(runQueue).mockResolvedValue({
        video: { url: "https://fal.ai/luma.mp4" },
      });
      const { lumaProvider } =
        await import("../../../../../src/main/providers/fal/luma.js");
      const result = await lumaProvider.generate({
        apiKey: "k",
        prompt: "dance",
      });
      expect(runQueue).toHaveBeenCalledWith(
        expect.objectContaining({ modelId: "fal-ai/luma-dream-machine" }),
      );
      expect(result.type).toBe("url");
    });
  });

  describe("elevenlabs", () => {
    it("should have audio kind", async () => {
      const { elevenlabsProvider } =
        await import("../../../../../src/main/providers/fal/elevenlabs.js");
      expect(elevenlabsProvider.id).toBe("fal-elevenlabs");
      expect(elevenlabsProvider.kind).toBe("audio");
    });

    it("should return audio url", async () => {
      vi.mocked(runQueue).mockResolvedValue({
        audio: { url: "https://fal.ai/speech.mp3" },
      });
      const { elevenlabsProvider } =
        await import("../../../../../src/main/providers/fal/elevenlabs.js");
      const result = await elevenlabsProvider.generate({
        apiKey: "k",
        text: "hello world",
      });
      expect(result).toEqual({
        type: "url",
        url: "https://fal.ai/speech.mp3",
        suffix: ".mp3",
      });
    });
  });

  describe("stable-audio", () => {
    it("should have audio kind", async () => {
      const { stableAudioProvider } =
        await import("../../../../../src/main/providers/fal/stable-audio.js");
      expect(stableAudioProvider.id).toBe("fal-stable-audio");
      expect(stableAudioProvider.kind).toBe("audio");
    });

    it("should return audio url", async () => {
      vi.mocked(runQueue).mockResolvedValue({
        audio_file: { url: "https://fal.ai/music.wav" },
      });
      const { stableAudioProvider } =
        await import("../../../../../src/main/providers/fal/stable-audio.js");
      const result = await stableAudioProvider.generate({
        apiKey: "k",
        prompt: "ambient synth",
      });
      expect(result).toEqual({
        type: "url",
        url: "https://fal.ai/music.wav",
        suffix: ".wav",
      });
    });
  });
});
