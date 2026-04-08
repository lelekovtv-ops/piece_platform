import { createLogger } from '@piece/logger';

const logger = createLogger({ serviceName: 'cache' });
const componentLogger = logger.createComponentLogger('ResendLimiter');

const DEFAULT_MAX_PER_DAY = 3;
const DAY_SECONDS = 24 * 60 * 60;

/**
 * Create a daily resend rate limiter backed by Redis.
 *
 * @param {Object} cache - Initialized cache instance
 * @param {Object} [options]
 * @param {number} [options.maxPerDay=3] - Max resends per email per day
 * @returns {{ canResend, recordResend }}
 */
export function createResendLimiter(cache, options = {}) {
  const maxPerDay = options.maxPerDay || DEFAULT_MAX_PER_DAY;

  function key(email) {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return `resend:${email.toLowerCase().trim()}:${date}`;
  }

  /**
   * Check if email can receive another resend today.
   * @param {string} email
   * @returns {Promise<{ allowed: boolean, remaining: number }>}
   */
  async function canResend(email) {
    try {
      const count = parseInt(await cache.get(key(email)), 10) || 0;
      return { allowed: count < maxPerDay, remaining: Math.max(0, maxPerDay - count) };
    } catch {
      return { allowed: true, remaining: maxPerDay };
    }
  }

  /**
   * Record a resend. Call after successfully sending verification email.
   * @param {string} email
   * @returns {Promise<{ count: number, remaining: number }>}
   */
  async function recordResend(email) {
    try {
      const k = key(email);
      const count = await cache.incr(k);
      await cache.expire(k, DAY_SECONDS);
      if (count >= maxPerDay) {
        componentLogger.warn('Resend limit reached', {
          email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
          count,
        });
      }
      return { count, remaining: Math.max(0, maxPerDay - count) };
    } catch {
      return { count: 0, remaining: maxPerDay };
    }
  }

  return { canResend, recordResend };
}
