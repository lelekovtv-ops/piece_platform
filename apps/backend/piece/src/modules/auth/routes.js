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

export function registerAuthRoutes(app, { authenticateToken } = {}) {
  if (authenticateToken) {
    router.post('/v1/auth/logout', authenticateToken, authController.logout);
    router.get('/v1/auth/me', authenticateToken, authController.me);
    router.post('/v1/auth/change-password', authenticateToken, authController.changePassword);
  }
  app.use(router);
}
