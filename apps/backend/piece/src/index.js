import { config } from './config.js';
import { logger, createComponentLogger } from './utils/logger.js';
import { createRequestLoggingMiddleware } from '@piece/logger';
import express from 'express';
import helmet from 'helmet';
import { corsMiddleware } from '@piece/cors-middleware';
import { createAuthMiddleware } from '@piece/auth-middleware';
import { registerUserRoutes } from './modules/users/routes.js';
import { registerAuthRoutes } from './modules/auth/routes.js';
import { registerTeamRoutes } from './modules/teams/routes.js';
import { registerProjectRoutes } from './modules/projects/routes.js';
import { registerUploadRoutes } from './modules/upload/routes.js';
import { registerScreenplayRoutes } from './modules/screenplay/routes.js';
import { registerRundownRoutes } from './modules/rundown/routes.js';
import { registerBibleRoutes } from './modules/bible/routes.js';
import { registerAIRoutes } from './modules/ai/routes.js';
import { registerGenerationRoutes } from './modules/generation/routes.js';
import { registerPipelineRoutes } from './modules/pipeline/routes.js';
import { registerSettingsRoutes } from './modules/settings/routes.js';
import { registerTranslateRoutes } from './modules/translate/routes.js';
import { registerKozaToolsRoutes } from './modules/koza-tools/routes.js';

const componentLogger = createComponentLogger('Application');

const setupApp = () => {
  const app = express();
  const PORT = config.get('PORT');

  app.use(helmet());
  app.use(corsMiddleware);
  app.use(express.json({ limit: '10mb' }));
  app.use(createRequestLoggingMiddleware(logger));

  let backgroundServicesReady = false;

  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: config.get('SERVICE_NAME'),
      timestamp: new Date().toISOString(),
      backgroundServices: backgroundServicesReady ? 'ready' : 'initializing',
    });
  });

  app.setBackgroundServicesReady = (ready) => {
    backgroundServicesReady = ready;
  };

  let authMiddleware = {};
  const jwtPublicKey = config.get('JWT_PUBLIC_KEY_BASE64');
  if (jwtPublicKey) {
    authMiddleware = createAuthMiddleware({ config });
  } else {
    componentLogger.warn('JWT keys not configured — authenticated routes disabled');
  }

  registerAuthRoutes(app, authMiddleware);
  registerUserRoutes(app, authMiddleware);
  registerTeamRoutes(app, authMiddleware);
  registerProjectRoutes(app, authMiddleware);
  registerUploadRoutes(app, authMiddleware);
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
  await initializeMultiTenancy(mongoUri);
  componentLogger.info('MongoDB connected');

  await initializeSystemIndexes();
  componentLogger.info('System indexes initialized');

  await initializePermissions(getSystemDb(), { config });
  componentLogger.info('Permissions initialized');

  try {
    await initializeServiceCache('piece', config, { strategy: 'redis' });
    componentLogger.info('Redis cache initialized');
  } catch (err) {
    componentLogger.warn('Redis cache init failed (non-critical)', { error: err.message });
  }

  try {
    await initializePubSub(config, { serviceName: 'piece' });
    componentLogger.info('NATS PubSub initialized');
  } catch (err) {
    componentLogger.warn('NATS PubSub init failed (non-critical)', { error: err.message });
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
