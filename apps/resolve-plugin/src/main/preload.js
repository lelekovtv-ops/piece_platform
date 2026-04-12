import { contextBridge, ipcRenderer } from "electron/renderer";
import {
  AUTH_CHANNELS,
  LICENSE_CHANNELS,
  WINDOW_CHANNELS,
  GENERATION_CHANNELS,
  SNAPSHOT_CHANNELS,
  KEYS_CHANNELS,
  LIBRARY_CHANNELS,
  QUEUE_CHANNELS,
} from "../shared/ipc-channels.js";

contextBridge.exposeInMainWorld("api", {
  auth: {
    startSignIn: () => ipcRenderer.invoke(AUTH_CHANNELS.startSignIn),
    getCurrentUser: () => ipcRenderer.invoke(AUTH_CHANNELS.getCurrentUser),
    signOut: () => ipcRenderer.invoke(AUTH_CHANNELS.signOut),
  },
  license: {
    check: () => ipcRenderer.invoke(LICENSE_CHANNELS.check),
    refresh: () => ipcRenderer.invoke(LICENSE_CHANNELS.refresh),
  },
  window: {
    expand: () => ipcRenderer.invoke(WINDOW_CHANNELS.expand),
    collapse: () => ipcRenderer.invoke(WINDOW_CHANNELS.collapse),
    getMode: () => ipcRenderer.invoke(WINDOW_CHANNELS.getMode),
    hideTemporarily: () => ipcRenderer.invoke(WINDOW_CHANNELS.hideTemporarily),
    showAgain: () => ipcRenderer.invoke(WINDOW_CHANNELS.showAgain),
    onModeChanged: (callback) => {
      ipcRenderer.on(WINDOW_CHANNELS.onModeChanged, (_event, mode) =>
        callback(mode),
      );
    },
  },
  generation: {
    run: (params) => ipcRenderer.invoke(GENERATION_CHANNELS.run, params),
    cancel: () => ipcRenderer.invoke(GENERATION_CHANNELS.cancel),
    getStatus: () => ipcRenderer.invoke(GENERATION_CHANNELS.getStatus),
    onProgress: (callback) => {
      ipcRenderer.on(GENERATION_CHANNELS.onProgress, (_event, data) =>
        callback(data),
      );
    },
    onComplete: (callback) => {
      ipcRenderer.on(GENERATION_CHANNELS.onComplete, (_event, data) =>
        callback(data),
      );
    },
    onError: (callback) => {
      ipcRenderer.on(GENERATION_CHANNELS.onError, (_event, data) =>
        callback(data),
      );
    },
  },
  snapshot: {
    capture: () => ipcRenderer.invoke(SNAPSHOT_CHANNELS.capture),
  },
  keys: {
    get: (keyId) => ipcRenderer.invoke(KEYS_CHANNELS.get, keyId),
    set: (keyId, value) => ipcRenderer.invoke(KEYS_CHANNELS.set, keyId, value),
    remove: (keyId) => ipcRenderer.invoke(KEYS_CHANNELS.remove, keyId),
    list: () => ipcRenderer.invoke(KEYS_CHANNELS.list),
  },
  library: {
    list: () => ipcRenderer.invoke(LIBRARY_CHANNELS.list),
    import: (filePath) => ipcRenderer.invoke(LIBRARY_CHANNELS.import, filePath),
    remove: (id) => ipcRenderer.invoke(LIBRARY_CHANNELS.remove, id),
    getUrl: (id) => ipcRenderer.invoke(LIBRARY_CHANNELS.getUrl, id),
  },
  queue: {
    add: (item) => ipcRenderer.invoke(QUEUE_CHANNELS.add, item),
    list: () => ipcRenderer.invoke(QUEUE_CHANNELS.list),
    cancel: (id) => ipcRenderer.invoke(QUEUE_CHANNELS.cancel, id),
    clear: () => ipcRenderer.invoke(QUEUE_CHANNELS.clear),
    onUpdate: (cb) => {
      ipcRenderer.on(QUEUE_CHANNELS.onUpdate, (_e, data) => cb(data));
    },
  },
});
