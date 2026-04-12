import { vi, describe, it, expect, beforeEach } from "vitest";

const mockDeviceCodesCollection = {
  findOne: vi.fn(),
  insertOne: vi.fn(),
  updateOne: vi.fn(),
  deleteOne: vi.fn(),
};

const mockDesktopTokensCollection = {
  findOne: vi.fn(),
  insertOne: vi.fn(),
};

vi.mock("@piece/multitenancy", () => ({
  getGlobalSystemCollection: vi.fn((name) => {
    if (name === "device_codes") return mockDeviceCodesCollection;
    if (name === "desktop_tokens") return mockDesktopTokensCollection;
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

vi.mock("../../../config.js", () => ({
  config: {
    get: vi.fn((key) => {
      const defaults = {
        PIECE_URL: "https://app.piece.dev",
      };
      return defaults[key] ?? "";
    }),
  },
}));

const { deviceCodeService } = await import("../device-code-service.js");

describe("DeviceCodeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createDeviceCode", () => {
    it("should generate device code and user code, store in DB, and return them", async () => {
      mockDeviceCodesCollection.insertOne.mockResolvedValue({
        insertedId: "dc-id",
      });

      const result = await deviceCodeService.createDeviceCode({
        appId: "piece-studio",
      });

      expect(result).toHaveProperty("deviceCode");
      expect(result).toHaveProperty("userCode");
      expect(result).toHaveProperty("verificationUri");
      expect(result).toHaveProperty("expiresIn");
      expect(result).toHaveProperty("interval");

      expect(result.deviceCode).toHaveLength(64);
      expect(result.userCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(result.expiresIn).toBe(600);
      expect(result.interval).toBe(5);

      expect(mockDeviceCodesCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceCode: result.deviceCode,
          userCodeHash: expect.any(String),
          appId: "piece-studio",
          status: "pending",
          userId: null,
          expiresAt: expect.any(Date),
          createdAt: expect.any(Date),
        }),
      );
    });

    it("should generate user codes without ambiguous characters (0, O, I, L)", async () => {
      mockDeviceCodesCollection.insertOne.mockResolvedValue({
        insertedId: "dc-id",
      });

      const result = await deviceCodeService.createDeviceCode({
        appId: "piece-studio",
      });

      const codeChars = result.userCode.replace("-", "");
      expect(codeChars).not.toMatch(/[0OIL]/);
    });
  });

  describe("pollDeviceCode", () => {
    it("should return authorization_pending when status is pending", async () => {
      mockDeviceCodesCollection.findOne.mockResolvedValue({
        _id: "dc-id",
        deviceCode: "abc123",
        status: "pending",
        expiresAt: new Date(Date.now() + 600_000),
        lastPolledAt: null,
        interval: 5,
      });

      const result = await deviceCodeService.pollDeviceCode("abc123");

      expect(result).toEqual({
        status: "pending",
        error: "authorization_pending",
      });
    });

    it("should return expired_token when record is expired", async () => {
      mockDeviceCodesCollection.findOne.mockResolvedValue({
        _id: "dc-id",
        deviceCode: "abc123",
        status: "pending",
        expiresAt: new Date(Date.now() - 1000),
        lastPolledAt: null,
        interval: 5,
      });

      const result = await deviceCodeService.pollDeviceCode("abc123");

      expect(result).toEqual({ status: "expired", error: "expired_token" });
    });

    it("should return expired_token when record not found", async () => {
      mockDeviceCodesCollection.findOne.mockResolvedValue(null);

      const result = await deviceCodeService.pollDeviceCode("nonexistent");

      expect(result).toEqual({ status: "expired", error: "expired_token" });
    });

    it("should return slow_down when polling too fast", async () => {
      mockDeviceCodesCollection.findOne.mockResolvedValue({
        _id: "dc-id",
        deviceCode: "abc123",
        status: "pending",
        expiresAt: new Date(Date.now() + 600_000),
        lastPolledAt: new Date(Date.now() - 2000),
        interval: 5,
      });

      const result = await deviceCodeService.pollDeviceCode("abc123");

      expect(result).toEqual({ status: "slow_down", error: "slow_down" });
    });

    it("should return approved with desktop token when status is approved", async () => {
      const mockUser = {
        _id: "user-id",
        email: "test@example.com",
        name: "Test User",
        avatarUrl: null,
        role: "owner",
      };

      mockDeviceCodesCollection.findOne.mockResolvedValue({
        _id: "dc-id",
        deviceCode: "abc123",
        status: "approved",
        userId: "user-id",
        appId: "piece-studio",
        expiresAt: new Date(Date.now() + 600_000),
        lastPolledAt: null,
        interval: 5,
      });

      const mockUsersCollection = {
        findOne: vi.fn().mockResolvedValue(mockUser),
      };
      const { getGlobalSystemCollection } = await import("@piece/multitenancy");
      getGlobalSystemCollection.mockImplementation((name) => {
        if (name === "device_codes") return mockDeviceCodesCollection;
        if (name === "desktop_tokens") return mockDesktopTokensCollection;
        if (name === "users") return mockUsersCollection;
        return {};
      });
      mockDesktopTokensCollection.insertOne.mockResolvedValue({
        insertedId: "dt-id",
      });
      mockDeviceCodesCollection.deleteOne.mockResolvedValue({
        deletedCount: 1,
      });

      const result = await deviceCodeService.pollDeviceCode("abc123");

      expect(result.status).toBe("approved");
      expect(result.accessToken).toBeDefined();
      expect(result.accessToken).toHaveLength(64);
      expect(result.user).toEqual(
        expect.objectContaining({
          id: "user-id",
          email: "test@example.com",
          name: "Test User",
        }),
      );
      expect(result.expiresAt).toBeDefined();

      expect(mockDesktopTokensCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-id",
          tokenHash: expect.any(String),
          appId: "piece-studio",
          status: "active",
          expiresAt: expect.any(Date),
          createdAt: expect.any(Date),
        }),
      );

      expect(mockDeviceCodesCollection.deleteOne).toHaveBeenCalledWith({
        _id: "dc-id",
      });
    });
  });

  describe("verifyUserCode", () => {
    it("should approve device code when valid user code provided", async () => {
      mockDeviceCodesCollection.findOne.mockResolvedValue({
        _id: "dc-id",
        status: "pending",
        appId: "piece-studio",
        expiresAt: new Date(Date.now() + 600_000),
      });
      mockDeviceCodesCollection.updateOne.mockResolvedValue({
        modifiedCount: 1,
      });

      const result = await deviceCodeService.verifyUserCode(
        "ABCD-1234",
        "user-id",
      );

      expect(result).toEqual({ appId: "piece-studio", approved: true });
      expect(mockDeviceCodesCollection.updateOne).toHaveBeenCalledWith(
        { _id: "dc-id" },
        {
          $set: {
            status: "approved",
            userId: "user-id",
            approvedAt: expect.any(Date),
          },
        },
      );
    });

    it("should throw INVALID_CODE when user code not found", async () => {
      mockDeviceCodesCollection.findOne.mockResolvedValue(null);

      await expect(
        deviceCodeService.verifyUserCode("XXXX-YYYY", "user-id"),
      ).rejects.toThrow("INVALID_CODE");
    });

    it("should throw INVALID_CODE when code is expired", async () => {
      mockDeviceCodesCollection.findOne.mockResolvedValue({
        _id: "dc-id",
        status: "pending",
        appId: "piece-studio",
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        deviceCodeService.verifyUserCode("ABCD-1234", "user-id"),
      ).rejects.toThrow("INVALID_CODE");
    });
  });
});
