export const AUTH_CHANNELS = Object.freeze({
  startSignIn: "auth:start-signin",
  getCurrentUser: "auth:get-current-user",
  signOut: "auth:sign-out",
  onAuthStatusChange: "auth:on-status-change",
  onDeviceCode: "auth:on-device-code",
});

export const LICENSE_CHANNELS = Object.freeze({
  check: "license:check",
  refresh: "license:refresh",
  onStatusChange: "license:on-status-change",
});

export const WINDOW_CHANNELS = Object.freeze({
  expand: "window:expand",
  collapse: "window:collapse",
  getMode: "window:get-mode",
  hideTemporarily: "window:hide-temporarily",
  showAgain: "window:show-again",
  onModeChanged: "window:mode-changed",
});

export const GENERATION_CHANNELS = Object.freeze({
  run: "generation:run",
  cancel: "generation:cancel",
  getStatus: "generation:get-status",
  onProgress: "generation:on-progress",
  onComplete: "generation:on-complete",
  onError: "generation:on-error",
});

export const SNAPSHOT_CHANNELS = Object.freeze({
  capture: "snapshot:capture",
});

export const KEYS_CHANNELS = Object.freeze({
  get: "keys:get",
  set: "keys:set",
  remove: "keys:remove",
  list: "keys:list",
});
