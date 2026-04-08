import { authService } from './service.js';
import { generateMagicLink, sendMagicLinkEmail, verifyMagicLink } from './magic-link-service.js';
import { validateEmailDomain, validateMxRecord } from '@piece/validation/email';
import { createAccountLockout } from '@piece/cache/accountLockout';
import { getRedisClient } from '@piece/cache';
import { createComponentLogger } from '../../utils/logger.js';
import { config } from '../../config.js';

const componentLogger = createComponentLogger('AuthController');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;

let _lockout = null;

function getLockout() {
  if (!_lockout) {
    const redis = getRedisClient();
    if (redis) {
      _lockout = createAccountLockout(redis, { maxAttempts: 5, lockoutSeconds: 900 });
    }
  }
  return _lockout;
}

async function register(req, res) {
  try {
    const { email, password, name } = req.body;

    const details = [];
    if (!email) details.push('Field "email" is required');
    if (!password) details.push('Field "password" is required');
    if (email && !EMAIL_REGEX.test(email)) details.push('Invalid email format');
    if (password && password.length < PASSWORD_MIN_LENGTH) {
      details.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    }

    if (details.length > 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid input data', details });
    }

    try {
      validateEmailDomain(email);
    } catch {
      return res.status(400).json({
        error: 'DISPOSABLE_EMAIL',
        message: 'Disposable email addresses are not allowed',
      });
    }

    const hasMx = await validateMxRecord(email);
    if (!hasMx) {
      return res.status(400).json({
        error: 'INVALID_EMAIL_DOMAIN',
        message: 'Email domain does not accept mail',
      });
    }

    const result = await authService.register({ email, password, name });
    componentLogger.info('User registered', { email: email.toLowerCase() });
    res.status(201).json(result);
  } catch (error) {
    if (error.code === 'EMAIL_TAKEN') {
      return res.status(409).json({ error: 'CONFLICT', message: error.message });
    }
    if (error.code === 'WEAK_PASSWORD') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.message });
    }
    componentLogger.error('Registration failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Registration failed' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Email and password are required',
      });
    }

    const lockout = getLockout();
    if (lockout) {
      const { locked, ttl } = await lockout.isLocked(email);
      if (locked) {
        return res.status(429).json({
          error: 'ACCOUNT_LOCKED',
          message: 'Too many failed login attempts. Please try again later.',
          retryAfter: ttl,
        });
      }
    }

    const result = await authService.login({ email, password });
    if (!result) {
      if (lockout) {
        await lockout.recordFailedAttempt(email);
      }
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }

    if (lockout) {
      await lockout.resetAttempts(email);
    }

    componentLogger.info('User logged in', { email });
    res.json(result);
  } catch (error) {
    componentLogger.error('Login failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Login failed' });
  }
}

async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Refresh token is required',
      });
    }

    const result = await authService.refreshAccessToken(refreshToken);
    if (!result) {
      return res.status(401).json({ error: 'TOKEN_EXPIRED', message: 'Invalid or expired refresh token' });
    }

    res.json(result);
  } catch (error) {
    componentLogger.error('Token refresh failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Token refresh failed' });
  }
}

async function logout(req, res) {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    componentLogger.error('Logout failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Logout failed' });
  }
}

async function me(req, res) {
  try {
    const user = await authService.getProfile(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    componentLogger.error('Failed to get profile', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get profile' });
  }
}

async function sendMagicLink(req, res) {
  try {
    const { email } = req.body;

    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Valid email is required',
      });
    }

    try {
      validateEmailDomain(email);
    } catch {
      return res.status(400).json({
        error: 'DISPOSABLE_EMAIL',
        message: 'Disposable email addresses are not allowed',
      });
    }

    const { url, email: normalizedEmail } = await generateMagicLink(email);

    try {
      await sendMagicLinkEmail(normalizedEmail, url);
    } catch {
      componentLogger.warn('Email send failed, magic link available in logs', { email: normalizedEmail });
    }

    const isDev = config.get('NODE_ENV') === 'development';
    const response = { message: 'Magic link sent', email: normalizedEmail };
    if (isDev) {
      response.devUrl = url;
    }

    res.json(response);
  } catch (error) {
    componentLogger.error('Failed to send magic link', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to send magic link' });
  }
}

async function verifyMagicToken(req, res) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Token is required',
      });
    }

    const user = await verifyMagicLink(token);
    if (!user) {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Magic link is invalid or expired',
      });
    }

    const result = await authService.issueTokensForUser(user);
    componentLogger.info('User signed in via magic link', { email: user.email });
    res.json(result);
  } catch (error) {
    componentLogger.error('Magic link verification failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Verification failed' });
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
};
