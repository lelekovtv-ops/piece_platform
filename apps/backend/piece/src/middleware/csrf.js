import crypto from 'node:crypto';
import { createComponentLogger } from '../utils/logger.js';
import { config } from '../config.js';

const componentLogger = createComponentLogger('CSRF');

const CSRF_COOKIE_NAME = 'piece_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function setCsrfCookie(res, token) {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: config.get('NODE_ENV') === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function createCsrfMiddleware() {
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();

    if (req.path.startsWith('/health') || req.path.startsWith('/internal/')) return next();

    const csrfExemptPaths = ['/v1/auth/login', '/v1/auth/register', '/v1/auth/refresh', '/v1/auth/magic-link'];
    if (csrfExemptPaths.some((p) => req.path === p || req.path.startsWith(p + '/'))) return next();

    if (!req.cookies?.piece_rt && !req.headers?.authorization) return next();

    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers?.[CSRF_HEADER_NAME];

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      componentLogger.warn('CSRF validation failed', {
        path: req.path,
        method: req.method,
        hasCookie: !!cookieToken,
        hasHeader: !!headerToken,
      });
      return res.status(403).json({
        error: 'CSRF_VALIDATION_FAILED',
        message: 'Missing or invalid CSRF token',
      });
    }

    next();
  };
}
