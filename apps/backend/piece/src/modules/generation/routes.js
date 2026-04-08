import { Router } from 'express';
import { generationController } from './controller.js';
import { requireTeamSelection } from '../../middleware/team-context.js';

export function registerGenerationRoutes(app, { authenticateToken } = {}) {
  const router = Router();

  if (authenticateToken) {
    router.use(authenticateToken);
  }
  router.use(requireTeamSelection());

  router.post('/v1/projects/:projectId/generate/image', generationController.generate);
  router.post('/v1/projects/:projectId/generate/search', generationController.search);

  app.use(router);
}
