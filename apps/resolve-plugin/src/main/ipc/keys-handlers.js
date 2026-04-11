import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { KEYS_CHANNELS } from "../../shared/ipc-channels.js";

export function registerKeysHandlers(handlers, { dataDir, logger }) {
  const log = logger.createComponentLogger
    ? logger.createComponentLogger("Keys")
    : logger;

  const keysFile = join(dataDir, "keys.json");

  function readKeys() {
    try {
      if (existsSync(keysFile)) {
        return JSON.parse(readFileSync(keysFile, "utf-8"));
      }
    } catch {
      log.warn("Failed to read keys file, starting fresh");
    }
    return {};
  }

  function writeKeys(data) {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(keysFile, JSON.stringify(data, null, 2), "utf-8");
  }

  handlers[KEYS_CHANNELS.get] = (keyId) => {
    const keys = readKeys();
    return keys[keyId] ?? null;
  };

  handlers[KEYS_CHANNELS.set] = (keyId, value) => {
    const keys = readKeys();
    keys[keyId] = value;
    writeKeys(keys);
    log.info("API key stored", { keyId });
  };

  handlers[KEYS_CHANNELS.remove] = (keyId) => {
    const keys = readKeys();
    delete keys[keyId];
    writeKeys(keys);
    log.info("API key removed", { keyId });
  };

  handlers[KEYS_CHANNELS.list] = () => {
    const keys = readKeys();
    return Object.keys(keys);
  };
}
