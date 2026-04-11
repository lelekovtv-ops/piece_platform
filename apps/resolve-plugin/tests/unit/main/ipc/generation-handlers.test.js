import { describe, it, expect, vi, beforeEach } from "vitest";
import { GENERATION_CHANNELS } from "../../../../src/shared/ipc-channels.js";

vi.mock("../../../../src/main/resolve/media-pool.js", () => ({
  importAndAppend: vi.fn().mockReturnValue({
    imported: [{ GetClipName: () => "Generated_001" }],
    timeline: [{}],
  }),
}));

vi.mock("fs", () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

const { registerGenerationHandlers } =
  await import("../../../../src/main/ipc/generation-handlers.js");
const { importAndAppend } =
  await import("../../../../src/main/resolve/media-pool.js");
const { writeFileSync, mkdirSync } = await import("fs");

function makeMockProvider(overrides = {}) {
  return {
    id: "test-provider",
    name: "Test Provider",
    kind: "image",
    generate: vi.fn().mockResolvedValue({
      type: "bytes",
      value: Buffer.from("fake-image"),
      suffix: ".png",
    }),
    ...overrides,
  };
}

function makeMockRegistry(provider) {
  return {
    getProvider: vi.fn().mockReturnValue(provider),
    listProviders: vi.fn().mockReturnValue(provider ? [provider] : []),
  };
}

function makeMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    createComponentLogger: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  };
}

describe("registerGenerationHandlers", () => {
  let handlers;
  let provider;
  let registry;
  let logger;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = {};
    provider = makeMockProvider();
    registry = makeMockRegistry(provider);
    logger = makeMockLogger();
  });

  it("registers handler for generation:run", () => {
    registerGenerationHandlers(handlers, {
      registry,
      downloadDir: "/tmp/dl",
      logger,
    });
    expect(handlers[GENERATION_CHANNELS.run]).toBeDefined();
    expect(typeof handlers[GENERATION_CHANNELS.run]).toBe("function");
  });

  it("registers handler for generation:cancel", () => {
    registerGenerationHandlers(handlers, {
      registry,
      downloadDir: "/tmp/dl",
      logger,
    });
    expect(handlers[GENERATION_CHANNELS.cancel]).toBeDefined();
  });

  it("registers handler for generation:get-status", () => {
    registerGenerationHandlers(handlers, {
      registry,
      downloadDir: "/tmp/dl",
      logger,
    });
    expect(handlers[GENERATION_CHANNELS.getStatus]).toBeDefined();
  });

  describe("generation:run", () => {
    it("looks up provider from registry", async () => {
      registerGenerationHandlers(handlers, {
        registry,
        downloadDir: "/tmp/dl",
        logger,
      });
      await handlers[GENERATION_CHANNELS.run]({
        provider: "test-provider",
        apiKey: "key-123",
        prompt: "a cat",
      });
      expect(registry.getProvider).toHaveBeenCalledWith("test-provider");
    });

    it("throws if provider not found", async () => {
      registry.getProvider.mockReturnValue(undefined);
      registerGenerationHandlers(handlers, {
        registry,
        downloadDir: "/tmp/dl",
        logger,
      });

      await expect(
        handlers[GENERATION_CHANNELS.run]({
          provider: "nonexistent",
          apiKey: "key",
          prompt: "x",
        }),
      ).rejects.toThrow("Provider not found: nonexistent");
    });

    it("calls provider.generate with apiKey and prompt", async () => {
      registerGenerationHandlers(handlers, {
        registry,
        downloadDir: "/tmp/dl",
        logger,
      });
      await handlers[GENERATION_CHANNELS.run]({
        provider: "test-provider",
        apiKey: "key-123",
        prompt: "a cat sitting",
        referenceImage: "/ref.png",
      });

      expect(provider.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: "key-123",
          prompt: "a cat sitting",
        }),
      );
    });

    it("saves bytes result to downloadDir and imports to Resolve", async () => {
      registerGenerationHandlers(handlers, {
        registry,
        downloadDir: "/tmp/dl",
        logger,
      });
      const result = await handlers[GENERATION_CHANNELS.run]({
        provider: "test-provider",
        apiKey: "k",
        prompt: "dog",
      });

      expect(mkdirSync).toHaveBeenCalledWith("/tmp/dl", { recursive: true });
      expect(writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("/tmp/dl/"),
        Buffer.from("fake-image"),
      );
      expect(importAndAppend).toHaveBeenCalledWith(
        expect.stringContaining("/tmp/dl/"),
        {},
      );
      expect(result).toHaveProperty("clipName");
    });

    it("saves url result by fetching then importing", async () => {
      provider.generate.mockResolvedValue({
        type: "url",
        url: "https://example.com/img.png",
        suffix: ".png",
      });

      const mockFetchGlobal = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
      });
      globalThis.fetch = mockFetchGlobal;

      registerGenerationHandlers(handlers, {
        registry,
        downloadDir: "/tmp/dl",
        logger,
      });

      const result = await handlers[GENERATION_CHANNELS.run]({
        provider: "test-provider",
        apiKey: "k",
        prompt: "dog",
      });

      expect(mockFetchGlobal).toHaveBeenCalledWith(
        "https://example.com/img.png",
      );
      expect(writeFileSync).toHaveBeenCalled();
      expect(importAndAppend).toHaveBeenCalled();
      expect(result).toHaveProperty("clipName");

      delete globalThis.fetch;
    });

    it("returns error object on generate failure", async () => {
      provider.generate.mockRejectedValue(new Error("API rate limit"));
      registerGenerationHandlers(handlers, {
        registry,
        downloadDir: "/tmp/dl",
        logger,
      });

      const result = await handlers[GENERATION_CHANNELS.run]({
        provider: "test-provider",
        apiKey: "k",
        prompt: "dog",
      });

      expect(result).toEqual(
        expect.objectContaining({
          error: "API rate limit",
        }),
      );
    });

    it("requires apiKey parameter", async () => {
      registerGenerationHandlers(handlers, {
        registry,
        downloadDir: "/tmp/dl",
        logger,
      });

      await expect(
        handlers[GENERATION_CHANNELS.run]({
          provider: "test-provider",
          prompt: "dog",
        }),
      ).rejects.toThrow("apiKey is required");
    });

    it("requires prompt parameter", async () => {
      registerGenerationHandlers(handlers, {
        registry,
        downloadDir: "/tmp/dl",
        logger,
      });

      await expect(
        handlers[GENERATION_CHANNELS.run]({
          provider: "test-provider",
          apiKey: "k",
        }),
      ).rejects.toThrow("prompt is required");
    });
  });

  describe("generation:get-status", () => {
    it("returns idle when no generation active", () => {
      registerGenerationHandlers(handlers, {
        registry,
        downloadDir: "/tmp/dl",
        logger,
      });
      expect(handlers[GENERATION_CHANNELS.getStatus]()).toBe("idle");
    });
  });
});
