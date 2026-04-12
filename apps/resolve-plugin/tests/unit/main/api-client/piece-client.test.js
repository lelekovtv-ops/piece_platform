import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../../../../src/main/auth/token-storage.js", () => ({
  loadToken: vi.fn(),
  clearToken: vi.fn(),
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("PIECE API Client", () => {
  let pieceClient;
  let tokenStorage;
  const API_URL = "https://api.piece.app";
  const DATA_DIR = "/tmp/test-piece-studio";

  beforeEach(async () => {
    vi.resetModules();
    mockFetch.mockReset();
    tokenStorage = await import("../../../../src/main/auth/token-storage.js");
    pieceClient =
      await import("../../../../src/main/api-client/piece-client.js");
  });

  describe("createPieceClient", () => {
    it("should create a client with required methods", () => {
      const client = pieceClient.createPieceClient({
        apiUrl: API_URL,
        dataDir: DATA_DIR,
      });
      expect(client.getMe).toBeTypeOf("function");
      expect(client.getMyLicenses).toBeTypeOf("function");
      expect(client.requestDeviceCode).toBeTypeOf("function");
      expect(client.pollDeviceCode).toBeTypeOf("function");
    });
  });

  describe("authenticated requests", () => {
    it("getMe should call GET /v1/auth/me with Bearer token", async () => {
      vi.mocked(tokenStorage.loadToken).mockResolvedValue({
        accessToken: "tok_abc",
        user: { id: "u1" },
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "u1", email: "a@b.com" }),
      });

      const client = pieceClient.createPieceClient({
        apiUrl: API_URL,
        dataDir: DATA_DIR,
      });
      const user = await client.getMe();

      expect(mockFetch).toHaveBeenCalledWith(`${API_URL}/v1/auth/me`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer tok_abc",
        },
      });
      expect(user).toEqual({ id: "u1", email: "a@b.com" });
    });

    it("getMyLicenses should call GET /v1/me/licenses", async () => {
      vi.mocked(tokenStorage.loadToken).mockResolvedValue({
        accessToken: "tok_abc",
        user: { id: "u1" },
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ product: "resolve-plugin" }] }),
      });

      const client = pieceClient.createPieceClient({
        apiUrl: API_URL,
        dataDir: DATA_DIR,
      });
      const licenses = await client.getMyLicenses();

      expect(mockFetch).toHaveBeenCalledWith(`${API_URL}/v1/me/licenses`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer tok_abc",
        },
      });
      expect(licenses).toEqual({ data: [{ product: "resolve-plugin" }] });
    });
  });

  describe("unauthenticated requests", () => {
    it("requestDeviceCode should call POST /v1/auth/device-code", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            userCode: "ABCD-1234",
            deviceCode: "dev_1",
            verificationUri: "https://app.piece.app/device",
          }),
      });

      const client = pieceClient.createPieceClient({
        apiUrl: API_URL,
        dataDir: DATA_DIR,
      });
      const result = await client.requestDeviceCode();

      expect(mockFetch).toHaveBeenCalledWith(`${API_URL}/v1/auth/device-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: "resolve-plugin" }),
      });
      expect(result.userCode).toBe("ABCD-1234");
    });

    it("pollDeviceCode should call POST /v1/auth/device-code/poll", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "authorization_pending" }),
      });

      const client = pieceClient.createPieceClient({
        apiUrl: API_URL,
        dataDir: DATA_DIR,
      });
      const result = await client.pollDeviceCode("dev_1");

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_URL}/v1/auth/device-code/poll`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceCode: "dev_1" }),
        },
      );
      expect(result.status).toBe("authorization_pending");
    });
  });

  describe("401 handling", () => {
    it("should clear token and emit auth-required on 401", async () => {
      vi.mocked(tokenStorage.loadToken).mockResolvedValue({
        accessToken: "expired_tok",
        user: { id: "u1" },
      });
      vi.mocked(tokenStorage.clearToken).mockResolvedValue(undefined);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "UNAUTHORIZED" }),
      });

      const events = [];
      const client = pieceClient.createPieceClient({
        apiUrl: API_URL,
        dataDir: DATA_DIR,
        onAuthRequired: () => events.push("auth-required"),
      });

      await expect(client.getMe()).rejects.toThrow();
      expect(tokenStorage.clearToken).toHaveBeenCalledWith(DATA_DIR);
      expect(events).toEqual(["auth-required"]);
    });
  });

  describe("error handling", () => {
    it("should throw on non-401 HTTP errors", async () => {
      vi.mocked(tokenStorage.loadToken).mockResolvedValue({
        accessToken: "tok",
        user: { id: "u1" },
      });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({ error: "INTERNAL_ERROR", message: "boom" }),
      });

      const client = pieceClient.createPieceClient({
        apiUrl: API_URL,
        dataDir: DATA_DIR,
      });
      await expect(client.getMe()).rejects.toThrow("boom");
    });
  });
});
