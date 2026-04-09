import { config } from './config.js';
import * as Sentry from '@sentry/node';

const sentryDsn = config.get('SENTRY_DSN_BACKEND');
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: config.get('NODE_ENV'),
    tracesSampleRate: 0.5,
  });
}

import { logger, createComponentLogger } from './utils/logger.js';
import { createRequestLoggingMiddleware } from '@piece/logger';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { corsMiddleware } from '@piece/cors-middleware';
import { createAuthMiddleware } from '@piece/auth-middleware';
import { registerUserRoutes } from './modules/users/routes.js';
import { registerAuthRoutes } from './modules/auth/routes.js';
import { registerTeamRoutes } from './modules/teams/routes.js';
import { registerProjectRoutes } from './modules/projects/routes.js';
import { registerUploadRoutes } from './modules/upload/routes.js';
import { registerLibraryRoutes } from './modules/library/routes.js';
import { registerScreenplayRoutes } from './modules/screenplay/routes.js';
import { registerRundownRoutes } from './modules/rundown/routes.js';
import { registerBibleRoutes } from './modules/bible/routes.js';
import { registerAIRoutes } from './modules/ai/routes.js';
import { registerGenerationRoutes } from './modules/generation/routes.js';
import { registerPipelineRoutes } from './modules/pipeline/routes.js';
import { registerSettingsRoutes } from './modules/settings/routes.js';
import { registerTranslateRoutes } from './modules/translate/routes.js';
import { registerKozaToolsRoutes } from './modules/koza-tools/routes.js';
import { createRateLimiter } from './middleware/rate-limiter.js';
import { buildPrometheusMetrics } from './middleware/prometheus-metrics.js';

const componentLogger = createComponentLogger('Application');

let _authMiddleware = null;

const setupApp = () => {
  const app = express();
  const PORT = config.get('PORT');

  app.use(helmet());
  app.use(corsMiddleware);
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(createRequestLoggingMiddleware(logger));
  app.use(createRateLimiter({ maxRequests: 100, windowSeconds: 60 }));

  let backgroundServicesReady = false;

  app.get('/health', async (req, res) => {
    const checks = { mongodb: 'unknown', redis: 'unknown' };

    try {
      const { getSystemDb } = await import('@piece/multitenancy');
      const db = getSystemDb();
      if (db) {
        await db.command({ ping: 1 });
        checks.mongodb = 'connected';
      } else {
        checks.mongodb = 'not initialized';
      }
    } catch {
      checks.mongodb = 'disconnected';
    }

    try {
      const { getRedisClient } = await import('@piece/cache');
      const redis = getRedisClient();
      if (redis) {
        await redis.ping();
        checks.redis = 'connected';
      } else {
        checks.redis = 'not initialized';
      }
    } catch {
      checks.redis = 'disconnected';
    }

    const allHealthy = checks.mongodb !== 'disconnected' && checks.redis !== 'disconnected';

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      service: config.get('SERVICE_NAME'),
      timestamp: new Date().toISOString(),
      backgroundServices: backgroundServicesReady ? 'ready' : 'initializing',
      checks,
    });
  });

  app.get('/internal/metrics', (req, res) => {
    const mem = process.memoryUsage();
    res.json({
      service: config.get('SERVICE_NAME'),
      uptime: process.uptime(),
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        external: Math.round(mem.external / 1024 / 1024),
      },
      cpu: process.cpuUsage(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/internal/metrics/prometheus', (req, res) => {
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(buildPrometheusMetrics());
  });

  app.use((req, res, next) => {
    if (backgroundServicesReady) return next();
    if (req.path === '/health' || req.path.startsWith('/internal/metrics')) return next();
    res.status(503).json({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Service is starting up, please retry',
    });
  });

  app.setBackgroundServicesReady = (ready) => {
    backgroundServicesReady = ready;
  };

  let authMiddleware = {};
  const jwtPublicKey = config.get('JWT_PUBLIC_KEY_BASE64');
  if (jwtPublicKey) {
    authMiddleware = createAuthMiddleware({ config });
    _authMiddleware = authMiddleware;
  } else if (config.get('NODE_ENV') === 'production') {
    componentLogger.error('JWT_PUBLIC_KEY_BASE64 is required in production');
    process.exit(1);
  } else {
    componentLogger.warn('JWT keys not configured — authenticated routes will reject all requests');
    const rejectAuth = (req, res) => {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication not configured' });
    };
    authMiddleware = {
      authenticateToken: rejectAuth,
      requireEmailVerification: rejectAuth,
      authenticateInternalToken: rejectAuth,
      optionalAuth: (req, res, next) => next(),
    };
  }

  registerAuthRoutes(app, authMiddleware);
  registerUserRoutes(app, authMiddleware);
  registerTeamRoutes(app, authMiddleware);
  registerProjectRoutes(app, authMiddleware);
  registerUploadRoutes(app, authMiddleware);
  registerLibraryRoutes(app, authMiddleware);
  registerScreenplayRoutes(app, authMiddleware);
  registerRundownRoutes(app, authMiddleware);
  registerBibleRoutes(app, authMiddleware);
  registerAIRoutes(app, authMiddleware);
  registerGenerationRoutes(app, authMiddleware);
  registerPipelineRoutes(app, authMiddleware);
  registerSettingsRoutes(app, authMiddleware);
  registerTranslateRoutes(app, authMiddleware);
  registerKozaToolsRoutes(app, authMiddleware);

  app.use('*', (req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found' });
  });

  app.use((error, req, res, _next) => {
    componentLogger.error('Unhandled error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  });

  return { app, PORT };
};

const initializeBackgroundServices = async () => {
  const { initializeMultiTenancy, getSystemDb } = await import('@piece/multitenancy');
  const { initializeSystemIndexes } = await import('./db/index.js');
  const { initializePermissions } = await import('@piece/permissions');
  const { initializeServiceCache } = await import('@piece/cache');
  const { initializePubSub } = await import('@piece/pubsub');

  const mongoUri = config.get('MONGODB_URI');
  await initializeMultiTenancy(mongoUri, {
    systemDbName: config.get('MONGODB_SYSTEM_DB'),
  });
  componentLogger.info('MongoDB connected');

  await initializeSystemIndexes();
  componentLogger.info('System indexes initialized');

  await initializePermissions(getSystemDb(), { config });
  componentLogger.info('Permissions initialized');

  try {
    await initializeServiceCache('piece', config, { strategy: 'redis' });
    componentLogger.info('Redis cache initialized');

    const { getRedisClient } = await import('@piece/cache');
    const { createTokenBlacklist } = await import('@piece/cache/tokenBlacklist');
    const redis = getRedisClient();
    if (redis && _authMiddleware?.setTokenBlacklist) {
      _authMiddleware.setTokenBlacklist(createTokenBlacklist(redis));
      componentLogger.info('Token blacklist initialized');
    }
  } catch (err) {
    componentLogger.warn('Redis cache init failed (non-critical)', { error: err.message });
  }

  try {
    await initializePubSub(config, { serviceName: 'piece' });
    componentLogger.info('NATS PubSub initialized');
  } catch (err) {
    componentLogger.warn('NATS PubSub init failed (non-critical)', { error: err.message });
  }

  try {
    const { startSessionCleanup } = await import('./jobs/cleanup-sessions.js');
    startSessionCleanup();
  } catch (err) {
    componentLogger.warn('Session cleanup job failed to start', { error: err.message });
  }
};

const startServer = async () => {
  try {
    componentLogger.info('Starting service', {
      nodeEnv: config.get('NODE_ENV'),
      port: config.get('PORT'),
    });

    const { app, PORT } = setupApp();

    httpServer = app.listen(PORT, '0.0.0.0', () => {
      componentLogger.info('HTTP server listening', { port: PORT });
    });

    httpServer.on('error', (error) => {
      componentLogger.error('Server error', { error: error.message });
    });

    initializeBackgroundServices()
      .then(() => {
        app.setBackgroundServicesReady(true);
        componentLogger.info('Service fully operational');
      })
      .catch((error) => {
        componentLogger.error('Failed to initialize background services', {
          error: error.message,
          stack: error.stack,
        });
        process.exit(1);
      });
  } catch (error) {
    componentLogger.error('Failed to start server', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

process.on('uncaughtException', (error) => {
  componentLogger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  componentLogger.error('Unhandled rejection', { reason: reason?.toString() });
  process.exit(1);
});

let httpServer = null;

async function gracefulShutdown(signal) {
  componentLogger.info(`${signal} received, shutting down gracefully`);

  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }

  try {
    const { getNatsClient } = await import('@piece/pubsub');
    const natsClient = getNatsClient();
    if (natsClient) {
      await natsClient.close();
    }
  } catch {
    // NATS may not have been initialized
  }

  try {
    const { closeConnection } = await import('@piece/multitenancy');
    await closeConnection();
  } catch {
    // MongoDB may not have been initialized
  }

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
