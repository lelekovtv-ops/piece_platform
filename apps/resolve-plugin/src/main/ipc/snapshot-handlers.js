import { copyFileSync, mkdirSync } from "fs";
import { basename, join } from "path";
import { SNAPSHOT_CHANNELS } from "../../shared/ipc-channels.js";
import { snapshotCurrentFrame } from "../resolve/snapshot.js";
import { addToLibraryManifest } from "./library-handlers.js";

export function registerSnapshotHandlers(handlers, { snapshotDir, uploadsDir, dataDir, logger }) {
  const log = logger.createComponentLogger
    ? logger.createComponentLogger("Snapshot")
    : logger;

  handlers[SNAPSHOT_CHANNELS.capture] = (options = {}) => {
    const format = options?.format || "png";

    try {
      const filePath = snapshotCurrentFrame(snapshotDir, { format });
      log.info("Snapshot captured", { filePath });

      let libraryPath = filePath;
      try {
        mkdirSync(uploadsDir, { recursive: true });
        const dest = join(uploadsDir, `snapshot-${Date.now()}-${basename(filePath)}`);
        copyFileSync(filePath, dest);
        libraryPath = dest;
        addToLibraryManifest(dataDir, dest, { source: "snapshot" });
        log.info("Snapshot added to library", { dest });
      } catch (copyErr) {
        log.warn("Could not copy snapshot to library", { error: copyErr.message });
      }

      return { filePath, libraryPath };
    } catch (err) {
      log.error("Snapshot failed", { error: err.message });
      return { error: err.message };
    }
  };
}
