import { Router } from 'express';
import { translateController } from './controller.js';

export function registerTranslateRoutes(app, { authenticateToken } = {}) {
  const router = Router();

  if (authenticateToken) {
    router.use(authenticateToken);
  }

  router.post('/v1/translate', translateController.translateText);

  app.use(router);
}
