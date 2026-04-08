# Task Analysis — Potential Issues & Risks

**Date:** 2026-04-09
**Analyzed document:** `docs/reports/2026-04-09-next-session-task.md`

---

## Critical Issues Found

### 1. Phase ordering dependency — SSL blocks everything

**Problem:** Phase 1 (SSL + Domain) is a blocker for almost everything else. If user doesn't have a domain ready, Phases 2-8 should proceed without it.

**Fix:** Reorder priorities. Phases 2 (Security), 3 (Backups), 4 (Monitoring), 5 (CI/CD) are independent of domain/SSL. Do them FIRST, then SSL when domain is ready.

**Recommended execution order:**
1. Phase 2 (Security Hardening) — no dependencies
2. Phase 3 (Backups) — no dependencies
3. Phase 4 (Monitoring Dashboards) — no dependencies
4. Phase 5 (CI/CD) — no dependencies
5. Phase 1 (SSL + Domain) — when user has domain
6. Phase 6-7 (Email, Analytics) — after domain

---

### 2. Docker daemon restart (Task 2.4) will cause downtime

**Problem:** `systemctl restart docker` kills ALL running containers. In the task it says "do during maintenance window" but doesn't specify recovery steps.

**Fix:** Add explicit recovery verification:
```bash
systemctl restart docker
sleep 10
cd /home/piece/piece && docker compose up -d
sleep 30
docker compose ps  # verify all healthy
curl -s http://localhost/api/health | jq .
```

Also: Docker's live-restore feature can minimize downtime:
```json
{
  "live-restore": true,
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
```

---

### 3. MongoDB backup script assumes container name

**Problem:** Script uses `piece-mongodb-1` as container name. Docker Compose container naming depends on:
- Project directory name
- docker-compose.yml service name
- Instance number

If the project was cloned to a different directory, or docker compose uses `--project-name`, the container name will be different.

**Fix:** Use `docker compose exec mongodb` instead of `docker exec piece-mongodb-1`:
```bash
docker compose -f /home/piece/piece/docker-compose.yml exec -T mongodb mongodump ...
docker compose -f /home/piece/piece/docker-compose.yml cp mongodb:/tmp/backup.gz ./
```

---

### 4. Cron job path for certbot renewal is wrong

**Problem:** The certbot renewal cron uses `docker compose run --rm certbot renew`. But `docker compose` needs to be run from the project directory, and the cron environment may not have Docker in PATH.

**Fix:**
```bash
0 3 * * 0 cd /home/piece/piece && /usr/bin/docker compose run --rm certbot renew --quiet && /usr/bin/docker compose restart nginx >> /home/piece/backups/certbot.log 2>&1
```

---

### 5. CI/CD workflow — SSH key format mismatch risk

**Problem:** Task says to add `~/.ssh/id_ed25519` (local key) as `STAGE_SSH_KEY` GitHub secret. But this is the key used to SSH FROM local machine TO server. The deploy workflow SSH action needs:
- A key that can authenticate as `piece` user on the server
- The server's `~/.ssh/authorized_keys` must have the matching public key

**Fix:** Clarify: the deployment SSH key should be a DEDICATED deploy key, not the personal SSH key. Steps:
1. Generate a new key pair specifically for CI/CD: `ssh-keygen -t ed25519 -C "piece-ci-deploy"`
2. Add the PUBLIC key to server: `ssh root@65.109.232.32 "cat >> /home/piece/.ssh/authorized_keys"` 
3. Add the PRIVATE key as `STAGE_SSH_KEY` GitHub secret
4. This way, personal keys are never stored in GitHub

---

### 6. Git pull on server — PAT token expiration not tracked

**Problem:** The repo was cloned with a PAT embedded in the remote URL. PATs expire. If the PAT expires, the deploy workflow will fail silently on `git pull`.

**Fix:** 
- Check PAT expiration date: GitHub → Settings → Developer settings → Personal access tokens
- Set a calendar reminder for renewal
- Consider switching to a GitHub App installation token or SSH deploy key instead of PAT

---

### 7. FRONTEND_URL may not exist in config schema

**Problem:** Task says "verify it's in the backend config schema. If not, add it." But doesn't specify WHERE it's used in the codebase. Simply adding it to the schema without wiring it into email templates/auth flows is useless.

**Fix:** Before adding FRONTEND_URL:
1. `grep -rn "FRONTEND_URL\|frontendUrl" apps/backend/ packages/` — check if it's already referenced
2. Check email templates — do they use `FRONTEND_URL` for verification links?
3. Check auth routes — does `sendVerificationEmail()` need a base URL?
4. Only add to schema if code actually consumes it

---

### 8. Grafana provisioning directory may not exist

**Problem:** Task says to create `docker/grafana/provisioning/dashboards/piece-services.json`. But the docker-compose.yml may not mount this directory into the Grafana container.

**Fix:** Verify docker-compose.yml Grafana volumes BEFORE creating files:
```bash
grep -A20 "grafana:" docker-compose.yml | grep volumes
```
If no provisioning mount exists, add it:
```yaml
volumes:
  - ./docker/grafana/provisioning:/etc/grafana/provisioning
```

---

### 9. Loki data source URL may be wrong

**Problem:** Task says Loki URL is `http://loki:3100`. But the actual Loki service name and port depend on docker-compose.yml config.

**Fix:** Verify before configuring:
```bash
grep -B2 -A10 "loki:" docker-compose.yml | grep -E "container_name|ports"
```

---

### 10. PostHog rebuild requirement not emphasized enough

**Problem:** `NEXT_PUBLIC_POSTHOG_KEY` is a build-time environment variable (Next.js inlines `NEXT_PUBLIC_*` at build time). Simply adding it to `.env` and restarting won't work.

**Fix:** Explicitly state: "MUST rebuild the platform Docker image":
```bash
docker compose build platform --no-cache
docker compose up -d platform
```

Same applies to ANY `NEXT_PUBLIC_*` variable change — always requires full rebuild.

---

## Minor Issues

### 11. No rollback plan for any phase

**Fix:** Before each phase, note the current state so rollback is possible:
- Before Docker daemon changes: `cat /etc/docker/daemon.json` (if exists)
- Before nginx SSL changes: backup current config
- Before .env changes: `cp .env .env.backup.$(date +%Y%m%d)`

### 12. No disk space check before MongoDB backup

**Fix:** Add to backup script:
```bash
AVAILABLE_KB=$(df /home/piece/backups | awk 'NR==2{print $4}')
if [ "$AVAILABLE_KB" -lt 1048576 ]; then  # Less than 1GB
  echo "ERROR: Less than 1GB free, skipping backup" >&2
  exit 1
fi
```

### 13. Fail2ban may not work with Docker SSH

If SSH is handled through Docker (unlikely but possible), Fail2ban watching `/var/log/auth.log` won't see Docker-proxied connections. Verify SSH runs on host, not in container.

---

## Summary

| Severity | Count | Key Risk |
|----------|-------|----------|
| Critical | 2 | Phase ordering (SSL blocks everything), Docker restart downtime |
| High | 4 | Container name assumption, PAT expiration, SSH key for CI/CD, PostHog rebuild |
| Medium | 4 | Cron paths, FRONTEND_URL usage, Grafana mounts, Loki URL |
| Low | 3 | No rollback plan, disk check, Fail2ban+Docker |

**Recommendation:** Start next session by re-reading this analysis, reorder phases (security/backups first, SSL last), and verify each assumption before executing.
