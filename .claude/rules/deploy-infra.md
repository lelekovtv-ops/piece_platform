# Deploy Infrastructure

## Platform

Docker Compose on self-hosted Hetzner Cloud VPS. CI/CD via GitHub Actions.

## Git Branch Workflow

```
dev (development) → stage (staging deploy) → main (production deploy)
```

- All work is done on `dev` branch
- Deploy to staging = merge `dev` into `stage` + push `stage`
- Deploy to production = merge `stage` into `main` + push `main`
- **NEVER** push directly to `main`
- **NEVER** deploy without staging verification first

## Environment Strategy

| Environment | Branch | Server | Domain Pattern | Workflow |
|-------------|--------|--------|---------------|----------|
| Development | `dev` | Local (Docker) | localhost | `pnpm run dev` |
| Staging | `stage` | Separate VPS | staging.{domain}, staging-api.{domain} | Push to `stage` → GitHub Actions |
| Production | `main` | Separate VPS | {domain}, api.{domain}, app.{domain} | Push to `main` → GitHub Actions |

Staging and production MUST be on **separate servers**. Never share a server.

## Staging Domain Convention

| Type | Pattern | Example |
|------|---------|---------|
| Staging root | `staging.{domain}` | `staging.acme.io` |
| Staging API | `staging-api.{domain}` | `staging-api.acme.io` |
| Staging App | `staging-app.{domain}` | `staging-app.acme.io` |
| Production root | `{domain}` | `acme.io` |
| Production API | `api.{domain}` | `api.acme.io` |
| Production App | `app.{domain}` | `app.acme.io` |

## GitHub Secrets Convention

| Secret | Purpose | Environment |
|--------|---------|-------------|
| `DEPLOY_HOST` | Production server IP | Production |
| `DEPLOY_USER` | Production SSH user | Production |
| `DEPLOY_SSH_KEY` | Production SSH private key | Production |
| `STAGE_HOST` | Staging server IP | Staging |
| `STAGE_USER` | Staging SSH user | Staging |
| `STAGE_SSH_KEY` | Staging SSH private key | Staging |

## Infrastructure Services

All infrastructure runs as Docker containers via `docker-compose.yml`:

| Service | Image | Memory | Purpose |
|---------|-------|--------|---------|
| MongoDB | `mongo:7` | 2G | Primary database (multi-tenant) |
| Redis | `redis:7-alpine` | 1G | Caching, rate limiting |
| NATS | `nats:2.10-alpine` | 512M | Messaging (JetStream) |
| Postgres | `postgres:16-alpine` | 512M | Relational data |
| MinIO | `minio/minio:latest` | 512M | S3-compatible object storage |
| Imagorvideo | `shumc/imagorvideo` | 1G | Image/video processing proxy |
| Nginx | `nginx:alpine` | 256M | Reverse proxy, SSL termination |
| Certbot | `certbot/certbot` | -- | Let's Encrypt SSL certificates |
| Qdrant | `qdrant/qdrant:v1.14.0` | 512M | Vector search (optional) |
| Prometheus | `prom/prometheus:v2.53.0` | 512M | Metrics collection |
| Grafana | `grafana/grafana:11.0.0` | 256M | Monitoring dashboard |
| Loki | `grafana/loki:3.0.0` | 256M | Log aggregation |
| Promtail | `grafana/promtail:3.0.0` | 128M | Log shipping |
| Node Exporter | `prom/node-exporter:v1.8.0` | 64M | Host metrics |

## Dockerfile Strategy

Builds use a **shared base image** to avoid reinstalling all dependencies per service:

```bash
docker build -f docker/Dockerfile.base -t {project-name}-base:latest .
```

### Dockerfile.base

```dockerfile
FROM node:20-alpine
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/ ./packages/
COPY apps/ ./apps/
COPY tools/ ./tools/
RUN pnpm install --frozen-lockfile --prod
```

### Dockerfile.service

```dockerfile
FROM {project-name}-base:latest
ARG SERVICE_NAME
WORKDIR /app/apps/backend/${SERVICE_NAME}
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT}/health || exit 1
CMD ["node", "src/index.js"]
```

### Dockerfile.platform (frontend)

Multi-stage build: Next.js build + standalone output served via `node server.js`.

## Docker Compose

Use anchors for DRY configuration:

```yaml
x-common-env: &common-env
  NODE_ENV: production
  MONGODB_URI: mongodb://${MONGO_ROOT_USER}:${MONGO_ROOT_PASSWORD}@mongodb:27017
  REDIS_URL: redis://redis:6379
  NATS_URL: nats://nats:4222
  API_GATEWAY_URL: http://api-gateway:3100
  JWT_PUBLIC_KEY_BASE64: ${JWT_PUBLIC_KEY_BASE64}
  INTERNAL_TOKEN: ${INTERNAL_TOKEN}
  ENCRYPTION_KEY: ${ENCRYPTION_KEY}

x-common-healthcheck: &common-healthcheck
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 15s

x-infra-depends: &infra-depends
  mongodb:
    condition: service_healthy
  redis:
    condition: service_healthy
  nats:
    condition: service_healthy
```

## Health Checks

Every service exposes `GET /health`:

```json
{ "status": "healthy", "service": "{service-name}", "timestamp": "2026-01-01T00:00:00.000Z" }
```

Docker healthchecks use `wget`:

```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:${PORT}/health"]
  <<: *common-healthcheck
```

## CI/CD -- GitHub Actions

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | PR to main | Lint, build, test |
| `deploy-stage.yml` | Push to `stage` | Deploy to staging |

> **NOTE:** `deploy-prod.yml` is not yet created. Production deployment workflow is pending.

### Deploy Flow

```
push to main
  -> GitHub Actions: lint + build (gate)
  -> Generate .env from GitHub Secrets, upload via scp
  -> SSH to server
  -> git fetch + reset --hard origin/main
  -> mv .env.generated .env
  -> docker build -f docker/Dockerfile.base -t {project-name}-base:latest .
  -> docker compose build --parallel
  -> docker compose up -d --remove-orphans --force-recreate
  -> Health check loop (20 attempts, 10s interval)
```

## Nginx Reverse Proxy

Config files: `nginx/conf.d/` (prod.conf, stage.conf, staging-ip.conf, staging-ssl.conf).

### Routing Matrix (Production)

```
{domain}          -> redirect to app.{domain}
api.{domain}      -> api-gateway:3100 (REST API)
api.{domain}/socket.io/  -> websocket-gateway:3109 (WebSocket upgrade)
api.{domain}/img/        -> imagorvideo:8000 (image processing)
api.{domain}/storage/koza-uploads/  -> minio:9000 (S3 storage)
app.{domain}      -> platform:3000 (Frontend)
```

Staging uses `/api/` prefix rewrite instead of separate subdomain. Grafana at `/grafana/`.

### Rate Limits

| Zone | Rate | Burst | Applied to |
|------|------|-------|-----------|
| `api_limit` | 100 req/s | 50 | REST API (`/`) |
| `img_limit` | 200 req/s | 100 | Image processing (`/img/`) |

### Cache Headers

| Route | Cache-Control | Expires |
|-------|--------------|---------|
| `/img/` | `public, immutable` | 7 days |
| `/storage/koza-uploads/` | `public, immutable` | 30 days |
| Static assets (js/css/img/fonts) | `public, immutable` | 1 year (prod) / 7 days (staging) |

### Timeouts

| Route | Read/Send Timeout |
|-------|------------------|
| REST API | 120 seconds |
| WebSocket | 86400 seconds (24 hours) |
| Image processing | 30 seconds |

### Security Headers

- `Strict-Transport-Security`: max-age=63072000 (730 days), includeSubDomains
- `X-Content-Type-Options`: nosniff
- `X-Frame-Options`: DENY (prod) / SAMEORIGIN (staging)

### Staging Gate (staging-ssl.conf)

Cookie-based auth: `staging_auth` cookie with preset token. Unauthenticated requests redirect to `/gate`. API and Grafana bypass gate.

SSL: Let's Encrypt via Certbot, auto-renewal.

## Monitoring Stack

### Prometheus

Config: `docker/prometheus/prometheus.yml`. Scrape interval: 15s.

| Job | Target | Metrics Path | Interval |
|-----|--------|-------------|----------|
| `piece-backend` | `api-gateway:3100` | `/internal/metrics/prometheus` | 15s |
| `websocket-gateway` | `websocket-gateway:3109` | `/internal/metrics/prometheus` | 15s |
| `node-exporter` | `node-exporter:9100` | `/metrics` | 15s |
| `imagorvideo` | `imagorvideo:5001` | `/metrics` | 30s |
| `prometheus` | `localhost:9090` | `/metrics` | 30s |

### Loki

Config: `docker/loki/loki-config.yml`.

- Log retention: 168 hours (7 days)
- TSDB schema v13, 24-hour period indexing
- Query limit: 720 hours
- Compaction every 10 minutes

### Grafana

Available at port 3001 (Docker) or `/grafana/` (via nginx). No pre-built dashboards -- configure manually.

### Promtail

Config: `docker/promtail/promtail-config.yml`. Ships Docker container logs to Loki.

## Secrets Management

Secrets delivered via GitHub Actions to `.env` on each server. NEVER committed to git.

Key secrets: `JWT_PUBLIC_KEY_BASE64`, `JWT_PRIVATE_KEY_BASE64`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `INTERNAL_TOKEN`, `MONGO_ROOT_USER`, `MONGO_ROOT_PASSWORD`, `SES_ACCESS_KEY_ID`, `SES_SECRET_ACCESS_KEY`.

## Rollback

```bash
cd ~/{project-name}
git fetch origin
git reset --hard <previous-commit>
docker build -f docker/Dockerfile.base -t {project-name}-base:latest .
docker compose build --parallel
docker compose up -d --remove-orphans --force-recreate
```

## Email Infrastructure (AWS SES)

Every project uses AWS SES for transactional email. Setup per domain:

### DNS Records Required

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| CNAME | `{t1}._domainkey.{domain}` | `{t1}.dkim.amazonses.com` | DKIM key 1 |
| CNAME | `{t2}._domainkey.{domain}` | `{t2}.dkim.amazonses.com` | DKIM key 2 |
| CNAME | `{t3}._domainkey.{domain}` | `{t3}.dkim.amazonses.com` | DKIM key 3 |
| TXT | `{domain}` | `v=spf1 include:amazonses.com ~all` | SPF |
| TXT | `_dmarc.{domain}` | `v=DMARC1; p=quarantine; ...` | DMARC |
| MX | `mail.{domain}` | `10 feedback-smtp.eu-central-1.amazonses.com` | Custom MAIL FROM |
| TXT | `mail.{domain}` | `v=spf1 include:amazonses.com ~all` | MAIL FROM SPF |
| TXT | `default._bimi.{domain}` | `v=BIMI1; l=https://{domain}/bimi/logo.svg` | BIMI brand logo |

### SES Configuration

- Region: `eu-central-1`
- Configuration set: `{project-name}-production`
- MAIL FROM: `mail.{domain}`
- IAM user with `ses:SendEmail` + `ses:SendRawEmail` on domain identity

### BIMI Logo

SVG Tiny P/S format (`baseProfile="tiny-ps"`), square, solid background, <32KB. Convert with `npx svgo-bimi`. Host at `https://{domain}/bimi/logo.svg` via nginx.

### GitHub Secrets (email)

| Type | Name | Value |
|------|------|-------|
| Secret | `SES_ACCESS_KEY_ID` | IAM access key |
| Secret | `SES_SECRET_ACCESS_KEY` | IAM secret key |
| Variable | `SES_REGION` | `eu-central-1` |
| Variable | `SES_CONFIGURATION_SET` | `{project-name}-production` |
| Variable | `FROM_EMAIL` | `noreply@{domain}` |
| Variable | `FROM_NAME` | `{ProjectName}` |

### Disposable Email Protection

Uses `disposable-email-domains` npm package (~4000 domains) via `@piece/validation/email`. Call `validateEmailDomain(email)` on registration. Extend with `BLOCKED_EMAIL_DOMAINS` env var (comma-separated).

## Deploy Checklist

Before deploying to production:

1. All tests pass (`pnpm test`)
2. Lint clean (`pnpm run lint`)
3. Build succeeds (`pnpm run build`)
4. Health endpoints respond correctly
5. No hardcoded secrets in code
6. System DB indexes verified if schema changed
7. NATS streams configured if new subjects added
8. API Gateway routes updated if paths changed
