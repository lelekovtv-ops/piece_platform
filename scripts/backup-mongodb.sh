#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/home/piece/backups/mongodb}"
COMPOSE_FILE="${COMPOSE_FILE:-/home/piece/piece/docker-compose.yml}"
RETENTION_DAYS=7
DATE=$(date +%Y-%m-%d_%H-%M-%S)

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting MongoDB backup..."

docker compose -f "$COMPOSE_FILE" exec -T mongodb \
  mongodump \
  --username="${MONGO_ROOT_USER:-admin}" \
  --password="${MONGO_ROOT_PASSWORD:-changeme}" \
  --authenticationDatabase=admin \
  --oplog \
  --archive \
  --gzip \
  > "$BACKUP_DIR/mongodb-$DATE.archive.gz"

BACKUP_SIZE=$(stat -c%s "$BACKUP_DIR/mongodb-$DATE.archive.gz" 2>/dev/null || stat -f%z "$BACKUP_DIR/mongodb-$DATE.archive.gz")
if [ "$BACKUP_SIZE" -lt 1000 ]; then
  echo "ERROR: Backup file too small ($BACKUP_SIZE bytes), possible failure"
  exit 1
fi

echo "[$(date)] MongoDB backup completed: mongodb-$DATE.archive.gz ($BACKUP_SIZE bytes)"

find "$BACKUP_DIR" -name "mongodb-*.archive.gz" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] Cleaned up backups older than $RETENTION_DAYS days"
