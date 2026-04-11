const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * HTTP error from a provider request.
 */
export class ProviderHttpError extends Error {
  /**
   * @param {number} status
   * @param {string} statusText
   * @param {string} body
   */
  constructor(status, statusText, body) {
    super(`HTTP ${status} ${statusText}: ${body.slice(0, 200)}`);
    this.name = "ProviderHttpError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

/**
 * @param {Response} res
 */
async function throwIfNotOk(res) {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ProviderHttpError(res.status, res.statusText, body);
  }
}

/**
 * POST JSON and return parsed response.
 * @param {string} url
 * @param {{ body: unknown, headers?: Record<string, string>, timeoutMs?: number }} opts
 * @returns {Promise<unknown>}
 */
export async function jsonPost(
  url,
  { body, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS },
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    await throwIfNotOk(res);
    return res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET JSON.
 * @param {string} url
 * @param {{ headers?: Record<string, string>, timeoutMs?: number }} [opts]
 * @returns {Promise<unknown>}
 */
export async function jsonGet(
  url,
  { headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    await throwIfNotOk(res);
    return res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch raw bytes from a URL.
 * @param {string} url
 * @param {{ headers?: Record<string, string>, timeoutMs?: number }} [opts]
 * @returns {Promise<ArrayBuffer>}
 */
export async function fetchBytes(
  url,
  { headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    await throwIfNotOk(res);
    return res.arrayBuffer();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
