import { describe, it, expect, vi, beforeEach } from "vitest";
import { LIBRARY_CHANNELS } from "../../../../src/shared/ipc-channels.js";

vi.mock("fs", () => ({
  readdirSync: vi.fn().mockReturnValue(["image1.png", "video1.mp4", "readme.txt"]),
  statSync: vi.fn().mockReturnValue({ mtimeMs: 1000, size: 1024 }),
  mkdirSync: vi.fn(),
  copyFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue("{}"),
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
}));

vi.mock("../../../../src/main/utils/upload.js", () => ({
  uploadFileForUrl: vi.fn().mockResolvedValue("https://tmpfiles.org/dl/123/file.png"),
}));

const { registerLibraryHandlers } =
  await import("../../../../src/main/ipc/library-handlers.js");
const fs = await import("fs");

function makeMockLogger() {
  const child = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    createComponentLogger: vi.fn().mockReturnValue(child),
  };
}

describe("registerLibraryHandlers", () => {
  let handlers;
  let logger;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = {};
    logger = makeMockLogger();
    registerLibraryHandlers(handlers, {
      downloadDir: "/tmp/downloads",
      uploadsDir: "/tmp/uploads",
      dataDir: "/tmp/data",
      logger,
    });
  });

  it("registers all library channels", () => {
    expect(handlers[LIBRARY_CHANNELS.list]).toBeDefined();
    expect(handlers[LIBRARY_CHANNELS.import]).toBeDefined();
    expect(handlers[LIBRARY_CHANNELS.remove]).toBeDefined();
    expect(handlers[LIBRARY_CHANNELS.getUrl]).toBeDefined();
  });

  it("list returns items from downloads and uploads dirs", () => {
    const items = handlers[LIBRARY_CHANNELS.list]();
    const names = items.map((i) => i.name);
    expect(names).toContain("image1.png");
    expect(names).toContain("video1.mp4");
    expect(names).not.toContain("readme.txt");
  });

  it("list classifies file types correctly", () => {
    const items = handlers[LIBRARY_CHANNELS.list]();
    const image = items.find((i) => i.name === "image1.png");
    const video = items.find((i) => i.name === "video1.mp4");
    expect(image.type).toBe("image");
    expect(video.type).toBe("video");
  });

  it("import copies file to uploads dir", () => {
    handlers[LIBRARY_CHANNELS.import]("/external/photo.png");
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      "/external/photo.png",
      expect.stringContaining("/tmp/uploads/"),
    );
  });

  it("import throws if file not found", () => {
    vi.mocked(fs.existsSync).mockReturnValueOnce(false);
    expect(() => handlers[LIBRARY_CHANNELS.import]("/missing.png")).toThrow("File not found");
  });

  it("getUrl returns uploaded URL", async () => {
    const url = await handlers[LIBRARY_CHANNELS.getUrl](
      handlers[LIBRARY_CHANNELS.list]()[0].id,
    );
    expect(url).toBe("https://tmpfiles.org/dl/123/file.png");
  });
});
