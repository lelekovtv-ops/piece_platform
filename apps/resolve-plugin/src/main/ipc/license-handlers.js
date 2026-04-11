import { LICENSE_CHANNELS } from "../../shared/ipc-channels.js";

const NO_LICENSE = Object.freeze({
  hasLicense: false,
  tier: null,
  expiresAt: null,
  stale: false,
});

export function registerLicenseHandlers(handlers, { licenseCheck }) {
  handlers[LICENSE_CHANNELS.check] = async () => {
    try {
      return await licenseCheck.checkLicense();
    } catch (err) {
      return { ...NO_LICENSE, error: err.message };
    }
  };

  handlers[LICENSE_CHANNELS.refresh] = async () => {
    try {
      return await licenseCheck.checkLicense({ force: true });
    } catch (err) {
      return { ...NO_LICENSE, error: err.message };
    }
  };
}
