import { UAParser } from 'ua-parser-js';
import { getGlobalSystemCollection } from '@piece/multitenancy';
import { mongoIdUtils } from '@piece/validation/mongo';
import { createComponentLogger } from '../../utils/logger.js';

const componentLogger = createComponentLogger('SessionService');

function getSessionsCollection() {
  return getGlobalSystemCollection('auth_sessions');
}

function parseUserAgent(userAgentString) {
  if (!userAgentString) {
    return { browser: 'Unknown', os: 'Unknown', deviceType: 'unknown', userAgent: '' };
  }
  const parser = new UAParser(userAgentString);
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = parser.getDevice();

  return {
    browser: [browser.name, browser.version].filter(Boolean).join(' ') || 'Unknown',
    os: [os.name, os.version].filter(Boolean).join(' ') || 'Unknown',
    deviceType: device.type || 'desktop',
    userAgent: userAgentString,
  };
}

const MAX_SESSIONS_PER_USER = 10;

async function createSession(userId, tokenHash, { ip, userAgent }) {
  const sessions = getSessionsCollection();
  const deviceInfo = parseUserAgent(userAgent);
  const now = new Date();

  const userObjectId = mongoIdUtils.toObjectId(userId);
  const activeCount = await sessions.countDocuments({ userId: userObjectId, revokedAt: null });

  if (activeCount >= MAX_SESSIONS_PER_USER) {
    const oldest = await sessions.findOne(
      { userId: userObjectId, revokedAt: null },
      { sort: { lastActiveAt: 1 } },
    );
    if (oldest) {
      await sessions.updateOne(
        { _id: oldest._id },
        { $set: { revokedAt: now } },
      );
      componentLogger.info('Oldest session revoked (max sessions reached)', {
        userId,
        revokedSessionId: mongoIdUtils.toApiString(oldest._id),
      });
    }
  }

  const result = await sessions.insertOne({
    userId: userObjectId,
    refreshTokenHash: tokenHash,
    deviceInfo,
    ip: ip || 'unknown',
    lastActiveAt: now,
    createdAt: now,
    revokedAt: null,
  });

  componentLogger.info('Session created', { userId, sessionId: mongoIdUtils.toApiString(result.insertedId) });
  return mongoIdUtils.toApiString(result.insertedId);
}

async function getActiveSessions(userId) {
  const sessions = getSessionsCollection();
  const docs = await sessions
    .find({
      userId: mongoIdUtils.toObjectId(userId),
      revokedAt: null,
    })
    .sort({ lastActiveAt: -1 })
    .toArray();

  return docs.map((s) => ({
    id: mongoIdUtils.toApiString(s._id),
    deviceInfo: {
      browser: s.deviceInfo?.browser || 'Unknown',
      os: s.deviceInfo?.os || 'Unknown',
      deviceType: s.deviceInfo?.deviceType || 'unknown',
    },
    ip: s.ip,
    lastActiveAt: s.lastActiveAt,
    createdAt: s.createdAt,
  }));
}

async function revokeSession(userId, sessionId) {
  const sessions = getSessionsCollection();

  const session = await sessions.findOne({
    _id: mongoIdUtils.toObjectId(sessionId),
    userId: mongoIdUtils.toObjectId(userId),
    revokedAt: null,
  });

  if (!session) return false;

  await sessions.updateOne(
    { _id: mongoIdUtils.toObjectId(sessionId) },
    { $set: { revokedAt: new Date() } },
  );

  if (session.refreshTokenHash) {
    const refreshTokens = getGlobalSystemCollection('refresh_tokens');
    await refreshTokens.deleteOne({ tokenHash: session.refreshTokenHash });
  }

  componentLogger.info('Session revoked', { userId, sessionId });
  return true;
}

async function revokeAllSessions(userId, exceptTokenHash) {
  const sessions = getSessionsCollection();
  const refreshTokens = getGlobalSystemCollection('refresh_tokens');

  const filter = {
    userId: mongoIdUtils.toObjectId(userId),
    revokedAt: null,
  };

  if (exceptTokenHash) {
    filter.refreshTokenHash = { $ne: exceptTokenHash };
  }

  const activeSessions = await sessions.find(filter).toArray();
  const tokenHashes = activeSessions
    .map((s) => s.refreshTokenHash)
    .filter(Boolean);

  if (tokenHashes.length > 0) {
    await refreshTokens.deleteMany({ tokenHash: { $in: tokenHashes } });
  }

  const result = await sessions.updateMany(filter, { $set: { revokedAt: new Date() } });

  componentLogger.info('All sessions revoked', { userId, count: result.modifiedCount });
  return result.modifiedCount;
}

async function updateLastActive(tokenHash) {
  const sessions = getSessionsCollection();
  await sessions.updateOne(
    { refreshTokenHash: tokenHash, revokedAt: null },
    { $set: { lastActiveAt: new Date() } },
  );
}

async function updateSessionTokenHash(oldTokenHash, newTokenHash) {
  const sessions = getSessionsCollection();
  await sessions.updateOne(
    { refreshTokenHash: oldTokenHash },
    { $set: { refreshTokenHash: newTokenHash, lastActiveAt: new Date() } },
  );
}

async function isNewDevice(userId, userAgent) {
  const sessions = getSessionsCollection();
  const deviceInfo = parseUserAgent(userAgent);

  const existing = await sessions.findOne({
    userId: mongoIdUtils.toObjectId(userId),
    'deviceInfo.browser': { $regex: new RegExp(`^${deviceInfo.browser.split(' ')[0]}`) },
    'deviceInfo.os': { $regex: new RegExp(`^${deviceInfo.os.split(' ')[0]}`) },
  });

  return !existing;
}

export const sessionService = {
  createSession,
  getActiveSessions,
  revokeSession,
  revokeAllSessions,
  updateLastActive,
  updateSessionTokenHash,
  isNewDevice,
};
