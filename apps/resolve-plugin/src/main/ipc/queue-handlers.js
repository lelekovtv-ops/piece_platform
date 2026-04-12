import crypto from "crypto";
import { QUEUE_CHANNELS } from "../../shared/ipc-channels.js";

const MAX_QUEUE_SIZE = 10;

export function registerQueueHandlers(handlers, { generateFn, getMainWindow, logger }) {
  const log = logger.createComponentLogger
    ? logger.createComponentLogger("Queue")
    : logger;

  const queue = [];
  let processing = false;

  function broadcastUpdate() {
    try {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send(QUEUE_CHANNELS.onUpdate, [...queue]);
      }
    } catch {
      // Window not available
    }
  }

  async function processNext() {
    if (processing) return;

    const next = queue.find((item) => item.status === "pending");
    if (!next) return;

    processing = true;
    next.status = "generating";
    broadcastUpdate();

    try {
      const result = await generateFn({
        providerId: next.providerId,
        prompt: next.prompt,
        apiKey: next.apiKey,
        duration: next.duration,
        referenceImages: next.referenceImages,
      });

      next.status = "done";
      next.result = result;
      log.info("Queue item completed", { id: next.id, clipName: result.clipName });
    } catch (err) {
      next.status = "error";
      next.error = err.message;
      log.error("Queue item failed", { id: next.id, error: err.message });
    }

    processing = false;
    broadcastUpdate();
    processNext();
  }

  handlers[QUEUE_CHANNELS.add] = (item) => {
    if (queue.filter((i) => i.status === "pending" || i.status === "generating").length >= MAX_QUEUE_SIZE) {
      throw new Error(`Queue is full (max ${MAX_QUEUE_SIZE})`);
    }

    const queueItem = {
      id: crypto.randomUUID(),
      providerId: item.providerId,
      prompt: item.prompt,
      apiKey: item.apiKey,
      duration: item.duration || null,
      referenceImages: item.referenceImages || [],
      status: "pending",
      result: null,
      error: null,
      createdAt: Date.now(),
    };

    queue.push(queueItem);
    log.info("Queue item added", { id: queueItem.id, provider: queueItem.providerId });
    broadcastUpdate();
    processNext();

    return [...queue];
  };

  handlers[QUEUE_CHANNELS.list] = () => [...queue];

  handlers[QUEUE_CHANNELS.cancel] = (itemId) => {
    const idx = queue.findIndex((i) => i.id === itemId);
    if (idx === -1) throw new Error("Queue item not found");

    if (queue[idx].status === "pending") {
      queue.splice(idx, 1);
    } else if (queue[idx].status === "generating") {
      queue[idx].status = "error";
      queue[idx].error = "Cancelled";
    }

    broadcastUpdate();
    return [...queue];
  };

  handlers[QUEUE_CHANNELS.clear] = () => {
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].status === "pending") {
        queue.splice(i, 1);
      }
    }
    broadcastUpdate();
    log.info("Queue cleared");
    return [...queue];
  };
}
