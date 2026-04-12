import { vi, describe, it, expect, beforeEach } from "vitest";

const mockDesktopTokensCollection = {
  findOne: vi.fn(),
  find: vi.fn(),
  insertOne: vi.fn(),
  updateOne: vi.fn(),
  deleteOne: vi.fn(),
};

const mockUsersCollection = {
  findOne: vi.fn(),
};

vi.mock("@piece/multitenancy", () => ({
  getGlobalSystemCollection: vi.fn((name) => {
    if (name === "desktop_tokens") return mockDesktopTokensCollection;
    if (name === "users") return mockUsersCollection;
    return {};
  }),
}));

vi.mock("@piece/validation/mongo", () => ({
  mongoIdUtils: {
    toObjectId: vi.fn((id) => id),
    toApiString: vi.fn((id) => id?.toString?.() ?? id),
    isValid: vi.fn(() => true),
  },
}));

vi.mock("../../../utils/logger.js", () => ({
  createComponentLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

const { desktopTokenService } = await import("../desktop-token-service.js");

describe("DesktopTokenService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listTokens", () => {
    it("should return active tokens for a user", async () => {
      const mockTokens = [
        {
          _id: "dt-1",
          userId: "user-id",
          appId: "piece-studio",
          status: "active",
          createdAt: new Date("2026-01-01"),
          lastUsedAt: new Date("2026-04-01"),
          expiresAt: new Date("2026-07-01"),
        },
      ];
      mockDesktopTokensCollection.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockTokens),
        }),
      });

      const result = await desktopTokenService.listTokens("user-id");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: "dt-1",
          appId: "piece-studio",
          status: "active",
        }),
      );
      expect(result[0]).not.toHaveProperty("tokenHash");
    });
  });

  describe("revokeToken", () => {
    it("should revoke a token owned by the user", async () => {
      mockDesktopTokensCollection.findOne.mockResolvedValue({
        _id: "dt-1",
        userId: "user-id",
        status: "active",
      });
      mockDesktopTokensCollection.updateOne.mockResolvedValue({
        modifiedCount: 1,
      });

      const result = await desktopTokenService.revokeToken("dt-1", "user-id");

      expect(result).toEqual({ revoked: true });
      expect(mockDesktopTokensCollection.updateOne).toHaveBeenCalledWith(
        { _id: "dt-1" },
        { $set: { status: "revoked", revokedAt: expect.any(Date) } },
      );
    });

    it("should throw NOT_FOUND when token does not exist", async () => {
      mockDesktopTokensCollection.findOne.mockResolvedValue(null);

      await expect(
        desktopTokenService.revokeToken("nonexistent", "user-id"),
      ).rejects.toThrow("NOT_FOUND");
    });

    it("should throw NOT_FOUND when token belongs to another user", async () => {
      mockDesktopTokensCollection.findOne.mockResolvedValue({
        _id: "dt-1",
        userId: "other-user",
        status: "active",
      });

      await expect(
        desktopTokenService.revokeToken("dt-1", "user-id"),
      ).rejects.toThrow("NOT_FOUND");
    });
  });

  describe("validateToken", () => {
    it("should return user data for valid active token", async () => {
      mockDesktopTokensCollection.findOne.mockResolvedValue({
        _id: "dt-1",
        userId: "user-id",
        status: "active",
        expiresAt: new Date(Date.now() + 86400_000),
      });
      mockUsersCollection.findOne.mockResolvedValue({
        _id: "user-id",
        email: "test@example.com",
        name: "Test User",
        role: "owner",
        avatarUrl: null,
      });

      const result = await desktopTokenService.validateToken("raw-token-hex");

      expect(result).toEqual(
        expect.objectContaining({
          id: "user-id",
          email: "test@example.com",
          name: "Test User",
          role: "owner",
        }),
      );
    });

    it("should return null for revoked token", async () => {
      mockDesktopTokensCollection.findOne.mockResolvedValue({
        _id: "dt-1",
        userId: "user-id",
        status: "revoked",
        expiresAt: new Date(Date.now() + 86400_000),
      });

      const result = await desktopTokenService.validateToken("raw-token-hex");

      expect(result).toBeNull();
    });

    it("should return null for expired token", async () => {
      mockDesktopTokensCollection.findOne.mockResolvedValue({
        _id: "dt-1",
        userId: "user-id",
        status: "active",
        expiresAt: new Date(Date.now() - 1000),
      });

      const result = await desktopTokenService.validateToken("raw-token-hex");

      expect(result).toBeNull();
    });

    it("should return null when token not found", async () => {
      mockDesktopTokensCollection.findOne.mockResolvedValue(null);

      const result = await desktopTokenService.validateToken("nonexistent");

      expect(result).toBeNull();
    });

    it("should return null when user not found", async () => {
      mockDesktopTokensCollection.findOne.mockResolvedValue({
        _id: "dt-1",
        userId: "user-id",
        status: "active",
        expiresAt: new Date(Date.now() + 86400_000),
      });
      mockUsersCollection.findOne.mockResolvedValue(null);

      const result = await desktopTokenService.validateToken("raw-token-hex");

      expect(result).toBeNull();
    });

    it("should fire-and-forget update lastUsedAt", async () => {
      mockDesktopTokensCollection.findOne.mockResolvedValue({
        _id: "dt-1",
        userId: "user-id",
        status: "active",
        expiresAt: new Date(Date.now() + 86400_000),
      });
      mockUsersCollection.findOne.mockResolvedValue({
        _id: "user-id",
        email: "test@example.com",
        name: "Test User",
        role: "owner",
        avatarUrl: null,
      });
      mockDesktopTokensCollection.updateOne.mockResolvedValue({
        modifiedCount: 1,
      });

      await desktopTokenService.validateToken("raw-token-hex");

      expect(mockDesktopTokensCollection.updateOne).toHaveBeenCalledWith(
        { _id: "dt-1" },
        { $set: { lastUsedAt: expect.any(Date) } },
      );
    });
  });
});
