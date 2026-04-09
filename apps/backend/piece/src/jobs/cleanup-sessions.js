import { getGlobalSystemCollection } from '@piece/multitenancy';
import { createComponentLogger } from '../utils/logger.js';

const componentLogger = createComponentLogger('SessionCleanup');

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const REVOKED_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

let cleanupTimer = null;

async function runCleanup() {
  try {
    const sessions = getGlobalSystemCollection('auth_sessions');
    const refreshTokens = getGlobalSystemCollection('refresh_tokens');

    const cutoff = new Date(Date.now() - REVOKED_SESSION_MAX_AGE_MS);

    const revokedResult = await sessions.deleteMany({
      revokedAt: { $ne: null, $lt: cutoff },
    });

    const orphanedResult = await sessions.deleteMany({
      refreshTokenHash: null,
      createdAt: { $lt: cutoff },
    });

    const expiredTokens = await refreshTokens.deleteMany({
      expiresAt: { $lt: new Date() },
    });

    const totalCleaned = (revokedResult.deletedCount || 0)
      + (orphanedResult.deletedCount || 0)
      + (expiredTokens.deletedCount || 0);

    if (totalCleaned > 0) {
      componentLogger.info('Session cleanup completed', {
        revokedSessions: revokedResult.deletedCount,
        orphanedSessions: orphanedResult.deletedCount,
        expiredTokens: expiredTokens.deletedCount,
      });
    }
  } catch (err) {
    componentLogger.error('Session cleanup failed', { error: err.message });
  }
}

export function startSessionCleanup() {
  if (cleanupTimer) return;

  runCleanup();

  cleanupTimer = setInterval(runCleanup, CLEANUP_INTERVAL_MS);
  componentLogger.info('Session cleanup job started', { intervalMs: CLEANUP_INTERVAL_MS });
}

export function stopSessionCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
