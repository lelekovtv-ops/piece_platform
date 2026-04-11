import { vi, describe, it, expect, beforeEach } from "vitest";

const mockHandle = vi.fn();
const mockWhenReady = vi.fn(() => ({ then: vi.fn((cb) => cb()) }));
const mockOn = vi.fn();

vi.mock("electron", () => ({
  app: {
    whenReady: mockWhenReady,
    on: mockOn,
    quit: vi.fn(),
  },
  BrowserWindow: vi.fn(() => ({
    loadFile: vi.fn(),
    on: vi.fn(),
    setSize: vi.fn(),
    hide: vi.fn(),
    show: vi.fn(),
    webContents: { send: vi.fn() },
  })),
  ipcMain: {
    handle: mockHandle,
  },
}));

vi.mock("module", () => ({
  createRequire: vi.fn(() =>
    vi.fn(() => {
      throw new Error("Not in Resolve");
    }),
  ),
}));

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

vi.mock("../../../src/main/resolve/client.js", () => ({
  loadNativeModule: vi.fn(),
  initialize: vi.fn(),
  cleanup: vi.fn(),
}));

vi.mock("../../../src/main/providers/bootstrap.js", () => ({}));

vi.mock("../../../src/main/providers/registry.js", () => ({
  getProvider: vi.fn(),
  listProviders: vi.fn(() => []),
  registerProvider: vi.fn(),
  clearRegistry: vi.fn(),
}));

vi.mock("../../../src/main/license/license-check.js", () => ({
  createLicenseCheck: vi.fn(() => ({
    checkLicense: vi.fn().mockResolvedValue({ hasLicense: false }),
  })),
}));

vi.mock("../../../src/main/auth/token-storage.js", () => ({
  loadToken: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../src/main/ipc/generation-handlers.js", () => ({
  registerGenerationHandlers: vi.fn(),
}));
vi.mock("../../../src/main/ipc/keys-handlers.js", () => ({
  registerKeysHandlers: vi.fn(),
}));
vi.mock("../../../src/main/ipc/snapshot-handlers.js", () => ({
  registerSnapshotHandlers: vi.fn(),
}));
vi.mock("../../../src/main/ipc/auth-handlers.js", () => ({
  registerAuthHandlers: vi.fn(),
}));
vi.mock("../../../src/main/ipc/license-handlers.js", () => ({
  registerLicenseHandlers: vi.fn(),
}));
vi.mock("../../../src/main/ipc/window-handlers.js", () => ({
  registerWindowHandlers: vi.fn(),
}));

describe("main entry point (Electron)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("should export PLUGIN_ID constant", async () => {
    const mainModule = await import("../../../src/main/index.js");
    expect(mainModule.PLUGIN_ID).toBe("app.piece.studio");
  });

  it("should call app.whenReady on import", async () => {
    await import("../../../src/main/index.js");
    expect(mockWhenReady).toHaveBeenCalled();
  });

  it("should register window-all-closed and activate handlers", async () => {
    await import("../../../src/main/index.js");
    const eventNames = mockOn.mock.calls.map((c) => c[0]);
    expect(eventNames).toContain("window-all-closed");
    expect(eventNames).toContain("activate");
  });
});
