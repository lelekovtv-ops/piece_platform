import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";

describe("config", () => {
  const originalEnv = { ...process.env };
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "piece-config-"));
    process.env.PIECE_DATA_DIR = tmpDir;
    process.env.PIECE_API_URL = "https://api.test.piece.app";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should load config from environment variables", async () => {
    const { createConfig } = await import("../../../src/main/config.js");
    const config = createConfig({ dataDir: tmpDir });

    expect(config.get("PIECE_API_URL")).toBe("https://api.test.piece.app");
  });

  it("should provide default dataDir based on home directory", async () => {
    delete process.env.PIECE_DATA_DIR;
    const { createConfig } = await import("../../../src/main/config.js");
    const config = createConfig();

    expect(config.dataDir).toContain(".piece-studio");
  });

  it("should derive logDir, downloadDir and snapshotDir from dataDir", async () => {
    const { createConfig } = await import("../../../src/main/config.js");
    const config = createConfig({ dataDir: tmpDir });

    expect(config.logDir).toBe(path.join(tmpDir, "logs"));
    expect(config.downloadDir).toBe(path.join(tmpDir, "downloads"));
    expect(config.snapshotDir).toBe(path.join(tmpDir, "snapshots"));
  });

  it("should provide LOG_LEVEL with default", async () => {
    delete process.env.LOG_LEVEL;
    const { createConfig } = await import("../../../src/main/config.js");
    const config = createConfig({ dataDir: tmpDir });

    expect(config.get("LOG_LEVEL")).toBe("info");
  });

  it("should load config from config.json when it exists", async () => {
    delete process.env.PIECE_API_URL;
    const configPath = path.join(tmpDir, "config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({ PIECE_API_URL: "https://from-file.piece.app" }),
    );

    const { createConfig } = await import("../../../src/main/config.js");
    const config = createConfig({ dataDir: tmpDir });

    expect(config.get("PIECE_API_URL")).toBe("https://from-file.piece.app");
  });

  it("should prefer env vars over config file values", async () => {
    const configPath = path.join(tmpDir, "config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({ PIECE_API_URL: "https://from-file.com" }),
    );
    process.env.PIECE_API_URL = "https://from-env.com";

    const { createConfig } = await import("../../../src/main/config.js");
    const config = createConfig({ dataDir: tmpDir });

    expect(config.get("PIECE_API_URL")).toBe("https://from-env.com");
  });
});
