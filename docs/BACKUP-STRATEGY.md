# Backup Strategy

## Overview

All data is backed up daily with 7-day retention. Critical data (MongoDB, PostgreSQL) uses incremental strategies.

## MongoDB Backup

MongoDB stores all application data (multi-tenant databases).

```bash
#!/bin/bash
# /home/piece/scripts/backup-mongodb.sh

set -euo pipefail

BACKUP_DIR="/home/piece/backups/mongodb"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

# Dump all databases
docker compose -f /home/piece/piece/docker-compose.yml exec -T mongodb \
  mongodump \
  --username="$MONGO_ROOT_USER" \
  --password="$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase=admin \
  --archive \
  --gzip \
  > "$BACKUP_DIR/mongodb-$DATE.archive.gz"

# Verify backup is not empty
BACKUP_SIZE=$(stat -f%z "$BACKUP_DIR/mongodb-$DATE.archive.gz" 2>/dev/null || stat -c%s "$BACKUP_DIR/mongodb-$DATE.archive.gz")
if [ "$BACKUP_SIZE" -lt 1000 ]; then
  echo "ERROR: Backup file too small ($BACKUP_SIZE bytes), possible failure"
  exit 1
fi

echo "MongoDB backup completed: mongodb-$DATE.archive.gz ($BACKUP_SIZE bytes)"

# Cleanup old backups
find "$BACKUP_DIR" -name "mongodb-*.archive.gz" -mtime +$RETENTION_DAYS -delete
echo "Cleaned up backups older than $RETENTION_DAYS days"
```

### Restore

```bash
cat mongodb-YYYY-MM-DD.archive.gz | docker compose exec -T mongodb \
  mongorestore \
  --username="$MONGO_ROOT_USER" \
  --password="$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase=admin \
  --archive \
  --gzip \
  --drop
```

## Redis Backup

Redis uses RDB snapshots (configured in docker-compose.yml with `--save 60 1000`).

```bash
#!/bin/bash
# /home/piece/scripts/backup-redis.sh

set -euo pipefail

BACKUP_DIR="/home/piece/backups/redis"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

# Trigger RDB save
docker compose -f /home/piece/piece/docker-compose.yml exec -T redis redis-cli BGSAVE
sleep 5

# Copy RDB file
docker compose -f /home/piece/piece/docker-compose.yml cp redis:/data/dump.rdb "$BACKUP_DIR/redis-$DATE.rdb"

echo "Redis backup completed: redis-$DATE.rdb"

# Cleanup old backups
find "$BACKUP_DIR" -name "redis-*.rdb" -mtime +$RETENTION_DAYS -delete
```

### Restore

```bash
docker compose stop redis
docker compose cp redis-YYYY-MM-DD.rdb redis:/data/dump.rdb
docker compose start redis
```

## PostgreSQL Backup (Collab Server)

```bash
#!/bin/bash
# /home/piece/scripts/backup-postgres.sh

set -euo pipefail

BACKUP_DIR="/home/piece/backups/postgres"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

docker compose -f /home/piece/piece/docker-compose.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
  > "$BACKUP_DIR/postgres-$DATE.dump"

echo "PostgreSQL backup completed: postgres-$DATE.dump"

find "$BACKUP_DIR" -name "postgres-*.dump" -mtime +$RETENTION_DAYS -delete
```

### Restore

```bash
cat postgres-YYYY-MM-DD.dump | docker compose exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists
```

## MinIO Backup

MinIO stores uploaded files (images, media assets).

```bash
#!/bin/bash
# /home/piece/scripts/backup-minio.sh

set -euo pipefail

BACKUP_DIR="/home/piece/backups/minio"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

# Use mc (MinIO Client) to mirror
docker run --rm --network piece_default \
  -v "$BACKUP_DIR":/backup \
  minio/mc:latest \
  mirror --overwrite http://minio:9000 /backup/minio-$DATE/

echo "MinIO backup completed: minio-$DATE/"

# Cleanup old backups
find "$BACKUP_DIR" -maxdepth 1 -name "minio-*" -mtime +$RETENTION_DAYS -exec rm -rf {} +
```

## Unified Backup Script

```bash
#!/bin/bash
# /home/piece/scripts/backup-all.sh

set -euo pipefail

LOG_FILE="/home/piece/backups/backup-$(date +%Y-%m-%d).log"

echo "=== Backup started at $(date) ===" | tee -a "$LOG_FILE"

# Source environment
source /home/piece/piece/.env

/home/piece/scripts/backup-mongodb.sh 2>&1 | tee -a "$LOG_FILE"
/home/piece/scripts/backup-redis.sh 2>&1 | tee -a "$LOG_FILE"
/home/piece/scripts/backup-postgres.sh 2>&1 | tee -a "$LOG_FILE"
/home/piece/scripts/backup-minio.sh 2>&1 | tee -a "$LOG_FILE"

echo "=== Backup completed at $(date) ===" | tee -a "$LOG_FILE"

# Report disk usage
echo "Backup disk usage:" | tee -a "$LOG_FILE"
du -sh /home/piece/backups/*/ 2>/dev/null | tee -a "$LOG_FILE"
```

## Cron Schedule

```bash
# Add to piece user's crontab (crontab -e)

# Daily full backup at 3:00 AM
0 3 * * * /home/piece/scripts/backup-all.sh

# Certbot renewal check twice daily
0 */12 * * * cd /home/piece/piece && docker compose run --rm certbot renew --quiet && docker compose restart nginx
```

## Disk Space Monitoring

Estimated daily backup sizes:

| Service | Estimated Size | 7-Day Total |
|---------|---------------|-------------|
| MongoDB | ~100-500 MB | ~1-3.5 GB |
| Redis | ~10-50 MB | ~70-350 MB |
| PostgreSQL | ~10-50 MB | ~70-350 MB |
| MinIO | Varies | Incremental |

Ensure `/home/piece/backups/` has at least 10 GB free space. Monitor with:

```bash
df -h /home/piece/backups/
```
