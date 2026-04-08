import { Router } from 'express';
import { rundownController } from './controller.js';
import { requireTeamSelection, requireTeamAccess } from '../../middleware/team-context.js';

export function registerRundownRoutes(app, { authenticateToken } = {}) {
  const router = Router();

  if (authenticateToken) {
    router.use(authenticateToken);
  }
  router.use(requireTeamSelection());
  router.use(requireTeamAccess());

  router.get('/v1/projects/:projectId/rundown', rundownController.getEntries);
  router.put('/v1/projects/:projectId/rundown', rundownController.batchUpdate);
  router.post('/v1/projects/:projectId/rundown/rebuild', rundownController.rebuild);
  router.get('/v1/projects/:projectId/timeline', rundownController.getTimeline);

  app.use(router);
}
