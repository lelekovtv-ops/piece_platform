import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../../../src/main/config.js", () => ({
  createConfig: vi.fn(() => ({
    dataDir: "/tmp/piece-test",
    logDir: "/tmp/piece-test/logs",
    downloadDir: "/tmp/piece-test/downloads",
    snapshotDir: "/tmp/piece-test/snapshots",
    get: vi.fn((key) => {
      const values = {
        LOG_LEVEL: "info",
        PIECE_API_URL: "https://api.test.piece.app",
      };
      return values[key] ?? null;
    }),
  })),
}));

vi.mock("../../../src/main/logger.js", () => ({
  createPluginLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    createComponentLogger: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  })),
}));

describe("main entry point", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export an init function", async () => {
    const mainModule = await import("../../../src/main/index.js");

    expect(typeof mainModule.init).toBe("function");
  });

  it("should export a PLUGIN_ID constant", async () => {
    const mainModule = await import("../../../src/main/index.js");

    expect(mainModule.PLUGIN_ID).toBe("app.piece.studio");
  });
});
