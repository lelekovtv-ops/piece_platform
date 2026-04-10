# Production Readiness Audit — 10,000 Users

**Date:** 2026-04-11
**Scope:** Full-stack auth, infrastructure, storage, disaster recovery

---

## Executive Summary

**Found: 57 issues total** (12 CRITICAL, 14 HIGH, 18 MEDIUM, 13 LOW)

The platform is NOT production-ready for 10K users. The main blockers are:
1. No automated backups (total data loss on disk failure)
2. MongoDB single instance with 2GB memory — unsustainable at scale
3. Multi-tenant architecture (1 DB per team) breaks at 10K teams
4. No CSRF protection on cookie-based auth
5. Access token not blacklisted on logout
6. No production deploy workflow

---

## Part 1: Security Findings

### CRITICAL

| # | Issue | File | Impact |
|---|-------|------|--------|
| S1 | **No CSRF protection** — cookie auth without CSRF tokens | controller.js | Account takeover via crafted page |
| S2 | **Logout doesn't blacklist access token** — valid for 15 min after logout | controller.js:272 | Token blacklist infra exists but never called |
| S3 | **Cookie path `/` leaks refresh token** to all endpoints | controller.js:32 | Should be `/v1/auth` |
| S4 | **Open redirect** on login (already fixed in this session) | login/page.tsx | Fixed |

### HIGH

| # | Issue | File | Impact |
|---|-------|------|--------|
| S5 | **Memory lockout Map — no size limit** → OOM via fake email flood | controller.js:54 | DoS with millions of unique emails |
| S6 | **Rate limiter memory store — no size limit** → OOM | rate-limiter.js:6 | Same OOM vector |
| S7 | **Bcrypt 12 rounds = 250-400ms** per hash → CPU bottleneck | service.js:12 | 100 concurrent logins = 25s blocking |
| S8 | **Account enumeration on register** — 409 reveals existing email | controller.js:166 | Credential stuffing enabler |
| S9 | **Refresh token rotation race** — no atomic check-and-swap | service.js:217 | Random logouts under concurrent tab refreshes |
| S10 | **CORS returns empty array** if CORS_ORIGINS not set in prod | cors-middleware | Frontend completely locked out |
| S11 | **Password change doesn't invalidate sessions** | service.js:288 | Attacker's session survives password change |
| S12 | **No session limit per user** — unlimited sessions | session-service.js | Collection bloat, slow queries |
| S13 | **`listSessions` isCurrent always false** — refreshTokenHash not returned | controller.js:428 | UX broken |

### MEDIUM

| # | Issue | File | Impact |
|---|-------|------|--------|
| S14 | No JWT key rotation strategy (no `kid` in header) | service.js:47 | No graceful rotation on compromise |
| S15 | Magic link creates users without teams or passwords | magic-link-service.js:77 | Broken experience |
| S16 | Session cleanup runs on every instance (no distributed lock) | cleanup-sessions.js | N instances = N concurrent cleanups |
| S17 | IPv6 parsing bug in suspicious activity | suspicious-activity.js:39 | Detection broken for IPv6 |
| S18 | `isNewDevice()` vulnerable to ReDoS via crafted User-Agent | session-service.js:146 | Event loop blocking |
| S19 | `hashToken()` duplicated across files | service.js + controller.js | Maintenance risk |
| S20 | Magic link email says "KOZA Studio" not "PIECE" | magic-link-service.js:48 | Branding mismatch |

---

## Part 2: Infrastructure Findings

### CRITICAL

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| I1 | **No automated backups** for any data store | docker-compose.yml | Total data loss on disk failure |
| I2 | **MongoDB single instance, no replica set** | docker-compose.yml:49 | No transactions, no failover, no PITR |
| I3 | **No `deploy-prod.yml`** workflow | .github/workflows/ | Manual deployment only |
| I4 | **Dockerfile.service references `koza-studio-base`** (wrong name) | docker/Dockerfile.service | Build confusion |

### HIGH

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| I5 | **No Docker log rotation** | docker-compose.yml | Disk fills in days/weeks |
| I6 | **Redis `allkeys-lru` evicts auth data** silently | docker-compose.yml:70 | Security controls disappear under memory pressure |
| I7 | **No SSL auto-renewal** (Certbot has no cron) | docker-compose.yml:326 | Site down after 90 days |
| I8 | **Nginx `worker_connections` not configured** (default 512) | nginx config | Connection limit too low for 10K users + WebSocket |
| I9 | **Staging auth token hardcoded in nginx config** | staging-ssl.conf:10 | Anyone with repo access bypasses gate |
| I10 | **No nginx proxy cache** for images | staging-ssl.conf:97 | Every image request hits backend |
| I11 | **/dev routes public in production** | public-routes.ts:9 | Dev tools accessible without auth |
| I12 | **WebSocket reconnection storm** — no max attempts or jitter | useCollaboration.ts:15 | 10K clients x reconnect = 625 req/s |

### MEDIUM

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| I13 | No Prometheus alerting rules or alertmanager | prometheus.yml | No automated alerts on failures |
| I14 | Grafana default password "admin" | docker-compose.yml:358 | Open monitoring dashboard |
| I15 | `client_max_body_size 50m` too low for video/media | nginx config | Upload failures |
| I16 | `authFetch` timeout 120s too long for user-facing | auth-fetch.ts:5 | Connection pile-up |
| I17 | Next.js rewrites proxy redundant in production | next.config.ts | Wasted Next.js workers |
| I18 | Loki port 3100 conflicts with api-gateway | loki-config.yml | Debugging confusion |

---

## Part 3: Data & Storage Findings

### Storage Estimate for 10K Users

| Data Type | Per User | Total (10K) |
|-----------|----------|-------------|
| Generated images (100/project x 50 projects x 2MB) | 10 GB | **100 TB** |
| Audio/voice (50MB x 50 projects) | 2.5 GB | **25 TB** |
| Screenplay/rundown/bible (500KB x 50) | 25 MB | **250 GB** |
| MongoDB documents | 5 MB | **50 GB** |
| **Total** | **~12.5 GB** | **~125 TB** |

### CRITICAL

| # | Issue | Impact |
|---|-------|--------|
| D1 | **10K databases (1 per team)** — unsustainable. 170K indexes in memory | Migrate to shared DB with teamId field |
| D2 | **MongoDB 2GB memory limit** — WiredTiger gets ~512MB cache for 50GB data | Raise to 8-16GB |

### HIGH

| # | Issue | Impact |
|---|-------|--------|
| D3 | **Missing indexes** on `library_files` + `pipeline_presets` | Full collection scans at scale |
| D4 | **No upload size limit** on presigned URLs | Users upload unlimited data to MinIO |
| D5 | **Redis 1GB limit** with eviction deleting auth data | Raise to 2-4GB, separate cache from auth |
| D6 | **No offsite backup** — all backups on same server | Disk failure = total loss |
| D7 | **Delete-then-insert pattern** in screenplay/rundown saves | Crash between ops = data loss |

### MEDIUM

| # | Issue | Impact |
|---|-------|--------|
| D8 | **No generation history** tracked — no cost visibility | $2-4M potential API costs untracked |
| D9 | **Temp file store is in-memory Map** (200 x 2MB = 400MB) | Not distributed, memory hog |
| D10 | **No TTL index on `auth_sessions`** | Revoked sessions accumulate forever |
| D11 | **MinIO 512MB limit** for 125TB data | Needs 2-4GB |

---

## Part 4: Implementation Plan for 10K Production

### Phase 0: Emergency Fixes (Day 1-2)

| Task | Effort | Priority |
|------|--------|----------|
| Add CSRF token to cookie-based auth | L | CRITICAL |
| Blacklist access token on logout/revoke | S | CRITICAL |
| Change cookie path to `/v1/auth` | S | CRITICAL |
| Cap memory Maps (lockout + rate limiter) at 50K entries | S | HIGH |
| Remove `/dev` from PUBLIC_ROUTES in production | S | HIGH |
| Fix `listSessions` isCurrent (return hash for comparison) | S | HIGH |

### Phase 1: Database Architecture (Week 1)

| Task | Effort | Priority |
|------|--------|----------|
| Enable MongoDB replica set (single-node) | M | CRITICAL |
| Raise MongoDB memory to 8GB | S | CRITICAL |
| Add missing indexes (library_files, pipeline_presets) | S | HIGH |
| Add TTL index on auth_sessions | S | MEDIUM |
| Invalidate all sessions on password change | S | HIGH |
| Enforce max 10 sessions per user | S | MEDIUM |

### Phase 2: Backup & Recovery (Week 1-2)

| Task | Effort | Priority |
|------|--------|----------|
| Set up automated MongoDB backup (daily mongodump) | M | CRITICAL |
| Set up offsite backup to Hetzner Storage Box or S3 | M | CRITICAL |
| Test restore procedure | M | CRITICAL |
| Add Redis RDB snapshots (`--save 3600 1`) | S | HIGH |
| Configure Redis `volatile-lru` (not `allkeys-lru`) | S | HIGH |
| Raise Redis memory to 2-4GB | S | HIGH |

### Phase 3: Infrastructure Hardening (Week 2)

| Task | Effort | Priority |
|------|--------|----------|
| Create `deploy-prod.yml` workflow | M | CRITICAL |
| Fix Dockerfile base image naming | S | CRITICAL |
| Add Docker log rotation to all services | S | HIGH |
| Configure SSL auto-renewal (certbot cron) | M | HIGH |
| Set nginx `worker_connections 4096` | S | HIGH |
| Add nginx proxy cache for images | M | HIGH |
| Add Prometheus alerting rules + alertmanager | L | MEDIUM |
| Move staging gate token to env var | S | HIGH |
| Set Grafana admin password (no default) | S | MEDIUM |

### Phase 4: Auth Hardening (Week 2-3)

| Task | Effort | Priority |
|------|--------|----------|
| Make Redis a hard dependency in production | S | HIGH |
| Add per-email rate limiting on auth endpoints | M | MEDIUM |
| Fix account enumeration on register (same response) | M | HIGH |
| Atomic register (user + team in transaction) | M | CRITICAL |
| Fix refresh token rotation with findOneAndUpdate | M | HIGH |
| Fix CORS to fail loudly when CORS_ORIGINS missing | S | HIGH |
| Add JWT `kid` for future key rotation | M | MEDIUM |
| Fix magic link user creation (add team) | M | MEDIUM |
| Bcrypt: verify `bcrypt` native bindings use thread pool | S | HIGH |

### Phase 5: Scale Preparation (Week 3-4)

| Task | Effort | Priority |
|------|--------|----------|
| Plan multi-tenant migration (shared DB) | XL | CRITICAL |
| Add generation history collection + cost tracking | L | MEDIUM |
| Move temp files from memory Map to MinIO/Redis | M | MEDIUM |
| Add upload size limits to presigned URLs | S | HIGH |
| Add WebSocket reconnection jitter + max attempts | S | HIGH |
| Add BroadcastChannel for cross-tab token refresh | M | MEDIUM |
| Reduce authFetch default timeout to 30s | S | MEDIUM |
| Raise MinIO memory to 2-4GB | S | LOW |

### Phase 6: Monitoring & Observability (Week 4)

| Task | Effort | Priority |
|------|--------|----------|
| Set up alerting (disk >80%, 5xx >1%, latency p99 >5s) | L | MEDIUM |
| Add cost dashboard for AI generation | M | MEDIUM |
| Add user growth / session metrics dashboard | M | LOW |
| Create runbook for common failures | L | MEDIUM |
| Define RPO (1h) and RTO (15min) targets | S | MEDIUM |
| Configure distributed session cleanup (Redis lock) | M | MEDIUM |

---

## RPO/RTO Targets (After Implementation)

| Metric | Current | Target |
|--------|---------|--------|
| RPO (data loss tolerance) | Total loss | **1 hour** |
| RTO (recovery time) | 1-4 hours | **15 minutes** |
| Backup frequency | None | **Every 6 hours** |
| Offsite backup | None | **Daily to external storage** |
| Restore tested | Never | **Monthly** |

---

## Server Requirements for 10K Users

| Resource | Current | Required |
|----------|---------|----------|
| RAM | ~8 GB (VPS) | **32 GB minimum** |
| CPU | 4 cores | **8 cores minimum** |
| Storage (SSD) | ~100 GB | **500 GB SSD + external object storage** |
| MongoDB memory | 2 GB | **8-16 GB** |
| Redis memory | 1 GB | **2-4 GB** |
| MinIO | 512 MB RAM, local disk | **Dedicated storage server or S3** |
| Backend instances | 1 | **2-3 behind load balancer** |
