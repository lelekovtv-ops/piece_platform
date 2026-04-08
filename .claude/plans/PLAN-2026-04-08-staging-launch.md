# PLAN: Staging Launch for Testers

**Created:** 2026-04-08
**Target:** ASAP — give testers a link
**Scope:** Server setup, CI/CD, monitoring (Grafana + Loki + Prometheus), analytics (PostHog), error tracking (Sentry), tester onboarding

---

## Context

Testers (5-20 people) need a URL to test the platform. No domain yet — use IP directly.
Need full visibility: online users, actions, server health, errors, logs.

**Current state:**
- Code ready on `stage` branch (28 production-readiness tasks done, 547 tests)
- Docker Compose fully configured with healthchecks
- Nginx configs exist but use `localhost` placeholders
- No CI/CD workflows
- No monitoring, analytics, or error tracking

---

## Phase 1: Hetzner Server + First Deploy (manual)

Goal: testers get `http://<IP>` link.

### Task 1.1: Create Hetzner staging server

**Steps:**
1. Create server in Hetzner Cloud Console:
   - Type: **CPX31** (4 vCPU, 8 GB RAM, 160 GB NVMe)
   - Image: Ubuntu 24.04
   - Location: eu-central (Falkenstein)
   - Add SSH key
2. Note down the server IP address

**Verify:** `ssh root@<IP>` connects successfully

### Task 1.2: Configure server

**Steps:**
1. SSH into server
2. Update system: `apt update && apt upgrade -y`
3. Install Docker: `curl -fsSL https://get.docker.com | sh && systemctl enable docker`
4. Install Docker Compose plugin: `apt install -y docker-compose-plugin`
5. Create deploy user: `adduser --disabled-password piece && usermod -aG docker piece`
6. Setup SSH keys for deploy user (copy your key to `/home/piece/.ssh/authorized_keys`)
7. Configure firewall (Hetzner Cloud Firewall):
   - Inbound: TCP 22 (SSH), TCP 80 (HTTP), TCP 443 (HTTPS)
   - Outbound: All allow
8. Configure swap (4 GB) and kernel tuning per `docs/HETZNER-SETUP.md`

**Verify:** `ssh piece@<IP>` connects, `docker ps` works

### Task 1.3: Create IP-based nginx config

**File:** CREATE `nginx/conf.d/staging-ip.conf`

Simplified nginx config — no SSL, no domain, just IP access. Three ports:
- `:80` → Frontend (platform:3000)
- API proxy at `/api/` → api-gateway:3100
- WebSocket at `/socket.io/` → websocket-service:3109

All on single port 80 since no domain = no SSL = no subdomains.

**Steps:**
1. Write test: curl `http://<IP>/` returns frontend, `http://<IP>/api/health` returns backend health
2. Create `nginx/conf.d/staging-ip.conf`:
```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 50m;

    # Backend API
    location /api/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://api-gateway:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 120;
        proxy_buffering off;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://websocket-service:3109;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Grafana (monitoring)
    location /grafana/ {
        proxy_pass http://grafana:3000/;
        proxy_set_header Host $host;
    }

    # Frontend (catch-all)
    location / {
        proxy_pass http://platform:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```
3. Update frontend API base URL to use `/api/` prefix on staging

**Verify:** nginx config test passes (`nginx -t`)

### Task 1.4: Create staging `.env` file

**Steps:**
1. Generate secrets:
   - `openssl rand -hex 32` for INTERNAL_TOKEN, ENCRYPTION_KEY
   - `openssl genrsa 4096` + `openssl rsa -pubout` for JWT keys, base64-encode them
   - Set `MONGO_ROOT_USER` / `MONGO_ROOT_PASSWORD`
2. Create `.env` with all required variables
3. Set `DISABLE_EMAIL_SENDING=true` (no SES for staging — skip email verification)
4. Set `NODE_ENV=production`, `LOG_LEVEL=info`

**Verify:** All required env vars present

### Task 1.5: First manual deploy

**Steps:**
1. Clone repo on server: `git clone <repo-url> ~/piece && cd ~/piece && git checkout stage`
2. Copy `.env` file to server
3. Build: `docker build -f docker/Dockerfile.base -t piece-base:latest .`
4. Build services: `docker compose build --parallel`
5. Replace nginx config: copy `staging-ip.conf` to `nginx/conf.d/default.conf`
6. Start: `docker compose up -d`
7. Wait for healthy: check all containers with `docker compose ps`

**Verify:**
- `curl http://<IP>/` → frontend loads
- `curl http://<IP>/api/health` → `{"status":"healthy"}`
- `docker stats --no-stream` → all containers within memory limits

---

## Phase 2: Monitoring Stack (Grafana + Prometheus + Loki)

Goal: dashboard at `http://<IP>/grafana/` showing server health, logs, active connections.

### Task 2.1: Add Prometheus metrics format to backend

**Files:**
- MODIFY `apps/backend/piece/src/index.js` — add `/internal/metrics/prometheus` endpoint
- CREATE test for the Prometheus endpoint

**Steps:**
1. Write failing test: `GET /internal/metrics/prometheus` returns text/plain with Prometheus format
2. Implement endpoint that exposes:
   - `process_memory_rss_bytes`
   - `process_memory_heap_used_bytes`
   - `process_cpu_seconds_total`
   - `process_uptime_seconds`
   - `http_requests_total{method, path, status}` (via middleware counter)
   - `http_request_duration_seconds{method, path}` (histogram)
3. Verify test passes

### Task 2.2: Add monitoring services to Docker Compose

**Files:**
- MODIFY `docker-compose.yml` — add prometheus, grafana, loki, promtail, node-exporter
- CREATE `docker/prometheus/prometheus.yml`
- CREATE `docker/loki/loki-config.yml`
- CREATE `docker/promtail/promtail-config.yml`

**Services to add:**

| Service | Image | Memory | Port | Purpose |
|---------|-------|--------|------|---------|
| prometheus | `prom/prometheus:v2.53.0` | 512M | 9090 (internal) | Metrics scraping |
| grafana | `grafana/grafana:11.0.0` | 256M | 3000→3001 (internal) | Dashboards |
| loki | `grafana/loki:3.0.0` | 256M | 3100→3101 (internal) | Log aggregation |
| promtail | `grafana/promtail:3.0.0` | 128M | — | Log shipping |
| node-exporter | `prom/node-exporter:v1.8.0` | 64M | 9100 (internal) | Host metrics |

**Prometheus scrape config:**
```yaml
scrape_configs:
  - job_name: 'piece-backend'
    scrape_interval: 15s
    static_configs:
      - targets: ['api-gateway:3100']
    metrics_path: /internal/metrics/prometheus

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'nats'
    static_configs:
      - targets: ['nats:8222']
    metrics_path: /varz
```

**Promtail config:** Ship Docker container logs to Loki.

**Verify:** All monitoring containers healthy

### Task 2.3: Create Grafana dashboards

**Files:**
- CREATE `docker/grafana/provisioning/dashboards/dashboard.yml`
- CREATE `docker/grafana/provisioning/dashboards/piece-overview.json`
- CREATE `docker/grafana/provisioning/datasources/datasources.yml`

**Dashboard panels:**
1. **Server Health:** CPU usage, Memory usage, Disk usage (from node-exporter)
2. **Application:** Request rate, Response time p95, Error rate, Active connections
3. **Infrastructure:** MongoDB connections, Redis memory, NATS messages/sec
4. **Logs:** Recent error logs (from Loki)

**Verify:** `http://<IP>/grafana/` loads, dashboards show data

---

## Phase 3: Analytics & Error Tracking

Goal: see who's online, what they're doing, catch errors.

### Task 3.1: Integrate Sentry (cloud — free tier)

**Steps:**
1. Create Sentry account at sentry.io (free: 5K errors/month)
2. Create project for frontend (React/Next.js) and backend (Node.js)
3. Get DSN keys

**Frontend integration:**
- MODIFY `apps/frontend/package.json` — add `@sentry/nextjs`
- CREATE `apps/frontend/sentry.client.config.ts`
- CREATE `apps/frontend/sentry.server.config.ts`
- MODIFY `apps/frontend/next.config.ts` — wrap with `withSentryConfig`

**Backend integration:**
- MODIFY `apps/backend/piece/package.json` — add `@sentry/node`
- MODIFY `apps/backend/piece/src/index.js` — init Sentry early, add error handler

**Config:**
- `SENTRY_DSN_FRONTEND` and `SENTRY_DSN_BACKEND` env vars
- `sampleRate: 1.0` on staging (capture everything)
- `tracesSampleRate: 0.5` (performance traces)
- Environment tag: `staging`

**Verify:** Trigger test error → appears in Sentry dashboard

### Task 3.2: Integrate PostHog (cloud — free tier)

**Steps:**
1. Create PostHog account at posthog.com (free: 1M events/month)
2. Get project API key

**Frontend integration:**
- MODIFY `apps/frontend/package.json` — add `posthog-js`
- CREATE `apps/frontend/src/lib/analytics.ts` — PostHog wrapper
- MODIFY `apps/frontend/src/app/layout.tsx` — init PostHog provider

**Key events to auto-capture:**
- Page views (automatic)
- Clicks (automatic)
- Session recordings (enable for staging)

**Custom events to track:**
- `project:created`, `project:opened`
- `screenplay:edited`, `rundown:rebuilt`
- `image:generated`, `pipeline:run`
- `user:registered`, `user:logged_in`

**Dashboard provides:**
- **Online users** — real-time session count
- **User actions** — what pages they visit, what they click
- **Session replay** — watch what testers do
- **Funnels** — registration → create project → edit → generate

**Config:**
- `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` env vars
- Disable in development (`process.env.NODE_ENV !== 'production'`)

**Verify:** Open app → events appear in PostHog dashboard

### Task 3.3: Add WebSocket connection counter to Grafana

**Files:**
- MODIFY `apps/backend/websocket-gateway/src/index.js` — expose `/internal/metrics` with connection count

**Metrics:**
- `ws_connections_active` — current connected clients
- `ws_connections_total` — total since start
- `ws_rooms_active` — active rooms (teams/users)

**Steps:**
1. Add counter tracking on `connection` / `disconnect` events
2. Expose as Prometheus-format metrics endpoint
3. Add to Prometheus scrape config
4. Add panel to Grafana dashboard

**Verify:** Connect via browser → Grafana shows +1 active connection

---

## Phase 4: CI/CD & Tester Onboarding

### Task 4.1: Create GitHub Actions workflows

**Files:**
- CREATE `.github/workflows/ci.yml` — lint + build + test on PRs
- CREATE `.github/workflows/deploy-stage.yml` — deploy on push to `stage`

**ci.yml triggers:** Pull request to `main` or `stage`
**deploy-stage.yml triggers:** Push to `stage`

**Deploy flow:**
```
push to stage
  → GitHub Actions: pnpm install, lint, build, test (gate)
  → Generate .env from GitHub Secrets, scp to server
  → SSH to server: git pull, docker build, docker compose up
  → Health check loop
```

**Verify:** Push to `stage` → automatic deploy succeeds

### Task 4.2: Configure GitHub Secrets

**Secrets to add:**

| Secret | Purpose |
|--------|---------|
| `STAGE_HOST` | Server IP |
| `STAGE_USER` | `piece` |
| `STAGE_SSH_KEY` | SSH private key |
| `JWT_PUBLIC_KEY_BASE64` | JWT public key |
| `JWT_PRIVATE_KEY_BASE64` | JWT private key |
| `JWT_REFRESH_SECRET` | Refresh token secret |
| `ENCRYPTION_KEY` | AES key |
| `INTERNAL_TOKEN` | Service-to-service token |
| `MONGO_ROOT_USER` | MongoDB admin user |
| `MONGO_ROOT_PASSWORD` | MongoDB admin password |
| `SENTRY_DSN_BACKEND` | Sentry DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry frontend DSN |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog API key |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host URL |

**Verify:** Secrets visible in GitHub Settings → Secrets

### Task 4.3: Staging registration flow

**Steps:**
1. Set `DISABLE_EMAIL_SENDING=true` in staging `.env` (skip actual email sending)
2. Add auto-verify flag for staging: if `NODE_ENV=staging`, auto-verify email on registration
3. Verify registration → login → create team → create project flow works end-to-end
4. Prepare brief tester instructions (1-page):
   - URL: `http://<IP>`
   - How to register
   - Key features to test
   - How to report bugs (GitHub Issues or Telegram)

**Verify:** Register new user via `http://<IP>` → lands on dashboard

### Task 4.4: Final verification + audit

**Steps:**
1. Full flow test: register → login → create team → create project → edit screenplay → generate
2. Check Grafana: server metrics visible at `http://<IP>/grafana/`
3. Check PostHog: session events appearing
4. Check Sentry: no unhandled errors
5. `docker stats` — all containers within limits
6. Share URL with first tester, confirm they can register

---

## Summary

| Phase | Tasks | Focus | Testers can use? |
|---|---|---|---|
| 1 | 5 tasks | Server + first deploy | ✅ Basic access via IP |
| 2 | 3 tasks | Grafana + Prometheus + Loki | + Monitoring dashboard |
| 3 | 3 tasks | Sentry + PostHog + WS metrics | + Analytics + errors |
| 4 | 4 tasks | CI/CD + tester onboarding | + Auto-deploy + smooth UX |
| **Total** | **15 tasks** | | **Full staging environment** |

## Tools Summary

| Tool | Plan | Cost | What it shows |
|------|------|------|---------------|
| **Grafana** | Self-hosted | Free | Server health, logs, custom dashboards |
| **Prometheus** | Self-hosted | Free | Metrics scraping |
| **Loki** | Self-hosted | Free | Log aggregation |
| **Node Exporter** | Self-hosted | Free | CPU, RAM, disk |
| **Sentry** | Cloud | Free (5K/mo) | Errors, stack traces, breadcrumbs |
| **PostHog** | Cloud | Free (1M events/mo) | Users online, actions, session replay |
| **Hetzner CPX31** | Staging | ~€13/mo | 4 vCPU, 8GB RAM |

## Memory Budget (Staging w/ Monitoring)

| Service | Memory |
|---------|--------|
| MongoDB | 1.5G (reduced for staging) |
| Redis | 512M |
| NATS | 256M |
| Qdrant | 1G (reduced for staging) |
| PostgreSQL | 256M |
| Backend | 512M |
| Frontend | 512M |
| WebSocket GW | 256M |
| Nginx | 128M |
| Prometheus | 512M |
| Grafana | 256M |
| Loki | 256M |
| Promtail | 128M |
| Node Exporter | 64M |
| **Total** | **~6.1G** (fits in 8G) |
