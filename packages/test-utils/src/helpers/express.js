/**
 * Express test app helper.
 *
 * Creates a minimal Express app with mocked auth middleware for route testing.
 *
 * Usage:
 *   import { createTestApp } from '@piece/test-utils/helpers/express';
 *   import myRoutes from '../routes.js';
 *
 *   const app = createTestApp(myRoutes, { user: testUser });
 *   const res = await request(app).get('/v1/items').expect(200);
 */

import express from 'express';

/**
 * @param {import('express').Router | Function} routes — Express router or middleware
 * @param {object} [options]
 * @param {object} [options.user]   — mock user injected as req.user
 * @param {string} [options.teamId] — mock teamId injected as req.teamId
 * @returns {import('express').Express}
 */
export function createTestApp(routes, options = {}) {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  // Inject mock authentication
  app.use((req, _res, next) => {
    if (options.user) {
      req.user = { ...options.user };
    }
    if (options.teamId) {
      req.teamId = options.teamId;
      if (req.user) {
        req.user.selectedTeamId = options.teamId;
      }
    }
    next();
  });

  // Mount routes
  if (typeof routes === 'function') {
    app.use(routes);
  } else {
    app.use(routes);
  }

  // Error handler
  app.use((err, _req, res, _next) => {
    res.status(err.status ?? 500).json({
      error: err.code ?? 'INTERNAL_ERROR',
      message: err.message ?? 'An unexpected error occurred',
    });
  });

  return app;
}
