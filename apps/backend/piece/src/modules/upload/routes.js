import { Router } from 'express';
import { uploadController } from './controller.js';
import { requireTeamSelection } from '../../middleware/team-context.js';

export function registerUploadRoutes(app, { authenticateToken } = {}) {
  const router = Router();

  if (authenticateToken) {
    router.use(authenticateToken);
  }
  router.use(requireTeamSelection());

  router.post('/v1/upload/presign', uploadController.presign);
  router.post('/v1/upload/complete', uploadController.complete);
  router.post('/v1/upload/temp', uploadController.tempUpload);
  router.get('/v1/upload/temp/:id', uploadController.getTempFile);

  app.use(router);
}
