import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const mockInitialize = vi.fn();
const mockCleanUp = vi.fn();
const mockGetResolve = vi.fn();

const mockWorkflowIntegration = {
  Initialize: mockInitialize,
  CleanUp: mockCleanUp,
  GetResolve: mockGetResolve,
};

vi.mock("../../../../src/main/logger.js", () => ({
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

describe("Resolve Client", () => {
  beforeEach(() => {
    vi.resetModules();
    mockInitialize.mockReset();
    mockCleanUp.mockReset();
    mockGetResolve.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialize", () => {
    it("should call WorkflowIntegration.Initialize and GetResolve", async () => {
      const mockResolveObj = { GetProjectManager: vi.fn() };
      mockGetResolve.mockReturnValue(mockResolveObj);

      const { loadNativeModule, initialize, getResolve } =
        await import("../../../../src/main/resolve/client.js");
      loadNativeModule(() => mockWorkflowIntegration);
      const result = initialize("app.piece.studio");

      expect(result).toBe(true);
      expect(mockInitialize).toHaveBeenCalledWith("app.piece.studio");
      expect(mockGetResolve).toHaveBeenCalled();
      expect(getResolve()).toBe(mockResolveObj);
    });

    it("should return false when GetResolve returns null", async () => {
      mockGetResolve.mockReturnValue(null);

      const { loadNativeModule, initialize, getResolve } =
        await import("../../../../src/main/resolve/client.js");
      loadNativeModule(() => mockWorkflowIntegration);
      const result = initialize("app.piece.studio");

      expect(result).toBe(false);
      expect(getResolve()).toBe(null);
    });
  });

  describe("getResolve", () => {
    it("should return null before initialization", async () => {
      const { getResolve } =
        await import("../../../../src/main/resolve/client.js");
      expect(getResolve()).toBe(null);
    });

    it("should return resolve object after initialization", async () => {
      const mockResolveObj = { GetProjectManager: vi.fn() };
      mockGetResolve.mockReturnValue(mockResolveObj);

      const { loadNativeModule, initialize, getResolve } =
        await import("../../../../src/main/resolve/client.js");
      loadNativeModule(() => mockWorkflowIntegration);
      initialize("app.piece.studio");

      expect(getResolve()).toBe(mockResolveObj);
    });
  });

  describe("cleanup", () => {
    it("should call CleanUp and reset resolve reference", async () => {
      const mockResolveObj = { GetProjectManager: vi.fn() };
      mockGetResolve.mockReturnValue(mockResolveObj);

      const { loadNativeModule, initialize, cleanup, getResolve } =
        await import("../../../../src/main/resolve/client.js");
      loadNativeModule(() => mockWorkflowIntegration);
      initialize("app.piece.studio");
      expect(getResolve()).toBe(mockResolveObj);

      cleanup();
      expect(mockCleanUp).toHaveBeenCalled();
      expect(getResolve()).toBe(null);
    });

    it("should not throw when cleanup called without initialization", async () => {
      const { cleanup } =
        await import("../../../../src/main/resolve/client.js");
      expect(() => cleanup()).not.toThrow();
    });
  });

  describe("graceful degradation", () => {
    it("should handle missing WorkflowIntegration module gracefully", async () => {
      const { loadNativeModule, initialize, getResolve, isAvailable } =
        await import("../../../../src/main/resolve/client.js");

      loadNativeModule(() => {
        throw new Error("Cannot find module 'WorkflowIntegration'");
      });

      expect(isAvailable()).toBe(false);
      const result = initialize("app.piece.studio");
      expect(result).toBe(false);
      expect(getResolve()).toBe(null);
    });
  });
});
