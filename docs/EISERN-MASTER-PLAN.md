# EISERN Master Plan — Complete Roadmap

**Created:** 2026-04-11
**Scope:** All unresolved issues from 3 audits + EISERN Phase 0-3 gaps + Phase 4-6
**Timeline:** 10 weeks (1 developer)
**Branch:** `dev`

---

## Current State (Verified)

### Done (Phase 0-3)
- Docker log rotation, .dockerignore, Prometheus alerting, Grafana password
- MongoDB replica set, Redis hardening (volatile-lru, --save, 2GB)
- Backup scripts, SSL auto-renewal, nginx hardening (worker_connections, healthcheck)
- CSP headers, certbot renewal loop
- Atomic refresh rotation, logout blacklisting, session invalidation on password change
- Cookie path /v1/auth, memory Map limits 10K, max 10 sessions
- Magic link team creation, JWT kid v1
- CSRF double-submit cookie (backend + frontend)
- /dev removed from PUBLIC_ROUTES, BroadcastChannel, WS jitter, timeout 30s

### Not Done (Verified Gaps)
- deploy-prod.yml missing
- prod.conf has localhost placeholders
- Frontend build broken (duplicate routes)
- Auth tests for 11 new features missing
- TTL index on auth_sessions missing
- hashToken duplicated (controller.js + service.js)
- Magic link email says "KOZA Studio"
- No CDN, no load testing executed, no GDPR, no dependency scanning
- 20 of 23 TUV gaps open
- Multi-instance: memoryLockout/rate-limiter/rolesCache not distributed
- Account enumeration partially fixed (accessToken: null leaks)

---

## Sprint 1: Production Blockers (Week 1-2)

> Without these, production deploy is impossible.

### 1.1 Fix frontend build — duplicate routes [M]
- DELETE root-level route pages that duplicate `(main)/` group
- Keep `(main)/` versions (they have auth layout)
- Routes to delete: `/projects/page.tsx`, `/project/`, `/settings/`, `/scriptwriter/`, `/studio/`, `/workspace/`, `/bible/`, `/board/`, `/export/`, `/library/`, `/piece/`, `/production/`
- Keep root: `/login/page.tsx` (simple version), `/healthz/`, `/home/`
- **Files:** `apps/frontend/src/app/` — ~12 page.tsx files to delete
- **Verify:** `pnpm run build` exits 0

### 1.2 Auth test coverage [L]
- CREATE tests for all 11 new security features:
  1. Atomic refresh rotation — concurrent requests, only 1 succeeds
  2. Reuse detection — old token outside grace period revokes all
  3. Logout blacklists access token — jti blacklisted, TTL correct
  4. Session invalidation on password change — other sessions revoked, current preserved
  5. Cookie path `/v1/auth` — set correctly
  6. Memory Map limits — 10,001 entries → stays 10,000
  7. Account enumeration — same status code for new and existing email
  8. Max 10 sessions — 11th revokes oldest
  9. Magic link creates team
  10. JWT kid present in token header
  11. CSRF — POST without token → 403, with token → success
- **Files:** `apps/backend/piece/src/modules/auth/__tests__/security-hardening.test.js`
- **Verify:** `pnpm test` passes, coverage >80% for auth module

### 1.3 TTL index on auth_sessions [S]
- ADD `expireAfterSeconds` TTL index on auth_sessions for auto-cleanup
- Revoked sessions: expire after 7 days
- **File:** `apps/backend/piece/src/db/initialize-system-indexes.js`
- **Verify:** `mongosh` shows TTL index

### 1.4 Deduplicate hashToken [S]
- MOVE `hashToken` to shared utility file `apps/backend/piece/src/modules/auth/utils.js`
- IMPORT in both controller.js and service.js
- **Files:** Create `utils.js`, edit `controller.js`, `service.js`
- **Verify:** grep shows single definition

### 1.5 Fix magic link branding [S]
- REPLACE "KOZA Studio" → "PIECE" in magic-link-service.js (lines 47, 57)
- **File:** `apps/backend/piece/src/modules/auth/magic-link-service.js`
- **Verify:** grep -r "KOZA Studio" returns 0 matches in auth module

### 1.6 Account enumeration — complete fix [M]
- CHANGE register flow: always return `{ message: "Check your email" }` for both new and existing
- Frontend: after register → redirect to "check your email" page
- Login with credentials only after email verification
- **Files:** `controller.js`, frontend register page, auth-store.ts
- **Verify:** Response identical for new/existing email (no accessToken in either)

### Sprint 1 Verification
```
pnpm run lint      → 0 errors
pnpm run build     → exit 0
pnpm test          → all pass
```

---

## Sprint 2: Production Pipeline (Week 3-4)

> Deploy infrastructure and production nginx.

### 2.1 deploy-prod.yml [L]
- CREATE `.github/workflows/deploy-prod.yml`
- Trigger: push to `main` branch
- Steps: lint gate → build gate → generate .env from secrets → scp .env → SSH → git pull → docker build base → docker compose build → docker compose up → health check loop (20 attempts, 10s)
- Add rollback step on health check failure
- **File:** `.github/workflows/deploy-prod.yml`
- **Verify:** Push test to main → workflow runs → all services healthy

### 2.2 Finalize prod.conf [M]
- REPLACE all `localhost` placeholders with actual domain variables
- Configure for real domain: `{domain}`, `api.{domain}`, `app.{domain}`
- Add SSL paths for production Let's Encrypt certs
- Add rate limiting zones (same as staging)
- **File:** `nginx/conf.d/prod.conf`
- **Verify:** `nginx -t` passes with production config

### 2.3 Production Docker Compose overrides [M]
- CREATE `docker-compose.prod.yml` with production-specific settings:
  - MongoDB memory: 8GB (up from 2GB)
  - MinIO memory: 2GB (up from 512MB)
  - Remove dev port bindings (127.0.0.1:*)
  - Use prod.conf instead of staging-ssl.conf for nginx
- **File:** `docker-compose.prod.yml`
- **Verify:** `docker compose -f docker-compose.yml -f docker-compose.prod.yml config` is valid

### 2.4 Nginx TLS hardening [S]
- ADD to prod.conf and staging-ssl.conf:
  ```
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_prefer_server_ciphers on;
  ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:...';
  ```
- DISABLE TLS 1.0/1.1 explicitly
- **Files:** `nginx/conf.d/prod.conf`, `nginx/conf.d/staging-ssl.conf`
- **Verify:** `testssl.sh` shows no TLS 1.0/1.1

### 2.5 Permissions-Policy header [S]
- ADD to nginx configs:
  ```
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()";
  ```
- **Files:** nginx conf.d configs
- **Verify:** Response headers include Permissions-Policy

### 2.6 Missing database indexes [S]
- ADD indexes on: `library_files` (teamId + createdAt), `pipeline_presets` (teamId)
- **File:** `apps/backend/piece/src/db/initialize-system-indexes.js`
- **Verify:** `db.collection.getIndexes()` shows new indexes

### Sprint 2 Verification
```
pnpm run lint → 0 errors
pnpm run build → exit 0
pnpm test → all pass
Deploy to staging → all services healthy
```

---

## Sprint 3: CDN + Load Testing + DDoS (Week 5-6)

> Performance validation and external protection.

### 3.1 Cloudflare setup [L]
- REGISTER domain with Cloudflare (free tier)
- DNS proxy mode: orange cloud on A/CNAME records
- Page rules: cache static assets, bypass cache for /v1/ API
- Firewall rules: rate limit /v1/auth/* to 20 req/min per IP
- **Deliverable:** Domain resolves through Cloudflare, L7 DDoS protection active
- **Verify:** `dig +short {domain}` returns Cloudflare IPs; `curl -I` shows CF headers

### 3.2 Run k6 load tests [M]
- EXECUTE existing `tests/load/k6-load-test.js` against staging
- ADD auth-specific scenarios:
  - 100 concurrent logins
  - 50 concurrent token refreshes
  - Registration under load
  - CSRF validation under load
- RECORD baseline metrics: p50, p95, p99 latency, error rate, throughput
- IDENTIFY bottlenecks
- **File:** `tests/load/k6-load-test.js` (extend)
- **Verify:** Report with baseline numbers documented

### 3.3 Deep health checks [M]
- EXTEND `/health` endpoint to check ALL 7 dependencies:
  - MongoDB (exists) ✓
  - Redis (exists) ✓
  - NATS (exists) ✓
  - MinIO — `mc ready local` or HTTP check
  - Qdrant — HTTP /healthz
  - Postgres — `pg_isready`
  - Email (SES) — connectivity check
- **File:** `apps/backend/piece/src/index.js`
- **Verify:** `curl /health` shows all 7 dependency statuses

### 3.4 Dependency scanning in CI [M]
- ADD to `ci.yml`:
  - `pnpm audit --audit-level=high` step
  - Dependabot config for weekly scans
- CREATE `.github/dependabot.yml`
- **Files:** `.github/workflows/ci.yml`, `.github/dependabot.yml`
- **Verify:** CI runs audit, Dependabot creates first PR

### 3.5 Upload size limits on presigned URLs [S]
- ADD max upload size (50MB per file) to presigned URL generation
- ADD server-side validation before accepting upload completion
- **Files:** `apps/backend/piece/src/modules/upload/` (find presigned URL generator)
- **Verify:** Upload >50MB → rejected

### Sprint 3 Verification
```
k6 load test → p99 < 2s at 100 concurrent users
Cloudflare active → CF-Ray header present
pnpm test → all pass
```

---

## Sprint 4: Data Safety + Multi-Instance (Week 7-8)

> Fix distributed state issues and data integrity.

### 4.1 Redis-based rate limiter for production [M]
- MODIFY rate-limiter.js: in production, REQUIRE Redis (not fallback to memory)
- Memory fallback only in development
- **File:** `apps/backend/piece/src/middleware/rate-limiter.js`
- **Verify:** Start without Redis in production → clear error; start with Redis → rate limiting works

### 4.2 Redis-based account lockout [M]
- MODIFY controller.js: in production, REQUIRE Redis for lockout (not fallback to memory Map)
- Memory Map only in development
- **File:** `apps/backend/piece/src/modules/auth/controller.js`
- **Verify:** Account lockout persists across backend restarts (Redis-backed)

### 4.3 Distributed session cleanup [S]
- ADD Redis distributed lock to session cleanup job
- Only one instance runs cleanup at a time
- **File:** `apps/backend/piece/src/jobs/cleanup-sessions.js`
- **Verify:** Start 2 instances → only 1 runs cleanup

### 4.4 Generation history collection [L]
- CREATE `generation_history` collection schema
- TRACK every AI generation: provider, model, prompt length, cost, duration, status
- ADD cost aggregation endpoint `/v1/admin/generation-costs`
- **Files:** New model + service + route in generation module
- **Verify:** Generate image → record appears in generation_history

### 4.5 Move temp files to MinIO [M]
- REPLACE in-memory temp file Map with MinIO `koza-temp` bucket
- Use presigned URLs for temp storage
- TTL: auto-delete after 1 hour (MinIO lifecycle rule)
- **Files:** Find temp file Map in generation module, refactor to MinIO
- **Verify:** Generate image → temp file in MinIO, not in memory

### 4.6 Screenplay save — atomic replace [M]
- FIX delete-then-insert pattern in screenplay/rundown saves
- Use MongoDB transactions (replica set now available)
- **Files:** `apps/backend/piece/src/modules/screenplay/`, `rundown/`
- **Verify:** Crash during save → old data preserved (not lost)

### Sprint 4 Verification
```
pnpm test → all pass
Load test with 2 backend instances → lockout + rate limit consistent
Generation creates history records
```

---

## Sprint 5: Compliance + Documentation (Week 9-10)

> GDPR, API docs, runbooks, final hardening.

### 5.1 GDPR data export [L]
- CREATE `/v1/users/me/export` endpoint
- Export all user data: profile, projects, screenplays, bibles, generations, sessions
- Format: JSON archive (zip)
- **Files:** New controller/service in users module
- **Verify:** `GET /v1/users/me/export` → downloads zip with all user data

### 5.2 GDPR data deletion [L]
- CREATE `/v1/users/me/delete` endpoint
- Soft delete: mark account, schedule hard delete in 30 days
- Hard delete: remove all user data across all team databases
- Send confirmation email before deletion
- **Files:** New controller/service in users module
- **Verify:** Delete request → account marked → 30 days → data removed

### 5.3 API documentation (OpenAPI) [L]
- CREATE OpenAPI 3.0 spec for all `/v1/` endpoints
- Serve via Swagger UI at `/docs` (internal only)
- **Files:** `apps/backend/piece/src/docs/openapi.yml`, swagger middleware
- **Verify:** `GET /docs` shows Swagger UI with all endpoints

### 5.4 Secrets rotation runbook [M]
- DOCUMENT step-by-step procedure for rotating:
  - JWT keys (using kid v1 → v2 with dual-key verification)
  - ENCRYPTION_KEY (re-encrypt data)
  - MONGO_ROOT_PASSWORD
  - INTERNAL_TOKEN
  - SES credentials
- **File:** `docs/runbooks/secret-rotation.md`
- **Verify:** Document reviewed, rotation tested on staging

### 5.5 Incident runbook [M]
- DOCUMENT common failure scenarios:
  - MongoDB down → symptoms, diagnosis, recovery
  - Redis down → degraded mode behavior, recovery
  - NATS down → impact, recovery
  - SSL expired → manual renewal steps
  - Disk full → cleanup, expansion
  - Memory OOM → identify service, restart, investigation
  - Auth failure spike → lockout check, brute force check
- **File:** `docs/runbooks/incident-response.md`

### 5.6 Disaster recovery test [M]
- EXECUTE full backup → restore cycle on staging:
  1. Take MongoDB backup with oplog
  2. Take Redis backup
  3. Drop databases
  4. Restore from backup
  5. Measure RTO (target: <30 minutes)
  6. Verify data integrity
- **Deliverable:** Documented RPO/RTO measurements

### 5.7 Final security checklist [L]
- RUN through all 57 original audit issues + 23 TUV gaps
- MARK each as: RESOLVED / MITIGATED / ACCEPTED RISK / DEFERRED
- GENERATE final audit report
- **File:** `docs/reports/eisern-final-audit.md`

### Sprint 5 Verification
```
pnpm test → all pass
pnpm run build → exit 0
GDPR export works
DR test passes
All 80 audit items have a status
```

---

## Dependency Graph

```
Sprint 1 (blockers)
  1.1 Fix build ──→ all subsequent sprints need green build
  1.2 Auth tests ──→ validates Sprint 0-3 work
  1.6 Enum fix ──→ changes register flow
  ↓
Sprint 2 (deploy pipeline)
  2.1 deploy-prod.yml ──→ 2.3 prod overrides
  2.2 prod.conf ──→ 2.4 TLS hardening
  ↓
Sprint 3 (performance)
  3.1 Cloudflare ──→ 3.2 load tests (test behind CDN)
  3.4 Dependency scanning (independent)
  ↓
Sprint 4 (data safety)
  4.1 Redis rate limiter ┐
  4.2 Redis lockout      ├──→ multi-instance safe
  4.3 Distributed cleanup ┘
  4.4 Generation history (independent)
  4.6 Atomic saves ← needs replica set (done)
  ↓
Sprint 5 (compliance)
  5.1-5.2 GDPR (independent)
  5.3 API docs (independent)
  5.6 DR test ← needs backup scripts (done)
  5.7 Final audit ← needs all previous sprints
```

---

## Timeline Summary

| Sprint | Weeks | Days | Focus | Key Deliverable |
|--------|-------|------|-------|-----------------|
| 1 | 1-2 | 10 | Production blockers | Build green, tests pass |
| 2 | 3-4 | 10 | Deploy pipeline | deploy-prod.yml works |
| 3 | 5-6 | 10 | CDN + Load testing | Baseline metrics, Cloudflare |
| 4 | 7-8 | 10 | Data safety | Multi-instance safe |
| 5 | 9-10 | 10 | Compliance | GDPR, DR tested, final audit |
| **Total** | **10** | **50** | | |

---

## Accepted Risks (Not in Scope)

| Risk | Reason | Mitigation |
|------|--------|------------|
| Network segmentation (V7) | Docker Compose limitation | Cloudflare provides L7 protection |
| Database encryption at rest (V8) | MongoDB Community lacks native encryption | Disk encryption at OS level on Hetzner |
| Container image scanning (V5) | Low ROI for current scale | Dependabot covers npm deps |
| Feature flags (V19) | Premature for current user count | Manual deploy control sufficient |
| i18n (V21) | react-i18next not installed, large effort | English-only MVP acceptable |
| Accessibility (V22) | Large effort, separate initiative | Track as separate project |
| Frontend bundle budget (V23) | Optimization phase, not hardening | Monitor via Lighthouse |
| Cookie prefix __Host- (V10) | Breaking change for existing sessions | Current SameSite+Secure sufficient |
| DNS security DNSSEC (V11) | Registrar-level change | Cloudflare provides DNS protection |
| Multi-tenant migration (D1) | 4-8 weeks alone, separate project | Monitor at 1K teams, plan migration |

---

## Success Criteria

| Metric | Current | Target |
|--------|---------|--------|
| Build | BROKEN | Green (exit 0) |
| Auth test coverage | ~40% | >80% |
| Lint | 0 errors | 0 errors, 0 warnings |
| Load test p99 | Unknown | <2s at 100 concurrent |
| RPO | Unknown | <6 hours (measured) |
| RTO | Unknown | <30 minutes (measured) |
| Audit issues resolved | 35/80 | 70/80 |
| GDPR compliance | None | Export + deletion working |
| Production deploy | Manual | Automated via GitHub Actions |
| DDoS protection | None | Cloudflare free tier |
