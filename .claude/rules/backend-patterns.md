# Backend Patterns

## Framework

Use **Express.js** (NOT Fastify). All backend code uses ES modules (`import`/`export`). Never use `require()`.

## Standard Service Structure

```
apps/backend/{service-name}/src/
  controllers/    # Request handling, validation, response formatting
  services/       # Business logic, orchestration
  models/         # Data access, MongoDB operations
  routes/         # Express router definitions
  middleware/     # Service-specific middleware
  utils/          # Helpers, transformers
  config.js       # Service configuration via piece/config
  index.js        # Entry point
```

## Mandatory Import Order

`piece/config` MUST be the first import in every entry point. `piece/logger` MUST be second.

```javascript
import { config } from './config.js';                              // 1. Config FIRST
import { createLogger, createRequestLoggingMiddleware } from 'piece/logger'; // 2. Logger
import express from 'express';
import helmet from 'helmet';
import { corsMiddleware } from 'piece/cors-middleware';
```

## Service Setup & Background Init

Most services use **background init** -- HTTP server starts immediately, background services init after listen.

```javascript
import { config } from './config.js';
import { logger, createComponentLogger } from './utils/logger.js';

const componentLogger = createComponentLogger('App');
const app = express();

// Middleware chain (order matters)
app.use(helmet());
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(createRequestLoggingMiddleware(logger));

// Health endpoint (reflects background readiness)
let backgroundServicesReady = false;
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: '{service-name}',
    timestamp: new Date().toISOString(),
    backgroundServices: backgroundServicesReady ? 'ready' : 'initializing',
  });
});

// Routes here...

// Process error handlers (MANDATORY in every index.js)
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { error: reason?.message || reason });
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

// Start server FIRST
app.listen(port, () => componentLogger.info('Service started', { port }));

// Background init (non-blocking, AFTER listen)
const initializeBackgroundServices = async () => {
  const mongoUri = await config.secrets.getMongoDBURI();
  await initializeMultiTenancy(mongoUri);
  await initializePermissions(getSystemDb(), { config });
  await initializePubSub(config, { serviceName: '{service-name}' });
};

initializeBackgroundServices()
  .then(() => { backgroundServicesReady = true; })
  .catch((err) => componentLogger.error('Background init failed', { error: err.message }));
```

## Auth Middleware

Auth middleware uses a **factory pattern**. NEVER import middleware as direct named exports.

```javascript
import { createAuthMiddleware } from 'piece/auth-middleware';

const { authenticateToken, requireEmailVerification, authenticateInternalToken } = createAuthMiddleware({ config });

// Public routes with JWT
router.get('/v1/resource',
  authenticateToken,
  requireEmailVerification,
  requireTeamSelection(),
  requireTeamAccess(),
  requirePermission('resource:read'),
  controller.list
);

// Internal service-to-service
router.post('/internal/resource', authenticateInternalToken, controller.internalHandler);
```

## Error Handling

Flat error format -- no nested objects, no `{ success: false }`:

```javascript
res.status(400).json({
  error: 'VALIDATION_ERROR',
  message: 'Invalid input data',
  details: ['Field "email" is required'],
});
```

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR`, `BAD_REQUEST` | Invalid input |
| 401 | `UNAUTHORIZED`, `TOKEN_EXPIRED` | Authentication required |
| 403 | `FORBIDDEN`, `INSUFFICIENT_PERMISSIONS` | Access denied |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT`, `DUPLICATE_ENTRY` | State conflict |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

## API Route Prefixes

| Prefix | Purpose | Auth |
|--------|---------|------|
| `/v1/` | Public API | Bearer token |
| `/internal/` | Service-to-service | x-internal-token |
| `/admin/` | System administration | Admin bearer token |

**No `/api/` prefix.** Routes are versioned directly: `/v1/customers`, `/internal/notify`.

## Response Patterns

### Single Object

```javascript
res.json({ id: '123', name: 'Item', createdAt: '...' });
```

### Collection Envelope (Offset Pagination)

```javascript
res.json({
  data: [{ id: '1' }, { id: '2' }],
  pagination: { total: 42, limit: 20, offset: 0, hasMore: true },
});
```

### Cursor Pagination

```javascript
res.json({
  data,
  pagination: { hasMore: data.length === limit, cursor: lastItem?._id?.toString(), direction: 'next', limit },
});
```

### Action with Metadata

```javascript
res.json({ affected: 5, message: 'Records imported' });
```

## Development Startup (`dev.sh`)

The `dev.sh` script starts all backend services in parallel:

1. Checks infrastructure containers (MongoDB, Redis, NATS) are running
2. Discovers services: scans `apps/backend/*/` for directories with `src/index.js`
3. Starts each service with `node --watch src/index.js` (auto-reload on changes)
4. Waits for `/health` endpoint (20s timeout, 100ms poll)
5. Monitors PIDs, graceful shutdown on SIGINT/SIGTERM (SIGTERM → 2s wait → SIGKILL)

Commands: `pnpm run dev:backend` (backend only) or `pnpm run dev` (all services).

## Graceful Shutdown

```javascript
let httpServer = null;
httpServer = app.listen(port);

async function gracefulShutdown(signal) {
  componentLogger.info(`${signal} received, shutting down`);
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  try {
    const { getNatsClient } = await import('piece/pubsub');
    const natsClient = getNatsClient();
    if (natsClient) await natsClient.close();
  } catch {}
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

## Anti-patterns

- **NEVER** `console.log` -- use `piece/logger`
- **NEVER** `process.env.VARIABLE` -- use `piece/config`
- **NEVER** `require()` -- ESM only
- **NEVER** `import jsonwebtoken` directly -- use `piece/auth-middleware`
- **NEVER** `import cors from 'cors'` directly -- use `piece/cors-middleware`
- **NEVER** prefix routes with `/api/` -- use `/v1/`, `/internal/`, `/admin/`
- **NEVER** return errors as `{ success: false, error: '...' }` -- use flat `{ error, message, details }`
- **NEVER** omit `process.on('unhandledRejection')` / `process.on('uncaughtException')` in entry points
- **NEVER** make direct HTTP calls between services -- use NATS or API Gateway `/internal/`
- **NEVER** use `eslint-disable` -- fix the code or use ESLint config overrides
- **NEVER** use Gmail API, nodemailer, or raw SMTP -- use `piece/email` (AWS SES)
- **NEVER** accept disposable emails on registration -- use `validateEmailDomain()` from `piece/validation/email`
- **NEVER** skip account lockout check on login -- use `createAccountLockout()` from `piece/cache`
- **NEVER** allow unlimited verification code resends -- use `createResendLimiter()` from `piece/cache`
- **NEVER** skip MX validation on registration -- use `validateMxRecord()` from `piece/validation/email`
