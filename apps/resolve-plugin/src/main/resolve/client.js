import { createPluginLogger } from "../logger.js";

let componentLogger = null;
let WorkflowIntegration = null;
let resolveApi = null;

function getLogger() {
  if (!componentLogger) {
    const logger = createPluginLogger({ logDir: "/tmp", level: "silent" });
    componentLogger = logger.createComponentLogger("ResolveClient");
  }
  return componentLogger;
}

export function loadNativeModule(loader) {
  try {
    WorkflowIntegration = loader();
  } catch {
    getLogger().warn(
      "WorkflowIntegration not available (running outside Resolve)",
    );
    WorkflowIntegration = null;
  }
}

export function isAvailable() {
  return WorkflowIntegration !== null;
}

export function initialize(pluginId) {
  if (!WorkflowIntegration) {
    getLogger().warn("Cannot initialize — WorkflowIntegration not loaded");
    return false;
  }

  try {
    WorkflowIntegration.Initialize(pluginId);
    const resolve = WorkflowIntegration.GetResolve();

    if (!resolve) {
      getLogger().warn("GetResolve returned null — Resolve may not be running");
      resolveApi = null;
      return false;
    }

    resolveApi = resolve;
    getLogger().info("Resolve API initialized", { pluginId });
    return true;
  } catch (err) {
    getLogger().error("Failed to initialize Resolve API", {
      error: err.message,
    });
    resolveApi = null;
    return false;
  }
}

export function getResolve() {
  return resolveApi;
}

export function cleanup() {
  if (WorkflowIntegration) {
    try {
      WorkflowIntegration.CleanUp();
      getLogger().info("WorkflowIntegration cleaned up");
    } catch (err) {
      getLogger().error("CleanUp failed", { error: err.message });
    }
  }
  resolveApi = null;
}
