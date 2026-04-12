import { vi, describe, it, expect, beforeEach } from "vitest";
import { readFile, writeFile, mkdir } from "node:fs/promises";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

const mockGetMyLicenses = vi.fn();

const mockClient = { getMyLicenses: mockGetMyLicenses };

const { createLicenseCheck } =
  await import("../../../../src/main/license/license-check.js");

describe("license-check", () => {
  let checker;
  const dataDir = "/tmp/test-piece-studio";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    checker = createLicenseCheck({ client: mockClient, dataDir });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkLicense", () => {
    it("returns hasLicense:true when active piece-studio license found", async () => {
      mockGetMyLicenses.mockResolvedValue({
        licenses: [
          {
            productId: "piece-studio",
            status: "active",
            tier: "pro",
            expiresAt: "2027-01-01T00:00:00.000Z",
          },
        ],
      });

      const result = await checker.checkLicense();

      expect(result).toEqual({
        hasLicense: true,
        tier: "pro",
        expiresAt: "2027-01-01T00:00:00.000Z",
        stale: false,
      });
    });

    it("returns hasLicense:false when no active piece-studio license", async () => {
      mockGetMyLicenses.mockResolvedValue({
        licenses: [
          { productId: "piece-studio", status: "expired", tier: "pro" },
        ],
      });

      const result = await checker.checkLicense();

      expect(result).toEqual({
        hasLicense: false,
        tier: null,
        expiresAt: null,
        stale: false,
      });
    });

    it("returns hasLicense:false when licenses array is empty", async () => {
      mockGetMyLicenses.mockResolvedValue({ licenses: [] });

      const result = await checker.checkLicense();

      expect(result.hasLicense).toBe(false);
    });

    it("returns hasLicense:false when no piece-studio product", async () => {
      mockGetMyLicenses.mockResolvedValue({
        licenses: [
          { productId: "other-product", status: "active", tier: "pro" },
        ],
      });

      const result = await checker.checkLicense();

      expect(result.hasLicense).toBe(false);
    });
  });

  describe("caching", () => {
    it("returns cached result within 1 hour without API call", async () => {
      mockGetMyLicenses.mockResolvedValue({
        licenses: [
          {
            productId: "piece-studio",
            status: "active",
            tier: "pro",
            expiresAt: "2027-01-01T00:00:00.000Z",
          },
        ],
      });

      await checker.checkLicense();
      expect(mockGetMyLicenses).toHaveBeenCalledTimes(1);

      const result2 = await checker.checkLicense();
      expect(mockGetMyLicenses).toHaveBeenCalledTimes(1);
      expect(result2.hasLicense).toBe(true);
    });

    it("refreshes after cache expires (1 hour)", async () => {
      mockGetMyLicenses.mockResolvedValue({
        licenses: [
          { productId: "piece-studio", status: "active", tier: "pro" },
        ],
      });

      await checker.checkLicense();
      expect(mockGetMyLicenses).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(60 * 60 * 1000 + 1);

      await checker.checkLicense();
      expect(mockGetMyLicenses).toHaveBeenCalledTimes(2);
    });

    it("force refresh bypasses cache", async () => {
      mockGetMyLicenses.mockResolvedValue({
        licenses: [
          { productId: "piece-studio", status: "active", tier: "pro" },
        ],
      });

      await checker.checkLicense();
      await checker.checkLicense({ force: true });
      expect(mockGetMyLicenses).toHaveBeenCalledTimes(2);
    });
  });

  describe("offline / error handling", () => {
    it("returns last known state with stale:true on API failure", async () => {
      mockGetMyLicenses.mockResolvedValueOnce({
        licenses: [
          {
            productId: "piece-studio",
            status: "active",
            tier: "pro",
            expiresAt: "2027-01-01T00:00:00.000Z",
          },
        ],
      });

      await checker.checkLicense();

      vi.advanceTimersByTime(60 * 60 * 1000 + 1);
      mockGetMyLicenses.mockRejectedValueOnce(new Error("Network error"));

      const result = await checker.checkLicense();

      expect(result).toEqual({
        hasLicense: true,
        tier: "pro",
        expiresAt: "2027-01-01T00:00:00.000Z",
        stale: true,
      });
    });

    it("returns hasLicense:false with stale:false when no prior state and API fails", async () => {
      mockGetMyLicenses.mockRejectedValue(new Error("Network error"));

      const result = await checker.checkLicense();

      expect(result).toEqual({
        hasLicense: false,
        tier: null,
        expiresAt: null,
        stale: false,
      });
    });
  });

  describe("disk persistence", () => {
    it("persists last known state to disk after successful check", async () => {
      mockGetMyLicenses.mockResolvedValue({
        licenses: [
          {
            productId: "piece-studio",
            status: "active",
            tier: "pro",
            expiresAt: "2027-01-01T00:00:00.000Z",
          },
        ],
      });

      await checker.checkLicense();

      expect(mkdir).toHaveBeenCalledWith(dataDir, { recursive: true });
      expect(writeFile).toHaveBeenCalledWith(
        `${dataDir}/license-cache.json`,
        expect.any(String),
        "utf-8",
      );

      const written = JSON.parse(writeFile.mock.calls[0][1]);
      expect(written.hasLicense).toBe(true);
      expect(written.tier).toBe("pro");
    });

    it("loads persisted state on first call when API fails", async () => {
      readFile.mockResolvedValueOnce(
        JSON.stringify({
          hasLicense: true,
          tier: "pro",
          expiresAt: "2027-01-01T00:00:00.000Z",
          checkedAt: Date.now() - 2 * 60 * 60 * 1000,
        }),
      );
      mockGetMyLicenses.mockRejectedValue(new Error("Offline"));

      const result = await checker.checkLicense();

      expect(result).toEqual({
        hasLicense: true,
        tier: "pro",
        expiresAt: "2027-01-01T00:00:00.000Z",
        stale: true,
      });
    });

    it("handles missing disk cache gracefully", async () => {
      readFile.mockRejectedValueOnce(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      );
      mockGetMyLicenses.mockRejectedValue(new Error("Offline"));

      const result = await checker.checkLicense();

      expect(result.hasLicense).toBe(false);
      expect(result.stale).toBe(false);
    });
  });
});
