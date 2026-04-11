import { vi, describe, it, expect, beforeEach } from "vitest";

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

const mockMediaPoolItem = { GetName: vi.fn(() => "test.png") };
const mockTimelineItem = { GetName: vi.fn(() => "test.png") };
const mockMediaPool = {
  ImportMedia: vi.fn(() => [mockMediaPoolItem]),
  AppendToTimeline: vi.fn(() => [mockTimelineItem]),
};
const mockTimeline = {
  GetName: vi.fn(() => "Timeline 1"),
  GetCurrentTimecode: vi.fn(() => "01:00:00:00"),
};
const mockProject = {
  GetCurrentTimeline: vi.fn(() => mockTimeline),
  GetMediaPool: vi.fn(() => mockMediaPool),
};
const mockResolve = {
  GetProjectManager: vi.fn(() => ({
    GetCurrentProject: vi.fn(() => mockProject),
  })),
};

describe("Media Pool Operations", () => {
  let mediaPool;

  beforeEach(async () => {
    vi.resetModules();
    mockMediaPool.ImportMedia.mockReset().mockReturnValue([mockMediaPoolItem]);
    mockMediaPool.AppendToTimeline.mockReset().mockReturnValue([
      mockTimelineItem,
    ]);
    mockProject.GetCurrentTimeline.mockReset().mockReturnValue(mockTimeline);
    mockProject.GetMediaPool.mockReset().mockReturnValue(mockMediaPool);

    const clientModule = await import("../../../../src/main/resolve/client.js");
    clientModule.loadNativeModule(() => ({
      Initialize: vi.fn(),
      CleanUp: vi.fn(),
      GetResolve: vi.fn(() => mockResolve),
    }));
    clientModule.initialize("app.piece.studio");

    mediaPool = await import("../../../../src/main/resolve/media-pool.js");
  });

  describe("getCurrentTimeline", () => {
    it("should return current timeline from the active project", () => {
      const timeline = mediaPool.getCurrentTimeline();
      expect(timeline).toBe(mockTimeline);
    });

    it("should return null when no project is open", () => {
      mockResolve.GetProjectManager.mockReturnValueOnce({
        GetCurrentProject: vi.fn(() => null),
      });
      const timeline = mediaPool.getCurrentTimeline();
      expect(timeline).toBe(null);
    });

    it("should return null when no timeline exists", () => {
      mockProject.GetCurrentTimeline.mockReturnValueOnce(null);
      const timeline = mediaPool.getCurrentTimeline();
      expect(timeline).toBe(null);
    });
  });

  describe("importMedia", () => {
    it("should import a file into the media pool", () => {
      const items = mediaPool.importMedia("/path/to/test.png");
      expect(mockMediaPool.ImportMedia).toHaveBeenCalledWith([
        "/path/to/test.png",
      ]);
      expect(items).toEqual([mockMediaPoolItem]);
    });

    it("should throw when Resolve is not initialized", async () => {
      vi.resetModules();
      await import("../../../../src/main/resolve/client.js");
      // Not initializing — getResolve() returns null
      const freshMediaPool =
        await import("../../../../src/main/resolve/media-pool.js");
      expect(() => freshMediaPool.importMedia("/path/to/test.png")).toThrow(
        "Resolve API not initialized",
      );
    });

    it("should throw when no project is open", () => {
      mockResolve.GetProjectManager.mockReturnValueOnce({
        GetCurrentProject: vi.fn(() => null),
      });
      expect(() => mediaPool.importMedia("/path/to/test.png")).toThrow(
        "No project is currently open",
      );
    });

    it("should return empty array when import fails", () => {
      mockMediaPool.ImportMedia.mockReturnValueOnce([]);
      const items = mediaPool.importMedia("/path/to/fail.png");
      expect(items).toEqual([]);
    });
  });

  describe("appendToTimeline", () => {
    it("should append media pool item to timeline", () => {
      const items = mediaPool.appendToTimeline(mockMediaPoolItem);
      expect(mockMediaPool.AppendToTimeline).toHaveBeenCalledWith([
        { mediaPoolItem: mockMediaPoolItem },
      ]);
      expect(items).toEqual([mockTimelineItem]);
    });

    it("should pass startFrame and endFrame options", () => {
      mediaPool.appendToTimeline(mockMediaPoolItem, {
        startFrame: 0,
        endFrame: 100,
      });
      expect(mockMediaPool.AppendToTimeline).toHaveBeenCalledWith([
        { mediaPoolItem: mockMediaPoolItem, startFrame: 0, endFrame: 100 },
      ]);
    });

    it("should pass mediaType option", () => {
      mediaPool.appendToTimeline(mockMediaPoolItem, { mediaType: 1 });
      expect(mockMediaPool.AppendToTimeline).toHaveBeenCalledWith([
        { mediaPoolItem: mockMediaPoolItem, mediaType: 1 },
      ]);
    });

    it("should throw when Resolve is not initialized", async () => {
      vi.resetModules();
      await import("../../../../src/main/resolve/client.js");
      const freshMediaPool =
        await import("../../../../src/main/resolve/media-pool.js");
      expect(() => freshMediaPool.appendToTimeline(mockMediaPoolItem)).toThrow(
        "Resolve API not initialized",
      );
    });

    it("should throw when no timeline exists", () => {
      mockProject.GetCurrentTimeline.mockReturnValueOnce(null);
      expect(() => mediaPool.appendToTimeline(mockMediaPoolItem)).toThrow(
        "No timeline is currently open",
      );
    });
  });

  describe("importAndAppend (convenience)", () => {
    it("should import a file and append to timeline in one call", () => {
      const result = mediaPool.importAndAppend("/path/to/clip.mp4");
      expect(mockMediaPool.ImportMedia).toHaveBeenCalledWith([
        "/path/to/clip.mp4",
      ]);
      expect(mockMediaPool.AppendToTimeline).toHaveBeenCalled();
      expect(result).toEqual({
        imported: [mockMediaPoolItem],
        timeline: [mockTimelineItem],
      });
    });

    it("should return null timeline items when import returns empty", () => {
      mockMediaPool.ImportMedia.mockReturnValueOnce([]);
      const result = mediaPool.importAndAppend("/path/to/missing.mp4");
      expect(result.imported).toEqual([]);
      expect(result.timeline).toEqual([]);
      expect(mockMediaPool.AppendToTimeline).not.toHaveBeenCalled();
    });
  });
});
