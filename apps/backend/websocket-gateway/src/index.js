import { config } from './config.js';
import { logger, createComponentLogger } from './utils/logger.js';
import { createRequestLoggingMiddleware } from '@piece/logger';
import express from 'express';
import helmet from 'helmet';
import { corsMiddleware } from '@piece/cors-middleware';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initializePubSub } from '@piece/pubsub';
import { createAuthMiddleware } from '@piece/auth-middleware';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
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
// Connection metrics
// ---------------------------------------------------------------------------
let totalConnections = 0;

app.get('/internal/metrics/prometheus', (_req, res) => {
  const activeConnections = eventsNs.sockets?.size || 0;
  const activeRooms = eventsNs.adapter?.rooms?.size || 0;
  const mem = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  const uptime = process.uptime();

  const lines = [
    '# HELP ws_connections_active Current active WebSocket connections',
    '# TYPE ws_connections_active gauge',
    `ws_connections_active ${activeConnections}`,
    '# HELP ws_connections_total Total WebSocket connections since start',
    '# TYPE ws_connections_total counter',
    `ws_connections_total ${totalConnections}`,
    '# HELP ws_rooms_active Current active rooms',
    '# TYPE ws_rooms_active gauge',
    `ws_rooms_active ${activeRooms}`,
    '# HELP process_memory_rss_bytes Resident set size in bytes',
    '# TYPE process_memory_rss_bytes gauge',
    `process_memory_rss_bytes ${mem.rss}`,
    '# HELP process_heap_used_bytes Heap used in bytes',
    '# TYPE process_heap_used_bytes gauge',
    `process_heap_used_bytes ${mem.heapUsed}`,
    '# HELP process_cpu_user_seconds_total CPU user time in seconds',
    '# TYPE process_cpu_user_seconds_total counter',
    `process_cpu_user_seconds_total ${cpuUsage.user / 1e6}`,
    '# HELP process_cpu_system_seconds_total CPU system time in seconds',
    '# TYPE process_cpu_system_seconds_total counter',
    `process_cpu_system_seconds_total ${cpuUsage.system / 1e6}`,
    '# HELP process_uptime_seconds Process uptime in seconds',
    '# TYPE process_uptime_seconds gauge',
    `process_uptime_seconds ${uptime}`,
  ];

  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(lines.join('\n') + '\n');
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
  transports: ['websocket'],
});

// Redis adapter for horizontal scaling
const redisUrl = config.get('REDIS_URL');
const pubClient = new Redis(redisUrl);
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));

const { verifyToken } = createAuthMiddleware({ config });

// ---------------------------------------------------------------------------
// /events namespace — main event delivery channel
// ---------------------------------------------------------------------------
const eventsNs = io.of('/events');

eventsNs.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
  if (!token) {
    return next(new Error('Authentication required'));
  }

  const user = verifyToken(token);
  if (!user) {
    return next(new Error('Invalid or expired token'));
  }

  socket.data.user = user;
  socket.data.authenticated = true;
  next();
});

eventsNs.on('connection', (socket) => {
  const { teamId, userId } = socket.handshake.query;
  totalConnections++;

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
