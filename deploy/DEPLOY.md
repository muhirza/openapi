# Deploy runbook — Tencent Lighthouse, Cloudflare Tunnel `vps`

Host: `43.133.47.35` · Ubuntu 24.04 · 2 vCPU / 2 GB RAM / 40 GB SSD / 20 Mbps
Public origin: `https://openapi.miate.my.id` → tunnel `vps` → `127.0.0.1:8080` → edge → frontend / backend
App dir: `/opt/dashboard`

The host already runs n8n, waha and a router. **Never touch their containers, routes or ports.**

---

## 0. Non-negotiables

- `ENCRYPTION_KEY` and `APP_SECRET_KEY` must be copied byte-for-byte. Without the original
  `ENCRYPTION_KEY`, every row in `api_credentials`, `api_tokens` and `user_pins` is unreadable forever.
- Never run `docker compose down -v` here — `-v` deletes the `dashboard_pgdata` volume.
- Postgres stays on `15-alpine`; do not bump the major version while migrating.
- Ports 3000/8000/5432 are container-internal. Only `127.0.0.1:8080` is published.

---

## 1. Host prep (2 GB RAM box)

```bash
free -h; df -h /
swapon --show

# 4 GB swap is not optional here — the Next.js build alone can exceed 1 GB
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl -w vm.swappiness=10
echo 'vm.swappiness=10' >> /etc/sysctl.conf

# Docker log cap (protects the 15 GB of free disk)
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
systemctl restart docker
```

No inbound firewall changes are required for the app: the tunnel is outbound-only.
Keep 22/tcp open in the Lighthouse firewall; do not add 80/443.

---

## 2. Restore point on the source machine (Windows)

Dump inside the container and copy it out — PowerShell's `>` writes UTF-16 and corrupts a
binary `-Fc` dump.

```powershell
cd "C:\Users\HYPE AMD\Documents\Code\OPEN API3"
mkdir backup -Force
docker compose exec -T db sh -c 'pg_dump -U dashboard -Fc -d dashboard > /tmp/dashboard.dump'
docker compose cp db:/tmp/dashboard.dump .\backup\dashboard.dump
Copy-Item .env .\backup\.env.prod
docker compose exec -T db psql -U dashboard -d dashboard -c "select (select count(*) from users) users,(select count(*) from api_credentials) creds,(select count(*) from local_transactions) local_tx,(select count(*) from stock_transactions) stock_tx;"
```

Record those four counts. They are the acceptance test in §6.

```powershell
scp .\backup\dashboard.dump root@43.133.47.35:/root/dashboard.dump
scp .\backup\.env.prod      root@43.133.47.35:/root/.env.prod
```

---

## 3. Code + config on the host

```bash
mkdir -p /opt/dashboard && cd /opt/dashboard
git clone https://github.com/muhirza/openapi.git .
cp /root/.env.prod .env && chmod 600 .env
mv /root/dashboard.dump /root/dashboard.dump.bak   # keep outside the compose volume path
```

Edit `.env` — change **only** these:

| Key | Value |
|---|---|
| `POSTGRES_PASSWORD` | new strong password |
| `DATABASE_URL` | `postgresql+asyncpg://dashboard:NEWPASS@db:5432/dashboard` |
| `SESSION_COOKIE_SECURE` | `true` |
| `NEXT_PUBLIC_API_URL` | `https://openapi.miate.my.id` |
| `ALLOWED_ORIGINS` | `https://openapi.miate.my.id` |
| `SEED_USERNAME` / `SEED_PASSWORD` | changed (no-op, users already exist) |

Leave `ENCRYPTION_KEY`, `APP_SECRET_KEY` and every `PROVIDER_*` untouched.

---

## 4. Database restore (before the backend ever starts)

```bash
cd /opt/dashboard
docker compose -f docker-compose.prod.yml up -d db
docker compose -f docker-compose.prod.yml ps          # wait for (healthy)

docker compose -f docker-compose.prod.yml cp /root/dashboard.dump.bak db:/tmp/dashboard.dump
docker compose -f docker-compose.prod.yml exec -T db \
  pg_restore -U dashboard -d dashboard --no-owner --clean --if-exists /tmp/dashboard.dump

docker compose -f docker-compose.prod.yml exec -T db psql -U dashboard -d dashboard -c \
 "select (select count(*) from users) users,(select count(*) from api_credentials) creds,(select count(*) from local_transactions) local_tx,(select count(*) from stock_transactions) stock_tx;"
docker compose -f docker-compose.prod.yml exec -T db psql -U dashboard -d dashboard -c \
 "select version_num from alembic_version;"        # expect 0010
```

Counts must match §2 before continuing.

---

## 5. Build + start

```bash
cd /opt/dashboard
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=60 backend
```

Memory guard while building (if the build gets OOM-killed):

```bash
docker builder prune -af
docker compose -f docker-compose.prod.yml build --progress=plain frontend
```

Fallback if 2 GB still isn't enough: build on the Windows machine and ship the images
(measured: 227 MB frontend, 600 MB backend).

```powershell
docker build -f frontend/Dockerfile.prod --build-arg NEXT_PUBLIC_API_URL=https://openapi.miate.my.id -t dashboard-frontend:prod frontend
docker build -f backend/Dockerfile.prod -t dashboard-backend:prod backend
docker save dashboard-frontend:prod dashboard-backend:prod | ssh root@43.133.47.35 "docker load"
```

Then on the host: `docker compose -f docker-compose.prod.yml up -d` (compose reuses the
local images it just loaded).

---

## 6. Cloudflare route

Zero Trust → Networks → Tunnels → `vps` → Routes → **Add route → Published application**

- Subdomain `openapi`, domain `miate.my.id`, type `HTTP`
- URL `http://localhost:8080` — or `http://172.17.0.1:8080` if `cloudflared` is a container
  (then change the edge mapping to `"0.0.0.0:8080:80"`)

Verification:

```bash
curl -s https://openapi.miate.my.id/health
curl -s -o /dev/null -w '%{http_code}\n' https://openapi.miate.my.id/

# other routes must be unaffected
curl -s -o /dev/null -w 'n8n %{http_code}\n'   https://n8n.miate.my.id/
curl -s -o /dev/null -w 'waha %{http_code}\n'  https://waha.miate.my.id/
curl -s -o /dev/null -w 'router %{http_code}\n' https://router.miate.my.id/
```

Acceptance in the browser:

1. Log in with existing credentials (bcrypt hashes came from the dump).
2. `access_token` cookie shows Secure + HttpOnly + SameSite=Lax.
3. API Config page renders saved client IDs → `ENCRYPTION_KEY` is correct.
4. Stock history detail and a local transaction open.
5. Excel export downloads.
6. Counts from §4 match §2.

---

## 7. Ops

```bash
chmod +x deploy/backup.sh
crontab -e    # add:
15 3 * * * /opt/dashboard/deploy/backup.sh
```

Copy `/var/backups/dashboard` off-box and store `.env` somewhere safe — a dump without
`ENCRYPTION_KEY` cannot be decrypted.

Updating:

```bash
cd /opt/dashboard && git pull
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
```

Both backend background loops (recheck + history sync) run inside the single uvicorn
process. Do not add `--workers`; each extra worker would duplicate provider calls.

---

## 8. CI/CD (GitHub Actions)

`.github/workflows/deploy.yml` — on every push to `master`: test → build & push images to
GHCR → SSH to the VPS → backup → pull → restart → health gate (auto-rollback on failure).
Pull requests only run the test job.

**Why images are built in CI, not on the VPS:** 2 vCPU / 2 GB cannot reliably run a Next.js
build next to n8n + waha + Postgres. CI has 4 GB and a warm registry cache; the VPS only
pulls ~800 MB.

One-time setup:

```bash
# 1) deploy key on your machine
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/openapi_deploy -N ""
ssh-copy-id -i ~/.ssh/openapi_deploy.pub root@43.133.47.35

# 2) host fingerprint for VPS_KNOWN_HOSTS
ssh-keyscan -H 43.133.47.35
```

Repository → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `VPS_HOST` | `43.133.47.35` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | contents of `~/.ssh/openapi_deploy` (the **private** key) |
| `VPS_KNOWN_HOSTS` | output of `ssh-keyscan -H 43.133.47.35` |

Optional repo **variables**: `PUBLIC_URL`, `NEXT_PUBLIC_SESSION_IDLE_MINUTES`.

Once, on the VPS — GHCR pull access (packages inherit repo visibility):

```bash
echo "<PAT with read:packages>" | docker login ghcr.io -u muhirza --password-stdin
chmod +x /opt/dashboard/deploy/release.sh
```

Optional manual approval: Settings → Environments → `production` → add required reviewers.
The deploy job then waits for a click.

What `deploy/release.sh` guarantees:

1. `pg_dump` to `/var/backups/dashboard` **before** anything restarts.
2. `git merge --ff-only` — refuses to clobber local edits on the server instead of resetting.
3. Images pinned by commit SHA in `.release.env`; `latest` is never what gets deployed.
4. Health gate polls `http://127.0.0.1:8080/health` for 90 s; on failure it redeploys the
   previous SHA pair and exits non-zero so the Actions run goes red.

Honest limits:

- **Image rollback does not undo a migration.** If a migration is destructive, the dump from
  step 1 is the only rollback. Review migration files in the PR before merging.
- Auto-deploy means `master` is production. Turn on branch protection / require PR review.
- One VPS, no HA. CI/CD makes releases routine, not the site redundant — off-site backups do.
- Never add `down -v` to any script here; that deletes `dashboard_pgdata`.

Manual deploy still works if Actions is down: `docker compose -f docker-compose.prod.yml up -d --build`.

---

## 9. Rollback

```bash
docker compose -f docker-compose.prod.yml stop        # app off, volume intact
```

Remove the `openapi` route in Cloudflare to take it dark. The source machine's
`openapi3_pgdata` volume was never modified, so `docker compose up -d` there restores the
old state exactly.
