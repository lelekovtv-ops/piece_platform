import { vi, describe, it, expect, beforeEach } from "vitest";

const mockStartSignIn = vi.fn();
const mockStopPolling = vi.fn();
const mockPollForToken = vi.fn();
const mockSignOut = vi.fn();
const mockGetCurrentUser = vi.fn();

vi.mock("../../../../src/main/auth/device-code.js", () => ({
  createDeviceCodeController: vi.fn(() => ({
    startSignIn: mockStartSignIn,
    pollForToken: mockPollForToken,
    stopPolling: mockStopPolling,
    signOut: mockSignOut,
    getCurrentUser: mockGetCurrentUser,
  })),
}));

describe("Auth IPC Handlers", () => {
  let authHandlers;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    authHandlers = await import("../../../../src/main/ipc/auth-handlers.js");
  });

  describe("registerAuthHandlers", () => {
    it("should register handlers on the IPC map", () => {
      const handlers = {};
      authHandlers.registerAuthHandlers(handlers, {
        apiUrl: "https://api.piece.app",
        dataDir: "/tmp/test",
      });

      expect(handlers["auth:start-signin"]).toBeTypeOf("function");
      expect(handlers["auth:get-current-user"]).toBeTypeOf("function");
      expect(handlers["auth:sign-out"]).toBeTypeOf("function");
    });
  });

  describe("auth:start-signin handler", () => {
    it("should call startSignIn and return device code info", async () => {
      const codeInfo = {
        userCode: "ABCD-1234",
        deviceCode: "dev_abc",
        verificationUri: "https://app.piece.app/device",
        expiresIn: 900,
        interval: 5,
      };
      mockStartSignIn.mockResolvedValue(codeInfo);
      mockPollForToken.mockResolvedValue({
        accessToken: "tok",
        user: { id: "u1" },
      });

      const handlers = {};
      authHandlers.registerAuthHandlers(handlers, {
        apiUrl: "https://api.piece.app",
        dataDir: "/tmp/test",
      });

      const result = await handlers["auth:start-signin"]();
      expect(mockStartSignIn).toHaveBeenCalled();
      expect(result).toEqual(codeInfo);
    });
  });

  describe("auth:get-current-user handler", () => {
    it("should return current user", async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: "u1",
        email: "a@b.com",
      });

      const handlers = {};
      authHandlers.registerAuthHandlers(handlers, {
        apiUrl: "https://api.piece.app",
        dataDir: "/tmp/test",
      });

      const user = await handlers["auth:get-current-user"]();
      expect(user).toEqual({ id: "u1", email: "a@b.com" });
    });
  });

  describe("auth:sign-out handler", () => {
    it("should call signOut and stopPolling", async () => {
      mockSignOut.mockResolvedValue(undefined);

      const handlers = {};
      authHandlers.registerAuthHandlers(handlers, {
        apiUrl: "https://api.piece.app",
        dataDir: "/tmp/test",
      });

      await handlers["auth:sign-out"]();
      expect(mockStopPolling).toHaveBeenCalled();
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
