import { createCache } from '@piece/cache';
import { createComponentLogger } from '../utils/logger.js';

const componentLogger = createComponentLogger('RateLimiter');

const cache = createCache({ prefix: 'ratelimit', defaultTTL: 60 });

/**
 * Create rate-limiting middleware using Redis cache.
 *
 * @param {{ maxRequests?: number, windowSeconds?: number }} options
 * @returns {Function} Express middleware
 */
export function createRateLimiter({ maxRequests = 100, windowSeconds = 60 } = {}) {
  return async (req, res, next) => {
    try {
      const key = `${req.ip}:${req.path}`;
      const current = await cache.get(key);

      if (current === null) {
        await cache.set(key, 1, windowSeconds);
        return next();
      }

      const count = Number(current) + 1;

      if (count > maxRequests) {
        res.set('Retry-After', String(windowSeconds));
        return res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
          retryAfter: windowSeconds,
        });
      }

      await cache.set(key, count, windowSeconds);
      next();
    } catch (err) {
      componentLogger.warn('Rate limiter error, allowing request', { error: err.message });
      next();
    }
  };
}
