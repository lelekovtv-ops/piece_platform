# Production Server Setup — Hetzner Cloud

## Recommended Server Specs (1000+ Concurrent Users)

| Component | Staging | Production |
|-----------|---------|------------|
| CPU | 4 vCPU (CPX31) | 8 vCPU (CPX41) |
| RAM | 8 GB | 16 GB |
| Storage | 160 GB NVMe | 240 GB NVMe |
| Bandwidth | 20 TB | 20 TB |
| Location | eu-central (Falkenstein) | eu-central (Falkenstein) |

## Memory Budget (Production)

| Service | Limit | Notes |
|---------|-------|-------|
| MongoDB | 2 GB | WiredTiger cache auto-sizes to ~1 GB |
| Redis | 1 GB | maxmemory 1gb, allkeys-lru |
| NATS | 512 MB | JetStream file storage |
| Qdrant | 4 GB | Vector search (optional) |
| PostgreSQL | 512 MB | Collab server backend |
| MinIO | 512 MB | Object storage |
| Backend (piece) | 512 MB | Express.js monolith |
| WebSocket GW | 256 MB | Socket.IO |
| Frontend | 512 MB | Next.js SSR |
| Nginx | 256 MB | Reverse proxy |
| **Total** | **~10.5 GB** | Leaves ~5.5 GB for OS + burst |

## Initial Setup

```bash
# 1. Create server via Hetzner Cloud Console or CLI
hcloud server create \
  --name piece-prod \
  --type cpx41 \
  --image ubuntu-24.04 \
  --location fsn1 \
  --ssh-key your-key

# 2. Connect
ssh root@<server-ip>

# 3. Update system
apt update && apt upgrade -y

# 4. Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker

# 5. Install Docker Compose plugin
apt install -y docker-compose-plugin

# 6. Create deploy user
adduser --disabled-password piece
usermod -aG docker piece

# 7. Setup SSH for deploy user (add your CI/CD public key)
mkdir -p /home/piece/.ssh
cp ~/.ssh/authorized_keys /home/piece/.ssh/
chown -R piece:piece /home/piece/.ssh

# 8. Clone repo
su - piece
git clone git@github.com:your-org/piece.git ~/piece
cd ~/piece
```

## Firewall Rules

```bash
# Hetzner Cloud Firewall (via Console or API)
# Inbound:
#   TCP 22   — SSH (restrict to your IPs)
#   TCP 80   — HTTP (Certbot + redirect)
#   TCP 443  — HTTPS (main traffic)
# Outbound:
#   All — allow
```

## SSL Certificate Setup

```bash
cd ~/piece

# 1. Start nginx without SSL first (use http-only config)
docker compose up -d nginx

# 2. Obtain certificate
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d api.yourdomain.com \
  -d app.yourdomain.com \
  --agree-tos --email admin@yourdomain.com

# 3. Switch to SSL nginx config and restart
docker compose restart nginx
```

## Auto-renewal Cron

```bash
# Add to piece user's crontab
crontab -e

# Renew certificates twice daily
0 */12 * * * cd /home/piece/piece && docker compose run --rm certbot renew --quiet && docker compose restart nginx
```

## Deploy Workflow

Automated via GitHub Actions (see `.github/workflows/deploy-prod.yml`).

Manual deploy:

```bash
cd ~/piece
git fetch origin
git reset --hard origin/main

# Copy .env from secure location
cp /home/piece/.env.production .env

# Build and deploy
docker build -f docker/Dockerfile.base -t piece-base:latest .
docker compose build --parallel
docker compose up -d --remove-orphans --force-recreate

# Verify health
for i in $(seq 1 20); do
  if curl -sf http://localhost:3100/health > /dev/null; then
    echo "Service healthy after $i attempts"
    break
  fi
  sleep 10
done
```

## Monitoring

```bash
# Check all containers
docker compose ps

# Check logs
docker compose logs -f --tail=100 api-gateway

# Check resource usage
docker stats --no-stream

# Check metrics endpoint
curl http://localhost:4030/internal/metrics
```

## Swap Configuration

```bash
# Add 4GB swap for memory peaks
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Tune swappiness (prefer RAM, use swap only under pressure)
echo 'vm.swappiness=10' >> /etc/sysctl.conf
sysctl -p
```

## Kernel Tuning for 1000+ Connections

```bash
cat >> /etc/sysctl.conf << 'EOF'
# Network tuning for 1000+ concurrent connections
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.core.netdev_max_backlog = 65535

# File descriptor limits
fs.file-max = 1000000
EOF

sysctl -p

# Also increase limits for the deploy user
cat >> /etc/security/limits.conf << 'EOF'
piece soft nofile 65535
piece hard nofile 65535
EOF
```
