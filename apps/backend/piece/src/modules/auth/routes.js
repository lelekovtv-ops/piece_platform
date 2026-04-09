import { Router } from 'express';
import { authController } from './controller.js';
import { createRateLimiter } from '../../middleware/rate-limiter.js';

const router = Router();

const authLimiter = createRateLimiter({ maxRequests: 10, windowSeconds: 60 });

router.post('/v1/auth/register', authLimiter, authController.register);
router.post('/v1/auth/login', authLimiter, authController.login);
router.post('/v1/auth/magic-link', authLimiter, authController.sendMagicLink);
router.post('/v1/auth/magic-link/verify', authLimiter, authController.verifyMagicToken);
router.post('/v1/auth/refresh', authLimiter, authController.refresh);

export function registerAuthRoutes(app, { authenticateToken, authenticateInternalToken } = {}) {
  if (authenticateToken) {
    router.post('/v1/auth/logout', authenticateToken, authController.logout);
    router.get('/v1/auth/me', authenticateToken, authController.me);
    router.post('/v1/auth/change-password', authenticateToken, authController.changePassword);
    router.get('/v1/auth/sessions', authenticateToken, authController.listSessions);
    router.delete('/v1/auth/sessions/:sessionId', authenticateToken, authController.revokeSession);
    router.delete('/v1/auth/sessions', authenticateToken, authController.revokeAllOtherSessions);
  }

  if (authenticateInternalToken) {
    router.get('/admin/auth/audit-log', authenticateInternalToken, authController.getAuditLog);
    router.get('/admin/auth/audit-log/user/:userId', authenticateInternalToken, authController.getUserAuditLog);
  }

  app.use(router);
}
