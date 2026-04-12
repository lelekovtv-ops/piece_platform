import { describe, it, expect, vi, beforeEach } from "vitest";
import { KEYS_CHANNELS } from "../../../../src/shared/ipc-channels.js";

let mockFileContent = "{}";

vi.mock("fs", () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => mockFileContent),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

const { registerKeysHandlers } =
  await import("../../../../src/main/ipc/keys-handlers.js");
const fs = await import("fs");

function makeMockLogger() {
  const child = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    createComponentLogger: vi.fn().mockReturnValue(child),
  };
}

describe("registerKeysHandlers", () => {
  let handlers;
  let logger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFileContent = "{}";
    handlers = {};
    logger = makeMockLogger();
  });

  it("registers all four key handlers", () => {
    registerKeysHandlers(handlers, { dataDir: "/tmp/data", logger });
    expect(handlers[KEYS_CHANNELS.get]).toBeDefined();
    expect(handlers[KEYS_CHANNELS.set]).toBeDefined();
    expect(handlers[KEYS_CHANNELS.remove]).toBeDefined();
    expect(handlers[KEYS_CHANNELS.list]).toBeDefined();
  });

  describe("keys:set and keys:get", () => {
    it("stores and retrieves a key", () => {
      registerKeysHandlers(handlers, { dataDir: "/tmp/data", logger });
      handlers[KEYS_CHANNELS.set]("openai", "sk-abc123");

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("keys.json"),
        expect.stringContaining("openai"),
        "utf-8",
      );

      mockFileContent = JSON.stringify({ openai: "sk-abc123" });
      const val = handlers[KEYS_CHANNELS.get]("openai");
      expect(val).toBe("sk-abc123");
    });

    it("returns null for unknown key", () => {
      registerKeysHandlers(handlers, { dataDir: "/tmp/data", logger });
      mockFileContent = "{}";
      const val = handlers[KEYS_CHANNELS.get]("nonexistent");
      expect(val).toBeNull();
    });
  });

  describe("keys:remove", () => {
    it("removes a stored key", () => {
      mockFileContent = JSON.stringify({ openai: "sk-123", fal: "fal-456" });
      registerKeysHandlers(handlers, { dataDir: "/tmp/data", logger });
      handlers[KEYS_CHANNELS.remove]("openai");

      const writeCall = fs.writeFileSync.mock.calls[0];
      const written = JSON.parse(writeCall[1]);
      expect(written).not.toHaveProperty("openai");
      expect(written).toHaveProperty("fal", "fal-456");
    });
  });

  describe("keys:list", () => {
    it("returns all stored key IDs", () => {
      mockFileContent = JSON.stringify({
        openai: "sk-123",
        fal: "fal-456",
        google: "g-789",
      });
      registerKeysHandlers(handlers, { dataDir: "/tmp/data", logger });
      const ids = handlers[KEYS_CHANNELS.list]();
      expect(ids).toEqual(["openai", "fal", "google"]);
    });

    it("returns empty array when no keys stored", () => {
      mockFileContent = "{}";
      registerKeysHandlers(handlers, { dataDir: "/tmp/data", logger });
      const ids = handlers[KEYS_CHANNELS.list]();
      expect(ids).toEqual([]);
    });
  });

  it("creates dataDir if it does not exist", () => {
    fs.existsSync.mockReturnValue(false);
    registerKeysHandlers(handlers, { dataDir: "/tmp/data", logger });
    handlers[KEYS_CHANNELS.set]("test", "val");
    expect(fs.mkdirSync).toHaveBeenCalledWith("/tmp/data", {
      recursive: true,
    });
  });
});
