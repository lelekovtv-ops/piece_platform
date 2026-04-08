import { Router } from 'express';
import { screenplayController } from './controller.js';
import { requireTeamSelection, requireTeamAccess } from '../../middleware/team-context.js';

export function registerScreenplayRoutes(app, { authenticateToken } = {}) {
  const router = Router();

  if (authenticateToken) {
    router.use(authenticateToken);
  }
  router.use(requireTeamSelection());
  router.use(requireTeamAccess());

  router.get('/v1/projects/:projectId/blocks', screenplayController.listBlocks);
  router.put('/v1/projects/:projectId/blocks', screenplayController.batchUpdate);
  router.post('/v1/projects/:projectId/blocks/import', screenplayController.importScreenplay);
  router.get('/v1/projects/:projectId/export/:format', screenplayController.exportScreenplay);
  router.get('/v1/projects/:projectId/scenes', screenplayController.getScenes);

  app.use(router);
}
