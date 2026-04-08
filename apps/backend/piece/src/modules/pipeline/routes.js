import { Router } from 'express';
import { pipelineController } from './controller.js';
import { requireTeamSelection, requireTeamAccess } from '../../middleware/team-context.js';

export function registerPipelineRoutes(app, { authenticateToken } = {}) {
  const router = Router();

  if (authenticateToken) {
    router.use(authenticateToken);
  }
  router.use(requireTeamSelection());
  router.use(requireTeamAccess());

  router.post('/v1/projects/:projectId/pipeline/run', pipelineController.run);
  router.get('/v1/projects/:projectId/pipeline/presets', pipelineController.listPresets);
  router.post('/v1/projects/:projectId/pipeline/presets', pipelineController.savePreset);

  app.use(router);
}
