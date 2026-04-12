import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";

describe("logger", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "piece-logger-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should create a logger instance with expected methods", async () => {
    const { createPluginLogger } = await import("../../../src/main/logger.js");
    const logger = createPluginLogger({ logDir: tmpDir, level: "info" });

    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("should create component loggers", async () => {
    const { createPluginLogger } = await import("../../../src/main/logger.js");
    const logger = createPluginLogger({ logDir: tmpDir, level: "info" });
    const component = logger.createComponentLogger("TestComponent");

    expect(typeof component.info).toBe("function");
    expect(typeof component.warn).toBe("function");
    expect(typeof component.error).toBe("function");
  });

  it("should create log directory if it does not exist", async () => {
    const logDir = path.join(tmpDir, "nested", "logs");
    const { createPluginLogger } = await import("../../../src/main/logger.js");
    createPluginLogger({ logDir, level: "info" });

    expect(fs.existsSync(logDir)).toBe(true);
  });
});
