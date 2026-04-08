import { Router } from 'express';
import { settingsController } from './controller.js';
import { requireTeamSelection, requireTeamAccess } from '../../middleware/team-context.js';

export function registerSettingsRoutes(app, { authenticateToken } = {}) {
  const router = Router();

  if (authenticateToken) {
    router.use(authenticateToken);
  }

  router.get('/v1/users/me/settings/:key', settingsController.getUserSetting);
  router.put('/v1/users/me/settings/:key', settingsController.setUserSetting);

  router.use(requireTeamSelection());
  router.use(requireTeamAccess());

  router.get('/v1/projects/:projectId/settings/:key', settingsController.getProjectSetting);
  router.put('/v1/projects/:projectId/settings/:key', settingsController.setProjectSetting);

  app.use(router);
}
