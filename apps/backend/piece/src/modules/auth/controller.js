import { authService } from "./service.js";
import { sessionService } from "./session-service.js";
import { auditService } from "./audit-service.js";
import { inviteService } from "../teams/invite-service.js";
import {
  recordFailedLoginAndCheck,
  clearSuspiciousTracking,
} from "./suspicious-activity.js";
import {
  generateMagicLink,
  sendMagicLinkEmail,
  verifyMagicLink,
} from "./magic-link-service.js";
import { validateEmailDomain, validateMxRecord } from "@piece/validation/email";
import { createAccountLockout } from "@piece/cache/accountLockout";
import { createResendLimiter } from "@piece/cache/resendLimiter";
import { getRedisClient } from "@piece/cache";
import { createComponentLogger } from "../../utils/logger.js";
import { generateCsrfToken, setCsrfCookie } from "../../middleware/csrf.js";
import { config } from "../../config.js";
import { hashToken } from "./utils.js";

const componentLogger = createComponentLogger("AuthController");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;

function getRequestMeta(req) {
  return { ip: req.ip, userAgent: req.headers["user-agent"] || "" };
}
const REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function setRefreshTokenCookie(res, refreshToken) {
  res.cookie("piece_rt", refreshToken, {
    httpOnly: true,
    secure: config.get("NODE_ENV") === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
}

function clearRefreshTokenCookie(res) {
  res.clearCookie("piece_rt", {
    httpOnly: true,
    secure: config.get("NODE_ENV") === "production",
    sameSite: "lax",
    path: "/",
  });
}

let _lockout = null;
let _magicLinkLimiter = null;
let _verificationLimiter = null;
let _resetLimiter = null;

const MEMORY_LOCKOUT_MAX = 5;
const MEMORY_LOCKOUT_TTL_MS = 900_000;
const MEMORY_MAP_SIZE_LIMIT = 10_000;
const memoryLockout = new Map();

function enforceMapSizeLimit(map) {
  if (map.size >= MEMORY_MAP_SIZE_LIMIT) {
    const oldestKey = map.keys().next().value;
    map.delete(oldestKey);
  }
}

function getLockout() {
  if (!_lockout) {
    const redis = getRedisClient();
    if (redis) {
      _lockout = createAccountLockout(redis, {
        maxAttempts: 5,
        lockoutSeconds: 900,
      });
    }
  }
  return _lockout;
}

function getMemoryLockoutEntry(email) {
  const key = email.toLowerCase();
  const entry = memoryLockout.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryLockout.delete(key);
    return null;
  }
  return entry;
}

function recordMemoryFailedAttempt(email) {
  const key = email.toLowerCase();
  enforceMapSizeLimit(memoryLockout);
  const entry = memoryLockout.get(key) || {
    count: 0,
    expiresAt: Date.now() + MEMORY_LOCKOUT_TTL_MS,
  };
  entry.count += 1;
  entry.expiresAt = Date.now() + MEMORY_LOCKOUT_TTL_MS;
  memoryLockout.set(key, entry);
}

function resetMemoryLockout(email) {
  memoryLockout.delete(email.toLowerCase());
}

function getMagicLinkLimiter() {
  if (!_magicLinkLimiter) {
    const redis = getRedisClient();
    if (redis) {
      _magicLinkLimiter = createResendLimiter(redis, { maxPerDay: 3 });
    }
  }
  return _magicLinkLimiter;
}

function getVerificationLimiter() {
  if (!_verificationLimiter) {
    const redis = getRedisClient();
    if (redis) {
      _verificationLimiter = createResendLimiter(redis, {
        maxPerDay: 5,
        prefix: "verify",
      });
    }
  }
  return _verificationLimiter;
}

function getResetLimiter() {
  if (!_resetLimiter) {
    const redis = getRedisClient();
    if (redis) {
      _resetLimiter = createResendLimiter(redis, {
        maxPerDay: 5,
        prefix: "pwd-reset",
      });
    }
  }
  return _resetLimiter;
}

async function register(req, res) {
  try {
    const { email, password, name } = req.body;

    const details = [];
    if (!email) details.push('Field "email" is required');
    if (!password) details.push('Field "password" is required');
    if (email && !EMAIL_REGEX.test(email)) details.push("Invalid email format");
    if (password && password.length < PASSWORD_MIN_LENGTH) {
      details.push(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      );
    }

    if (details.length > 0) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid input data",
        details,
      });
    }

    try {
      validateEmailDomain(email);
    } catch {
      return res.status(400).json({
        error: "DISPOSABLE_EMAIL",
        message: "Disposable email addresses are not allowed",
      });
    }

    const hasMx = await validateMxRecord(email);
    if (!hasMx) {
      return res.status(400).json({
        error: "INVALID_EMAIL_DOMAIN",
        message: "Email domain does not accept mail",
      });
    }

    const result = await authService.register({ email, password, name });
    const meta = getRequestMeta(req);
    componentLogger.info("User registered", { email: email.toLowerCase() });
    await sessionService.createSession(
      result.user.id,
      hashToken(result.refreshToken),
      meta,
    );
    auditService.logAuthEvent(auditService.AUTH_EVENTS.REGISTER, {
      userId: result.user.id,
      email: email.toLowerCase(),
      ...meta,
    });
    setRefreshTokenCookie(res, result.refreshToken);
    setCsrfCookie(res, generateCsrfToken());

    if (config.get("DISABLE_EMAIL_SENDING") !== "true") {
      authService
        .generateAndSendVerificationEmail(result.user.id, email.toLowerCase())
        .catch((err) => {
          componentLogger.warn(
            "Failed to send verification email on register",
            { error: err.message },
          );
        });
    }

    res
      .status(201)
      .json({ user: result.user, accessToken: result.accessToken });
  } catch (error) {
    if (error.code === "EMAIL_TAKEN") {
      componentLogger.info("Registration attempt with existing email", {
        email: req.body?.email?.toLowerCase(),
      });
      return res.status(201).json({
        user: { email: req.body.email.toLowerCase() },
        accessToken: null,
      });
    }
    if (error.code === "WEAK_PASSWORD") {
      return res
        .status(400)
        .json({ error: "VALIDATION_ERROR", message: error.message });
    }
    componentLogger.error("Registration failed", { error: error.message });
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Registration failed" });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Email and password are required",
      });
    }

    const meta = getRequestMeta(req);
    const lockout = getLockout();
    if (lockout) {
      const { locked, ttl } = await lockout.isLocked(email);
      if (locked) {
        auditService.logAuthEvent(auditService.AUTH_EVENTS.ACCOUNT_LOCKED, {
          email,
          ...meta,
          reason: "too_many_attempts",
        });
        return res.status(429).json({
          error: "ACCOUNT_LOCKED",
          message: "Too many failed login attempts. Please try again later.",
          retryAfter: ttl,
        });
      }
    } else {
      const memEntry = getMemoryLockoutEntry(email);
      if (memEntry && memEntry.count >= MEMORY_LOCKOUT_MAX) {
        auditService.logAuthEvent(auditService.AUTH_EVENTS.ACCOUNT_LOCKED, {
          email,
          ...meta,
          reason: "too_many_attempts",
        });
        return res.status(429).json({
          error: "ACCOUNT_LOCKED",
          message: "Too many failed login attempts. Please try again later.",
          retryAfter: Math.ceil((memEntry.expiresAt - Date.now()) / 1000),
        });
      }
    }

    const result = await authService.login({ email, password });
    if (!result) {
      if (lockout) {
        await lockout.recordFailedAttempt(email);
      } else {
        recordMemoryFailedAttempt(email);
      }
      auditService.logAuthEvent(auditService.AUTH_EVENTS.LOGIN_FAILED, {
        email,
        ...meta,
        reason: "invalid_credentials",
      });
      recordFailedLoginAndCheck(email, meta.ip).catch(() => {});
      return res
        .status(401)
        .json({ error: "UNAUTHORIZED", message: "Invalid credentials" });
    }

    if (lockout) {
      await lockout.resetAttempts(email);
    } else {
      resetMemoryLockout(email);
    }

    componentLogger.info("User logged in", { email });
    await sessionService.createSession(
      result.user.id,
      hashToken(result.refreshToken),
      meta,
    );
    auditService.logAuthEvent(auditService.AUTH_EVENTS.LOGIN_SUCCESS, {
      userId: result.user.id,
      email,
      ...meta,
    });
    clearSuspiciousTracking(email).catch(() => {});
    setRefreshTokenCookie(res, result.refreshToken);
    setCsrfCookie(res, generateCsrfToken());
    res.json({ user: result.user, accessToken: result.accessToken });
  } catch (error) {
    componentLogger.error("Login failed", { error: error.message });
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Login failed" });
  }
}

async function refresh(req, res) {
  try {
    const refreshToken = req.cookies?.piece_rt || req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Refresh token is required",
      });
    }

    const oldTokenHash = hashToken(refreshToken);
    const result = await authService.refreshAccessToken(refreshToken);
    if (!result) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        error: "TOKEN_EXPIRED",
        message: "Invalid or expired refresh token",
      });
    }

    const newTokenHash = hashToken(result.refreshToken);
    await sessionService
      .updateSessionTokenHash(oldTokenHash, newTokenHash)
      .catch(() => {});

    setRefreshTokenCookie(res, result.refreshToken);
    setCsrfCookie(res, generateCsrfToken());
    res.json({ accessToken: result.accessToken });
  } catch (error) {
    componentLogger.error("Token refresh failed", { error: error.message });
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Token refresh failed" });
  }
}

async function logout(req, res) {
  try {
    const refreshToken = req.cookies?.piece_rt || req.body?.refreshToken;
    await authService.logout(refreshToken);

    if (req.user?.jti && req.user?.exp) {
      try {
        const { getTokenBlacklist } = await import("../../index.js");
        const blacklist = getTokenBlacklist();
        if (blacklist) {
          const remainingTtl = Math.max(
            0,
            req.user.exp - Math.floor(Date.now() / 1000),
          );
          if (remainingTtl > 0) {
            await blacklist.blacklist(req.user.jti, remainingTtl);
          }
        }
      } catch {
        componentLogger.warn("Failed to blacklist access token on logout");
      }
    }

    clearRefreshTokenCookie(res);
    auditService.logAuthEvent(auditService.AUTH_EVENTS.LOGOUT, {
      userId: req.user?.id,
      ...getRequestMeta(req),
    });
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    componentLogger.error("Logout failed", { error: error.message });
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Logout failed" });
  }
}

async function me(req, res) {
  try {
    const user = await authService.getProfile(req.user.id);
    if (!user) {
      return res
        .status(404)
        .json({ error: "NOT_FOUND", message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    componentLogger.error("Failed to get profile", { error: error.message });
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Failed to get profile" });
  }
}

async function sendMagicLink(req, res) {
  try {
    const { email } = req.body;

    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Valid email is required",
      });
    }

    try {
      validateEmailDomain(email);
    } catch {
      return res.status(400).json({
        error: "DISPOSABLE_EMAIL",
        message: "Disposable email addresses are not allowed",
      });
    }

    const limiter = getMagicLinkLimiter();
    if (limiter) {
      const { allowed } = await limiter.canResend(email.toLowerCase());
      if (!allowed) {
        return res.status(429).json({
          error: "RATE_LIMIT_EXCEEDED",
          message: "Too many magic link requests. Try again tomorrow.",
        });
      }
    }

    const { url, email: normalizedEmail } = await generateMagicLink(email);

    try {
      await sendMagicLinkEmail(normalizedEmail, url);
    } catch {
      componentLogger.warn("Email send failed, magic link available in logs", {
        email: normalizedEmail,
      });
    }

    if (limiter) {
      await limiter.recordResend(normalizedEmail);
    }

    const isDev = config.get("NODE_ENV") === "development";
    const response = { message: "Magic link sent", email: normalizedEmail };
    if (isDev) {
      response.devUrl = url;
    }

    auditService.logAuthEvent(auditService.AUTH_EVENTS.MAGIC_LINK_SENT, {
      email: normalizedEmail,
      ...getRequestMeta(req),
    });
    res.json(response);
  } catch (error) {
    componentLogger.error("Failed to send magic link", {
      error: error.message,
    });
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Failed to send magic link" });
  }
}

async function verifyMagicToken(req, res) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Token is required",
      });
    }

    const user = await verifyMagicLink(token);
    if (!user) {
      return res.status(401).json({
        error: "INVALID_TOKEN",
        message: "Magic link is invalid or expired",
      });
    }

    const result = await authService.issueTokensForUser(user);
    const meta = getRequestMeta(req);
    componentLogger.info("User signed in via magic link", {
      email: user.email,
    });
    await sessionService.createSession(
      result.user.id,
      hashToken(result.refreshToken),
      meta,
    );
    auditService.logAuthEvent(auditService.AUTH_EVENTS.MAGIC_LINK_VERIFIED, {
      userId: result.user.id,
      email: user.email,
      ...meta,
    });
    setRefreshTokenCookie(res, result.refreshToken);
    setCsrfCookie(res, generateCsrfToken());
    res.json({ user: result.user, accessToken: result.accessToken });
  } catch (error) {
    componentLogger.error("Magic link verification failed", {
      error: error.message,
    });
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Verification failed" });
  }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    const details = [];
    if (!currentPassword) details.push('Field "currentPassword" is required');
    if (!newPassword) details.push('Field "newPassword" is required');
    if (newPassword && newPassword.length < PASSWORD_MIN_LENGTH) {
      details.push(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      );
    }

    if (details.length > 0) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid input data",
        details,
      });
    }

    const currentRefreshToken = req.cookies?.piece_rt;
    const currentTokenHash = currentRefreshToken
      ? hashToken(currentRefreshToken)
      : null;
    await authService.changePassword(
      req.user.id,
      currentPassword,
      newPassword,
      currentTokenHash,
    );
    componentLogger.info("Password changed", { userId: req.user.id });
    auditService.logAuthEvent(auditService.AUTH_EVENTS.PASSWORD_CHANGE, {
      userId: req.user.id,
      ...getRequestMeta(req),
    });
    res.json({ message: "Password changed successfully" });
  } catch (error) {
    if (error.code === "WRONG_PASSWORD") {
      return res
        .status(400)
        .json({ error: "WRONG_PASSWORD", message: error.message });
    }
    if (error.code === "USER_NOT_FOUND") {
      return res
        .status(404)
        .json({ error: "NOT_FOUND", message: error.message });
    }
    if (error.code === "WEAK_PASSWORD") {
      return res
        .status(400)
        .json({ error: "VALIDATION_ERROR", message: error.message });
    }
    componentLogger.error("Password change failed", { error: error.message });
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Password change failed" });
  }
}

async function listSessions(req, res) {
  try {
    const sessions = await sessionService.getActiveSessions(req.user.id);
    const currentTokenHash = req.cookies?.piece_rt
      ? hashToken(req.cookies.piece_rt)
      : null;

    const data = sessions.map((s) => ({
      ...s,
      isCurrent: s.refreshTokenHash === currentTokenHash || false,
    }));

    res.json({ data });
  } catch (error) {
    componentLogger.error("Failed to list sessions", { error: error.message });
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Failed to list sessions" });
  }
}

async function revokeSession(req, res) {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res
        .status(400)
        .json({ error: "VALIDATION_ERROR", message: "Session ID is required" });
    }

    const revoked = await sessionService.revokeSession(req.user.id, sessionId);
    if (!revoked) {
      return res
        .status(404)
        .json({ error: "NOT_FOUND", message: "Session not found" });
    }

    auditService.logAuthEvent(auditService.AUTH_EVENTS.SESSION_REVOKED, {
      userId: req.user.id,
      sessionId,
      ...getRequestMeta(req),
    });
    res.json({ message: "Session revoked" });
  } catch (error) {
    componentLogger.error("Failed to revoke session", { error: error.message });
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Failed to revoke session" });
  }
}

async function revokeAllOtherSessions(req, res) {
  try {
    const currentTokenHash = req.cookies?.piece_rt
      ? hashToken(req.cookies.piece_rt)
      : null;
    const count = await sessionService.revokeAllSessions(
      req.user.id,
      currentTokenHash,
    );
    auditService.logAuthEvent(auditService.AUTH_EVENTS.ALL_SESSIONS_REVOKED, {
      userId: req.user.id,
      ...getRequestMeta(req),
    });
    res.json({ message: "All other sessions revoked", affected: count });
  } catch (error) {
    componentLogger.error("Failed to revoke all sessions", {
      error: error.message,
    });
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Failed to revoke sessions" });
  }
}

async function getAuditLog(req, res) {
  try {
    const { getGlobalSystemCollection } = await import("@piece/multitenancy");
    const { mongoIdUtils } = await import("@piece/validation/mongo");
    const collection = getGlobalSystemCollection("auth_audit_log");

    const { userId, event, limit = 50, offset = 0 } = req.query;
    const filter = {};
    if (userId) filter.userId = mongoIdUtils.toObjectId(userId);
    if (event) filter.event = event;

    const parsedLimit = Math.min(Number(limit) || 50, 200);
    const parsedOffset = Number(offset) || 0;

    const [data, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(parsedOffset)
        .limit(parsedLimit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    res.json({
      data: data.map((d) => ({
        id: mongoIdUtils.toApiString(d._id),
        event: d.event,
        userId: d.userId ? mongoIdUtils.toApiString(d.userId) : null,
        email: d.email,
        metadata: d.metadata,
        createdAt: d.createdAt,
      })),
      pagination: {
        total,
        limit: parsedLimit,
        offset: parsedOffset,
        hasMore: parsedOffset + parsedLimit < total,
      },
    });
  } catch (error) {
    componentLogger.error("Failed to get audit log", { error: error.message });
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Failed to get audit log" });
  }
}

async function getUserAuditLog(req, res) {
  try {
    const { getGlobalSystemCollection } = await import("@piece/multitenancy");
    const { mongoIdUtils } = await import("@piece/validation/mongo");
    const collection = getGlobalSystemCollection("auth_audit_log");

    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const parsedLimit = Math.min(Number(limit) || 50, 200);
    const parsedOffset = Number(offset) || 0;

    const filter = { userId: mongoIdUtils.toObjectId(userId) };
    const [data, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(parsedOffset)
        .limit(parsedLimit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    res.json({
      data: data.map((d) => ({
        id: mongoIdUtils.toApiString(d._id),
        event: d.event,
        userId: mongoIdUtils.toApiString(d.userId),
        email: d.email,
        metadata: d.metadata,
        createdAt: d.createdAt,
      })),
      pagination: {
        total,
        limit: parsedLimit,
        offset: parsedOffset,
        hasMore: parsedOffset + parsedLimit < total,
      },
    });
  } catch (error) {
    componentLogger.error("Failed to get user audit log", {
      error: error.message,
    });
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Failed to get audit log" });
  }
}

async function sendVerificationEmail(req, res) {
  try {
    const limiter = getVerificationLimiter();
    if (limiter) {
      const { allowed } = await limiter.canResend(
        req.user.email || req.user.id,
      );
      if (!allowed) {
        return res.status(429).json({
          error: "RATE_LIMIT_EXCEEDED",
          message: "Too many verification requests. Try again later.",
        });
      }
    }

    const result = await authService.generateEmailVerificationToken(
      req.user.id,
    );

    if (result.alreadyVerified) {
      return res.json({ message: "Email is already verified" });
    }

    try {
      await authService.sendVerificationEmail(result.email, result.url);
    } catch {
      componentLogger.warn(
        "Verification email send failed, URL available in logs",
        { email: result.email },
      );
    }

    if (limiter) {
      await limiter.recordResend(req.user.email || req.user.id);
    }
    auditService.logAuthEvent(
      auditService.AUTH_EVENTS.EMAIL_VERIFICATION_SENT,
      { userId: req.user.id, email: result.email, ...getRequestMeta(req) },
    );

    const isDev = config.get("NODE_ENV") === "development";
    const response = { message: "Verification email sent" };
    if (isDev) {
      response.devUrl = result.url;
    }

    res.json(response);
  } catch (error) {
    if (error.code === "USER_NOT_FOUND") {
      return res
        .status(404)
        .json({ error: "NOT_FOUND", message: error.message });
    }
    componentLogger.error("Failed to send verification email", {
      error: error.message,
    });
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to send verification email",
    });
  }
}

async function verifyEmail(req, res) {
  try {
    const { token } = req.body;

    if (!token) {
      return res
        .status(400)
        .json({ error: "VALIDATION_ERROR", message: "Token is required" });
    }

    const result = await authService.verifyEmailToken(token);
    if (!result) {
      return res.status(400).json({
        error: "INVALID_TOKEN",
        message: "Verification link is invalid or expired",
      });
    }

    auditService.logAuthEvent(auditService.AUTH_EVENTS.EMAIL_VERIFIED, {
      userId: result.userId,
      email: result.email,
      ...getRequestMeta(req),
    });
    res.json({ message: "Email verified successfully", verified: true });
  } catch (error) {
    componentLogger.error("Email verification failed", {
      error: error.message,
    });
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Email verification failed" });
  }
}

async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body;

    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Valid email is required",
      });
    }

    const limiter = getResetLimiter();
    if (limiter) {
      const { allowed } = await limiter.canResend(email.toLowerCase());
      if (!allowed) {
        return res.json({
          message: "If that email is registered, a reset link has been sent",
        });
      }
      await limiter.recordResend(email.toLowerCase());
    }

    await authService.requestPasswordReset(email);

    auditService.logAuthEvent(
      auditService.AUTH_EVENTS.PASSWORD_RESET_REQUESTED,
      { email: email.toLowerCase(), ...getRequestMeta(req) },
    );
    res.json({
      message: "If that email is registered, a reset link has been sent",
    });
  } catch (error) {
    componentLogger.error("Password reset request failed", {
      error: error.message,
    });
    res.json({
      message: "If that email is registered, a reset link has been sent",
    });
  }
}

async function confirmPasswordReset(req, res) {
  try {
    const { token, newPassword } = req.body;

    const details = [];
    if (!token) details.push('Field "token" is required');
    if (!newPassword) details.push('Field "newPassword" is required');
    if (newPassword && newPassword.length < PASSWORD_MIN_LENGTH) {
      details.push(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      );
    }

    if (details.length > 0) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid input data",
        details,
      });
    }

    const resetResult = await authService.confirmPasswordReset(
      token,
      newPassword,
    );

    auditService.logAuthEvent(
      auditService.AUTH_EVENTS.PASSWORD_RESET_CONFIRMED,
      { userId: resetResult.userId, ...getRequestMeta(req) },
    );
    res.json({ message: "Password has been reset successfully" });
  } catch (error) {
    if (error.code === "INVALID_TOKEN") {
      return res
        .status(400)
        .json({ error: "INVALID_TOKEN", message: error.message });
    }
    if (error.code === "WEAK_PASSWORD") {
      return res
        .status(400)
        .json({ error: "VALIDATION_ERROR", message: error.message });
    }
    componentLogger.error("Password reset confirmation failed", {
      error: error.message,
    });
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Password reset failed" });
  }
}

async function acceptInvite(req, res) {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invite token is required",
      });
    }

    const result = await inviteService.acceptInvite(token, req.user.id);
    res.json(result);
  } catch (error) {
    if (error.code === "INVALID_INVITE") {
      return res
        .status(404)
        .json({ error: "NOT_FOUND", message: error.message });
    }
    if (error.code === "ALREADY_MEMBER") {
      return res
        .status(409)
        .json({ error: "CONFLICT", message: error.message });
    }
    componentLogger.error("Failed to accept invite", { error: error.message });
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Failed to accept invite" });
  }
}

export const authController = {
  register,
  login,
  sendMagicLink,
  verifyMagicToken,
  refresh,
  logout,
  me,
  changePassword,
  listSessions,
  revokeSession,
  revokeAllOtherSessions,
  getAuditLog,
  getUserAuditLog,
  sendVerificationEmail,
  verifyEmail,
  requestPasswordReset,
  confirmPasswordReset,
  acceptInvite,
};
