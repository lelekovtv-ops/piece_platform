import { Router } from 'express';
import { projectController } from './controller.js';
import { requireTeamSelection, requireTeamAccess } from '../../middleware/team-context.js';

export function registerProjectRoutes(app, { authenticateToken } = {}) {
  const router = Router();

  if (authenticateToken) {
    router.use(authenticateToken);
  }
  router.use(requireTeamSelection());
  router.use(requireTeamAccess());

  router.get('/v1/projects', projectController.list);
  router.post('/v1/projects', projectController.create);
  router.get('/v1/projects/:projectId', projectController.getById);
  router.patch('/v1/projects/:projectId', projectController.update);
  router.delete('/v1/projects/:projectId', projectController.remove);

  app.use(router);
}
