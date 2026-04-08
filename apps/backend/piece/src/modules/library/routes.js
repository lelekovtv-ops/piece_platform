import { Router } from 'express';
import { libraryController } from './controller.js';
import { requireTeamSelection } from '../../middleware/team-context.js';

export function registerLibraryRoutes(app, { authenticateToken } = {}) {
  const router = Router();

  if (authenticateToken) {
    router.use(authenticateToken);
  }
  router.use(requireTeamSelection());

  router.post('/v1/library', libraryController.create);
  router.get('/v1/library', libraryController.list);
  router.get('/v1/library/:id', libraryController.get);
  router.patch('/v1/library/:id', libraryController.update);
  router.delete('/v1/library/:id', libraryController.remove);

  app.use(router);
}
