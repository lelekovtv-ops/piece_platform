import { Router } from 'express';
import { authController } from './controller.js';

const router = Router();

router.post('/v1/auth/register', authController.register);
router.post('/v1/auth/login', authController.login);
router.post('/v1/auth/magic-link', authController.sendMagicLink);
router.post('/v1/auth/magic-link/verify', authController.verifyMagicToken);
router.post('/v1/auth/refresh', authController.refresh);

export function registerAuthRoutes(app, { authenticateToken } = {}) {
  if (authenticateToken) {
    router.post('/v1/auth/logout', authenticateToken, authController.logout);
    router.get('/v1/auth/me', authenticateToken, authController.me);
  }
  app.use(router);
}
