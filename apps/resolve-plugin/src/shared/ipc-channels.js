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
