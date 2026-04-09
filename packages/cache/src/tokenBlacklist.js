/**
 * Token blacklist for immediate access token revocation.
 *
 * Stores blacklisted JTI (JWT ID) values in Redis with TTL matching
 * the remaining token lifetime. When Redis is unavailable, fails open
 * since access tokens are short-lived (15 min).
 */

/**
 * @param {import('ioredis').Redis} redis
 * @returns {{ blacklist: Function, isBlacklisted: Function }}
 */
export function createTokenBlacklist(redis) {
  const PREFIX = 'piece:bl:';

  async function blacklist(jti, ttlSeconds) {
    if (!redis || !jti) return;
    try {
      await redis.set(`${PREFIX}${jti}`, '1', 'EX', ttlSeconds);
    } catch {
      // Fail open — access tokens are short-lived
    }
  }

  async function isBlacklisted(jti) {
    if (!redis || !jti) return false;
    try {
      const result = await redis.exists(`${PREFIX}${jti}`);
      return result === 1;
    } catch {
      return false;
    }
  }

  return { blacklist, isBlacklisted };
}
