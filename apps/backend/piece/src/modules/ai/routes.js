import { Router } from 'express';
import { aiController } from './controller.js';

export function registerAIRoutes(app, { authenticateToken } = {}) {
  const router = Router();

  if (authenticateToken) {
    router.use(authenticateToken);
  }

  router.post('/v1/chat', aiController.chat);
  router.post('/v1/ai/split-vision', aiController.visionSplit);
  router.post('/v1/ai/prompt-enhance', aiController.promptEnhance);
  router.get('/v1/system/capabilities', aiController.capabilities);

  app.use(router);
}
