#!/bin/sh
set -eu

APP_DIR=/opt/dashboard
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env --env-file .release.env"
HEALTH_URL=http://127.0.0.1:8080/health
HEALTH_TRIES=45

cd "$APP_DIR"

if [ -z "${BACKEND_IMAGE:-}" ] || [ -z "${FRONTEND_IMAGE:-}" ]; then
  echo "BACKEND_IMAGE and FRONTEND_IMAGE must be set" >&2
  exit 1
fi

command -v curl >/dev/null 2>&1 || { echo "curl is required for the health gate" >&2; exit 1; }

PREV_BACKEND=""
PREV_FRONTEND=""
if [ -f .release.env ]; then
  PREV_BACKEND=$(sed -n 's/^BACKEND_IMAGE=//p' .release.env)
  PREV_FRONTEND=$(sed -n 's/^FRONTEND_IMAGE=//p' .release.env)
fi

echo "==> syncing repo"
git fetch --prune origin
git merge --ff-only origin/master

echo "==> pre-deploy database backup"
./deploy/backup.sh

printf 'BACKEND_IMAGE=%s\nFRONTEND_IMAGE=%s\n' "$BACKEND_IMAGE" "$FRONTEND_IMAGE" > .release.env

echo "==> pulling images"
$COMPOSE pull backend frontend

echo "==> applying"
$COMPOSE up -d

echo "==> health gate"
i=0
healthy=0
while [ "$i" -lt "$HEALTH_TRIES" ]; do
  if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
    healthy=1
    break
  fi
  i=$((i + 1))
  sleep 2
done

if [ "$healthy" -ne 1 ]; then
  echo "!! health gate failed after $((HEALTH_TRIES * 2))s" >&2
  if [ -n "$PREV_BACKEND" ] && [ -n "$PREV_FRONTEND" ]; then
    echo "!! rolling back to $PREV_BACKEND" >&2
    printf 'BACKEND_IMAGE=%s\nFRONTEND_IMAGE=%s\n' "$PREV_BACKEND" "$PREV_FRONTEND" > .release.env
    $COMPOSE up -d
    if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
      echo "!! rollback healthy" >&2
    else
      echo "!! rollback ALSO unhealthy — manual attention required" >&2
    fi
  else
    echo "!! no previous release recorded, nothing to roll back to" >&2
  fi
  exit 1
fi

$COMPOSE logs --tail=20 backend

echo "==> deployed $BACKEND_IMAGE"
docker image prune -f >/dev/null
