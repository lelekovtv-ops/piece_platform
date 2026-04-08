import { Router } from 'express';
import { kozaToolsController } from './controller.js';

export function registerKozaToolsRoutes(app, { authenticateToken } = {}) {
  const router = Router();

  if (authenticateToken) {
    router.use(authenticateToken);
  }

  router.post('/v1/tools/nano-banana', kozaToolsController.nanoBanana);
  router.post('/v1/tools/ambient-image', kozaToolsController.ambientImage);
  router.post('/v1/tools/ambient-prompt', kozaToolsController.ambientPrompt);
  router.post('/v1/tools/classify-intent', kozaToolsController.classifyIntent);
  router.post('/v1/tools/sjinn', kozaToolsController.sjinnCreate);
  router.get('/v1/tools/sjinn/:taskId', kozaToolsController.sjinnPoll);
  router.post('/v1/tools/photo-to-3d', kozaToolsController.photoTo3dCreate);
  router.get('/v1/tools/photo-to-3d/:taskId', kozaToolsController.photoTo3dPoll);
  router.post('/v1/tools/smart-distribute', kozaToolsController.smartDistribute);

  app.use(router);
}
