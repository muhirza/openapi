# MVP0 OPEN API SIDIVA Dashboard

Local web-based dashboard — MVP0.

## Quick Start

1. Copy `.env.example` to `.env` and adjust values (a ready `.env` is provided).

2. Start all services:

```bash
docker compose up --build
```

3. Access the app:
   - Frontend: http://localhost:3000
   - Backend API docs: http://localhost:8000/docs
   - Health check: http://localhost:8000/health

4. Create your first user on the login page ("New user? Register").

## Architecture

```
Frontend (Next.js)  →  Backend (FastAPI)  →  PostgreSQL
                              ↓
                       Provider API (Get Token)
```

- **Auth**: JWT in HttpOnly cookie, passwords hashed with bcrypt
- **First user**: auto-seeded when the DB has no users — default `admin` / `admin12345` (override with `SEED_USERNAME` / `SEED_PASSWORD`)
- **Credentials**: Fernet-encrypted (key from `ENCRYPTION_KEY` env var)
- **Token**: Stored server-side, never exposed to frontend, reused while valid

## Project Structure

```
backend/
  app/
    api/routes/     # auth, profile, token endpoints
    core/           # config, security (hash/encrypt)
    models/         # SQLAlchemy models
    schemas/        # Pydantic schemas
    services/       # TokenService (calls provider)
    db/             # async session
    main.py         # FastAPI app
  alembic/          # migrations
frontend/
  src/app/          # Next.js App Router pages
  src/components/   # React components
  src/lib/          # API client
  src/hooks/        # useSession
```

## Environment Variables

See `.env.example` for all options. Key ones:

- `APP_SECRET_KEY` — app secret (also the Fernet fallback)
- `ENCRYPTION_KEY` — Fernet key for credential encryption
- `DATABASE_URL` — Postgres connection string
- `SESSION_IDLE_MINUTES` — log out after this many minutes without activity (default 120)
- `SESSION_ABSOLUTE_HOURS` — hard cap on session age (default 12)
- `SESSION_COOKIE_SECURE` — set `true` behind HTTPS
- `PROVIDER_*` — Provider token endpoint config (endpoint, method, content type, grant type, extra fields)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | Register first user |
| POST | `/api/login` | Login (sets HttpOnly session cookie, 12 h max) |
| POST | `/api/logout` | Revoke the session and clear cookie |
| GET | `/api/me` | Current session info (also the client heartbeat) |
| GET | `/api/profile/credentials` | Credential status (never returns secret) |
| PUT | `/api/profile/credentials` | Save Client ID + Secret (encrypted) |
| GET | `/api/token/status` | Token status + expiry |
| POST | `/api/token/refresh` | Force fetch new token from provider |

## Sessions

Auth uses an opaque token in an HttpOnly, SameSite=Lax cookie. Tokens are stored
hashed in `user_sessions`, expire after **2 hours idle** or **12 hours** from login
(whichever comes first), and logout revokes them server-side. The frontend validates
the session with `GET /api/me` on every dashboard load, mirrors the idle timer, and
redirects to `/login?expired=1` when the session ends.

## MVP0 Scope

- Local auth (username + password, bcrypt)
- Encrypted API credential storage
- Get Token flow with 1-hour lifetime and reuse
- Simple dashboard

**Not included** (future milestones): Balance, API History, Local Transaction History, per-endpoint API keys.