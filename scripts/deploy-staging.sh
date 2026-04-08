#!/bin/bash
set -euo pipefail

# piece — Manual Deploy Script for Staging
# Usage: ./scripts/deploy-staging.sh [branch]
# Default branch: stage

BRANCH="${1:-stage}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"

echo "=== piece staging deploy ==="
echo "Branch: $BRANCH"
echo "Directory: $PROJECT_DIR"
echo ""

cd "$PROJECT_DIR"

# 1. Pull latest code
echo ">>> Pulling latest code..."
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

# 2. Use staging nginx config
echo ">>> Configuring nginx for IP-based staging..."
cp nginx/conf.d/staging-ip.conf nginx/conf.d/default.conf 2>/dev/null || true

# 3. Build base image
echo ">>> Building base image..."
docker build -f docker/Dockerfile.base -t piece-base:latest .

# 4. Build all services
echo ">>> Building services..."
docker compose build --parallel

# 5. Start/restart services
echo ">>> Starting services..."
docker compose up -d --remove-orphans --force-recreate

# 6. Health check loop
echo ">>> Waiting for services to be healthy..."
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  if curl -sf http://localhost:3100/health > /dev/null 2>&1; then
    echo ">>> Backend healthy after $ATTEMPT attempts"
    break
  fi
  if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo ">>> ERROR: Backend not healthy after $MAX_ATTEMPTS attempts"
    docker compose ps
    docker compose logs --tail=20 api-gateway
    exit 1
  fi
  sleep 10
done

# 7. Show status
echo ""
echo "=== Deploy complete ==="
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo ">>> Frontend: http://$(hostname -I | awk '{print $1}')/"
echo ">>> API:      http://$(hostname -I | awk '{print $1}')/api/health"
echo ">>> Grafana:  http://$(hostname -I | awk '{print $1}')/grafana/"
