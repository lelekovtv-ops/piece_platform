import {
  AUTH_CHANNELS,
  LICENSE_CHANNELS,
  WINDOW_CHANNELS,
  GENERATION_CHANNELS,
  SNAPSHOT_CHANNELS,
  KEYS_CHANNELS,
} from "../shared/ipc-channels.js";

export function createPreloadApi(ipcHandlers, eventBus) {
  return {
    auth: {
      startSignIn: () => ipcHandlers[AUTH_CHANNELS.startSignIn]?.(),
      getCurrentUser: () => ipcHandlers[AUTH_CHANNELS.getCurrentUser]?.(),
      signOut: () => ipcHandlers[AUTH_CHANNELS.signOut]?.(),
    },
    license: {
      check: () => ipcHandlers[LICENSE_CHANNELS.check]?.(),
      refresh: () => ipcHandlers[LICENSE_CHANNELS.refresh]?.(),
    },
    window: {
      expand: () => ipcHandlers[WINDOW_CHANNELS.expand]?.(),
      collapse: () => ipcHandlers[WINDOW_CHANNELS.collapse]?.(),
      getMode: () => ipcHandlers[WINDOW_CHANNELS.getMode]?.(),
      hideTemporarily: () => ipcHandlers[WINDOW_CHANNELS.hideTemporarily]?.(),
      showAgain: () => ipcHandlers[WINDOW_CHANNELS.showAgain]?.(),
      onModeChanged: (cb) => eventBus?.on(WINDOW_CHANNELS.onModeChanged, cb),
    },
    generation: {
      run: (params) => ipcHandlers[GENERATION_CHANNELS.run]?.(params),
      cancel: () => ipcHandlers[GENERATION_CHANNELS.cancel]?.(),
      getStatus: () => ipcHandlers[GENERATION_CHANNELS.getStatus]?.(),
      onProgress: (cb) => eventBus?.on(GENERATION_CHANNELS.onProgress, cb),
      onComplete: (cb) => eventBus?.on(GENERATION_CHANNELS.onComplete, cb),
      onError: (cb) => eventBus?.on(GENERATION_CHANNELS.onError, cb),
    },
    snapshot: {
      capture: () => ipcHandlers[SNAPSHOT_CHANNELS.capture]?.(),
    },
    keys: {
      get: (keyId) => ipcHandlers[KEYS_CHANNELS.get]?.(keyId),
      set: (keyId, value) => ipcHandlers[KEYS_CHANNELS.set]?.(keyId, value),
      remove: (keyId) => ipcHandlers[KEYS_CHANNELS.remove]?.(keyId),
      list: () => ipcHandlers[KEYS_CHANNELS.list]?.(),
    },
  };
}
