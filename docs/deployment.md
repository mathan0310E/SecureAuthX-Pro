# Deployment Guide

## Architecture

```
Browser ──> [Next.js web] ──/api──> [Express API]
                                       │
                          ┌────────────┼────────────┐
                       PostgreSQL   Redis       SMTP (MailHog in dev)
```

- **Web** — Next.js app server (SSR + same-origin `/api` proxy).
- **API** — stateless Express service built by `tsup` (`dist/index.cjs`).
- **PostgreSQL 17** — source of truth (Prisma-managed schema).
- **Redis** — rate-limit state, MFA challenges, refresh-token blacklist cache.
- **Mail** — transactional email (SMTP). MailHog is provided for development only.

## Prerequisites

- Node.js 22+, pnpm 10+
- Docker (for infra) or managed PostgreSQL/Redis
- A reverse proxy (e.g. Caddy, Nginx, Traefik) for TLS

## 1. Environment

Copy `.env.example` to `.env` (repo root) and set production values:

| Variable | Notes |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Postgres DSN |
| `REDIS_URL` | Redis DSN (may include password) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | 32+ random bytes, unique |
| `ENCRYPTION_KEY` | Key for TOTP secret encryption |
| `COOKIE_SECURE` | `true` behind HTTPS |
| `TRUST_PROXY` | `1` behind a reverse proxy |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Bootstrap admin for `db:seed` |
| `SMTP_*` | Transactional mail provider |

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 2. Database

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

The seed is idempotent and creates the bootstrap administrator.

## 3. Build

```bash
pnpm -r build
```

## 4. Run

### Production process
```bash
# API
DATABASE_URL=… REDIS_URL=… NODE_ENV=production node apps/api/dist/index.cjs

# Web
NODE_ENV=production npx --workspace @secureauthx/web start
```

### Docker (provided)
```bash
docker compose -f docker/docker-compose.yml --profile app up -d --build
```

Two images are defined:
- `Dockerfile.api` — multi-stage: install → build (`tsup`) → slim runtime.
- `Dockerfile.web` — build static/SSR output → run Next start.

## 5. Reverse proxy & TLS

Terminate TLS at the proxy and forward to the web origin (port 3000). The web app rewrites `/api/*` to the API origin configured by `API_URL` (default `http://localhost:4000`). Example Caddy:

```
auth.example.com {
    reverse_proxy localhost:3000
}
```

Ensure `COOKIE_SECURE=true` and `TRUST_PROXY=1` are set.

## 6. Verification

```bash
curl -fsS http://localhost:4000/health            # liveness
curl -fsS http://localhost:4000/api/v1/health     # db + redis readiness
```

Login as the admin, then confirm the Security Activity and Admin pages render.

## 7. Operations

- **Backups**: dump Postgres (`pg_dump`); Redis is ephemeral cache/state and safe to lose.
- **Scaling**: the API is stateless; scale horizontally behind a load balancer (sticky sessions not required). Redis must be shared.
- **Updates**: run `db:migrate` before starting the new API release.
- **Health checks**: wire `/health` into your orchestrator.
