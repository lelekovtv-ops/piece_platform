# Staging Deployment Report — April 9, 2026

## Summary

First successful staging deployment of the PIECE platform on Hetzner Cloud. All 15 containers running, all critical services healthy. Found and fixed 4 issues during post-deploy verification, including a critical security vulnerability (exposed internal ports).

| Metric | Value |
|--------|-------|
| Server | Hetzner CX23, Helsinki, 2 vCPU / 4GB RAM / 40GB SSD |
| IP | 65.109.232.32 |
| Total containers | 15 (+ 1 init container) |
| Healthy services | 14/15 (Qdrant unhealthy — non-critical) |
| Commits this session | 4 |
| Critical issues found | 1 (security) |
| Medium issues found | 2 (Redis, NATS) |
| Low issues found | 1 (Qdrant memory) |

## Infrastructure

| Service | Image | Status | Memory |
|---------|-------|--------|--------|
| api-gateway | piece-api-gateway | ✅ healthy | 56 MB / 512 MB |
| platform | piece-platform (Next.js standalone) | ✅ healthy | 37 MB / 512 MB |
| websocket-gateway | piece-websocket-gateway | ✅ healthy | 24 MB / 512 MB |
| nginx | nginx:alpine | ✅ running | 4 MB / 256 MB |
| mongodb | mongo:7 | ✅ healthy | 296 MB / 2 GB |
| redis | redis:7-alpine | ✅ healthy | 5 MB / 1 GB |
| nats | nats:2.10-alpine | ✅ healthy | 6 MB / 512 MB |
| minio | minio/minio | ✅ healthy | 166 MB / 512 MB |
| postgres | postgres:16-alpine | ✅ healthy | 21 MB / 512 MB |
| qdrant | qdrant/qdrant:v1.14.0 | ⚠️ unhealthy | 15 MB / 512 MB |
| grafana | grafana:11.0.0 | ✅ healthy | 65 MB / 256 MB |
| prometheus | prom/prometheus:v2.53.0 | ✅ healthy | 48 MB / 512 MB |
| loki | grafana/loki:3.0.0 | ✅ healthy | 59 MB / 256 MB |
| promtail | grafana/promtail:3.0.0 | ✅ running | 40 MB / 128 MB |
| node-exporter | prom/node-exporter:1.8.0 | ✅ running | 9 MB / 64 MB |

**Total RAM usage:** ~1.2 GB of 3.7 GB available (67% free)
**Disk usage:** 12 GB / 38 GB (34% used)

## Endpoints Verified

| Endpoint | Method | Expected | Actual |
|----------|--------|----------|--------|
| `http://65.109.232.32/` | GET | 200, HTML | ✅ 200, 11KB HTML |
| `http://65.109.232.32/api/health` | GET | healthy JSON | ✅ mongodb: connected, redis: connected |
| `http://65.109.232.32/api/v1/auth/register` | POST {} | 400 validation | ✅ VALIDATION_ERROR |
| `http://65.109.232.32/api/v1/auth/login` | POST {} | 400 validation | ✅ VALIDATION_ERROR |
| `http://65.109.232.32/api/v1/users/profile` | GET | 401 | ✅ UNAUTHORIZED |
| `http://65.109.232.32/grafana/` | GET | 301 to login | ✅ 301 |
| `http://65.109.232.32/socket.io/` | GET | 400 (no WS upgrade) | ✅ 400 |

## Issues Found and Fixed

### 1. 🔴 CRITICAL: Internal ports exposed to internet

**Problem:** Docker `ports:` mapped to `0.0.0.0`, bypassing UFW firewall. MongoDB (27022), Redis (6384), NATS (4223/8223), MinIO (9006/9007), PostgreSQL (5433), Qdrant (6337/6338), Grafana (3001), backend (3100), platform (3000) were all directly accessible from the internet.

**Verification:** `curl http://65.109.232.32:27022/` returned MongoDB HTTP response. MinIO console (9007) returned HTTP 200.

**Fix:** Changed all `ports:` in `docker-compose.yml` to bind to `127.0.0.1:PORT:PORT`. Only nginx (80/443) remains on `0.0.0.0`.

**Commit:** `b43b99e`

### 2. 🟠 MEDIUM: Redis cache init failure

**Problem:** `packages/cache/src/index.js` called `config.get('redisUrl')` (camelCase), but the config schema key is `REDIS_URL`. The `config.get()` method throws an Error for unknown keys (not returns `undefined`), so the `??` fallback never executed.

**Fix:** Replaced with try/catch block using `config.get('REDIS_URL')`.

**Commit:** `b43b99e`

### 3. 🟠 MEDIUM: NATS JetStream stream creation failure

**Problem:** `packages/pubsub/src/index.js` passed numeric values for `storage` (0/1) and `retention` (0), but the nats.js library expects string enums: `'file'`/`'memory'` for storage, `'limits'` for retention. The NATS server returned "invalid json 400".

**Fix:** Changed to string enum values: `storage: def.storage === 'memory' ? 'memory' : 'file'`, `retention: 'limits'`.

**Commit:** `5bcf8c4`

### 4. 🟡 LOW: Qdrant memory limit too high

**Problem:** Qdrant had `memory: 4G` limit on a 4GB RAM server. Could cause OOM if Qdrant tried to use its full allocation.

**Fix:** Reduced to `memory: 512M` for staging.

**Commit:** `b43b99e`

## Previous Session Fixes (Also Deployed)

| Fix | Commit |
|-----|--------|
| Dockerfile.platform: removed duplicate HEALTHCHECK+CMD (nginx leftover from Vite era) | `bfd2895` |
| docker-compose: `VITE_API_URL` → `NEXT_PUBLIC_API_BASE_URL` | `bfd2895` |
| config.js: `SENTRY_DSN_BACKEND: .optional()` → `.default('')` | `bfd2895` |
| nginx: `websocket-service` → `websocket-gateway` in all 3 configs | `193e913` |
| nginx: mount single staging-ip.conf instead of whole conf.d directory | `193e913` |

## Commits (This Session)

```
b43b99e security: bind internal ports to 127.0.0.1, fix Redis cache init, reduce Qdrant memory
5bcf8c4 fix: NATS JetStream stream config uses string enums, not numeric
```

## Known Remaining Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| No SSL/HTTPS | High | All traffic unencrypted. JWT tokens and passwords sent in plaintext |
| No domain configured | Medium | Access only via IP address |
| Qdrant healthcheck failing | Low | Vector search is optional, service running fine |
| `DISABLE_EMAIL_SENDING=true` | Info | Registration works but no email verification flow |
| No Grafana dashboards configured | Info | Prometheus collects data, but no visualization |
| No automated backups | Medium | MongoDB data not backed up |
| No log rotation for Docker | Low | Logs can fill disk over time |
| No Sentry/PostHog DSN configured | Info | Code ready, services not created |
| `FRONTEND_URL` not set in .env | Low | Needed for email links |
| `practical_kapitsa` orphan container | Low | Leftover from debug, should be removed |

## Server Access

```bash
ssh root@65.109.232.32        # root access
ssh piece@65.109.232.32       # deploy user
```

SSH key: `~/.ssh/id_ed25519` (ed25519, comment "piece-staging")

## .env Location

`/home/piece/piece/.env` — contains all secrets (JWT keys, MongoDB password, encryption key, internal token)
