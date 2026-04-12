import { loadToken, clearToken } from "../auth/token-storage.js";

export function createPieceClient({ apiUrl, dataDir, onAuthRequired }) {
  async function authHeaders() {
    const stored = await loadToken(dataDir);
    const headers = { "Content-Type": "application/json" };
    if (stored?.accessToken) {
      headers.Authorization = `Bearer ${stored.accessToken}`;
    }
    return headers;
  }

  async function request(method, path, { body, auth = true } = {}) {
    const headers = auth
      ? await authHeaders()
      : { "Content-Type": "application/json" };
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${apiUrl}${path}`, opts);

    if (!res.ok) {
      if (res.status === 401 && auth) {
        await clearToken(dataDir);
        onAuthRequired?.();
      }
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.message || `HTTP ${res.status}`);
    }

    return res.json();
  }

  return {
    getMe: () => request("GET", "/v1/auth/me"),
    getMyLicenses: () => request("GET", "/v1/me/licenses"),
    requestDeviceCode: () =>
      request("POST", "/v1/auth/device-code", {
        body: { clientId: "resolve-plugin" },
        auth: false,
      }),
    pollDeviceCode: (deviceCode) =>
      request("POST", "/v1/auth/device-code/poll", {
        body: { deviceCode },
        auth: false,
      }),
  };
}
