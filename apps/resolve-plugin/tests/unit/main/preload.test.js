import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInvoke = vi.fn();
const mockOn = vi.fn();
let exposedApi = null;

vi.mock("electron/renderer", () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn((name, api) => {
      exposedApi = api;
    }),
  },
  ipcRenderer: {
    invoke: mockInvoke,
    on: mockOn,
  },
}));

beforeEach(() => {
  exposedApi = null;
  mockInvoke.mockReset();
  mockOn.mockReset();
});

async function loadPreload() {
  vi.resetModules();
  exposedApi = null;
  await import("../../../src/main/preload.js");
  return exposedApi;
}

describe("preload (Electron contextBridge)", () => {
  it("exposes all six namespaces on window.api", async () => {
    const api = await loadPreload();
    expect(api).toHaveProperty("auth");
    expect(api).toHaveProperty("license");
    expect(api).toHaveProperty("window");
    expect(api).toHaveProperty("generation");
    expect(api).toHaveProperty("snapshot");
    expect(api).toHaveProperty("keys");
  });

  describe("auth namespace", () => {
    it("invokes auth:start-signin", async () => {
      const api = await loadPreload();
      mockInvoke.mockResolvedValue({ code: "ABC123" });
      const result = await api.auth.startSignIn();
      expect(mockInvoke).toHaveBeenCalledWith("auth:start-signin");
      expect(result).toEqual({ code: "ABC123" });
    });

    it("invokes auth:get-current-user", async () => {
      const api = await loadPreload();
      await api.auth.getCurrentUser();
      expect(mockInvoke).toHaveBeenCalledWith("auth:get-current-user");
    });

    it("invokes auth:sign-out", async () => {
      const api = await loadPreload();
      await api.auth.signOut();
      expect(mockInvoke).toHaveBeenCalledWith("auth:sign-out");
    });
  });

  describe("license namespace", () => {
    it("invokes license:check", async () => {
      const api = await loadPreload();
      await api.license.check();
      expect(mockInvoke).toHaveBeenCalledWith("license:check");
    });

    it("invokes license:refresh", async () => {
      const api = await loadPreload();
      await api.license.refresh();
      expect(mockInvoke).toHaveBeenCalledWith("license:refresh");
    });
  });

  describe("window namespace", () => {
    it("invokes expand and collapse", async () => {
      const api = await loadPreload();
      await api.window.expand();
      await api.window.collapse();
      expect(mockInvoke).toHaveBeenCalledWith("window:expand");
      expect(mockInvoke).toHaveBeenCalledWith("window:collapse");
    });

    it("invokes getMode", async () => {
      const api = await loadPreload();
      await api.window.getMode();
      expect(mockInvoke).toHaveBeenCalledWith("window:get-mode");
    });

    it("invokes hideTemporarily and showAgain", async () => {
      const api = await loadPreload();
      await api.window.hideTemporarily();
      await api.window.showAgain();
      expect(mockInvoke).toHaveBeenCalledWith("window:hide-temporarily");
      expect(mockInvoke).toHaveBeenCalledWith("window:show-again");
    });

    it("registers onModeChanged via ipcRenderer.on", async () => {
      const api = await loadPreload();
      const cb = vi.fn();
      api.window.onModeChanged(cb);
      expect(mockOn).toHaveBeenCalledWith(
        "window:mode-changed",
        expect.any(Function),
      );
    });
  });

  describe("generation namespace", () => {
    it("invokes run with params", async () => {
      const api = await loadPreload();
      const params = { provider: "sjinn", prompt: "cat", apiKey: "k" };
      await api.generation.run(params);
      expect(mockInvoke).toHaveBeenCalledWith("generation:run", params);
    });

    it("invokes cancel and getStatus", async () => {
      const api = await loadPreload();
      await api.generation.cancel();
      await api.generation.getStatus();
      expect(mockInvoke).toHaveBeenCalledWith("generation:cancel");
      expect(mockInvoke).toHaveBeenCalledWith("generation:get-status");
    });

    it("registers event callbacks via ipcRenderer.on", async () => {
      const api = await loadPreload();
      api.generation.onProgress(vi.fn());
      api.generation.onComplete(vi.fn());
      api.generation.onError(vi.fn());
      expect(mockOn).toHaveBeenCalledWith(
        "generation:on-progress",
        expect.any(Function),
      );
      expect(mockOn).toHaveBeenCalledWith(
        "generation:on-complete",
        expect.any(Function),
      );
      expect(mockOn).toHaveBeenCalledWith(
        "generation:on-error",
        expect.any(Function),
      );
    });
  });

  describe("snapshot namespace", () => {
    it("invokes capture", async () => {
      const api = await loadPreload();
      await api.snapshot.capture();
      expect(mockInvoke).toHaveBeenCalledWith("snapshot:capture");
    });
  });

  describe("keys namespace", () => {
    it("invokes get with keyId", async () => {
      const api = await loadPreload();
      await api.keys.get("openai");
      expect(mockInvoke).toHaveBeenCalledWith("keys:get", "openai");
    });

    it("invokes set with keyId and value", async () => {
      const api = await loadPreload();
      await api.keys.set("openai", "sk-new");
      expect(mockInvoke).toHaveBeenCalledWith("keys:set", "openai", "sk-new");
    });

    it("invokes remove", async () => {
      const api = await loadPreload();
      await api.keys.remove("openai");
      expect(mockInvoke).toHaveBeenCalledWith("keys:remove", "openai");
    });

    it("invokes list", async () => {
      const api = await loadPreload();
      await api.keys.list();
      expect(mockInvoke).toHaveBeenCalledWith("keys:list");
    });
  });
});
