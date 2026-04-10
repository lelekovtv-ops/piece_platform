#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/home/piece/backups/redis}"
COMPOSE_FILE="${COMPOSE_FILE:-/home/piece/piece/docker-compose.yml}"
RETENTION_DAYS=7
DATE=$(date +%Y-%m-%d_%H-%M-%S)

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting Redis backup..."

docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli BGSAVE
sleep 5

docker compose -f "$COMPOSE_FILE" cp redis:/data/dump.rdb "$BACKUP_DIR/redis-$DATE.rdb"

BACKUP_SIZE=$(stat -c%s "$BACKUP_DIR/redis-$DATE.rdb" 2>/dev/null || stat -f%z "$BACKUP_DIR/redis-$DATE.rdb")
echo "[$(date)] Redis backup completed: redis-$DATE.rdb ($BACKUP_SIZE bytes)"

find "$BACKUP_DIR" -name "redis-*.rdb" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] Cleaned up backups older than $RETENTION_DAYS days"
