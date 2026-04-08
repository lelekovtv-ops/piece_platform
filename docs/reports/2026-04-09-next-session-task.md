# Next Session Task — Staging Hardening & Production Readiness

**Priority:** Complete all items in order. Do not skip items even if they seem minor.
**Branch:** `dev`
**Server:** 65.109.232.32 (root or piece user)
**SSH key:** `~/.ssh/id_ed25519`

---

## Phase 1: SSL + Domain (CRITICAL — do first)

### Task 1.1: Configure domain DNS

The user needs to decide: buy a new domain, or use Cloudflare Tunnel, or configure SSL on bare IP.

**Ask the user:**
- Do they have a domain? If yes, which one?
- If no domain — use Cloudflare Tunnel (free, temporary) or self-signed cert?

### Task 1.2: Set up Let's Encrypt SSL via Certbot

Assuming a domain is available (e.g., `piece.example.com`):

1. Update DNS A records to point to `65.109.232.32`
2. On server: create initial cert:
   ```bash
   docker compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot \
     -d piece.example.com -d api.piece.example.com --email user@email.com --agree-tos
   ```
3. Switch nginx config from `staging-ip.conf` to full SSL config:
   - Listen 80 → redirect to 443
   - Listen 443 ssl with cert paths
   - `ssl_certificate /etc/letsencrypt/live/{domain}/fullchain.pem`
   - `ssl_certificate_key /etc/letsencrypt/live/{domain}/privkey.pem`
4. Update `.env` on server:
   - `NEXT_PUBLIC_API_BASE_URL=https://api.piece.example.com`
   - `FRONTEND_URL=https://piece.example.com`
   - `WS_CORS_ORIGINS=https://piece.example.com`
5. Rebuild platform with new `NEXT_PUBLIC_API_BASE_URL`
6. Add certbot auto-renewal cron:
   ```bash
   echo "0 3 * * * cd /home/piece/piece && docker compose run --rm certbot renew && docker compose restart nginx" | crontab -
   ```
7. Verify: `curl -I https://piece.example.com` → 200, valid cert

**If no domain available**, configure self-signed SSL:
1. Generate self-signed cert via openssl
2. Update nginx to use it
3. Note: browsers will show warning

### Task 1.3: Update FRONTEND_URL in .env

On server `/home/piece/piece/.env`, add:
```
FRONTEND_URL=https://{domain-or-ip}
```
This is used by:
- Email verification links
- Password reset links
- OAuth redirect URLs (future)

Backend code references `config.get('FRONTEND_URL')` — verify it's in the backend config schema. If not, add it:
```javascript
// apps/backend/piece/src/config.js
FRONTEND_URL: z.string().default('http://localhost:5201'),
```

---

## Phase 2: Security Hardening

### Task 2.1: Grafana authentication

Current state: Grafana accessible at `http://65.109.232.32/grafana/` with default password from .env.

Actions:
1. Verify `GF_SECURITY_ADMIN_PASSWORD` is set in server `.env` (it is: `eef07ec0...`)
2. Login to Grafana, verify it requires auth
3. Consider: add nginx basic auth in front of `/grafana/` for extra layer
4. Consider: restrict `/grafana/` to specific IPs if testers don't need it

### Task 2.2: Fail2ban for SSH protection

```bash
ssh root@65.109.232.32
apt install -y fail2ban
cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600
findtime = 600
EOF
systemctl enable fail2ban
systemctl start fail2ban
```

### Task 2.3: Unattended security upgrades

```bash
ssh root@65.109.232.32
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades  # answer Yes
```

### Task 2.4: Docker log rotation

Add to docker daemon config to prevent logs filling disk:

```bash
ssh root@65.109.232.32
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
systemctl restart docker
```

**WARNING:** This restarts Docker and all containers. Do this during maintenance window. After restart, verify all containers came back up.

### Task 2.5: Clean up orphan container

```bash
ssh root@65.109.232.32
docker rm practical_kapitsa  # orphan from debug session
```

---

## Phase 3: Backups

### Task 3.1: MongoDB backup script + cron

Create backup script:

```bash
ssh root@65.109.232.32
mkdir -p /home/piece/backups

cat > /home/piece/backup-mongodb.sh << 'SCRIPT'
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/home/piece/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Source .env for MongoDB credentials
source /home/piece/piece/.env

# Run mongodump inside the MongoDB container
docker exec piece-mongodb-1 mongodump \
  --username="${MONGO_ROOT_USER}" \
  --password="${MONGO_ROOT_PASSWORD}" \
  --authenticationDatabase=admin \
  --archive=/tmp/backup_${TIMESTAMP}.gz \
  --gzip

# Copy backup out of container
docker cp piece-mongodb-1:/tmp/backup_${TIMESTAMP}.gz ${BACKUP_DIR}/

# Clean up inside container
docker exec piece-mongodb-1 rm /tmp/backup_${TIMESTAMP}.gz

# Remove old backups
find ${BACKUP_DIR} -name "backup_*.gz" -mtime +${RETENTION_DAYS} -delete

echo "Backup completed: ${BACKUP_DIR}/backup_${TIMESTAMP}.gz"
ls -lh ${BACKUP_DIR}/backup_${TIMESTAMP}.gz
SCRIPT

chmod +x /home/piece/backup-mongodb.sh
```

Add cron (daily at 3 AM):
```bash
echo "0 3 * * * /home/piece/backup-mongodb.sh >> /home/piece/backups/backup.log 2>&1" >> /var/spool/cron/crontabs/root
```

Test: run manually, verify backup file created.

---

## Phase 4: Monitoring Dashboards

### Task 4.1: Import Node Exporter dashboard to Grafana

1. Login to Grafana at `http://65.109.232.32/grafana/` (admin / password from .env)
2. Add Prometheus data source: `http://prometheus:9090`
3. Import dashboard ID `1860` (Node Exporter Full) from grafana.com
4. Verify: CPU, memory, disk, network metrics visible

### Task 4.2: Create custom service dashboard

Create a JSON provisioning file for auto-loaded dashboard:

File: `docker/grafana/provisioning/dashboards/piece-services.json`

Panels:
- Backend HTTP request rate (from Prometheus metrics if available)
- Container memory usage per service
- Container restart count
- MongoDB connections
- Redis memory usage

Alternatively, import dashboard ID `893` (Docker and Host monitoring) if Prometheus has Docker metrics.

### Task 4.3: Configure Loki data source in Grafana

1. Add Loki data source in Grafana: `http://loki:3100`
2. Verify: can query logs from all containers
3. Create a simple "Recent Errors" panel: `{job="docker"} |= "error"` or `level=50` (Pino error level)

---

## Phase 5: CI/CD Automation

### Task 5.1: Set up GitHub Secrets for staging

Go to GitHub repo `lelekovtv-ops/piece_platform` → Settings → Secrets and Variables → Actions.

Add secrets:
| Secret Name | Value |
|-------------|-------|
| `STAGE_HOST` | `65.109.232.32` |
| `STAGE_USER` | `piece` |
| `STAGE_SSH_KEY` | Contents of `~/.ssh/id_ed25519` (private key) |

### Task 5.2: Create staging deploy workflow

File: `.github/workflows/deploy-stage.yml`

Already exists in codebase from staging plan implementation. Verify it:
1. Read `.github/workflows/deploy-stage.yml`
2. Ensure it:
   - Triggers on push to `stage` branch
   - SSHes to server as `piece` user
   - Runs `git pull`, `docker build`, `docker compose up -d`
   - Has health check verification loop
3. If workflow references wrong paths or usernames, fix them

### Task 5.3: Test CI/CD pipeline

1. Merge `dev` into `stage`: `git checkout stage && git merge dev && git push origin stage`
2. Watch GitHub Actions — should see workflow running
3. Verify deployment succeeded on server
4. If workflow fails — fix and re-push

**Important:** The deploy user `piece` needs permission to run Docker commands. Verify:
```bash
ssh piece@65.109.232.32 "docker compose ps" # should work (piece is in docker group)
```

Also verify the `piece` user can `git pull` — the repo was cloned with PAT in URL:
```bash
ssh piece@65.109.232.32 "cd /home/piece/piece && git remote -v"
```
If remote doesn't include PAT, the `piece` user needs either:
- SSH key added to GitHub
- Or PAT in the remote URL
- Or the deploy workflow handles git pull as part of SSH commands

---

## Phase 6: Email Setup (Optional — depends on SES readiness)

### Task 6.1: Configure AWS SES for staging

If user has AWS account with SES configured:

1. On server `.env`, update:
   ```
   DISABLE_EMAIL_SENDING=false
   SES_ACCESS_KEY_ID=AKIA...
   SES_SECRET_ACCESS_KEY=...
   SES_REGION=eu-central-1
   SES_CONFIGURATION_SET=piece-staging
   FROM_EMAIL=noreply@{domain}
   FROM_NAME=PIECE
   ```
2. Restart api-gateway: `docker compose restart api-gateway`
3. Test: register a new account, verify email received

If no SES — skip this phase. Registration still works with `DISABLE_EMAIL_SENDING=true`, just without email verification.

---

## Phase 7: Analytics & Error Tracking (Optional)

### Task 7.1: Create Sentry project

1. Go to sentry.io, create project (Node.js for backend)
2. Get DSN
3. On server `.env`: `SENTRY_DSN_BACKEND=https://...@sentry.io/...`
4. Restart api-gateway
5. Trigger a test error, verify it appears in Sentry

### Task 7.2: Create PostHog project

1. Go to posthog.com (free tier), create project
2. Get API key
3. Frontend already has PostHog integration code
4. Set in `.env` or build args: `NEXT_PUBLIC_POSTHOG_KEY=phc_...`, `NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com`
5. Rebuild platform, redeploy
6. Visit site, verify events appear in PostHog

---

## Phase 8: Final Verification

### Task 8.1: Full end-to-end registration test

1. Open `http(s)://65.109.232.32/` in browser
2. Navigate to registration page
3. Register a new user with valid email
4. If email enabled — check inbox, click verification link
5. Login with the registered user
6. Verify: team creation, basic navigation works

### Task 8.2: Run full audit

Execute `/audit` command — the 8-step audit from `.claude/rules/audit-workflow.md`:
1. Hardcoded secrets scan
2. Error handling verification
3. Event naming validation
4. Database pattern verification
5. Logging compliance
6. Container security
7. ESLint compliance
8. Test coverage verification

### Task 8.3: Check resource usage after all changes

```bash
ssh root@65.109.232.32 "free -h && df -h / && docker stats --no-stream"
```

---

## Files Modified / To Be Modified

| File | Phase | Change |
|------|-------|--------|
| `nginx/conf.d/staging-ip.conf` → SSL config | 1.2 | Add SSL server block |
| `docker-compose.yml` | 1.2, 2.4 | SSL nginx volumes, logging config |
| `apps/backend/piece/src/config.js` | 1.3 | Add FRONTEND_URL if missing |
| `.env` on server | 1.2, 1.3, 6, 7 | Domain, FRONTEND_URL, SES, Sentry, PostHog |
| `/etc/docker/daemon.json` on server | 2.4 | Log rotation |
| `/home/piece/backup-mongodb.sh` on server | 3.1 | Backup script |
| `docker/grafana/provisioning/` | 4 | Dashboards, data sources |
| `.github/workflows/deploy-stage.yml` | 5.2 | Review/fix |

## Estimated Effort

| Phase | Items | Complexity |
|-------|-------|-----------|
| Phase 1: SSL + Domain | 3 tasks | Medium (depends on domain availability) |
| Phase 2: Security | 5 tasks | Low |
| Phase 3: Backups | 1 task | Low |
| Phase 4: Monitoring | 3 tasks | Medium |
| Phase 5: CI/CD | 3 tasks | Medium |
| Phase 6: Email | 1 task | Low (if SES ready) |
| Phase 7: Analytics | 2 tasks | Low |
| Phase 8: Verification | 3 tasks | Low |

## Context Recovery Notes

- Read `docs/reports/2026-04-09-staging-deploy.md` for what was done this session
- Read `/memories/session/staging-status.md` if session memory available
- Server is running and stable — all services healthy
- Git branch: `dev` at commit `5bcf8c4`
- `stage` branch exists at `bed16b3` (behind dev by ~6 commits)
- The platform image was built with `NEXT_PUBLIC_API_BASE_URL=http://65.109.232.32/api`
- If domain changes, platform MUST be rebuilt with new URL
- GitHub PAT in git remote URL on server — expires at some point, check if still valid
