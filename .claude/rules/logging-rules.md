# Logging Rules

## Core Principle

**Structured logger only.** NEVER use `console.log`, `console.warn`, `console.error`, or `console.info` in backend code.

Frontend `console.log` is acceptable only in development builds.

## Implementation

Built on **Pino** (high-performance structured JSON logger) with **AsyncLocalStorage** for automatic request-scoped context propagation.

## Logger Setup

```javascript
import { createLogger } from 'piece/logger';

const logger = createLogger({ serviceName: '{service-name}' });
```

### Component Loggers

For scoped logging within a service, use component loggers:

```javascript
const routeLogger = logger.createComponentLogger('UserRoutes');
const serviceLogger = logger.createComponentLogger('AuthService');

routeLogger.info('User created', { userId, email });
serviceLogger.warn('Token expired', { userId });
```

## Request Logging Middleware

Every service MUST use `createRequestLoggingMiddleware(logger)`. It wraps each request in AsyncLocalStorage context and logs request/response metadata.

```javascript
import { createLogger, createRequestLoggingMiddleware } from 'piece/logger';

const logger = createLogger({ serviceName: '{service-name}' });

app.use(helmet());
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));       // BEFORE request logging
app.use(createRequestLoggingMiddleware(logger)); // AFTER body parsing
```

**IMPORTANT:** `express.json()` MUST be placed BEFORE `createRequestLoggingMiddleware()` so the request body is parsed when logging begins.

## Correlation IDs

CorrelationId is **automatically injected** into every log via AsyncLocalStorage. No need to pass it manually.

```javascript
// correlationId is auto-injected
routeLogger.info('User created', { userId, email });
// Output includes correlationId automatically from ALS context
```

### How it works

1. **HTTP requests:** `createRequestLoggingMiddleware()` wraps the request in `asyncLocalStorage.run({ correlationId })`
2. **NATS handlers:** `piece/pubsub` subscriber wraps handlers in `runWithContext({ correlationId: event.correlationId })`
3. **Manual context:** For cases outside HTTP/NATS:

```javascript
import { runWithContext } from 'piece/logger';

await runWithContext({ correlationId: 'custom-id' }, async () => {
  logger.info('Processing', { step: 1 }); // correlationId auto-injected
});
```

## Log Levels

| Level | When to Use | HTTP Context |
|-------|-------------|-------------|
| `error` | Unexpected failures, 5xx responses | 500, 502, 503 |
| `warn` | Expected but notable issues, 4xx responses | 400, 401, 403, 404 |
| `info` | Lifecycle events, successful operations | 200, 201, 204 |
| `debug` | Detailed diagnostics | Development only |

Configure via `LOG_LEVEL` env variable (default: `info`).

## What to Log

```javascript
// Service startup
componentLogger.info('Service started', { port, env });
componentLogger.info('Database connected', { database });

// Request processing
componentLogger.info('User created', { userId, email, teamId });
componentLogger.warn('Validation failed', { errors: validationErrors });

// NATS event handling
componentLogger.info('Event received', { eventType, subject });
componentLogger.info('Event processed', { eventType, durationMs: 45 });
componentLogger.error('Handler failed', { eventType, error: err.message });

// Error responses
componentLogger.error('Database query failed', {
  error: err.message,
  stack: err.stack,
  collection: 'users',
});
```

## NEVER Log

- API keys, tokens, JWT secrets
- Passwords (raw or hashed)
- MongoDB connection URIs with credentials
- Service account keys
- Full request bodies containing credentials
- Personal identification numbers
- Credit card details
- Encryption keys

```javascript
// WRONG
componentLogger.info('User login', { password: req.body.password });

// CORRECT
componentLogger.info('User login', { email: req.body.email, success: true });
```

## Anti-patterns

- **NEVER** use `console.log` in `apps/backend/` or `packages/` code
- **NEVER** log sensitive data (see list above)
- **NEVER** log plain strings without context -- always include structured fields
- **NEVER** create custom logger instances -- use `piece/logger`
- **NEVER** manually pass correlationId -- it is auto-injected via AsyncLocalStorage
