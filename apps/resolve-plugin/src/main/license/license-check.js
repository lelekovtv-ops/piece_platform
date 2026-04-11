import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_FILE = "license-cache.json";
const PRODUCT_ID = "piece-studio";

const NO_LICENSE = Object.freeze({
  hasLicense: false,
  tier: null,
  expiresAt: null,
  stale: false,
});

export function createLicenseCheck({ client, dataDir }) {
  let cached = null;
  let cachedAt = 0;

  async function loadDiskCache() {
    try {
      const raw = await readFile(join(dataDir, CACHE_FILE), "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function saveDiskCache(state) {
    try {
      await mkdir(dataDir, { recursive: true });
      await writeFile(
        join(dataDir, CACHE_FILE),
        JSON.stringify({ ...state, checkedAt: Date.now() }),
        "utf-8",
      );
    } catch {
      // Best-effort persistence
    }
  }

  function parseResult(licenses) {
    const active = licenses.find(
      (l) => l.productId === PRODUCT_ID && l.status === "active",
    );
    if (!active) return { ...NO_LICENSE };
    return {
      hasLicense: true,
      tier: active.tier ?? null,
      expiresAt: active.expiresAt ?? null,
      stale: false,
    };
  }

  async function checkLicense({ force = false } = {}) {
    const now = Date.now();

    if (!force && cached && now - cachedAt < CACHE_TTL_MS) {
      return { ...cached };
    }

    try {
      const data = await client.getMyLicenses();
      const result = parseResult(data.licenses || []);
      cached = result;
      cachedAt = now;
      await saveDiskCache(result);
      return { ...result };
    } catch {
      // API failed — try last known state
      if (cached) {
        return { ...cached, stale: true };
      }

      // No memory cache — try disk
      const disk = await loadDiskCache();
      if (disk && disk.hasLicense !== undefined) {
        cached = {
          hasLicense: disk.hasLicense,
          tier: disk.tier ?? null,
          expiresAt: disk.expiresAt ?? null,
          stale: false,
        };
        cachedAt = disk.checkedAt || 0;
        return { ...cached, stale: true };
      }

      return { ...NO_LICENSE };
    }
  }

  return { checkLicense };
}
