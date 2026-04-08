import { Router } from 'express';
import { userController } from './controller.js';

export function registerUserRoutes(app, { authenticateToken } = {}) {
  const router = Router();

  if (authenticateToken) {
    router.use(authenticateToken);
  }

  router.get('/v1/users', userController.list);
  router.get('/v1/users/me', userController.getProfile);
  router.get('/v1/users/:id', userController.getById);
  router.patch('/v1/users/:id', userController.update);
  router.delete('/v1/users/:id', userController.remove);

  app.use(router);
}
