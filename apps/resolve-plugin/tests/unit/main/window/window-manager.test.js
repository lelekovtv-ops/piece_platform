import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWindowManager } from "../../../../src/main/window/window-manager.js";

function makeMockWin() {
  return {
    setSize: vi.fn(),
    getSize: vi.fn(() => [80, 80]),
    setPosition: vi.fn(),
    getPosition: vi.fn(() => [100, 100]),
    setAlwaysOnTop: vi.fn(),
    setVisibleOnAllWorkspaces: vi.fn(),
    setResizable: vi.fn(),
    setMovable: vi.fn(),
    setSkipTaskbar: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    isVisible: vi.fn(() => true),
    isDestroyed: vi.fn(() => false),
    on: vi.fn(),
    webContents: {
      send: vi.fn(),
    },
  };
}

function makeMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    createComponentLogger: vi.fn(function () {
      return this;
    }),
  };
}

describe("window-manager", () => {
  let manager;
  let win;
  let logger;

  beforeEach(() => {
    win = makeMockWin();
    logger = makeMockLogger();
    manager = createWindowManager({ win, logger });
  });

  it("starts in bubble mode", () => {
    expect(manager.getMode()).toBe("bubble");
  });

  it("expand resizes window to expanded dimensions", () => {
    manager.expand();
    expect(win.setSize).toHaveBeenCalledWith(420, 640);
    expect(manager.getMode()).toBe("expanded");
  });

  it("collapse resizes window to bubble dimensions", () => {
    manager.expand();
    manager.collapse();
    expect(win.setSize).toHaveBeenCalledWith(80, 80);
    expect(manager.getMode()).toBe("bubble");
  });

  it("expand is idempotent", () => {
    manager.expand();
    manager.expand();
    expect(win.setSize).toHaveBeenCalledTimes(1);
  });

  it("collapse is idempotent when already bubble", () => {
    manager.collapse();
    expect(win.setSize).not.toHaveBeenCalled();
  });

  it("hideTemporarily hides the window", () => {
    manager.hideTemporarily();
    expect(win.hide).toHaveBeenCalled();
  });

  it("showAgain shows the window after hide", () => {
    manager.hideTemporarily();
    manager.showAgain();
    expect(win.show).toHaveBeenCalled();
  });

  it("sends mode-change event to renderer on expand", () => {
    manager.expand();
    expect(win.webContents.send).toHaveBeenCalledWith(
      "window:mode-changed",
      "expanded",
    );
  });

  it("sends mode-change event to renderer on collapse", () => {
    manager.expand();
    manager.collapse();
    expect(win.webContents.send).toHaveBeenCalledWith(
      "window:mode-changed",
      "bubble",
    );
  });
});
