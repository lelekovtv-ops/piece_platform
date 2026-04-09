import { Router } from 'express';
import { projectController } from './controller.js';
import { requireTeamSelection, requireTeamAccess, requirePermission, requireScopeFilter } from '@piece/permissions';

export function registerProjectRoutes(app, { authenticateToken } = {}) {
  const router = Router();

  if (authenticateToken) {
    router.use(authenticateToken);
  }
  router.use(requireTeamSelection());
  router.use(requireTeamAccess());

  router.get('/v1/projects', requirePermission('projects', 'read'), requireScopeFilter('projects'), projectController.list);
  router.post('/v1/projects', requirePermission('projects', 'write'), projectController.create);
  router.get('/v1/projects/:projectId', requirePermission('projects', 'read'), projectController.getById);
  router.patch('/v1/projects/:projectId', requirePermission('projects', 'write'), projectController.update);
  router.delete('/v1/projects/:projectId', requirePermission('projects', 'delete'), projectController.remove);

  app.use(router);
}
