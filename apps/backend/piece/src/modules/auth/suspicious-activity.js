import { getRedisClient } from '@piece/cache';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('SuspiciousActivity');

const FAILED_LOGIN_WINDOW_MS = 60 * 60 * 1000;
const FAILED_LOGIN_THRESHOLD = 10;
const UNIQUE_IP_THRESHOLD = 3;
const PREFIX = 'piece:suspicious:';

/**
 * Record a failed login attempt and check for suspicious patterns.
 * Pattern: 10+ failed logins from 3+ different IPs within 1 hour → alert.
 *
 * @param {string} email
 * @param {string} ip
 * @returns {Promise<boolean>} true if suspicious activity detected
 */
export async function recordFailedLoginAndCheck(email, ip) {
  const redis = getRedisClient();
  if (!redis) return false;

  try {
    const key = `${PREFIX}failed:${email.toLowerCase()}`;
    const now = Date.now();
    const windowStart = now - FAILED_LOGIN_WINDOW_MS;
    const member = `${ip}:${now}`;

    const pipeline = redis.pipeline();
    pipeline.zadd(key, now, member);
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zrangebyscore(key, windowStart, '+inf');
    pipeline.expire(key, 3600);
    const results = await pipeline.exec();

    const entries = results[2][1] || [];
    if (entries.length < FAILED_LOGIN_THRESHOLD) return false;

    const uniqueIps = new Set(entries.map((e) => e.split(':')[0]));
    if (uniqueIps.size >= UNIQUE_IP_THRESHOLD) {
      componentLogger.warn('Suspicious login activity detected', {
        email: email.toLowerCase(),
        failedAttempts: entries.length,
        uniqueIps: uniqueIps.size,
        window: '1h',
      });
      return true;
    }

    return false;
  } catch (err) {
    componentLogger.warn('Suspicious activity check failed', { error: err.message });
    return false;
  }
}

/**
 * Clear suspicious activity tracking for an email (e.g., after successful login).
 */
export async function clearSuspiciousTracking(email) {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(`${PREFIX}failed:${email.toLowerCase()}`);
  } catch {
    // Non-critical
  }
}
