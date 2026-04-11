import { SNAPSHOT_CHANNELS } from "../../shared/ipc-channels.js";
import { snapshotCurrentFrame } from "../resolve/snapshot.js";

export function registerSnapshotHandlers(handlers, { snapshotDir, logger }) {
  const log = logger.createComponentLogger
    ? logger.createComponentLogger("Snapshot")
    : logger;

  handlers[SNAPSHOT_CHANNELS.capture] = (options = {}) => {
    const format = options?.format || "png";

    try {
      const filePath = snapshotCurrentFrame(snapshotDir, { format });
      log.info("Snapshot captured", { filePath });
      return { filePath };
    } catch (err) {
      log.error("Snapshot failed", { error: err.message });
      return { error: err.message };
    }
  };
}
