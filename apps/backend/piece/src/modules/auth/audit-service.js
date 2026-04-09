import { getGlobalSystemCollection } from '@piece/multitenancy';
import { mongoIdUtils } from '@piece/validation/mongo';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('AuthAudit');

const AUTH_EVENTS = {
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  REGISTER: 'register',
  LOGOUT: 'logout',
  PASSWORD_CHANGE: 'password_change',
  MAGIC_LINK_SENT: 'magic_link_sent',
  MAGIC_LINK_VERIFIED: 'magic_link_verified',
  SESSION_REVOKED: 'session_revoked',
  ALL_SESSIONS_REVOKED: 'all_sessions_revoked',
  TOKEN_REFRESHED: 'token_refreshed',
  ACCOUNT_LOCKED: 'account_locked',
};

function getAuditCollection() {
  return getGlobalSystemCollection('auth_audit_log');
}

/**
 * Log an auth event. Fire-and-forget — never blocks the auth flow.
 *
 * @param {string} event - One of AUTH_EVENTS values
 * @param {{ userId?: string, email?: string, ip?: string, userAgent?: string, sessionId?: string, reason?: string }} metadata
 */
function logAuthEvent(event, { userId, email, ip, userAgent, sessionId, reason } = {}) {
  const doc = {
    event,
    userId: userId ? mongoIdUtils.toObjectId(userId) : null,
    email: email || null,
    metadata: {
      ip: ip || null,
      userAgent: userAgent || null,
      sessionId: sessionId || null,
      reason: reason || null,
    },
    createdAt: new Date(),
  };

  getAuditCollection()
    .insertOne(doc)
    .catch((err) => {
      componentLogger.warn('Failed to write audit log', { event, error: err.message });
    });
}

export const auditService = { logAuthEvent, AUTH_EVENTS };
