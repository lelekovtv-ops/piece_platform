import { describe, it, expect, vi, beforeEach } from "vitest";
import { SNAPSHOT_CHANNELS } from "../../../../src/shared/ipc-channels.js";

vi.mock("../../../../src/main/resolve/snapshot.js", () => ({
  snapshotCurrentFrame: vi
    .fn()
    .mockReturnValue("/tmp/snapshots/piece-snapshot-123.png"),
}));

const { registerSnapshotHandlers } =
  await import("../../../../src/main/ipc/snapshot-handlers.js");
const { snapshotCurrentFrame } =
  await import("../../../../src/main/resolve/snapshot.js");

function makeMockLogger() {
  const child = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    createComponentLogger: vi.fn().mockReturnValue(child),
  };
}

describe("registerSnapshotHandlers", () => {
  let handlers;
  let logger;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = {};
    logger = makeMockLogger();
  });

  it("registers handler for snapshot:capture", () => {
    registerSnapshotHandlers(handlers, {
      snapshotDir: "/tmp/snapshots",
      logger,
    });
    expect(handlers[SNAPSHOT_CHANNELS.capture]).toBeDefined();
    expect(typeof handlers[SNAPSHOT_CHANNELS.capture]).toBe("function");
  });

  it("calls snapshotCurrentFrame with snapshotDir", () => {
    registerSnapshotHandlers(handlers, {
      snapshotDir: "/tmp/snapshots",
      logger,
    });
    const result = handlers[SNAPSHOT_CHANNELS.capture]();
    expect(snapshotCurrentFrame).toHaveBeenCalledWith("/tmp/snapshots", {
      format: "png",
    });
    expect(result).toEqual({
      filePath: "/tmp/snapshots/piece-snapshot-123.png",
    });
  });

  it("returns error object on failure", () => {
    snapshotCurrentFrame.mockImplementation(() => {
      throw new Error("No timeline is currently open");
    });
    registerSnapshotHandlers(handlers, {
      snapshotDir: "/tmp/snapshots",
      logger,
    });
    const result = handlers[SNAPSHOT_CHANNELS.capture]();
    expect(result).toEqual(
      expect.objectContaining({
        error: "No timeline is currently open",
      }),
    );
  });

  it("passes format option when provided", () => {
    registerSnapshotHandlers(handlers, {
      snapshotDir: "/tmp/snapshots",
      logger,
    });
    handlers[SNAPSHOT_CHANNELS.capture]({ format: "jpg" });
    expect(snapshotCurrentFrame).toHaveBeenCalledWith("/tmp/snapshots", {
      format: "jpg",
    });
  });
});
