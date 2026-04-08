import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getGlobalSystemCollection } from '@piece/multitenancy';
import { mongoIdUtils } from '@piece/validation/mongo';
import { createComponentLogger } from '../../utils/logger.js';
import { config } from '../../config.js';

const componentLogger = createComponentLogger('AuthService');

const BCRYPT_ROUNDS = 12;
const PASSWORD_MIN_LENGTH = 8;

function getUsersCollection() {
  return getGlobalSystemCollection('users');
}

function getRefreshTokensCollection() {
  return getGlobalSystemCollection('refresh_tokens');
}

function getPrivateKey() {
  const base64 = config.get('JWT_PRIVATE_KEY_BASE64');
  if (!base64) {
    throw new Error('JWT_PRIVATE_KEY_BASE64 is not configured');
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

function signAccessToken(payload) {
  return jwt.sign(payload, getPrivateKey(), {
    algorithm: 'RS256',
    expiresIn: config.get('JWT_EXPIRES_IN'),
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, config.get('JWT_REFRESH_SECRET'), {
    algorithm: 'HS256',
    expiresIn: config.get('JWT_REFRESH_EXPIRES_IN'),
  });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, config.get('JWT_REFRESH_SECRET'), {
    algorithms: ['HS256'],
  });
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: mongoIdUtils.toApiString(user._id),
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl || null,
    language: user.language || 'en',
    emailVerified: user.emailVerified || false,
    createdAt: user.createdAt,
  };
}

async function register({ email, password, name }) {
  const users = getUsersCollection();
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await users.findOne({ email: normalizedEmail });
  if (existing) {
    const error = new Error('Email is already registered');
    error.code = 'EMAIL_TAKEN';
    throw error;
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    const error = new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    error.code = 'WEAK_PASSWORD';
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const now = new Date();
  const result = await users.insertOne({
    email: normalizedEmail,
    name: name?.trim() || normalizedEmail.split('@')[0],
    passwordHash,
    avatarUrl: null,
    language: 'en',
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });

  const userId = mongoIdUtils.toApiString(result.insertedId);
  const accessToken = signAccessToken({ sub: userId, email: normalizedEmail });
  const refreshToken = signRefreshToken({ sub: userId, type: 'refresh' });

  await getRefreshTokensCollection().insertOne({
    userId: result.insertedId,
    token: refreshToken,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
  });

  componentLogger.info('User registered', { userId, email: normalizedEmail });

  const user = await users.findOne({ _id: result.insertedId });

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
}

async function login({ email, password }) {
  const users = getUsersCollection();

  const user = await users.findOne({ email: email.toLowerCase() });
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  const userId = mongoIdUtils.toApiString(user._id);

  const accessToken = signAccessToken({ sub: userId, email: user.email });
  const refreshToken = signRefreshToken({ sub: userId, type: 'refresh' });

  const now = new Date();
  await getRefreshTokensCollection().insertOne({
    userId: user._id,
    token: refreshToken,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
  });

  componentLogger.info('User logged in', { userId, email: user.email });

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
}

async function refreshAccessToken(token) {
  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    return null;
  }

  if (decoded.type !== 'refresh') return null;

  const stored = await getRefreshTokensCollection().findOne({ token });
  if (!stored) return null;

  const users = getUsersCollection();
  const user = await users.findOne({ _id: mongoIdUtils.toObjectId(decoded.sub) });
  if (!user) return null;

  await getRefreshTokensCollection().deleteOne({ token });

  const userId = mongoIdUtils.toApiString(user._id);
  const accessToken = signAccessToken({ sub: userId, email: user.email });
  const newRefreshToken = signRefreshToken({ sub: userId, type: 'refresh' });

  const now = new Date();
  await getRefreshTokensCollection().insertOne({
    userId: user._id,
    token: newRefreshToken,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
  });

  return { accessToken, refreshToken: newRefreshToken };
}

async function issueTokensForUser(user) {
  const userId = mongoIdUtils.toApiString(user._id);
  const accessToken = signAccessToken({ sub: userId, email: user.email });
  const refreshToken = signRefreshToken({ sub: userId, type: 'refresh' });

  const now = new Date();
  await getRefreshTokensCollection().insertOne({
    userId: user._id,
    token: refreshToken,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
  });

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
}

async function logout(refreshToken) {
  if (refreshToken) {
    await getRefreshTokensCollection().deleteOne({ token: refreshToken });
  }
}

async function getProfile(userId) {
  const users = getUsersCollection();
  const user = await users.findOne({ _id: mongoIdUtils.toObjectId(userId) });
  return sanitizeUser(user);
}

export const authService = {
  register,
  login,
  issueTokensForUser,
  refreshAccessToken,
  logout,
  getProfile,
};
