import { describe, it, expect, vi } from "vitest";
import { createPreloadApi } from "../../../src/main/preload.js";

function makeMockHandlers() {
  return {
    "auth:start-signin": vi.fn().mockResolvedValue({ code: "ABC123" }),
    "auth:get-current-user": vi.fn().mockResolvedValue({ email: "a@b.com" }),
    "auth:sign-out": vi.fn().mockResolvedValue(undefined),
    "license:check": vi.fn().mockResolvedValue({ hasLicense: true }),
    "license:refresh": vi.fn().mockResolvedValue({ hasLicense: true }),
    "window:expand": vi.fn(),
    "window:collapse": vi.fn(),
    "window:get-mode": vi.fn().mockReturnValue("bubble"),
    "window:hide-temporarily": vi.fn(),
    "window:show-again": vi.fn(),
    "generation:run": vi.fn().mockResolvedValue({ clipName: "clip_001" }),
    "generation:cancel": vi.fn(),
    "generation:get-status": vi.fn().mockReturnValue("idle"),
    "snapshot:capture": vi
      .fn()
      .mockResolvedValue({ filePath: "/tmp/snap.png" }),
    "keys:get": vi.fn().mockResolvedValue("sk-123"),
    "keys:set": vi.fn().mockResolvedValue(undefined),
    "keys:remove": vi.fn().mockResolvedValue(undefined),
    "keys:list": vi.fn().mockResolvedValue(["openai", "fal"]),
  };
}

function makeMockEventBus() {
  return { on: vi.fn(), off: vi.fn() };
}

describe("createPreloadApi", () => {
  it("exposes all six namespaces", () => {
    const api = createPreloadApi(makeMockHandlers(), makeMockEventBus());
    expect(api).toHaveProperty("auth");
    expect(api).toHaveProperty("license");
    expect(api).toHaveProperty("window");
    expect(api).toHaveProperty("generation");
    expect(api).toHaveProperty("snapshot");
    expect(api).toHaveProperty("keys");
  });

  describe("auth namespace", () => {
    it("delegates startSignIn", async () => {
      const h = makeMockHandlers();
      const api = createPreloadApi(h, makeMockEventBus());
      const result = await api.auth.startSignIn();
      expect(h["auth:start-signin"]).toHaveBeenCalledOnce();
      expect(result).toEqual({ code: "ABC123" });
    });

    it("delegates getCurrentUser", async () => {
      const h = makeMockHandlers();
      const api = createPreloadApi(h, makeMockEventBus());
      await api.auth.getCurrentUser();
      expect(h["auth:get-current-user"]).toHaveBeenCalledOnce();
    });

    it("delegates signOut", async () => {
      const h = makeMockHandlers();
      const api = createPreloadApi(h, makeMockEventBus());
      await api.auth.signOut();
      expect(h["auth:sign-out"]).toHaveBeenCalledOnce();
    });
  });

  describe("license namespace", () => {
    it("delegates check", async () => {
      const h = makeMockHandlers();
      const api = createPreloadApi(h, makeMockEventBus());
      await api.license.check();
      expect(h["license:check"]).toHaveBeenCalledOnce();
    });

    it("delegates refresh", async () => {
      const h = makeMockHandlers();
      const api = createPreloadApi(h, makeMockEventBus());
      await api.license.refresh();
      expect(h["license:refresh"]).toHaveBeenCalledOnce();
    });
  });

  describe("window namespace", () => {
    it("delegates expand and collapse", () => {
      const h = makeMockHandlers();
      const api = createPreloadApi(h, makeMockEventBus());
      api.window.expand();
      api.window.collapse();
      expect(h["window:expand"]).toHaveBeenCalledOnce();
      expect(h["window:collapse"]).toHaveBeenCalledOnce();
    });

    it("delegates getMode", () => {
      const h = makeMockHandlers();
      const api = createPreloadApi(h, makeMockEventBus());
      const mode = api.window.getMode();
      expect(mode).toBe("bubble");
    });

    it("delegates hideTemporarily and showAgain", () => {
      const h = makeMockHandlers();
      const api = createPreloadApi(h, makeMockEventBus());
      api.window.hideTemporarily();
      api.window.showAgain();
      expect(h["window:hide-temporarily"]).toHaveBeenCalledOnce();
      expect(h["window:show-again"]).toHaveBeenCalledOnce();
    });

    it("registers onModeChanged callback via eventBus", () => {
      const bus = makeMockEventBus();
      const api = createPreloadApi(makeMockHandlers(), bus);
      const cb = vi.fn();
      api.window.onModeChanged(cb);
      expect(bus.on).toHaveBeenCalledWith("window:mode-changed", cb);
    });
  });

  describe("generation namespace", () => {
    it("delegates run with params", async () => {
      const h = makeMockHandlers();
      const api = createPreloadApi(h, makeMockEventBus());
      const params = { provider: "sjinn", prompt: "cat", apiKey: "k" };
      const result = await api.generation.run(params);
      expect(h["generation:run"]).toHaveBeenCalledWith(params);
      expect(result).toEqual({ clipName: "clip_001" });
    });

    it("delegates cancel and getStatus", () => {
      const h = makeMockHandlers();
      const api = createPreloadApi(h, makeMockEventBus());
      api.generation.cancel();
      api.generation.getStatus();
      expect(h["generation:cancel"]).toHaveBeenCalledOnce();
      expect(h["generation:get-status"]).toHaveBeenCalledOnce();
    });

    it("registers event callbacks via eventBus", () => {
      const bus = makeMockEventBus();
      const api = createPreloadApi(makeMockHandlers(), bus);
      const onP = vi.fn();
      const onC = vi.fn();
      const onE = vi.fn();
      api.generation.onProgress(onP);
      api.generation.onComplete(onC);
      api.generation.onError(onE);
      expect(bus.on).toHaveBeenCalledWith("generation:on-progress", onP);
      expect(bus.on).toHaveBeenCalledWith("generation:on-complete", onC);
      expect(bus.on).toHaveBeenCalledWith("generation:on-error", onE);
    });
  });

  describe("snapshot namespace", () => {
    it("delegates capture", async () => {
      const h = makeMockHandlers();
      const api = createPreloadApi(h, makeMockEventBus());
      const result = await api.snapshot.capture();
      expect(h["snapshot:capture"]).toHaveBeenCalledOnce();
      expect(result).toEqual({ filePath: "/tmp/snap.png" });
    });
  });

  describe("keys namespace", () => {
    it("delegates get with keyId", async () => {
      const h = makeMockHandlers();
      const api = createPreloadApi(h, makeMockEventBus());
      const val = await api.keys.get("openai");
      expect(h["keys:get"]).toHaveBeenCalledWith("openai");
      expect(val).toBe("sk-123");
    });

    it("delegates set with keyId and value", async () => {
      const h = makeMockHandlers();
      const api = createPreloadApi(h, makeMockEventBus());
      await api.keys.set("openai", "sk-new");
      expect(h["keys:set"]).toHaveBeenCalledWith("openai", "sk-new");
    });

    it("delegates remove", async () => {
      const h = makeMockHandlers();
      const api = createPreloadApi(h, makeMockEventBus());
      await api.keys.remove("openai");
      expect(h["keys:remove"]).toHaveBeenCalledWith("openai");
    });

    it("delegates list", async () => {
      const h = makeMockHandlers();
      const api = createPreloadApi(h, makeMockEventBus());
      const result = await api.keys.list();
      expect(h["keys:list"]).toHaveBeenCalledOnce();
      expect(result).toEqual(["openai", "fal"]);
    });
  });

  it("handles missing handler gracefully (returns undefined)", () => {
    const api = createPreloadApi({}, makeMockEventBus());
    expect(api.auth.startSignIn()).toBeUndefined();
    expect(api.window.expand()).toBeUndefined();
    expect(api.generation.cancel()).toBeUndefined();
    expect(api.snapshot.capture()).toBeUndefined();
    expect(api.keys.list()).toBeUndefined();
  });

  it("handles missing eventBus gracefully", () => {
    const api = createPreloadApi(makeMockHandlers(), undefined);
    expect(() => api.window.onModeChanged(vi.fn())).not.toThrow();
    expect(() => api.generation.onProgress(vi.fn())).not.toThrow();
  });
});
