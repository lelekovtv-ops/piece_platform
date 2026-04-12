import os from "os";
import path from "path";
import fs from "fs";

const DEFAULTS = {
  LOG_LEVEL: "info",
  PIECE_API_URL: "https://api.piece.app",
  DEV_MODE: "false",
};

export function createConfig({ dataDir } = {}) {
  const resolvedDataDir =
    dataDir ||
    process.env.PIECE_DATA_DIR ||
    path.join(os.homedir(), ".piece-studio");
  const logDir = path.join(resolvedDataDir, "logs");
  const downloadDir = path.join(resolvedDataDir, "downloads");
  const uploadsDir = path.join(resolvedDataDir, "uploads");
  const snapshotDir = path.join(resolvedDataDir, "snapshots");

  let fileConfig = {};
  const configFilePath = path.join(resolvedDataDir, "config.json");
  try {
    if (fs.existsSync(configFilePath)) {
      const raw = fs.readFileSync(configFilePath, "utf-8");
      fileConfig = JSON.parse(raw);
    }
  } catch {
    // Ignore malformed config file
  }

  function get(key) {
    if (process.env[key] !== undefined) {
      return process.env[key];
    }
    if (fileConfig[key] !== undefined) {
      return fileConfig[key];
    }
    return DEFAULTS[key] ?? null;
  }

  return {
    dataDir: resolvedDataDir,
    logDir,
    downloadDir,
    uploadsDir,
    snapshotDir,
    get,
  };
}
