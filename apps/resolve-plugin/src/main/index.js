import { createRequire } from "module";
import { join } from "path";
import { existsSync } from "fs";
import { createConfig } from "./config.js";
import { createPluginLogger } from "./logger.js";
import {
  loadNativeModule,
  initialize as initResolve,
  cleanup as resolveCleanup,
} from "./resolve/client.js";

export const PLUGIN_ID = "app.piece.studio";

const config = createConfig();
const logger = createPluginLogger({
  logDir: config.logDir,
  level: config.get("LOG_LEVEL"),
});
const componentLogger = logger.createComponentLogger("ResolvePlugin");

let BrowserWindow = null;

loadNativeModule(() => {
  const require = createRequire(import.meta.url);
  return require("WorkflowIntegration");
});

try {
  const require = createRequire(import.meta.url);
  const electron = require("electron");
  BrowserWindow = electron.BrowserWindow || electron.default?.BrowserWindow;
} catch {
  componentLogger.warn("Electron not available (running outside Resolve)");
}

export function init() {
  componentLogger.info("PIECE Studio plugin initializing", {
    pluginId: PLUGIN_ID,
  });

  initResolve(PLUGIN_ID);

  if (BrowserWindow) {
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    const rendererPath = join(
      import.meta.dirname || ".",
      "..",
      "renderer",
      "index.html",
    );

    if (existsSync(rendererPath)) {
      win.loadFile(rendererPath);
    } else {
      componentLogger.warn("Renderer not found", { path: rendererPath });
    }
  }

  componentLogger.info("PIECE Studio plugin initialized");
}

process.on("unhandledRejection", (reason) => {
  componentLogger.error("Unhandled rejection", {
    error: reason?.message || String(reason),
  });
});

process.on("uncaughtException", (err) => {
  componentLogger.error("Uncaught exception", {
    error: err.message,
    stack: err.stack,
  });
});

process.on("exit", () => {
  try {
    resolveCleanup();
  } catch {
    // Best-effort cleanup
  }
});
