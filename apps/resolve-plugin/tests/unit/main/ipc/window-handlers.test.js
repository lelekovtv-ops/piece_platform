import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerWindowHandlers } from "../../../../src/main/ipc/window-handlers.js";

describe("window-handlers", () => {
  let handlers;
  let windowManager;

  beforeEach(() => {
    handlers = {};
    windowManager = {
      expand: vi.fn(),
      collapse: vi.fn(),
      hideTemporarily: vi.fn(),
      showAgain: vi.fn(),
      getMode: vi.fn(() => "bubble"),
    };
    registerWindowHandlers(handlers, { windowManager });
  });

  it("registers window:expand handler", () => {
    expect(handlers["window:expand"]).toBeTypeOf("function");
  });

  it("registers window:collapse handler", () => {
    expect(handlers["window:collapse"]).toBeTypeOf("function");
  });

  it("registers window:get-mode handler", () => {
    expect(handlers["window:get-mode"]).toBeTypeOf("function");
  });

  it("expand handler calls windowManager.expand", async () => {
    await handlers["window:expand"]();
    expect(windowManager.expand).toHaveBeenCalled();
  });

  it("collapse handler calls windowManager.collapse", async () => {
    await handlers["window:collapse"]();
    expect(windowManager.collapse).toHaveBeenCalled();
  });

  it("get-mode handler returns current mode", async () => {
    windowManager.getMode.mockReturnValue("expanded");
    const result = await handlers["window:get-mode"]();
    expect(result).toBe("expanded");
  });

  it("hide-temporarily handler calls windowManager", async () => {
    await handlers["window:hide-temporarily"]();
    expect(windowManager.hideTemporarily).toHaveBeenCalled();
  });

  it("show-again handler calls windowManager", async () => {
    await handlers["window:show-again"]();
    expect(windowManager.showAgain).toHaveBeenCalled();
  });
});
