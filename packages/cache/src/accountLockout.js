import { createLogger } from '@piece/logger';

const logger = createLogger({ serviceName: 'cache' });
const componentLogger = logger.createComponentLogger('AccountLockout');

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_LOCKOUT_SECONDS = 15 * 60; // 15 minutes

/**
 * Create an account lockout tracker backed by Redis.
 *
 * @param {Object} cache - Initialized cache instance (from @piece/cache)
 * @param {Object} [options]
 * @param {number} [options.maxAttempts=5] - Failed attempts before lockout
 * @param {number} [options.lockoutSeconds=900] - Lockout duration in seconds
 * @returns {{ isLocked, recordFailedAttempt, resetAttempts }}
 */
export function createAccountLockout(cache, options = {}) {
  const maxAttempts = options.maxAttempts || DEFAULT_MAX_ATTEMPTS;
  const lockoutSeconds = options.lockoutSeconds || DEFAULT_LOCKOUT_SECONDS;

  function key(email) {
    return `lockout:${email.toLowerCase().trim()}`;
  }

  /**
   * Check if account is locked due to too many failed attempts.
   * @param {string} email
   * @returns {Promise<{ locked: boolean, attemptsLeft: number, ttl: number }>}
   */
  async function isLocked(email) {
    try {
      const attempts = await cache.get(key(email));
      const count = parseInt(attempts, 10) || 0;
      if (count >= maxAttempts) {
        const ttl = await cache.ttl(key(email));
        return { locked: true, attemptsLeft: 0, ttl: ttl > 0 ? ttl : lockoutSeconds };
      }
      return { locked: false, attemptsLeft: maxAttempts - count, ttl: 0 };
    } catch {
      // Fail open — don't block login if Redis is down
      return { locked: false, attemptsLeft: maxAttempts, ttl: 0 };
    }
  }

  /**
   * Record a failed login attempt. Returns lockout status after recording.
   * @param {string} email
   * @returns {Promise<{ locked: boolean, attempts: number, attemptsLeft: number }>}
   */
  async function recordFailedAttempt(email) {
    try {
      const k = key(email);
      const attempts = await cache.incr(k);
      // Set TTL on first attempt (or refresh on each attempt)
      await cache.expire(k, lockoutSeconds);
      const locked = attempts >= maxAttempts;
      if (locked) {
        componentLogger.warn('Account locked due to failed attempts', {
          email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
          attempts,
        });
      }
      return { locked, attempts, attemptsLeft: Math.max(0, maxAttempts - attempts) };
    } catch {
      return { locked: false, attempts: 0, attemptsLeft: maxAttempts };
    }
  }

  /**
   * Reset failed attempts counter (call on successful login).
   * @param {string} email
   */
  async function resetAttempts(email) {
    try {
      await cache.del(key(email));
    } catch {
      // Non-critical — counter will expire naturally
    }
  }

  return { isLocked, recordFailedAttempt, resetAttempts };
}
