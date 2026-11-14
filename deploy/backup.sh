#!/bin/sh
set -eu

cd /opt/dashboard

STAMP=$(date +%F)
OUT="/var/backups/dashboard/db-${STAMP}.dump"

mkdir -p /var/backups/dashboard

docker compose -f docker-compose.prod.yml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -Fc -d "$POSTGRES_DB"' > "$OUT"

find /var/backups/dashboard -name 'db-*.dump' -mtime +14 -delete

echo "$(date -Is) wrote $OUT ($(wc -c < "$OUT") bytes)"
