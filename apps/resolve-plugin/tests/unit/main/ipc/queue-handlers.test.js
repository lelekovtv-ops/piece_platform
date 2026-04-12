import { describe, it, expect, vi, beforeEach } from "vitest";
import { QUEUE_CHANNELS } from "../../../../src/shared/ipc-channels.js";

const { registerQueueHandlers } =
  await import("../../../../src/main/ipc/queue-handlers.js");

function makeMockLogger() {
  const child = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    createComponentLogger: vi.fn().mockReturnValue(child),
  };
}

describe("registerQueueHandlers", () => {
  let handlers;
  let logger;
  let generateFn;
  let getMainWindow;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = {};
    logger = makeMockLogger();
    generateFn = vi.fn().mockResolvedValue({ clipName: "test.mp4", filePath: "/tmp/test.mp4" });
    getMainWindow = vi.fn().mockReturnValue({
      isDestroyed: () => false,
      webContents: { send: vi.fn() },
    });
    registerQueueHandlers(handlers, { generateFn, getMainWindow, logger });
  });

  it("registers all queue channels", () => {
    expect(handlers[QUEUE_CHANNELS.add]).toBeDefined();
    expect(handlers[QUEUE_CHANNELS.list]).toBeDefined();
    expect(handlers[QUEUE_CHANNELS.cancel]).toBeDefined();
    expect(handlers[QUEUE_CHANNELS.clear]).toBeDefined();
  });

  it("list returns empty array initially", () => {
    expect(handlers[QUEUE_CHANNELS.list]()).toEqual([]);
  });

  it("add creates a queue item and returns queue", async () => {
    const result = await handlers[QUEUE_CHANNELS.add]({
      providerId: "test",
      prompt: "a cat",
      apiKey: "key",
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      providerId: "test",
      prompt: "a cat",
      status: expect.stringMatching(/pending|generating|done/),
    });
    expect(result[0].id).toBeDefined();
  });

  it("cancel removes a pending item", async () => {
    generateFn.mockImplementation(() => new Promise(() => {})); // Never resolves
    await handlers[QUEUE_CHANNELS.add]({ providerId: "a", prompt: "x", apiKey: "k" });
    await handlers[QUEUE_CHANNELS.add]({ providerId: "b", prompt: "y", apiKey: "k" });

    const items = handlers[QUEUE_CHANNELS.list]();
    const pendingItem = items.find((i) => i.status === "pending");
    if (pendingItem) {
      const result = await handlers[QUEUE_CHANNELS.cancel](pendingItem.id);
      expect(result.find((i) => i.id === pendingItem.id)).toBeUndefined();
    }
  });

  it("clear removes pending items", async () => {
    generateFn.mockImplementation(() => new Promise(() => {}));
    await handlers[QUEUE_CHANNELS.add]({ providerId: "a", prompt: "x", apiKey: "k" });
    await handlers[QUEUE_CHANNELS.add]({ providerId: "b", prompt: "y", apiKey: "k" });

    const result = await handlers[QUEUE_CHANNELS.clear]();
    const pending = result.filter((i) => i.status === "pending");
    expect(pending).toHaveLength(0);
  });

  it("throws when queue is full", async () => {
    generateFn.mockImplementation(() => new Promise(() => {}));
    for (let i = 0; i < 10; i++) {
      handlers[QUEUE_CHANNELS.add]({ providerId: "p", prompt: `${i}`, apiKey: "k" });
    }
    expect(() =>
      handlers[QUEUE_CHANNELS.add]({ providerId: "p", prompt: "overflow", apiKey: "k" }),
    ).toThrow("Queue is full");
  });
});
