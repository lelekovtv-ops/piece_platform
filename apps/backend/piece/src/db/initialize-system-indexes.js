import { getGlobalSystemCollection } from '@piece/multitenancy';

export async function initializeSystemIndexes() {
  const users = getGlobalSystemCollection('users');
  await users.createIndex({ email: 1 }, { unique: true, sparse: true });
  await users.createIndex({ createdAt: -1 });

  const teams = getGlobalSystemCollection('teams');
  await teams.createIndex({ ownerId: 1 });
  await teams.createIndex({ createdAt: -1 });

  const teamMembers = getGlobalSystemCollection('team_members');
  await teamMembers.createIndex({ teamId: 1, userId: 1 }, { unique: true });
  await teamMembers.createIndex({ userId: 1 });

  const userSettings = getGlobalSystemCollection('user_settings');
  await userSettings.createIndex({ userId: 1, storeKey: 1 }, { unique: true });

  const refreshTokens = getGlobalSystemCollection('refresh_tokens');
  await refreshTokens.createIndex({ tokenHash: 1 });
  await refreshTokens.createIndex({ userId: 1 });
  await refreshTokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await refreshTokens.createIndex({ replacedHash: 1 }, { sparse: true });

  const authSessions = getGlobalSystemCollection('auth_sessions');
  await authSessions.createIndex({ userId: 1, revokedAt: 1 });
  await authSessions.createIndex({ refreshTokenHash: 1 });
  await authSessions.createIndex({ lastActiveAt: -1 });
  await authSessions.createIndex({ revokedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { revokedAt: { $type: 'date' } } });

  const authAuditLog = getGlobalSystemCollection('auth_audit_log');
  await authAuditLog.createIndex({ userId: 1, createdAt: -1 });
  await authAuditLog.createIndex({ event: 1, createdAt: -1 });
  await authAuditLog.createIndex({ email: 1, createdAt: -1 });
  await authAuditLog.createIndex({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
}
