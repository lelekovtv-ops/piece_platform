# Session Report — 2026-04-09/10

## Auth Master Plan: Full Implementation + Deployment

### Duration: ~6 hours

---

## What was done

### Phase 0: Critical Data Integrity Bug
- Fixed `normalizeEmail()` returning `@$localhost` instead of `@${domain}` in `packages/validation/src/emailNormalization.js:38`
- Impact: all email duplicate detection was broken

### Phase 1: Fix Critical Bugs (7 items)
- **P1.1**: Fixed refresh token rotation on client — new token was never stored after refresh
- **P1.2**: Removed all console.logs from auth files (auth-store.ts, login/page.tsx)
- **P1.3**: Consolidated API_BASE to single source (`endpoints.ts`)
- **P1.4**: Added backend readiness gate — returns 503 until MongoDB ready
- **P1.5**: Missing JWT key in production now causes `process.exit(1)` instead of silently disabling auth
- **P1.6**: Fixed CORS production origins — reads from `CORS_ORIGINS` env var instead of hardcoded localhost
- **P1.6b**: Fixed WS CORS default from `*` to `localhost:5201`

### Phase 2: Security Hardening (7 items)
- **P2.1**: Moved refresh token from localStorage to httpOnly cookie (`piece_rt`)
- **P2.2**: Hash refresh tokens with SHA-256 before MongoDB storage
- **P2.3**: Added Next.js middleware for server-side route protection
- **P2.4**: Concurrent refresh mutex — dedup on frontend + 30s grace period on backend
- **P2.5**: WebSocket token re-verification every 5 min + auto-reconnect with exponential backoff
- **P2.6**: Magic link resend limiter — max 3/day per email
- **P2.7**: In-memory fallback for rate limiter and account lockout when Redis is down

### Phase 3: Session Management (5 items)
- **P3.1**: Created `session-service.js` — CRUD for auth_sessions collection
- **P3.2**: Integrated sessions into login/register/refresh/logout flows
- **P3.3**: Added API routes: GET/DELETE `/v1/auth/sessions`
- **P3.4**: MongoDB indexes for auth_sessions and updated refresh_tokens
- **P3.5**: Frontend sessions UI on Settings page (device, IP, last active, revoke)

### Phase 4: Scalability (4 items)
- **P4.1**: Access token blacklist in Redis (`tokenBlacklist.js`) + `jti` in JWT
- **P4.2**: Background cleanup job — hourly cleanup of expired sessions/tokens
- **P4.3**: Sliding window rate limiter using Redis sorted sets
- **P4.4**: MongoDB connection pooling verified (maxPoolSize: 200)

### Phase 5: Audit & Monitoring (4 items)
- **P5.1**: Auth audit log service (fire-and-forget writes to `auth_audit_log`)
- **P5.2**: Integrated audit logging into all controller handlers
- **P5.3**: Suspicious activity detection (10+ failed logins from 3+ IPs in 1hr)
- **P5.4**: Admin audit endpoints: GET `/admin/auth/audit-log`

### UI & Routing Changes
- Split login page: cinematic visual left + form right
- Route restructuring: `/` → `/home` (landing), `/projects` (workspace)
- GlobalNav hidden on login page
- Logo links to `/home`

### CI/CD Fixes
- Fixed ESLint errors (require() → dynamic import in test files)
- Fixed library test mocks (`piece/` → `@piece/` prefix)
- Fixed websocket-gateway no-tests issue
- Fixed `eslint --quiet` for warnings
- Fixed workflow lint command (`--skip-nx-cache`)
- Committed 17 previously unstaged files

### Deployment
- Configured all GitHub Secrets (10 secrets + 1 variable)
- Cloned repo on Hetzner server
- Fixed MongoDB authentication (recreated with credentials)
- Fixed SSL certificate (self-signed for staging)
- Fixed `JWT_PRIVATE_KEY_BASE64` missing from docker-compose `x-common-env`
- Fixed `.env` whitespace/tab stripping in workflow
- Synced all branches: dev = stage = main

### Admin Tools
- Terminal dashboard: `scripts/admin-dashboard.sh`
- Mac menu bar monitor: `scripts/piece-monitor.py` (🎬 icon)
- HTML monitor: `Desktop/PieceMonitor.html`

### Documentation
- Team handbook: `docs/team/team-handbook.md`

---

## Files Created (new)

| File | Purpose |
|------|---------|
| `apps/backend/piece/src/modules/auth/session-service.js` | Session CRUD |
| `apps/backend/piece/src/modules/auth/audit-service.js` | Audit logging |
| `apps/backend/piece/src/modules/auth/suspicious-activity.js` | Threat detection |
| `apps/backend/piece/src/jobs/cleanup-sessions.js` | Background cleanup |
| `apps/frontend/src/middleware.ts` | Server-side route protection |
| `apps/frontend/src/components/landing/LandingNav.tsx` | Landing page nav |
| `packages/cache/src/tokenBlacklist.js` | Redis token blacklist |
| `scripts/admin-dashboard.sh` | Terminal admin monitor |
| `scripts/piece-monitor.py` | Mac menu bar monitor |
| `docs/team/team-handbook.md` | Team handbook |

## Files Modified (key changes)

| File | Change |
|------|--------|
| `apps/backend/piece/src/modules/auth/controller.js` | Cookie, sessions, audit, lockout fallback |
| `apps/backend/piece/src/modules/auth/service.js` | Token hashing, jti, grace period |
| `apps/backend/piece/src/index.js` | Readiness gate, JWT validation, cookieParser, blacklist |
| `apps/frontend/src/lib/auth/auth-client.ts` | httpOnly cookie, no localStorage, refresh mutex |
| `apps/frontend/src/lib/auth/auth-store.ts` | Removed localStorage, simplified |
| `apps/frontend/src/lib/auth/auth-fetch.ts` | Single API_BASE |
| `apps/frontend/src/app/login/page.tsx` | Split layout, cinematic visual |
| `apps/frontend/src/app/page.tsx` | Server redirect to /home |
| `apps/frontend/src/app/projects/page.tsx` | Full editor functionality |
| `apps/frontend/src/app/settings/page.tsx` | Active sessions UI |
| `apps/frontend/src/hooks/useCollaboration.ts` | Disconnect handling, reconnect |
| `apps/backend/websocket-gateway/src/index.js` | Token re-verification |
| `packages/auth-middleware/src/index.js` | Blacklist check, async |
| `packages/cors-middleware/src/index.js` | Env-based origins |
| `docker-compose.yml` | JWT vars, WS CORS |
| `.github/workflows/deploy-stage.yml` | Whitespace fix, skip-nx-cache |

---

## Current Server Status (piece-app.com)

```
✅ api-gateway        — healthy
✅ platform           — healthy
✅ websocket-gateway  — healthy
✅ mongodb            — healthy
✅ redis              — healthy
✅ nginx              — up
✅ nats               — healthy
✅ minio              — healthy
⚠️  SSL               — self-signed (needs Let's Encrypt)
```

## Tests

- Backend: 221 tests passed
- Frontend: 375 tests passed
- Lint: 0 errors (warnings in legacy files, --quiet)

---

## TODO for next session

1. **Let's Encrypt SSL** — replace self-signed cert with real certificate
2. **Mac admin app** — native Electron/Tauri app for full admin panel
3. **Clean test users** — remove 9 test accounts from production MongoDB
4. **Login on production** — verify end-to-end login flow on piece-app.com
5. **deploy-prod.yml** — create production deploy workflow for `main` branch
