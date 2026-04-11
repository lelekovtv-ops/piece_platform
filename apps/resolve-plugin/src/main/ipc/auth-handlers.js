import { createDeviceCodeController } from "../auth/device-code.js";
import { AUTH_CHANNELS } from "../../shared/ipc-channels.js";

export function registerAuthHandlers(handlers, { apiUrl, dataDir }) {
  const ctrl = createDeviceCodeController({ apiUrl, dataDir });

  handlers[AUTH_CHANNELS.startSignIn] = async () => {
    const codeInfo = await ctrl.startSignIn();
    ctrl.pollForToken(codeInfo.deviceCode, codeInfo.interval).catch(() => {});
    return codeInfo;
  };

  handlers[AUTH_CHANNELS.getCurrentUser] = () => ctrl.getCurrentUser();

  handlers[AUTH_CHANNELS.signOut] = async () => {
    ctrl.stopPolling();
    await ctrl.signOut();
  };
}
