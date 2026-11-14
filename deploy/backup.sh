#!/bin/sh
set -eu

cd /opt/dashboard

BACKUP_DIR=${BACKUP_DIR:-/var/backups/dashboard}
STAMP=$(date +%F)
OUT="${BACKUP_DIR}/db-${STAMP}.dump"

mkdir -p "$BACKUP_DIR"

docker compose -f docker-compose.prod.yml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -Fc -d "$POSTGRES_DB"' > "$OUT"

find "$BACKUP_DIR" -name 'db-*.dump' -mtime +14 -delete

echo "$(date -Is) wrote $OUT ($(wc -c < "$OUT") bytes)"
