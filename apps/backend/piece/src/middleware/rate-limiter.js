import { getRedisClient } from '@piece/cache';
import { createComponentLogger } from '../utils/logger.js';

const componentLogger = createComponentLogger('RateLimiter');

const memoryStore = new Map();
const MEMORY_CLEANUP_INTERVAL_MS = 60_000;
const MEMORY_MAP_SIZE_LIMIT = 10_000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
}, MEMORY_CLEANUP_INTERVAL_MS);

/**
 * Sliding window rate limiter using Redis sorted sets.
 * Falls back to in-memory fixed window when Redis is unavailable.
 */
export function createRateLimiter({ maxRequests = 100, windowSeconds = 60 } = {}) {
  return async (req, res, next) => {
    const key = `piece:rl:${req.ip}:${req.path}`;
    const redis = getRedisClient();

    if (redis) {
      try {
        const now = Date.now();
        const windowStart = now - windowSeconds * 1000;

        const pipeline = redis.pipeline();
        pipeline.zremrangebyscore(key, 0, windowStart);
        pipeline.zadd(key, now, `${now}:${Math.random()}`);
        pipeline.zcard(key);
        pipeline.expire(key, windowSeconds);

        const results = await pipeline.exec();
        const count = results[2][1];

        if (count > maxRequests) {
          res.set('Retry-After', String(windowSeconds));
          return res.status(429).json({
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
            retryAfter: windowSeconds,
          });
        }

        return next();
      } catch {
        // Fall through to memory fallback
      }
    }

    const now = Date.now();
    const entry = memoryStore.get(key);

    if (!entry || entry.expiresAt <= now) {
      if (memoryStore.size >= MEMORY_MAP_SIZE_LIMIT) {
        const oldestKey = memoryStore.keys().next().value;
        memoryStore.delete(oldestKey);
      }
      memoryStore.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
      return next();
    }

    entry.count += 1;

    if (entry.count > maxRequests) {
      componentLogger.warn('Rate limit exceeded (memory fallback)', { ip: req.ip, path: req.path });
      res.set('Retry-After', String(windowSeconds));
      return res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        retryAfter: windowSeconds,
      });
    }

    next();
  };
}
