# Shared Packages

## Overview

All shared packages live under `packages/` and are published as `piece/*` scoped packages within the monorepo.

## Dependency Format

Always use wildcard version in `package.json`:

```json
"piece/logger": "*"
```

**NEVER** use `workspace:*` or `file:` references.

## Core Packages

Every backend service MUST use these packages. No exceptions.

### 1. piece/config -- Centralized Configuration

**MUST be the FIRST import** in every service entry point.

```javascript
import { ServiceConfig, BaseConfigSchema } from 'piece/config';
import { z } from 'zod';

const schema = BaseConfigSchema.extend({
  MONGODB_URI: z.string(),
  // service-specific fields
});

export const config = new ServiceConfig('{service-name}', schema, {
  importMetaUrl: import.meta.url,
});
```

Loads configuration from environment variables. Uses `importMetaUrl` to dynamically discover monorepo root for `.env` file loading.

**SecretsManager** -- accessed via `config.secrets` (lazy-initialized):

```javascript
const mongoUri = await config.secrets.getMongoDBURI();
const internalToken = config.secrets.getInternalServiceToken();
```

Standard schemas for composition:

| Schema | Fields |
|--------|--------|
| `BaseConfigSchema` | NODE_ENV, PORT, LOG_LEVEL, serviceName |
| `DatabaseConfigSchema` | MONGODB_URI, database options |
| `PubSubConfigSchema` | NATS_URL, ack/deliver settings |
| `ServiceUrlsConfigSchema` | API Gateway URL, internal service URLs |
| `InternalAuthConfigSchema` | Internal service-to-service auth tokens |

### 2. piece/logger -- Structured Logging (Pino + AsyncLocalStorage)

**MUST be the SECOND import** (after config).

```javascript
import { createLogger } from 'piece/logger';

const logger = createLogger({ serviceName: '{service-name}' });
const routeLogger = logger.createComponentLogger('UserRoutes');
routeLogger.info('User created', { userId, email });
```

Additional exports:

```javascript
import { runWithContext, getCorrelationId, asyncLocalStorage } from 'piece/logger';

await runWithContext({ correlationId: 'custom-id' }, async () => {
  logger.info('Processing', { step: 1 }); // correlationId auto-injected
});
```

### 3. piece/auth-middleware -- JWT Authentication

Uses a **factory pattern**. Individual middleware functions are NOT available as direct named exports.

```javascript
import { createAuthMiddleware } from 'piece/auth-middleware';

const { authenticateToken, requireEmailVerification, authenticateInternalToken } = createAuthMiddleware({ config });
```

Strategies:

| Strategy | Description | Use Case |
|----------|-------------|----------|
| `trust-jwt` | Validate JWT signature only | Read-only endpoints |
| `verify-db` | Validate JWT + check user in DB | Write endpoints |

### 4. piece/cors-middleware -- Standardized CORS

**MUST be the FIRST middleware** after helmet.

```javascript
import { corsMiddleware } from 'piece/cors-middleware';

app.use(helmet());
app.use(corsMiddleware);
```

### 5. piece/permissions -- RBAC + Scope (ABAC) + ReBAC

Three-layer permission system.

```javascript
import { initializePermissions, requirePermission, requireScopeFilter } from 'piece/permissions';
import { getSystemDb } from 'piece/multitenancy';

await initializePermissions(getSystemDb(), { config });

// RBAC
router.get('/v1/flows', requirePermission('flows', 'read'), flowController.list);

// Scope filter (ABAC)
router.get('/v1/sessions',
  requirePermission('sessions', 'read'),
  requireScopeFilter('sessions'),
  sessionController.list
);

// Resource access (ReBAC)
import { ResourceAccessResolver } from 'piece/permissions';
const resolver = new ResourceAccessResolver(teamId);
const access = await resolver.resolveEffectiveAccess({ subjectType: 'user', subjectId, resourceType: 'knowledge_base', resourceId });
```

**System roles (hierarchical):**

| Role | Level | Default Scope |
|------|-------|---------------|
| owner | 3 | all |
| admin | 2 | all |
| manager | 1 | my |

**Scope types:** `ALL` (all team records), `MY` (own records only, `createdBy === userId`).

**Resource access:** `SubjectTypes` (user, role, agent), `ResourceTypes` (knowledge_base, drive, table, repository, secret), `AccessLevels` (full, write, read, denied). Conflict resolution: `denied` wins.

### 6. piece/validation -- Event & Data Validation

```javascript
import { validateEvent, safeValidateEvent } from 'piece/validation';
import { MessageEvents } from 'piece/validation/events';

const event = MessageEvents.inbound(data, '{service-name}', correlationId);
validateEvent(event);

// MongoDB ObjectId utilities
import { mongoIdUtils } from 'piece/validation/mongo';
mongoIdUtils.isValid(id);
mongoIdUtils.toObjectId(id);
mongoIdUtils.toApiString(objectId);

// Disposable email validation
import { validateEmailDomain, isDisposableEmail } from 'piece/validation/email';
validateEmailDomain(email); // throws DISPOSABLE_EMAIL_NOT_ALLOWED
isDisposableEmail(email);   // returns boolean
```

Uses `disposable-email-domains` npm package (~4000 domains). Extend with custom domains via `loadCustomBlockedDomains('evil.com,spam.net')`.

**Call `validateEmailDomain()` in registration and any endpoint that accepts new email addresses.** Do NOT call on login or password reset (email already verified).

```javascript
// MX record validation (async, graceful fail-open)
import { validateMxRecord } from 'piece/validation/email';
const hasMx = await validateMxRecord(email); // true if MX exists or DNS unreachable

// Email normalization (for duplicate detection, NOT for storage)
import { normalizeEmail, areEmailsDuplicate } from 'piece/validation/email-normalize';
normalizeEmail('User.Name+tag@Gmail.com'); // → 'username@gmail.com'
areEmailsDuplicate('u.ser@gmail.com', 'user@gmail.com'); // → true

// Cloudflare Turnstile verification
import { verifyTurnstile } from 'piece/validation/turnstile';
const result = await verifyTurnstile(token, config.get('TURNSTILE_SECRET_KEY'), { remoteIp: req.ip });
if (!result.success) return res.status(400).json({ error: 'CAPTCHA_FAILED' });
```

### piece/cache -- Account Lockout & Resend Limiter

```javascript
import { createAccountLockout } from 'piece/cache/accountLockout';
import { createResendLimiter } from 'piece/cache/resendLimiter';

// Account lockout (5 failed attempts → 15 min lock)
const lockout = createAccountLockout(cache, { maxAttempts: 5, lockoutSeconds: 900 });
const { locked } = await lockout.isLocked(email);         // check before login
await lockout.recordFailedAttempt(email);                   // on wrong password
await lockout.resetAttempts(email);                         // on successful login

// Verification code resend limiter (3/day per email)
const resendLimiter = createResendLimiter(cache, { maxPerDay: 3 });
const { allowed } = await resendLimiter.canResend(email);   // check before resend
await resendLimiter.recordResend(email);                     // after sending
```

## Additional Packages

### piece/pubsub -- NATS JetStream Messaging

```javascript
import { initializePubSub, publishEvent, subscribe, subjects } from 'piece/pubsub';

await initializePubSub(config, { serviceName: '{service-name}' });
await publishEvent(subjects.messageInbound(chatId), event);
await subscribe('MESSAGES', 'msg-orchestrator', handler, {
  filterSubject: '{prefix}.msg.inbound.>',
});
```

### piece/multitenancy -- MongoDB Multi-Tenant

```javascript
import { initializeMultiTenancy, getSystemCollection, getTableCollection, getSystemDb, getGlobalSystemCollection } from 'piece/multitenancy';

await initializeMultiTenancy(config.get('mongodbUri'));

const messages = getSystemCollection(teamId, 'messages');     // no prefix
const customers = getTableCollection(teamId, 'customers');    // table_ prefix
const systemDb = getSystemDb();                                // synchronous
const users = getGlobalSystemCollection('users');              // synchronous
```

### piece/cache -- Redis Caching

```javascript
import { initializeServiceCache, StandardTTL } from 'piece/cache';

const cache = await initializeServiceCache('{service-name}', config, {
  strategy: 'redis',
  extensions: { batch: true, database: true },
});

await cache.set(key, data, StandardTTL.MEDIUM);
```

| Constant | Seconds | Use Case |
|----------|---------|----------|
| `SHORT` | 60 | Temporary/volatile |
| `MEDIUM` | 300 | Default TTL |
| `LONG` | 3600 | Stable references |

### piece/email -- AWS SES Email Sending

```javascript
import { initializeEmail, sendEmail } from 'piece/email';

// Initialize once during service startup
initializeEmail(config);

// Send an email (with retry logic built in)
const result = await sendEmail('user@example.com', 'Subject', '<p>Hello</p>', {
  correlationId,
  retryAttempts: 3,
  retryDelay: 1000,
});
// result.messageId
```

Configuration via `EmailConfigSchema`: `SES_REGION`, `SES_ACCESS_KEY_ID`, `SES_SECRET_ACCESS_KEY`, `SES_CONFIGURATION_SET`, `FROM_EMAIL`, `FROM_NAME`, `DISABLE_EMAIL_SENDING`.

Development mode: set `DISABLE_EMAIL_SENDING=true` to skip actual sending (returns mock message ID).

### piece/encryption -- Sensitive Data

```javascript
import { encrypt, decrypt } from 'piece/encryption';

const encrypted = encrypt(sensitiveData, key);
const decrypted = decrypt(encrypted, key);
```

### piece/embedding -- Shared Embedding Pipeline (Optional)

```javascript
import { ChunkingService, EmbeddingService, QdrantVectorService, initializeQdrant } from 'piece/embedding';

await initializeQdrant(config);
const chunkingService = new ChunkingService();
const chunks = chunkingService.chunkDocument(content, { title, maxTokens: 500 });
```

### piece/test-utils -- Shared Test Utilities

NOT a runtime dependency -- used only in tests.

```javascript
import 'piece/test-utils/mocks/multitenancy';
import 'piece/test-utils/mocks/pubsub';
import 'piece/test-utils/mocks/config';
import 'piece/test-utils/mocks/redis';
```

Export paths: mocks (multitenancy, pubsub, auth, config, redis), helpers (express, mongodb, events), fixtures (users, teams).

## Service Init Order

```javascript
// 1. Config FIRST
import { config } from './config.js';

// 2. Logger
import { logger, createComponentLogger } from './utils/logger.js';

// 3. Express app
const app = express();

// 4-7. Middleware chain
app.use(helmet());                              // 4. Security
app.use(corsMiddleware);                        // 5. CORS
app.use(express.json({ limit: '10mb' }));       // 6. Body parsing (BEFORE logging)
app.use(createRequestLoggingMiddleware(logger)); // 7. Request logging

// 8. Health endpoint
// 9. Routes
// 10. Process error handlers

// 11. Start server FIRST
app.listen(port);

// 12. Background services init (AFTER listen)
initializeBackgroundServices()
  .then(() => { backgroundServicesReady = true; })
  .catch((err) => componentLogger.error('Background init failed', { error: err.message }));
```

## Anti-patterns

- **NEVER** use `console.log` -- use structured logger
- **NEVER** use `process.env` directly -- use config package
- **NEVER** import `jsonwebtoken` directly -- use auth-middleware
- **NEVER** configure CORS manually -- use cors-middleware
- **NEVER** access MongoDB directly -- use multitenancy package
- **NEVER** create PubSub events without validation -- use factory functions
- **NEVER** use `workspace:*` or `file:` in dependencies -- use `"*"`
- **NEVER** import auth middleware as direct named exports -- use factory
