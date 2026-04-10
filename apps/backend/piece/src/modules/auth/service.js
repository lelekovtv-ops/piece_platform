import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getGlobalSystemCollection } from '@piece/multitenancy';
import { mongoIdUtils } from '@piece/validation/mongo';
import { createComponentLogger } from '../../utils/logger.js';
import { config } from '../../config.js';
import { teamService } from '../teams/service.js';
import { hashToken } from './utils.js';

const componentLogger = createComponentLogger('AuthService');

const BCRYPT_ROUNDS = 12;
const PASSWORD_MIN_LENGTH = 8;
const REFRESH_TOKEN_GRACE_PERIOD_MS = 30_000;

let _emailVerifyCache = null;
let _pwdResetCache = null;

async function getEmailVerifyCache() {
  if (!_emailVerifyCache) {
    const { createCache, StandardTTL } = await import('@piece/cache');
    _emailVerifyCache = createCache({ prefix: 'email-verify', defaultTTL: StandardTTL.verification });
  }
  return _emailVerifyCache;
}

async function getPwdResetCache() {
  if (!_pwdResetCache) {
    const { createCache } = await import('@piece/cache');
    _pwdResetCache = createCache({ prefix: 'pwd-reset', defaultTTL: 3600 });
  }
  return _pwdResetCache;
}

function getUsersCollection() {
  return getGlobalSystemCollection('users');
}

function getRefreshTokensCollection() {
  return getGlobalSystemCollection('refresh_tokens');
}

let _cachedPrivateKey = null;

function getPrivateKey() {
  if (_cachedPrivateKey) return _cachedPrivateKey;
  const base64 = config.get('JWT_PRIVATE_KEY_BASE64');
  if (!base64) {
    throw new Error('JWT_PRIVATE_KEY_BASE64 is not configured');
  }
  _cachedPrivateKey = Buffer.from(base64, 'base64').toString('utf8');
  return _cachedPrivateKey;
}

function signAccessToken(payload) {
  const jti = crypto.randomUUID();
  return jwt.sign({ ...payload, jti }, getPrivateKey(), {
    algorithm: 'RS256',
    expiresIn: config.get('JWT_EXPIRES_IN'),
    keyid: 'v1',
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

async function resolveUserRole(userId) {
  try {
    const teams = await teamService.listByUser(userId);
    return teams?.[0]?.role || 'manager';
  } catch (error) {
    componentLogger.warn('Failed to resolve user role for token', { userId, error: error.message });
    return 'manager';
  }
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
    emailVerified: config.get('DISABLE_EMAIL_SENDING') === 'true',
    createdAt: now,
    updatedAt: now,
  });

  const userId = mongoIdUtils.toApiString(result.insertedId);

  try {
    const teamName = name?.trim() || normalizedEmail.split('@')[0];
    await teamService.create({ name: `${teamName}'s Team`, ownerId: userId });
    componentLogger.info('Personal team created for user', { userId });
  } catch (teamError) {
    componentLogger.warn('Failed to create personal team', { userId, error: teamError.message });
  }

  const role = await resolveUserRole(userId);
  const accessToken = signAccessToken({ sub: userId, email: normalizedEmail, role });
  const refreshToken = signRefreshToken({ sub: userId, type: 'refresh' });

  await getRefreshTokensCollection().insertOne({
    userId: result.insertedId,
    tokenHash: hashToken(refreshToken),
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
  const role = await resolveUserRole(userId);

  const accessToken = signAccessToken({ sub: userId, email: user.email, role });
  const refreshToken = signRefreshToken({ sub: userId, type: 'refresh' });

  const now = new Date();
  const refreshTokens = getRefreshTokensCollection();

  await refreshTokens.deleteMany({
    userId: user._id,
    createdAt: { $lt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
  });

  await refreshTokens.insertOne({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
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

  const tokenHash = hashToken(token);
  const refreshTokens = getRefreshTokensCollection();

  const stored = await refreshTokens.findOne({ tokenHash });
  if (!stored) {
    const replaced = await refreshTokens.findOne({
      replacedHash: tokenHash,
      replacedAt: { $gte: new Date(Date.now() - REFRESH_TOKEN_GRACE_PERIOD_MS) },
    });
    if (replaced) {
      const users = getUsersCollection();
      const user = await users.findOne({ _id: replaced.userId });
      if (!user) return null;
      const replacedUserId = mongoIdUtils.toApiString(user._id);
      const role = await resolveUserRole(replacedUserId);
      return { accessToken: signAccessToken({ sub: replacedUserId, email: user.email, role }), refreshToken: token };
    }

    const staleReuse = await refreshTokens.findOne({ replacedHash: tokenHash });
    if (staleReuse) {
      componentLogger.warn('Refresh token reuse detected outside grace period — revoking all user tokens', {
        userId: mongoIdUtils.toApiString(staleReuse.userId),
      });
      await refreshTokens.deleteMany({ userId: staleReuse.userId });
    }

    return null;
  }

  const users = getUsersCollection();
  const user = await users.findOne({ _id: mongoIdUtils.toObjectId(decoded.sub) });
  if (!user) return null;

  const userId = mongoIdUtils.toApiString(user._id);
  const role = await resolveUserRole(userId);
  const accessToken = signAccessToken({ sub: userId, email: user.email, role });
  const newRefreshToken = signRefreshToken({ sub: userId, type: 'refresh' });

  const now = new Date();
  const newTokenHash = hashToken(newRefreshToken);

  const result = await refreshTokens.findOneAndUpdate(
    { tokenHash },
    { $set: { tokenHash: newTokenHash, replacedHash: tokenHash, replacedAt: now, createdAt: now, expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) } },
    { returnDocument: 'after' },
  );

  if (!result) {
    componentLogger.warn('Concurrent refresh token rotation detected', { userId });
    return null;
  }

  return { accessToken, refreshToken: newRefreshToken };
}

async function issueTokensForUser(user) {
  const userId = mongoIdUtils.toApiString(user._id);
  const role = await resolveUserRole(userId);
  const accessToken = signAccessToken({ sub: userId, email: user.email, role });
  const refreshToken = signRefreshToken({ sub: userId, type: 'refresh' });

  const now = new Date();
  await getRefreshTokensCollection().insertOne({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
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
    await getRefreshTokensCollection().deleteOne({ tokenHash: hashToken(refreshToken) });
  }
}

async function getProfile(userId) {
  const users = getUsersCollection();
  const user = await users.findOne({ _id: mongoIdUtils.toObjectId(userId) });
  return sanitizeUser(user);
}

async function changePassword(userId, currentPassword, newPassword, exceptTokenHash) {
  const users = getUsersCollection();
  const user = await users.findOne({ _id: mongoIdUtils.toObjectId(userId) });

  if (!user) {
    const error = new Error('User not found');
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    const error = new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    error.code = 'WEAK_PASSWORD';
    throw error;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    const error = new Error('Current password is incorrect');
    error.code = 'WRONG_PASSWORD';
    throw error;
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await users.updateOne(
    { _id: mongoIdUtils.toObjectId(userId) },
    { $set: { passwordHash: newHash, updatedAt: new Date() } },
  );

  await revokeAllUserTokens(userId, exceptTokenHash);
  componentLogger.info('Password changed, other sessions revoked', { userId });
}

async function revokeAllUserTokens(userId, exceptTokenHash) {
  const refreshTokens = getRefreshTokensCollection();
  const filter = { userId: mongoIdUtils.toObjectId(userId) };
  if (exceptTokenHash) {
    filter.tokenHash = { $ne: exceptTokenHash };
  }
  await refreshTokens.deleteMany(filter);
}

async function generateEmailVerificationToken(userId) {
  const { StandardTTL } = await import('@piece/cache');
  const cache = await getEmailVerifyCache();

  const users = getUsersCollection();
  const user = await users.findOne({ _id: mongoIdUtils.toObjectId(userId) });
  if (!user) {
    const error = new Error('User not found');
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  if (user.emailVerified) {
    return { alreadyVerified: true };
  }

  const token = crypto.randomBytes(32).toString('hex');
  await cache.set(token, { userId, email: user.email }, StandardTTL.verification);

  const frontendUrl = config.get('FRONTEND_URL');
  const verificationUrl = `${frontendUrl}/auth/verify?token=${token}&type=email`;

  if (config.get('NODE_ENV') === 'development' || config.get('DISABLE_EMAIL_SENDING') === 'true') {
    componentLogger.info('DEV email verification URL', { url: verificationUrl, email: user.email });
  }

  return { token, url: verificationUrl, email: user.email };
}

async function verifyEmailToken(token) {
  const cache = await getEmailVerifyCache();

  const data = await cache.get(token);
  if (!data) return null;

  await cache.del(token);

  const users = getUsersCollection();
  await users.updateOne(
    { _id: mongoIdUtils.toObjectId(data.userId) },
    { $set: { emailVerified: true, updatedAt: new Date() } },
  );

  componentLogger.info('Email verified', { userId: data.userId, email: data.email });
  return { userId: data.userId, email: data.email };
}

async function sendVerificationEmail(email, verificationUrl) {
  const { sendEmail } = await import('@piece/email');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #0E0D0C;">
      <h2 style="color: #E7E3DC; margin-bottom: 8px;">Verify your email</h2>
      <p style="color: #999; margin-bottom: 32px;">Click the button below to verify your email address. This link expires in 15 minutes.</p>
      <a href="${verificationUrl}" style="display: inline-block; background: #D4A853; color: #0E0D0C; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Verify Email
      </a>
      <p style="color: #666; font-size: 13px; margin-top: 32px;">If you didn't create an account, you can safely ignore this email.</p>
      <p style="color: #444; font-size: 12px; margin-top: 24px;">Or paste this link in your browser:<br/><span style="color: #D4A853; word-break: break-all;">${verificationUrl}</span></p>
    </div>
  `;

  await sendEmail(email, 'Verify your email — PIECE', html);
  componentLogger.info('Verification email sent', { email });
}

async function generateAndSendVerificationEmail(userId, email) {
  const result = await generateEmailVerificationToken(userId);
  if (result.alreadyVerified) return;
  await sendVerificationEmail(email, result.url);
}

async function requestPasswordReset(email) {
  const cache = await getPwdResetCache();

  const users = getUsersCollection();
  const user = await users.findOne({ email: email.toLowerCase().trim() });

  if (!user) {
    componentLogger.info('Password reset requested for unknown email', { email });
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const userId = mongoIdUtils.toApiString(user._id);
  await cache.set(token, { userId, email: user.email }, 3600);

  const frontendUrl = config.get('FRONTEND_URL');
  const resetUrl = `${frontendUrl}/auth/reset-password?token=${token}`;

  if (config.get('NODE_ENV') === 'development' || config.get('DISABLE_EMAIL_SENDING') === 'true') {
    componentLogger.info('DEV password reset URL', { url: resetUrl, email: user.email });
  }

  try {
    const { sendEmail } = await import('@piece/email');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #0E0D0C;">
        <h2 style="color: #E7E3DC; margin-bottom: 8px;">Reset your password</h2>
        <p style="color: #999; margin-bottom: 32px;">Click the button below to set a new password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display: inline-block; background: #D4A853; color: #0E0D0C; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Reset Password
        </a>
        <p style="color: #666; font-size: 13px; margin-top: 32px;">If you didn't request this, you can safely ignore this email.</p>
        <p style="color: #444; font-size: 12px; margin-top: 24px;">Or paste this link in your browser:<br/><span style="color: #D4A853; word-break: break-all;">${resetUrl}</span></p>
      </div>
    `;

    await sendEmail(user.email, 'Reset your password — PIECE', html);
    componentLogger.info('Password reset email sent', { email: user.email });
  } catch (err) {
    componentLogger.error('Failed to send password reset email', { email: user.email, error: err.message });
  }
}

async function confirmPasswordReset(token, newPassword) {
  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    const error = new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    error.code = 'WEAK_PASSWORD';
    throw error;
  }

  const cache = await getPwdResetCache();

  const data = await cache.get(token);
  if (!data) {
    const error = new Error('Reset link is invalid or expired');
    error.code = 'INVALID_TOKEN';
    throw error;
  }

  await cache.del(token);

  const users = getUsersCollection();
  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await users.updateOne(
    { _id: mongoIdUtils.toObjectId(data.userId) },
    { $set: { passwordHash: newHash, updatedAt: new Date() } },
  );

  const refreshTokens = getRefreshTokensCollection();
  await refreshTokens.deleteMany({ userId: mongoIdUtils.toObjectId(data.userId) });

  componentLogger.info('Password reset confirmed', { userId: data.userId });
  return { userId: data.userId };
}

export const authService = {
  register,
  login,
  issueTokensForUser,
  refreshAccessToken,
  logout,
  getProfile,
  changePassword,
  generateEmailVerificationToken,
  verifyEmailToken,
  sendVerificationEmail,
  generateAndSendVerificationEmail,
  requestPasswordReset,
  confirmPasswordReset,
  revokeAllUserTokens,
};
