import { Router } from 'express';
import { bibleController } from './controller.js';
import { requireTeamSelection, requireTeamAccess } from '../../middleware/team-context.js';

export function registerBibleRoutes(app, { authenticateToken } = {}) {
  const router = Router();

  if (authenticateToken) {
    router.use(authenticateToken);
  }
  router.use(requireTeamSelection());
  router.use(requireTeamAccess());

  router.get('/v1/projects/:projectId/bible/characters', bibleController.characters.list);
  router.post('/v1/projects/:projectId/bible/characters', bibleController.characters.create);
  router.patch('/v1/projects/:projectId/bible/characters/:id', bibleController.characters.update);
  router.delete('/v1/projects/:projectId/bible/characters/:id', bibleController.characters.remove);

  router.get('/v1/projects/:projectId/bible/locations', bibleController.locations.list);
  router.post('/v1/projects/:projectId/bible/locations', bibleController.locations.create);
  router.patch('/v1/projects/:projectId/bible/locations/:id', bibleController.locations.update);
  router.delete('/v1/projects/:projectId/bible/locations/:id', bibleController.locations.remove);

  router.get('/v1/projects/:projectId/bible/props', bibleController.props.list);
  router.post('/v1/projects/:projectId/bible/props', bibleController.props.create);
  router.patch('/v1/projects/:projectId/bible/props/:id', bibleController.props.update);
  router.delete('/v1/projects/:projectId/bible/props/:id', bibleController.props.remove);

  router.post('/v1/projects/:projectId/bible/parse', bibleController.parseFromScreenplay);

  app.use(router);
}
