import { vi, describe, it, expect, beforeEach } from "vitest";

const mockFindOne = vi.fn();
const mockFind = vi.fn();
const mockInsertOne = vi.fn();
const mockUpdateOne = vi.fn();
const mockToArray = vi.fn();
const mockCountDocuments = vi.fn();
const mockSort = vi.fn(() => ({
  skip: vi.fn(() => ({ limit: vi.fn(() => ({ toArray: mockToArray })) })),
  toArray: mockToArray,
}));

const mockCollection = {
  findOne: mockFindOne,
  find: mockFind.mockReturnValue({ sort: mockSort }),
  insertOne: mockInsertOne,
  updateOne: mockUpdateOne,
  countDocuments: mockCountDocuments,
};

vi.mock("@piece/multitenancy", () => ({
  getGlobalSystemCollection: vi.fn(() => mockCollection),
}));

vi.mock("@piece/validation/mongo", () => ({
  mongoIdUtils: {
    toObjectId: vi.fn((id) => id),
    toApiString: vi.fn((id) => id?.toString?.() || id),
    isValid: vi.fn(() => true),
  },
}));

vi.mock("@piece/logger", () => ({
  createLogger: vi.fn(() => ({
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

vi.mock("../../../../utils/logger.js", () => ({
  createComponentLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

const { licenseService } = await import("../license-service.js");

describe("licenseService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFind.mockReturnValue({ sort: mockSort });
    mockSort.mockReturnValue({
      skip: vi.fn(() => ({ limit: vi.fn(() => ({ toArray: mockToArray })) })),
      toArray: mockToArray,
    });
  });

  describe("getUserLicenses", () => {
    it("should return active licenses for a user", async () => {
      const now = new Date();
      const licenses = [
        {
          _id: "lic1",
          userId: "user1",
          productId: "piece-studio",
          tier: "pro",
          status: "active",
          source: "manual",
          activatedAt: now,
          expiresAt: null,
          createdAt: now,
        },
      ];
      mockToArray.mockResolvedValue(licenses);
      mockCountDocuments.mockResolvedValue(1);

      const result = await licenseService.getUserLicenses("user1");

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("lic1");
      expect(result.data[0].productId).toBe("piece-studio");
      expect(result.data[0].tier).toBe("pro");
      expect(result.data[0].status).toBe("active");
    });

    it("should return empty array for user with no licenses", async () => {
      mockToArray.mockResolvedValue([]);
      mockCountDocuments.mockResolvedValue(0);

      const result = await licenseService.getUserLicenses("user2");

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe("grantLicense", () => {
    it("should create a license with required fields", async () => {
      mockInsertOne.mockResolvedValue({ insertedId: "lic-new" });

      const result = await licenseService.grantLicense("user1", {
        productId: "piece-studio",
        tier: "pro",
        source: "manual",
      });

      expect(mockInsertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user1",
          productId: "piece-studio",
          tier: "pro",
          status: "active",
          source: "manual",
        }),
      );
      expect(result.id).toBe("lic-new");
      expect(result.status).toBe("active");
    });

    it("should set expiresAt when provided", async () => {
      const expiresAt = new Date("2027-01-01");
      mockInsertOne.mockResolvedValue({ insertedId: "lic-exp" });

      await licenseService.grantLicense("user1", {
        productId: "piece-studio",
        tier: "pro",
        source: "manual",
        expiresAt,
      });

      expect(mockInsertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt,
        }),
      );
    });

    it("should throw INVALID_PRODUCT for unknown productId", async () => {
      await expect(
        licenseService.grantLicense("user1", {
          productId: "unknown-product",
          tier: "pro",
          source: "manual",
        }),
      ).rejects.toThrow("INVALID_PRODUCT");
    });

    it("should throw INVALID_TIER for unknown tier", async () => {
      await expect(
        licenseService.grantLicense("user1", {
          productId: "piece-studio",
          tier: "ultimate",
          source: "manual",
        }),
      ).rejects.toThrow("INVALID_TIER");
    });
  });

  describe("revokeLicense", () => {
    it("should revoke an existing active license", async () => {
      mockUpdateOne.mockResolvedValue({ matchedCount: 1 });

      const result = await licenseService.revokeLicense("user1", "lic1");

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: "lic1", userId: "user1", status: "active" },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: "revoked",
          }),
        }),
      );
      expect(result).toBe(true);
    });

    it("should return false when license not found or already revoked", async () => {
      mockUpdateOne.mockResolvedValue({ matchedCount: 0 });

      const result = await licenseService.revokeLicense("user1", "lic-gone");

      expect(result).toBe(false);
    });
  });

  describe("hasActiveLicense", () => {
    it("should return true when user has active non-expired license", async () => {
      mockFindOne.mockResolvedValue({
        _id: "lic1",
        status: "active",
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result = await licenseService.hasActiveLicense(
        "user1",
        "piece-studio",
      );

      expect(result).toBe(true);
    });

    it("should return true when license has no expiry (lifetime)", async () => {
      mockFindOne.mockResolvedValue({
        _id: "lic1",
        status: "active",
        expiresAt: null,
      });

      const result = await licenseService.hasActiveLicense(
        "user1",
        "piece-studio",
      );

      expect(result).toBe(true);
    });

    it("should return false when no matching license found", async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await licenseService.hasActiveLicense(
        "user1",
        "piece-studio",
      );

      expect(result).toBe(false);
    });
  });
});
