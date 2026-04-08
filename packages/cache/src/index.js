/**
 * piece/cache — Redis caching utilities.
 *
 * Provides standardised TTL constants, cache initialisation, and a
 * CacheManager class with batch/pattern/lock extensions.
 *
 * Placeholder tokens:
 *   piece     — npm scope
 *   piece  — project slug
 *   piece        — cache key prefix
 */

import Redis from 'ioredis';

// ---------------------------------------------------------------------------
// Standard TTL constants (seconds) — NEVER hardcode TTL values in services
// ---------------------------------------------------------------------------

export const StandardTTL = Object.freeze({
  SHORT: 60,
  MEDIUM: 300,
  LONG: 3600,

  // Domain-specific
  chatListShort: 300,
  chatMembersShort: 600,
  verification: 900,
  channel: 86400,
  chat: 1800,
  topic: 3600,
  topicLookup: 3600,
  secretApproval: 120,
  authSession: 600,
  aiEngineSession: 300,
  tableData: 1800,
  tableConfig: 3600,
  mediaFile: 86400,
  permissions: 600,
  user: 86400,
  userRoles: 86400,
});

// ---------------------------------------------------------------------------
// Service profiles — registered services and their cache configuration
// ---------------------------------------------------------------------------

// Add your service profiles here. Unknown service names fall back to DEFAULT_PROFILE.
const DEFAULT_PROFILE = { extensions: {}, defaultTTL: StandardTTL.MEDIUM };

const SERVICE_PROFILES = new Map([
  ['default', DEFAULT_PROFILE],
  ['api-gateway', { extensions: { patterns: true }, defaultTTL: StandardTTL.SHORT }],
  ['example-service', { extensions: { batch: true }, defaultTTL: StandardTTL.LONG }],
]);

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let _redisClient = null;

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Initialise the cache for a specific service.
 *
 * @param {string} serviceName — must match a SERVICE_PROFILES key (or falls back to 'default')
 * @param {object} config      — ServiceConfig instance
 * @param {object} [overrides]
 * @param {string} [overrides.strategy]   — 'redis' | 'memory' (default: 'redis')
 * @param {object} [overrides.extensions] — override profile extensions
 * @param {object} [overrides.redis]      — { defaultTTL }
 * @returns {Promise<CacheManager>}
 */
export async function initializeServiceCache(serviceName, config, overrides = {}) {
  const profile = SERVICE_PROFILES.get(serviceName) ?? DEFAULT_PROFILE;
  const strategy = overrides.strategy ?? 'redis';

  if (strategy === 'redis') {
    const redisUrl = typeof config.get === 'function'
      ? config.get('redisUrl') ?? config.get('REDIS_URL')
      : 'redis://localhost:6384';

    _redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 3000),
      lazyConnect: true,
    });

    await _redisClient.connect();
  }

  const defaultTTL = overrides.redis?.defaultTTL ?? profile.defaultTTL ?? StandardTTL.MEDIUM;
  const extensions = overrides.extensions ?? profile.extensions ?? {};

  return new CacheManager({ prefix: serviceName, defaultTTL, extensions });
}

/**
 * Create a cache instance with a custom prefix (does not initialise a new connection).
 *
 * @param {{ prefix: string, defaultTTL?: number }} options
 * @returns {CacheManager}
 */
export function createCache({ prefix, defaultTTL }) {
  return new CacheManager({ prefix, defaultTTL: defaultTTL ?? StandardTTL.MEDIUM, extensions: {} });
}

// ---------------------------------------------------------------------------
// CacheManager
// ---------------------------------------------------------------------------

export class CacheManager {
  #prefix;
  #defaultTTL;
  #extensions;

  constructor({ prefix, defaultTTL, extensions }) {
    this.#prefix = prefix;
    this.#defaultTTL = defaultTTL;
    this.#extensions = extensions;
  }

  /** Build a prefixed cache key. */
  #key(key) {
    return `${this.#prefix}:${key}`;
  }

  /**
   * Get a cached value. Returns null on miss.
   */
  async get(key) {
    if (!_redisClient) return null;
    const raw = await _redisClient.get(this.#key(key));
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  /**
   * Set a cached value with optional TTL (seconds). Defaults to profile TTL.
   */
  async set(key, value, ttl) {
    if (!_redisClient) return;
    const serialised = typeof value === 'string' ? value : JSON.stringify(value);
    const seconds = ttl ?? this.#defaultTTL;
    await _redisClient.set(this.#key(key), serialised, 'EX', seconds);
  }

  /**
   * Delete a cached value.
   */
  async del(key) {
    if (!_redisClient) return;
    await _redisClient.del(this.#key(key));
  }

  /**
   * Check whether a key exists.
   */
  async exists(key) {
    if (!_redisClient) return false;
    return (await _redisClient.exists(this.#key(key))) === 1;
  }

  // -----------------------------------------------------------------------
  // Batch extension
  // -----------------------------------------------------------------------

  /**
   * Get multiple values in one round-trip.
   *
   * @param {string[]} keys
   * @returns {Promise<Map<string, unknown>>}
   */
  async mget(keys) {
    if (!_redisClient || keys.length === 0) return new Map();
    const prefixed = keys.map((k) => this.#key(k));
    const values = await _redisClient.mget(...prefixed);

    const result = new Map();
    for (let i = 0; i < keys.length; i++) {
      if (values[i] !== null) {
        try {
          result.set(keys[i], JSON.parse(values[i]));
        } catch {
          result.set(keys[i], values[i]);
        }
      }
    }
    return result;
  }

  // -----------------------------------------------------------------------
  // Pattern extension
  // -----------------------------------------------------------------------

  /**
   * Delete all keys matching a glob pattern.
   *
   * @param {string} pattern — glob pattern (e.g. 'user:*')
   * @returns {Promise<number>} count of deleted keys
   */
  async deletePattern(pattern) {
    if (!_redisClient) return 0;
    const fullPattern = this.#key(pattern);
    let cursor = '0';
    let deleted = 0;

    do {
      const [nextCursor, keys] = await _redisClient.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        deleted += await _redisClient.del(...keys);
      }
    } while (cursor !== '0');

    return deleted;
  }

  // -----------------------------------------------------------------------
  // Lock extension (simple Redis SETNX lock)
  // -----------------------------------------------------------------------

  /**
   * Acquire a simple distributed lock.
   *
   * @param {string} lockName
   * @param {number} [ttl] — lock TTL in seconds (default 30)
   * @returns {Promise<boolean>} true if lock acquired
   */
  async acquireLock(lockName, ttl = 30) {
    if (!_redisClient) return true; // No Redis = no contention
    const key = `lock:${this.#key(lockName)}`;
    const result = await _redisClient.set(key, '1', 'EX', ttl, 'NX');
    return result === 'OK';
  }

  /**
   * Release a distributed lock.
   */
  async releaseLock(lockName) {
    if (!_redisClient) return;
    const key = `lock:${this.#key(lockName)}`;
    await _redisClient.del(key);
  }
}

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

/**
 * Get the underlying ioredis client. Returns null if not initialised.
 */
export function getRedisClient() {
  return _redisClient;
}
