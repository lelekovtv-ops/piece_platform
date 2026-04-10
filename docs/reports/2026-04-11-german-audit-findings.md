# TUV-Audit: Production Readiness Plan

**Date:** 2026-04-11
**Method:** German engineering audit (7 criteria)
**Verdict:** PLAN IS NOT PRODUCTION-GRADE. Diagnostic report, not implementation plan.

---

## 1. Vollstandigkeit (Completeness) — 23 Missing Items

### Security — Not Mentioned At All

| # | Gap | Severity |
|---|-----|----------|
| V1 | **DDoS protection** — single VPS, no Cloudflare, no L3/L7 mitigation | CRITICAL |
| V2 | **WAF** — no ModSecurity, no Cloudflare WAF | HIGH |
| V3 | **CSP headers** — helmet() used but CSP not configured for AI image providers | HIGH |
| V4 | **Dependency vulnerability scanning** — no npm audit, no Dependabot in CI | HIGH |
| V5 | **Container image scanning** — no Trivy/Grype | MEDIUM |
| V6 | **Secret rotation procedure** — JWT, ENCRYPTION_KEY, MONGO_ROOT_PASSWORD | HIGH |
| V7 | **Network segmentation** — all services on flat Docker network | MEDIUM |
| V8 | **Database encryption at rest** — MongoDB WiredTiger unencrypted | MEDIUM |
| V9 | **TLS 1.0/1.1 not explicitly disabled** | MEDIUM |
| V10 | **Cookie prefix `__Host-`** for defense-in-depth | LOW |
| V11 | **DNS security (DNSSEC, CAA records)** | MEDIUM |
| V12 | **HTTP Permissions-Policy header** | LOW |

### Operational — Not Mentioned At All

| # | Gap | Severity |
|---|-----|----------|
| V13 | **Load testing** — ZERO evidence system tested under ANY load | CRITICAL |
| V14 | **CDN for media delivery** — 125TB from single nginx, no CDN | CRITICAL |
| V15 | **Blue-green / canary deployment** — force-recreate = downtime | HIGH |
| V16 | **Cost estimation** — servers, SES, AI APIs, storage not budgeted | HIGH |
| V17 | **GDPR compliance** — no DPA, no deletion workflow, no consent | HIGH |
| V18 | **Deep health checks** — /health only checks 2 of 7 dependencies | HIGH |
| V19 | **Feature flags** — no mechanism to disable features under load | MEDIUM |
| V20 | **API documentation (OpenAPI/Swagger)** | MEDIUM |
| V21 | **i18n** — CLAUDE.md requires it, react-i18next not installed | MEDIUM |
| V22 | **Accessibility (WCAG 2.1 AA)** | MEDIUM |
| V23 | **Frontend bundle size budget** — Slate + xyflow + Three.js + MediaPipe | MEDIUM |

---

## 2. Genauigkeit (Precision) — 11 Numerical Errors

| # | Claim | Reality | Impact |
|---|-------|---------|--------|
| G1 | "50 projects per user" | No telemetry. Most SaaS: 2-5 projects. If avg=5, storage drops 10x to ~10TB | **All storage estimates are 10x inflated** |
| G2 | "100 images per project" | No usage data. Unsubstantiated. | Same |
| G3 | "50MB audio per project" | No basis in code or usage | Same |
| G4 | "125 TB total" on "500 GB SSD" | **125 TB does not fit on 500 GB**. "External storage" undefined — Hetzner max 10TB/box, S3 = $2,875/mo | **Plan is physically impossible** |
| G5 | "MongoDB 50 GB" | "5 MB per user" with no per-collection breakdown | Unverifiable guess |
| G6 | "Redis 135 MB" | Not in plan at all. @piece/cache usage not quantified | No basis |
| G7 | "32 GB RAM minimum" | Docker limits sum to 24-34 GB + 3 GB OS + backend instances. Real need: **36-40 GB** | Underestimate |
| G8 | "4 weeks" timeline | CSRF alone = 3-5 days. Multi-tenant migration = 4-8 weeks alone | **Real: 12-16 weeks** |
| G9 | "RPO: 1 hour" with "Backup every 6 hours" | **Mathematically impossible**. RPO = time since last backup = 6h | Self-contradictory |
| G10 | "$2-4M AI API costs" | 10K x 50 x 100 x $0.04. But "50 projects" is unsubstantiated | Scare number |
| G11 | "57 issues found" | Actual count in tables: 49 (20+18+11) | Arithmetic error |

---

## 3. Reihenfolge (Ordering) — 6 Sequencing Errors

| # | Error | Correct Order |
|---|-------|---------------|
| R1 | CSRF marked "L effort" on "Day 1-2" | L = 3-5 days minimum (frontend + backend + testing) |
| R2 | Monitoring in Phase 6 (last) | Should be Phase 1 — need visibility before making changes |
| R3 | "Atomic register" in Phase 4 depends on replica set (Phase 1) | Dependency not stated |
| R4 | Multi-tenant migration in Phase 5 as "XL" | Biggest risk item — should be PLANNED in Phase 1, EXECUTED in Phase 3+ |
| R5 | No buffer time between phases | If Phase 1 slips 1 week, everything cascades |
| R6 | Load testing not mentioned in any phase | Should be parallel from Day 1 |

---

## 4. Abhangigkeiten (Dependencies) — 9 Unresolved

| # | Task A | Depends On | Status |
|---|--------|-----------|--------|
| A1 | Atomic register (transactions) | MongoDB replica set | Correctly ordered but not linked |
| A2 | CSRF protection | Frontend + backend changes | Plan only mentions backend |
| A3 | Offsite backup | External storage account + credentials | Who creates? What cost? |
| A4 | deploy-prod.yml | Production server exists | **Does a prod VPS exist?** |
| A5 | Redis `volatile-lru` | All keys must have TTL | Requires auditing every `cache.set()` |
| A6 | nginx `worker_connections 4096` | `worker_rlimit_nofile 8192` | Not mentioned |
| A7 | 2-3 backend instances | Load balancer, stateless backend | Memory Maps (lockout, rate limit, permissions) break with multi-instance |
| A8 | Multi-tenant migration | Downtime window or dual-write strategy | Neither discussed |
| A9 | Cookie path change `/` → `/v1/auth` | Old cookies `path=/` won't be cleared by `clearCookie(path=/v1/auth)` | **Session leak bug** |

---

## 5. Widerspruche (Contradictions) — 9 Found

| # | Statement A | Statement B | Conflict |
|---|------------|------------|---------|
| W1 | "125 TB storage" | "500 GB SSD" | Physically impossible |
| W2 | "RPO: 1 hour" | "Backup every 6 hours" | RPO = 6h, not 1h |
| W3 | "2-3 backend instances" | `memoryLockout = new Map()` | Lockout per-process, not per-user |
| W4 | "2-3 backend instances" | Rate limiter uses memory store | Rate = N x limit |
| W5 | "2-3 backend instances" | `_rolesCache` in-memory Map | No cross-instance invalidation |
| W6 | "MongoDB 8-16 GB" | Current VPS likely 8 GB total | Can't give 8 GB to MongoDB alone |
| W7 | "57 issues" in summary | 49 issues in actual tables | Wrong count |
| W8 | BACKUP-STRATEGY.md: "Redis uses --save 60 1000" | docker-compose.yml: `--appendonly yes` only, no `--save` | Documentation lies |
| W9 | "No generation history" (D8) | `createGenerationResult()` factory exists | Type infra exists, unused |

---

## 6. Risikobewertung (Risk) — 8 Unassessed

| # | Risk | Probability | Impact | Mitigation in Plan |
|---|------|------------|--------|--------------------|
| R1 | Multi-tenant migration breaks existing data | HIGH | CRITICAL | NONE |
| R2 | bcrypt is `bcryptjs` (pure JS, no thread pool) | MEDIUM | HIGH | "Verify" but no fallback |
| R3 | 10K estimate wrong (50K or 500) | MEDIUM | HIGH | No scaling tiers |
| R4 | Replica set migration causes downtime | MEDIUM | HIGH | No maintenance window |
| R5 | CSRF breaks mobile/API consumers | MEDIUM | MEDIUM | Not discussed |
| R6 | Phase timing slip cascades | HIGH | HIGH | No buffer |
| R7 | `volatile-lru` + no-TTL keys = Redis OOM | LOW | CRITICAL | Not analyzed |
| R8 | Cookie path change = old cookies never cleared | HIGH | MEDIUM | **Real bug** |

---

## 7. Infrastructure Verification — 17 Additional Findings

| # | Finding | Severity |
|---|---------|----------|
| I1 | **No `.dockerignore`** — builds include .git, node_modules, .env | CRITICAL |
| I2 | **Nginx has NO healthcheck** — silent failure kills all traffic | CRITICAL |
| I3 | **`prod.conf` uses `localhost` placeholders** — not production-ready | CRITICAL |
| I4 | **MinIO/Postgres use insecure default passwords** in staging deploy | CRITICAL |
| I5 | **Staging gate token hardcoded** in committed nginx config | HIGH |
| I6 | **Base image tag `koza-studio-base`** — old project name | HIGH |
| I7 | **MinIO backup script syntax wrong** — `mc mirror` needs alias | HIGH |
| I8 | **BACKUP-STRATEGY.md lies** about Redis `--save` config | HIGH |
| I9 | **Duplicate nginx configs** (`staging-ip 2.conf`, `staging-ssl 2.conf`) | MEDIUM |
| I10 | No healthcheck on promtail and node-exporter | MEDIUM |
| I11 | No Redis graceful shutdown in cache package | MEDIUM |
| I12 | `.env.staging.template` missing 10+ docker-compose variables | MEDIUM |
| I13 | No Docker network segmentation | MEDIUM |
| I14 | No connection pool monitoring | LOW |
| I15 | node-exporter has `pid: host` + full FS read | LOW |
| I16 | Loki/api-gateway both port 3100 (separate containers, no conflict) | LOW |
| I17 | No `--no-cache` on app builds in deploy script | LOW |

---

## Overall Verdict

### What the plan does well:
- Identifies real security vulnerabilities (CSRF, token blacklist, cookie path)
- Correctly flags multi-tenant architecture as unsustainable
- Recognizes backup gap as critical

### What the plan fails at:
1. **All storage numbers are unsubstantiated** — "50 projects per user" has no basis
2. **125 TB on 500 GB SSD** — physically impossible, no storage architecture
3. **RPO self-contradicts** — 1h RPO with 6h backups
4. **Timeline 3x too optimistic** — 4 weeks should be 12-16 weeks
5. **Multi-instance breaks 3 in-memory systems** (lockout, rate limit, permissions)
6. **23 missing topics** including load testing, CDN, GDPR, DDoS
7. **No load testing** — all capacity claims are theoretical
8. **9 contradictions** within the plan itself

---

## Corrected Plan (Realistic)

### Realistic Assumptions

| Metric | Optimistic | Conservative | Basis |
|--------|-----------|--------------|-------|
| Projects per user | 5 | 20 | Industry SaaS avg |
| Images per project | 20 | 50 | Active generation pipeline |
| Storage per user | 200 MB | 2 GB | 5 x 20 x 2MB |
| Total media (10K) | **2 TB** | **20 TB** | Realistic range |
| MongoDB | 5 GB | 20 GB | With generation history |
| Timeline | 12 weeks | 16 weeks | One developer |

### Corrected Phase Order (16 weeks, 1 developer)

**Phase 0: Visibility First (Week 1)**
- Set up monitoring alerts (Prometheus rules + alertmanager)
- Create .dockerignore
- Add nginx healthcheck
- Fix backup script (mc mirror syntax)
- Fix BACKUP-STRATEGY.md lies
- Remove duplicate nginx configs
- Set up k6/Artillery for load testing baseline

**Phase 1: Emergency Security (Week 1-2)**
- Token blacklisting on logout (S — existing infra, just wire it)
- Cookie path `/v1/auth` (S — but handle migration of old cookies)
- Cap memory Maps at 50K entries (S)
- Remove `/dev` from PUBLIC_ROUTES in production (S)
- Fix `listSessions` isCurrent (S)
- Session invalidation on password change (S)
- Max 10 sessions per user (S)

**Phase 2: Backup & Database (Week 2-4)**
- Enable MongoDB single-node replica set
- Set up automated mongodump (daily + oplog continuous)
- Set up offsite backup (Hetzner Storage Box or S3)
- Test restore procedure
- Fix Redis: add `--save 3600 1`, change to `volatile-lru`, raise to 2-4 GB
- Raise MongoDB memory to 8 GB
- Add missing indexes (library_files, pipeline_presets)
- Add TTL indexes on auth_sessions

**Phase 3: CSRF + Auth Hardening (Week 4-6)**
- CSRF token implementation (backend + frontend — L effort)
- Atomic register with transactions (needs replica set from Phase 2)
- Fix account enumeration on register
- Fix refresh token rotation (findOneAndUpdate)
- CORS fail-loud in production
- Add JWT `kid` for rotation
- Fix magic link user creation (add team)
- Create deploy-prod.yml

**Phase 4: Infrastructure (Week 6-8)**
- Docker log rotation on all services
- SSL auto-renewal (certbot cron)
- nginx worker_connections 4096
- nginx proxy cache for images
- CDN evaluation (Cloudflare free tier or Hetzner CDN)
- Blue-green deployment (at least rolling recreate)
- Deep health checks (all 7 dependencies)
- Move staging gate token to env var

**Phase 5: Scale Preparation (Week 8-12)**
- Load test at 1K concurrent (k6 baseline)
- Evaluate multi-tenant migration (shared DB vs keep per-team)
- If migrating: dual-write strategy with canary rollout
- Generation history + cost tracking
- Move temp files from memory Map to MinIO
- WebSocket reconnection jitter + max attempts
- BroadcastChannel for cross-tab refresh

**Phase 6: Compliance & Polish (Week 12-16)**
- GDPR: data export, deletion workflow, DPA template
- DDoS: Cloudflare (free tier) for CDN + L7 protection
- Dependency scanning (npm audit in CI, Dependabot)
- CSP headers configuration
- API documentation (OpenAPI)
- Cost dashboard for AI generation
- Runbook for common failures

### Corrected Targets

| Metric | Current | Target | Method |
|--------|---------|--------|--------|
| RPO | Total loss | **6 hours** (honest) | Daily dump + oplog |
| RTO | 1-4 hours | **30 minutes** | Automated deploy + tested restore |
| Backup frequency | None | **Daily full + continuous oplog** | Cron + offsite |
| Server RAM | 8 GB | **32-40 GB** | Hetzner CX41 or CAX31 |
| Storage | 100 GB SSD | **500 GB SSD + 5 TB Storage Box** | Hetzner |
| CDN | None | **Cloudflare free** | DNS proxy |
| Load tested | Never | **Monthly at 1K concurrent** | k6 |
