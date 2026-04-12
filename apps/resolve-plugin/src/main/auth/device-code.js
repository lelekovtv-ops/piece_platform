import { saveToken, loadToken, clearToken } from "./token-storage.js";

export function createDeviceCodeController({ apiUrl, dataDir }) {
  let aborted = false;
  let timeoutId = null;
  let rejectPoll = null;

  async function startSignIn() {
    const res = await fetch(`${apiUrl}/v1/auth/device-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "resolve-plugin" }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `HTTP ${res.status}`);
    }
    return res.json();
  }

  function pollForToken(code, intervalSec = 5) {
    aborted = false;
    let currentInterval = intervalSec;

    return new Promise((resolve, reject) => {
      rejectPoll = reject;
      async function tick() {
        if (aborted) {
          return reject(new Error("Polling cancelled"));
        }

        let data;
        try {
          const res = await fetch(`${apiUrl}/v1/auth/device-code/poll`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceCode: code }),
          });
          data = await res.json();
        } catch (err) {
          return reject(err);
        }

        if (data.status === "approved") {
          const tokenData = {
            accessToken: data.accessToken,
            user: data.user,
          };
          await saveToken(dataDir, tokenData);
          return resolve(tokenData);
        }

        if (data.status === "slow_down") {
          currentInterval += 5;
        }

        if (data.status === "expired_token") {
          return reject(new Error("Device code expired"));
        }

        timeoutId = setTimeout(tick, currentInterval * 1000);
      }

      tick();
    });
  }

  function stopPolling() {
    aborted = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (rejectPoll) {
      rejectPoll(new Error("Polling cancelled"));
      rejectPoll = null;
    }
  }

  async function signOut() {
    const stored = await loadToken(dataDir);
    if (stored?.accessToken) {
      try {
        await fetch(`${apiUrl}/v1/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${stored.accessToken}`,
          },
        });
      } catch {
        // Best-effort revocation
      }
    }
    await clearToken(dataDir);
  }

  async function getCurrentUser() {
    const stored = await loadToken(dataDir);
    return stored?.user ?? null;
  }

  return { startSignIn, pollForToken, stopPolling, signOut, getCurrentUser };
}
