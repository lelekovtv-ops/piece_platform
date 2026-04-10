# EISERN Phase 0-3 Implementation Session

**Date:** 2026-04-11
**Duration:** Single session
**Branch:** `dev` (uncommitted)

---

## What Was Done

### Phase 0: Observability & Safety Nets (6 tasks)

| Task | File | Change |
|------|------|--------|
| .dockerignore | `.dockerignore` | NEW — excludes node_modules, .git, tests, docs, .claude, .github |
| Docker log rotation | `docker-compose.yml` | `x-common-logging` anchor (json-file, 50m x 5) applied to all 16 services |
| Prometheus alerting | `docker/prometheus/alert-rules.yml` | NEW — 11 rules: ServiceDown, HighErrorRate, HighLatencyP99, HighDiskUsage, CriticalDiskUsage, HighMemoryUsage, HighCpuUsage, MongoDBDown, RedisDown, WebSocketGatewayDown, HighWebSocketConnections |
| Prometheus config | `docker/prometheus/prometheus.yml` | Added `rule_files:` section |
| Grafana password | `docker-compose.yml` | `:-admin` → `:?must be set in .env` (fail-fast) |
| Health check | `apps/backend/piece/src/index.js` | Added NATS check, version, uptime, `/health/live`, `/health/ready` |
| BACKUP-STRATEGY.md | `docs/BACKUP-STRATEGY.md` | Fixed lie about Redis `--save` config |

### Phase 1: Infrastructure Hardening (7 tasks)

| Task | File | Change |
|------|------|--------|
| MongoDB replica set | `docker-compose.yml` | `--replSet rs0 --bind_ip_all`, `mongo-init-replica` service, `?replicaSet=rs0&authSource=admin` in URI |
| Redis hardening | `docker-compose.yml` | `allkeys-lru` → `volatile-lru`, added `--save 900 1 --save 300 10`, memory 1GB → 2GB |
| Backup scripts | `scripts/backup-mongodb.sh`, `scripts/backup-redis.sh` | NEW — mongodump with --oplog, BGSAVE + copy, 7-day retention |
| SSL auto-renewal | `docker-compose.yml` | Certbot entrypoint with 12h renewal loop |
| Nginx hardening | `nginx/nginx.conf`, `nginx/docker-entrypoint.sh`, `docker-compose.yml` | NEW main config (worker_connections 2048), envsubst for staging gate token, healthcheck, proxy_cache |
| CSP headers | `apps/backend/piece/src/index.js` | Explicit helmet CSP: default-src self, script-src self, style-src self unsafe-inline, img-src self data blob amazonaws, frame-ancestors none |
| Duplicate nginx configs | `nginx/conf.d/` | Deleted `staging-ip 2.conf`, `staging-ssl 2.conf` |

### Phase 2: Auth Hardening (11 tasks)

| Task | File | Change |
|------|------|--------|
| Atomic refresh rotation | `service.js` | `findOneAndUpdate` instead of find+update; reuse detection (stale token → revoke all user tokens) |
| Logout blacklisting | `controller.js`, `index.js` | Logout extracts jti+exp from req.user, calls tokenBlacklist.blacklist(); exported getTokenBlacklist() |
| Session invalidation | `service.js`, `controller.js` | changePassword() calls revokeAllUserTokens(userId, exceptTokenHash); controller passes current cookie hash |
| Cookie path | `controller.js` | path `/` → `/v1/auth`; old cookie cleared for migration |
| Memory Map limits | `controller.js`, `rate-limiter.js` | 10K cap with FIFO eviction on both memoryLockout and memoryStore |
| Account enumeration | `controller.js` | EMAIL_TAKEN returns 201 with `{ user: {email}, accessToken: null }` instead of 409 CONFLICT |
| Max 10 sessions | `session-service.js` | Count active sessions before insert; if ≥10, revoke oldest by lastActiveAt |
| Magic link teams | `magic-link-service.js` | After user creation via magic link, calls teamService.create() in try/catch |
| JWT kid | `service.js` | Added `keyid: 'v1'` to jwt.sign options |
| CSRF protection | `middleware/csrf.js`, `controller.js`, `index.js` | NEW double-submit cookie middleware; piece_csrf cookie set on login/register/refresh/magic-link; X-CSRF-Token header validated on POST/PUT/DELETE/PATCH |
| /dev removal | `public-routes.ts` | Removed `/dev` from PUBLIC_ROUTES array |

### Phase 3: Frontend Security (4 tasks)

| Task | File | Change |
|------|------|--------|
| CSRF integration | `auth-fetch.ts` | Reads piece_csrf cookie, sends X-CSRF-Token header on non-GET requests |
| Request timeout | `auth-fetch.ts` | 120s → 30s |
| BroadcastChannel | `auth-channel.ts`, `auth-store.ts`, `AuthProvider.tsx` | NEW cross-tab auth sync; logout in tab A → tab B redirects to /login |
| WebSocket jitter | `useCollaboration.ts` | Added jitter: delay * (0.5 + random * 0.5); max 10 reconnect attempts |

---

## Audit Findings (Post-Implementation)

### Fixed During Audit

1. **Account enumeration response shape leak** — response shape differed (user+accessToken vs user+message). Fixed to identical shape.
2. **Password change didn't preserve current session** — revokeAllUserTokens called without exceptTokenHash. Fixed: controller passes current cookie hash.
3. **Duplicate setRefreshTokenCookie in register** — cookie set twice. Removed duplicate.
4. **Staging gate token fallback** — predictable default `psg_default_change_me`. Changed to fail-fast `${VAR:?Error}`.

### Remaining Issues

1. **Account enumeration incomplete** — `accessToken: null` vs real token still distinguishable. Needs two-step register flow (Sprint 1.6).
2. **`unsafe-inline` in CSP** — required by Tailwind. Needs nonce-based approach.
3. **Frontend build broken** — duplicate routes `/(main)/` vs root app. Pre-existing. Sprint 1.1.
4. **Auth tests missing** — 0 tests for 11 new security features. Sprint 1.2.
5. **hashToken duplicated** — in controller.js:20 and service.js:35. Sprint 1.4.
6. **Magic link says "KOZA Studio"** — lines 47, 57 in magic-link-service.js. Sprint 1.5.
7. **No TTL index on auth_sessions** — collection grows forever. Sprint 1.3.

---

## Files Changed (All Uncommitted on `dev`)

### New Files
- `.dockerignore`
- `docker/prometheus/alert-rules.yml`
- `nginx/nginx.conf`
- `nginx/docker-entrypoint.sh`
- `scripts/backup-mongodb.sh`
- `scripts/backup-redis.sh`
- `apps/backend/piece/src/middleware/csrf.js`
- `apps/frontend/src/lib/auth/auth-channel.ts`
- `docs/EISERN-MASTER-PLAN.md`

### Modified Files
- `docker-compose.yml`
- `docker/prometheus/prometheus.yml`
- `docs/BACKUP-STRATEGY.md`
- `nginx/conf.d/staging-ssl.conf`
- `apps/backend/piece/src/index.js`
- `apps/backend/piece/src/modules/auth/controller.js`
- `apps/backend/piece/src/modules/auth/service.js`
- `apps/backend/piece/src/modules/auth/session-service.js`
- `apps/backend/piece/src/modules/auth/magic-link-service.js`
- `apps/backend/piece/src/middleware/rate-limiter.js`
- `apps/frontend/src/lib/auth/auth-fetch.ts`
- `apps/frontend/src/lib/auth/auth-store.ts`
- `apps/frontend/src/lib/auth/public-routes.ts`
- `apps/frontend/src/components/app/AuthProvider.tsx`
- `apps/frontend/src/hooks/useCollaboration.ts`

### Deleted Files
- `nginx/conf.d/staging-ip 2.conf`
- `nginx/conf.d/staging-ssl 2.conf`

---

## Verification Status

| Check | Result |
|-------|--------|
| `pnpm run lint` | 0 errors, 2 warnings (pre-existing in websocket-gateway) |
| `pnpm run build` | FAILS — pre-existing duplicate route pages (not our change) |
| Backend syntax | OK — starts without errors |

---

## Next Steps

Full remaining plan: `docs/EISERN-MASTER-PLAN.md` (5 sprints, 10 weeks)

**Sprint 1 priority:** Fix frontend build (delete duplicate routes), write auth tests, TTL index, deduplicate hashToken, fix branding, complete enumeration fix.

**All changes are uncommitted.** Commit when ready:
```bash
git add -A
git commit -m "feat(eisern): phase 0-3 production hardening — infra, auth, frontend security"
```
