import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.mock("../../../../src/main/auth/token-storage.js", () => ({
  saveToken: vi.fn(),
  loadToken: vi.fn(),
  clearToken: vi.fn(),
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("Device Code Controller", () => {
  let deviceCode;
  let tokenStorage;
  const DATA_DIR = "/tmp/test-piece-studio";
  const API_URL = "https://api.piece.app";

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    mockFetch.mockReset();
    tokenStorage = await import("../../../../src/main/auth/token-storage.js");
    deviceCode = await import("../../../../src/main/auth/device-code.js");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createDeviceCodeController", () => {
    it("should create a controller with required methods", () => {
      const ctrl = deviceCode.createDeviceCodeController({
        apiUrl: API_URL,
        dataDir: DATA_DIR,
      });
      expect(ctrl.startSignIn).toBeTypeOf("function");
      expect(ctrl.pollForToken).toBeTypeOf("function");
      expect(ctrl.stopPolling).toBeTypeOf("function");
      expect(ctrl.signOut).toBeTypeOf("function");
      expect(ctrl.getCurrentUser).toBeTypeOf("function");
    });
  });

  describe("startSignIn", () => {
    it("should call POST /v1/auth/device-code and return code info", async () => {
      const response = {
        userCode: "ABCD-1234",
        deviceCode: "dev_abc",
        verificationUri: "https://app.piece.app/device",
        expiresIn: 900,
        interval: 5,
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(response),
      });

      const ctrl = deviceCode.createDeviceCodeController({
        apiUrl: API_URL,
        dataDir: DATA_DIR,
      });
      const result = await ctrl.startSignIn();

      expect(mockFetch).toHaveBeenCalledWith(`${API_URL}/v1/auth/device-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: "resolve-plugin" }),
      });
      expect(result).toEqual(response);
    });

    it("should throw on HTTP error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({ error: "INTERNAL_ERROR", message: "fail" }),
      });

      const ctrl = deviceCode.createDeviceCodeController({
        apiUrl: API_URL,
        dataDir: DATA_DIR,
      });
      await expect(ctrl.startSignIn()).rejects.toThrow("fail");
    });
  });

  describe("pollForToken", () => {
    it("should poll until approved and save token", async () => {
      const pendingResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            status: "authorization_pending",
          }),
      };
      const approvedResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            status: "approved",
            accessToken: "desktop_tok",
            user: { id: "u1", email: "a@b.com" },
          }),
      };

      mockFetch
        .mockResolvedValueOnce(pendingResponse)
        .mockResolvedValueOnce(approvedResponse);

      vi.mocked(tokenStorage.saveToken).mockResolvedValue(undefined);

      const ctrl = deviceCode.createDeviceCodeController({
        apiUrl: API_URL,
        dataDir: DATA_DIR,
      });

      const pollPromise = ctrl.pollForToken("dev_abc", 5);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(5000);

      const result = await pollPromise;
      expect(result).toEqual({
        accessToken: "desktop_tok",
        user: { id: "u1", email: "a@b.com" },
      });
      expect(tokenStorage.saveToken).toHaveBeenCalledWith(DATA_DIR, {
        accessToken: "desktop_tok",
        user: { id: "u1", email: "a@b.com" },
      });
    });

    it("should handle slow_down by increasing interval", async () => {
      const slowDown = {
        ok: true,
        json: () => Promise.resolve({ status: "slow_down" }),
      };
      const approved = {
        ok: true,
        json: () =>
          Promise.resolve({
            status: "approved",
            accessToken: "tok",
            user: { id: "u1" },
          }),
      };

      mockFetch.mockResolvedValueOnce(slowDown).mockResolvedValueOnce(approved);
      vi.mocked(tokenStorage.saveToken).mockResolvedValue(undefined);

      const ctrl = deviceCode.createDeviceCodeController({
        apiUrl: API_URL,
        dataDir: DATA_DIR,
      });
      const pollPromise = ctrl.pollForToken("dev_abc", 5);

      // First poll immediate — slow_down
      await vi.advanceTimersByTimeAsync(0);
      // New interval = 5 + 5 = 10s
      await vi.advanceTimersByTimeAsync(10000);

      const result = await pollPromise;
      expect(result.accessToken).toBe("tok");
    });

    it("should reject on expired_token", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "expired_token" }),
      });

      const ctrl = deviceCode.createDeviceCodeController({
        apiUrl: API_URL,
        dataDir: DATA_DIR,
      });

      const p = ctrl.pollForToken("dev_abc", 5);
      p.catch(() => {});
      await vi.advanceTimersByTimeAsync(0);
      await expect(p).rejects.toThrow("expired");
    });
  });

  describe("stopPolling", () => {
    it("should abort in-progress polling", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "authorization_pending" }),
      });

      const ctrl = deviceCode.createDeviceCodeController({
        apiUrl: API_URL,
        dataDir: DATA_DIR,
      });
      const pollPromise = ctrl.pollForToken("dev_abc", 5);
      await vi.advanceTimersByTimeAsync(0);
      ctrl.stopPolling();

      await expect(pollPromise).rejects.toThrow("cancelled");
    });
  });

  describe("signOut", () => {
    it("should clear token storage", async () => {
      vi.mocked(tokenStorage.loadToken).mockResolvedValue({
        accessToken: "tok",
        user: { id: "u1" },
      });
      vi.mocked(tokenStorage.clearToken).mockResolvedValue(undefined);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const ctrl = deviceCode.createDeviceCodeController({
        apiUrl: API_URL,
        dataDir: DATA_DIR,
      });
      await ctrl.signOut();

      expect(tokenStorage.clearToken).toHaveBeenCalledWith(DATA_DIR);
    });
  });

  describe("getCurrentUser", () => {
    it("should return user from stored token", async () => {
      vi.mocked(tokenStorage.loadToken).mockResolvedValue({
        accessToken: "tok",
        user: { id: "u1", email: "a@b.com" },
      });

      const ctrl = deviceCode.createDeviceCodeController({
        apiUrl: API_URL,
        dataDir: DATA_DIR,
      });
      const user = await ctrl.getCurrentUser();
      expect(user).toEqual({ id: "u1", email: "a@b.com" });
    });

    it("should return null when no stored token", async () => {
      vi.mocked(tokenStorage.loadToken).mockResolvedValue(null);

      const ctrl = deviceCode.createDeviceCodeController({
        apiUrl: API_URL,
        dataDir: DATA_DIR,
      });
      const user = await ctrl.getCurrentUser();
      expect(user).toBeNull();
    });
  });
});
