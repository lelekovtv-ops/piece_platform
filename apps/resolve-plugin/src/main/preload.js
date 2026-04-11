import { AUTH_CHANNELS, LICENSE_CHANNELS } from "../shared/ipc-channels.js";

export function createPreloadApi(ipcHandlers) {
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
  };
}
