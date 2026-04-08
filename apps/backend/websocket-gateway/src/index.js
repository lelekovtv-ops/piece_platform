import { config } from './config.js';
import { logger, createComponentLogger } from './utils/logger.js';
import { createRequestLoggingMiddleware } from '@piece/logger';
import express from 'express';
import helmet from 'helmet';
import { corsMiddleware } from '@piece/cors-middleware';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initializePubSub } from '@piece/pubsub';
import { initializeExampleSubscriber } from './services/exampleSubscriber.js';
import { initializeCollaboration } from './services/collaboration.js';

const componentLogger = createComponentLogger('App');

const app = express();
app.use(helmet());
app.use(corsMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use(createRequestLoggingMiddleware(logger));

// ---------------------------------------------------------------------------
// Health endpoint
// ---------------------------------------------------------------------------
let backgroundServicesReady = false;

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'websocket-gateway',
    timestamp: new Date().toISOString(),
    backgroundServices: backgroundServicesReady ? 'ready' : 'initializing',
  });
});

// ---------------------------------------------------------------------------
// HTTP + Socket.IO server
// ---------------------------------------------------------------------------
const httpServer = createServer(app);
const port = config.get('PORT') || 3109;

const io = new Server(httpServer, {
  cors: {
    origin: config.get('WS_CORS_ORIGINS'),
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// ---------------------------------------------------------------------------
// /events namespace — main event delivery channel
// ---------------------------------------------------------------------------
const eventsNs = io.of('/events');

eventsNs.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
  if (!token) {
    return next(new Error('Authentication required'));
  }

  // TODO: verify JWT and extract user context
  // const user = verifyJwt(token);
  // socket.data.user = user;

  // Placeholder: accept all connections for scaffolding
  socket.data.authenticated = true;
  next();
});

eventsNs.on('connection', (socket) => {
  const { teamId, userId } = socket.handshake.query;

  componentLogger.info('Client connected', {
    socketId: socket.id,
    teamId,
    userId,
  });

  // Join rooms for targeted delivery
  if (teamId) {
    socket.join(`team:${teamId}`);
  }
  if (userId) {
    socket.join(`user:${userId}`);
  }

  socket.on('disconnect', (reason) => {
    componentLogger.debug('Client disconnected', {
      socketId: socket.id,
      reason,
    });
  });
});

// ---------------------------------------------------------------------------
// Process error handlers
// ---------------------------------------------------------------------------
process.on('unhandledRejection', (reason) => {
  componentLogger.error('Unhandled rejection', { error: String(reason) });
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  componentLogger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
httpServer.listen(port, () => {
  componentLogger.info('WebSocket gateway started', { port });
});

// ---------------------------------------------------------------------------
// Background services (NATS subscribers)
// ---------------------------------------------------------------------------
async function initializeBackgroundServices() {
  await initializePubSub(config, { serviceName: 'websocket-gateway' });
  await initializeExampleSubscriber(eventsNs);
  initializeCollaboration(eventsNs);
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
async function gracefulShutdown(signal) {
  componentLogger.info(`${signal} received, shutting down gracefully`);

  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }

  try {
    const { getNatsClient } = await import('@piece/pubsub');
    const natsClient = getNatsClient();
    if (natsClient) await natsClient.close();
  } catch {
    // NATS not initialized — skip
  }

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

initializeBackgroundServices()
  .then(() => {
    backgroundServicesReady = true;
    componentLogger.info('Background services ready');
  })
  .catch((err) => {
    componentLogger.error('Background init failed', { error: err.message });
  });
