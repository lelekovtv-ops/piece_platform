# Audit Workflow

## Purpose

Ensures code quality, security, and architecture compliance before changes are merged.

## When to Audit

### Mandatory (before merge)

- New API endpoints or route changes
- Database schema modifications
- Authentication or authorization changes
- PubSub topic additions or event schema changes
- Dependency additions or major version upgrades
- Configuration changes (env variables, Docker Compose)
- Dockerfile or Docker Compose changes

### Recommended

- UI component additions
- Styling changes
- Test additions

### Skip

- README or comment-only changes
- CI/CD configuration (unless it affects build/deploy logic)

## Audit Steps

### Step 1: Hardcoded Secrets Scan

Search the entire codebase for hardcoded secrets. Highest priority check.

**Scan for:**

- MongoDB URIs: `mongodb://`, `mongodb+srv://`
- Service account keys: `"type": "service_account"`
- JWT secrets: `jwt_secret`, `JWT_SECRET` assigned to string literals
- API keys: patterns like `AIza`, `sk-`, `key-`, `token-`
- Passwords: string assigned to `password`, `secret`, `passwd`
- `.env` files that should not be committed

**How to scan:**

```bash
grep -rn "mongodb://" apps/ packages/ --include="*.js"
grep -rn "jwt_secret\|JWT_SECRET" apps/ packages/ | grep -v "process.env\|config\."
grep -rn "AIza\|sk-\|api_key\s*=\s*['\"]" apps/ packages/
```

**Expected:** Zero matches. All secrets must be in `.env` files (never committed).

### Step 2: Error Handling Verification

- [ ] All async route handlers use try/catch or Express error middleware
- [ ] Error responses follow flat format: `{ error, message, details }` -- NO `{ success: false }`
- [ ] Proper HTTP status codes (400/401/403/404/500)
- [ ] No error responses leak stack traces in production
- [ ] `process.on('unhandledRejection')` in every service entry point
- [ ] `process.on('uncaughtException')` in every service entry point
- [ ] Process handlers call `process.exit(1)` after logging
- [ ] PubSub event handlers have try/catch blocks
- [ ] Middleware chain: `helmet -> cors -> express.json -> createRequestLoggingMiddleware`

### Step 3: Event Naming Validation

- [ ] All events created via validation factory functions
- [ ] No inline event object creation
- [ ] Every event includes `correlationId`
- [ ] Event schemas match between publisher and subscriber

### Step 4: Database Pattern Verification

- [ ] All per-team MongoDB access via `piece/multitenancy`
- [ ] All system-wide access via `getSystemDb()` / `getGlobalSystemCollection()`
- [ ] No direct MongoDB driver imports outside multitenancy package
- [ ] Per-team isolation enforced
- [ ] Index creation centralized (not in route handlers)
- [ ] No cross-tenant data access possible

### Step 5: Logging Compliance

- [ ] No `console.log`, `console.warn`, `console.error` in backend code
- [ ] All logging uses `createLogger()` from structured logger
- [ ] Log messages include structured context objects
- [ ] No sensitive data in log messages
- [ ] `correlationId` present in request-scoped logs

### Step 6: Container Security

- [ ] Shared Dockerfile uses `node:20-alpine`
- [ ] `GET /health` endpoint present in every service
- [ ] No secrets baked into Docker images
- [ ] Docker Compose healthcheck configured
- [ ] Secrets passed via `.env` file (not hardcoded in `docker-compose.yml`)

### Step 7: ESLint Strict Compliance

- [ ] `pnpm run lint` reports 0 errors AND 0 warnings
- [ ] Zero `eslint-disable` comments in codebase
- [ ] All warnings fixed -- not suppressed

### Step 8: Test Coverage Verification

- [ ] All tests pass (`pnpm exec vitest run`)
- [ ] New services have `vitest.config.js`
- [ ] New services have `"test": "vitest run"` in `package.json`
- [ ] Test files use `vi.mock()` before imports
- [ ] No `jest` imports or `jest.fn()` -- use `vi.fn()`
- [ ] No `console.log` in test files
- [ ] No `.only` or `.skip` without documented reason
- [ ] No real API keys or secrets in test fixtures

## Audit Report Format

```markdown
# Audit Report -- [Date]

## Summary

- **Services scanned:** N
- **Critical issues:** N
- **Warnings:** N
- **Info:** N

## Findings

### Critical

1. [Finding with file path and line number]

### Warnings

1. [Finding with file path]

### Info

1. [Finding]

## Recommendations

1. [Specific actionable recommendation]
```

## Plan Audit Rules

Every plan MUST include:

- **Last step:** "Final audit: build + code + error-patterns + docs"
- **For plans with 5+ steps:** intermediate audits every 5 steps
- Audit cannot be skipped even if "changes are minor"
- Plan cannot be marked completed without passing audit
- Tech debt found during audit goes into plan's "Tech Debt Discovered" section
