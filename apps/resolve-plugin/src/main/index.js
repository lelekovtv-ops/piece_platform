import { app, BrowserWindow, ipcMain } from "electron";
import { createRequire } from "module";
import path from "path";
import { createConfig } from "./config.js";
import { createPluginLogger } from "./logger.js";
import {
  loadNativeModule,
  initialize as initResolve,
  cleanup as resolveCleanup,
} from "./resolve/client.js";
import { registerGenerationHandlers } from "./ipc/generation-handlers.js";
import { registerKeysHandlers } from "./ipc/keys-handlers.js";
import { registerSnapshotHandlers } from "./ipc/snapshot-handlers.js";
import { registerAuthHandlers } from "./ipc/auth-handlers.js";
import { registerLicenseHandlers } from "./ipc/license-handlers.js";
import { registerWindowHandlers } from "./ipc/window-handlers.js";
import * as registry from "./providers/registry.js";
import "./providers/bootstrap.js";
import { createLicenseCheck } from "./license/license-check.js";
import { loadToken } from "./auth/token-storage.js";
import { WINDOW_CHANNELS } from "../shared/ipc-channels.js";

export const PLUGIN_ID = "app.piece.studio";

const config = createConfig();
const logger = createPluginLogger({
  logDir: config.logDir,
  level: config.get("LOG_LEVEL"),
});
const componentLogger = logger.createComponentLogger("ResolvePlugin");

let mainWindow = null;

// Load WorkflowIntegration native module from plugin root
const pluginDir = import.meta.dirname;
const __require = createRequire(import.meta.url);

try {
  const nativePath = path.join(pluginDir, "WorkflowIntegration.node");
  const WI = __require(nativePath);
  loadNativeModule(() => WI);
  componentLogger.info("WorkflowIntegration.node loaded");
} catch (err) {
  componentLogger.warn("WorkflowIntegration not available", {
    error: err.message,
  });
}

// Initialize Resolve API inside app.whenReady (async)

// Window manager — controls BrowserWindow size/mode
const windowManager = {
  _mode: "expanded",
  expand() {
    if (mainWindow) {
      mainWindow.setSize(420, 640);
      this._mode = "expanded";
      mainWindow.webContents.send(WINDOW_CHANNELS.onModeChanged, "expanded");
    }
  },
  collapse() {
    if (mainWindow) {
      mainWindow.setSize(80, 80);
      this._mode = "bubble";
      mainWindow.webContents.send(WINDOW_CHANNELS.onModeChanged, "bubble");
    }
  },
  getMode() {
    return this._mode;
  },
  hideTemporarily() {
    mainWindow?.hide();
  },
  showAgain() {
    mainWindow?.show();
  },
};

// Create a simple license API client
function createLicenseClient({ apiUrl, dataDir }) {
  return {
    async getMyLicenses() {
      const stored = await loadToken(dataDir);
      if (!stored?.accessToken) {
        return { licenses: [] };
      }
      const res = await fetch(`${apiUrl}/v1/licenses/me`, {
        headers: { Authorization: `Bearer ${stored.accessToken}` },
      });
      if (!res.ok) return { licenses: [] };
      return res.json();
    },
  };
}

// Register all IPC handlers via ipcMain.handle
function registerIpcHandlers() {
  const handlers = {};

  const apiUrl = config.get("PIECE_API_URL");
  const devMode = config.get("DEV_MODE") === "true";
  const licenseClient = createLicenseClient({
    apiUrl,
    dataDir: config.dataDir,
  });
  const licenseCheck = createLicenseCheck({
    client: licenseClient,
    dataDir: config.dataDir,
  });

  if (devMode) {
    componentLogger.info("DEV_MODE enabled — auth and license checks bypassed");
  }

  registerGenerationHandlers(handlers, {
    registry,
    downloadDir: config.downloadDir,
    logger,
  });
  registerKeysHandlers(handlers, {
    dataDir: config.dataDir,
    logger,
    config,
  });
  registerSnapshotHandlers(handlers, {
    snapshotDir: config.snapshotDir,
    logger,
  });
  registerAuthHandlers(handlers, {
    apiUrl,
    dataDir: config.dataDir,
    devMode,
  });
  registerLicenseHandlers(handlers, { licenseCheck, devMode });
  registerWindowHandlers(handlers, { windowManager });

  // Bridge handlers dict to Electron ipcMain.handle
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (_event, ...args) => {
      try {
        return await handler(...args);
      } catch (err) {
        componentLogger.error("IPC handler error", {
          channel,
          error: err.message,
        });
        return { error: err.message };
      }
    });
  }

  componentLogger.info("IPC handlers registered", {
    count: Object.keys(handlers).length,
  });
}

// Create plugin browser window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 640,
    useContentSize: true,
    webPreferences: {
      preload: path.join(pluginDir, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.on("close", () => {
    app.quit();
  });

  const rendererPath = path.join(pluginDir, "dist", "renderer", "index.html");
  mainWindow.loadFile(rendererPath);

  componentLogger.info("Plugin window created");
}

// Electron app lifecycle
app.whenReady().then(async () => {
  await initResolve(PLUGIN_ID);
  registerIpcHandlers();
  createWindow();
  componentLogger.info("PIECE Studio plugin ready", { pluginId: PLUGIN_ID });
});

app.on("window-all-closed", () => {
  resolveCleanup();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Process error handlers
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
