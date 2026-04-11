import { vi, describe, it, expect, beforeEach } from "vitest";
import { existsSync } from "fs";

vi.mock("fs", () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
}));

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

const mockStill = { id: "still-1" };
const mockAlbum = {
  ExportStills: vi.fn(() => true),
};
const mockGallery = {
  GetCurrentStillAlbum: vi.fn(() => mockAlbum),
};
const mockTimeline = {
  GetName: vi.fn(() => "Timeline 1"),
  GrabStill: vi.fn(() => mockStill),
  GetCurrentTimecode: vi.fn(() => "01:00:05:00"),
};
const mockProject = {
  GetCurrentTimeline: vi.fn(() => mockTimeline),
  GetGallery: vi.fn(() => mockGallery),
  GetMediaPool: vi.fn(),
};
const mockResolve = {
  GetProjectManager: vi.fn(() => ({
    GetCurrentProject: vi.fn(() => mockProject),
  })),
};

describe("Snapshot", () => {
  let snapshot;

  beforeEach(async () => {
    vi.resetModules();
    mockTimeline.GrabStill.mockReset().mockReturnValue(mockStill);
    mockGallery.GetCurrentStillAlbum.mockReset().mockReturnValue(mockAlbum);
    mockAlbum.ExportStills.mockReset().mockReturnValue(true);
    mockProject.GetCurrentTimeline.mockReset().mockReturnValue(mockTimeline);
    mockProject.GetGallery.mockReset().mockReturnValue(mockGallery);
    vi.mocked(existsSync).mockReturnValue(true);

    const clientModule = await import("../../../../src/main/resolve/client.js");
    clientModule.loadNativeModule(() => ({
      Initialize: vi.fn(() => true),
      CleanUp: vi.fn(),
      GetResolve: vi.fn(() => mockResolve),
    }));
    await clientModule.initialize("app.piece.studio");

    snapshot = await import("../../../../src/main/resolve/snapshot.js");
  });

  describe("snapshotCurrentFrame", () => {
    it("should grab still and export to output directory", () => {
      const result = snapshot.snapshotCurrentFrame("/tmp/snapshots");

      expect(mockTimeline.GrabStill).toHaveBeenCalled();
      expect(mockGallery.GetCurrentStillAlbum).toHaveBeenCalled();
      expect(mockAlbum.ExportStills).toHaveBeenCalledWith(
        [mockStill],
        "/tmp/snapshots",
        expect.any(String),
        expect.any(String),
      );
      expect(result).toMatch(/^\/tmp\/snapshots\//);
    });

    it("should generate unique filenames with timestamps", () => {
      const result1 = snapshot.snapshotCurrentFrame("/tmp/snapshots");
      expect(result1).toMatch(/piece-snapshot-\d+/);
    });

    it("should throw when Resolve is not initialized", async () => {
      vi.resetModules();
      await import("../../../../src/main/resolve/client.js");
      const freshSnapshot =
        await import("../../../../src/main/resolve/snapshot.js");
      expect(() =>
        freshSnapshot.snapshotCurrentFrame("/tmp/snapshots"),
      ).toThrow("Resolve API not initialized");
    });

    it("should throw when no timeline is available", () => {
      mockProject.GetCurrentTimeline.mockReturnValueOnce(null);
      expect(() => snapshot.snapshotCurrentFrame("/tmp/snapshots")).toThrow(
        "No timeline is currently open",
      );
    });

    it("should throw when GrabStill fails", () => {
      mockTimeline.GrabStill.mockReturnValueOnce(null);
      expect(() => snapshot.snapshotCurrentFrame("/tmp/snapshots")).toThrow(
        "Failed to grab still from timeline",
      );
    });

    it("should throw when ExportStills fails", () => {
      mockAlbum.ExportStills.mockReturnValueOnce(false);
      expect(() => snapshot.snapshotCurrentFrame("/tmp/snapshots")).toThrow(
        "Failed to export still",
      );
    });

    it("should throw when exported file does not exist", () => {
      vi.mocked(existsSync).mockReturnValueOnce(false);
      expect(() => snapshot.snapshotCurrentFrame("/tmp/snapshots")).toThrow(
        "Exported file not found",
      );
    });

    it("should use png format by default", () => {
      snapshot.snapshotCurrentFrame("/tmp/snapshots");
      expect(mockAlbum.ExportStills).toHaveBeenCalledWith(
        expect.any(Array),
        "/tmp/snapshots",
        expect.any(String),
        "png",
      );
    });

    it("should accept custom format", () => {
      snapshot.snapshotCurrentFrame("/tmp/snapshots", { format: "jpg" });
      expect(mockAlbum.ExportStills).toHaveBeenCalledWith(
        expect.any(Array),
        "/tmp/snapshots",
        expect.any(String),
        "jpg",
      );
    });
  });
});
