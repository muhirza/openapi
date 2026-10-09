# MVP0 Transaction Dashboard

Local web-based transaction dashboard — MVP0.

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
    core/           # config, security (hash/encrypt/JWT)
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
  src/hooks/        # useAuth
```

## Environment Variables

See `.env.example` for all options. Key ones:

- `APP_SECRET_KEY` — JWT signing key
- `ENCRYPTION_KEY` — Fernet key for credential encryption
- `DATABASE_URL` — Postgres connection string
- `PROVIDER_*` — Provider token endpoint config (endpoint, method, content type, grant type, extra fields)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | Register first user |
| POST | `/api/login` | Login (sets HttpOnly cookie) |
| POST | `/api/logout` | Logout (clears cookie) |
| GET | `/api/profile/credentials` | Credential status (never returns secret) |
| PUT | `/api/profile/credentials` | Save Client ID + Secret (encrypted) |
| GET | `/api/token/status` | Token status + expiry |
| POST | `/api/token/refresh` | Force fetch new token from provider |

## MVP0 Scope

- Local auth (username + password, bcrypt)
- Encrypted API credential storage
- Get Token flow with 1-hour lifetime and reuse
- Simple dashboard

**Not included** (future milestones): Balance, API History, Local Transaction History, per-endpoint API keys.