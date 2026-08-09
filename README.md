# SecureAuthX Pro

**Enterprise-grade, self-hosted Multi-Factor Authentication (MFA) platform.**

SecureAuthX Pro is a complete authentication and identity platform that ships with
password-based login hardened by account lockout, TOTP (authenticator apps), WebAuthn
passkeys, recovery codes, trusted devices, session management, and full audit
telemetry — deployed as a pair of Cloudflare Workers backed by Postgres and Redis.

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![Hono](https://img.shields.io/badge/Hono-4.6-red?logo=hono)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-deployed-orange?logo=cloudflare)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-blue?logo=postgresql)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Live Deployment

The project is deployed end-to-end on Cloudflare Workers with a Neon Postgres database:

| Component | URL |
| --- | --- |
| **Web app** | <https://secureauthx-pro-web.secureauthx-pro.workers.dev> |
| **API (REST)** | <https://secureauthx-pro-api.secureauthx-pro.workers.dev> |
| **API health** | <https://secureauthx-pro-api.secureauthx-pro.workers.dev/api/v1/health> |

> **Note:** the live demo runs with `MAIL_PROVIDER=console`, so transactional emails
> (verification links, reset links) are written to the Worker logs instead of being
> delivered. Point `MAIL_PROVIDER` at `smtp` or `resend` for real delivery.

---

## Features

### Authentication
- Email + password registration and login (bcrypt, 12 rounds)
- Email verification with expiring, single-use hashed tokens
- Password reset flow with expiring, revocable tokens
- Account lockout after N failed attempts (configurable window)
- Optional passkey-only accounts (no password required)

### Multi-Factor Authentication
- **TOTP** — authenticator-app codes (QR provisioning, encrypted secrets at rest, counter-based)
- **WebAuthn / Passkeys** — platform + roaming authenticators (COSE keys, sign-count tracking, AAGUID metadata)
- **Recovery codes** — 10 one-time, SHA-256 hashed codes with per-code revocation
- **Trusted devices** — fingerprint-based device trust with configurable TTL
- MFA challenge with TTL; enforcement policy per account

### Sessions & Devices
- Refresh-token rotation with SHA-256 hashed session storage
- Active session listing, per-device revocation, "sign out everywhere"
- Device fingerprinting and browser/platform capture
- Configurable idle and absolute session timeouts

### Security & Compliance
- AES-256-GCM encryption of secrets at rest (SHA-256 derived key)
- JWT access tokens (short-lived) + rotating refresh tokens
- Rate limiting on auth endpoints (Upstash Redis in production)
- Full **audit log** of identity actions and **security events** (severity-graded)
- User roles (`USER` / `ADMIN`), statuses (`ACTIVE`, `LOCKED`, `DISABLED`, `PENDING_VERIFICATION`)
- Admin console for user management (list, inspect, lock/unlock, disable, delete)

---

## Architecture

The system runs as **two Cloudflare Workers** sharing one Postgres database.

```
 Browser
   │  HTTPS (browser only talks to the web origin)
   ▼
 secureauthx-pro-web   ──  Next.js 15 (React 19) via OpenNext on Workers
   │
   │  same-origin /api/* rewrites → cookies scoped to the web host
   ▼
 secureauthx-pro-api   ──  Hono 4 (Node.js-compat Worker)
   │
   ├──► Neon PostgreSQL  (Prisma 6, engineType=client WASM + @prisma/adapter-pg)
   └──► Upstash Redis    (REST — rate limits, MFA challenges, session cache)
```

- **Web Worker** (`secureauthx-pro-web`): Next.js app server-rendered and served from
  the edge. Proxies `/api/*` to the API Worker so auth cookies stay first-party.
- **API Worker** (`secureauthx-pro-api`): Hono REST API. Runs with `nodejs_compat` so the
  `pg` driver can open real TCP connections to Postgres over Workers' socket API.
- **Why Workers?** Global edge distribution, zero servers to operate, and the entire
  stack (web + API) deploys from one GitHub Actions pipeline.

See [docs/architecture.md](docs/architecture.md) for details, and
[docs/security-model.md](docs/security-model.md) for the threat model.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Web framework | Next.js 15, React 19, Tailwind CSS 4 |
| API framework | Hono 4 (Node + Cloudflare Workers), `@hono/node-server` |
| Database | PostgreSQL 17 (Docker locally, **Neon** in production) |
| ORM | Prisma 6 (`engineType=client` WASM + `@prisma/adapter-pg`) |
| Cache | Redis 7 (Docker locally, **Upstash Redis REST** in production) |
| AuthN/Z | JWT (access + refresh rotation), bcryptjs, `@simplewebauthn/*` |
| Validation | Zod (`@secureauthx/validation`) |
| Email | Console (dev) / SMTP / Resend providers |
| Edge runtime | Cloudflare Workers (`nodejs_compat`), OpenNext for Next.js |
| UI | `@secureauthx/ui` (shadcn-style), TanStack Query/Table, zustand, recharts |
| Tooling | pnpm ≥ 10, Node ≥ 22, TypeScript 5.9, Vitest, Playwright (e2e) |

---

## Repository Layout

```
apps/
  api/             Hono REST API (src/worker.ts → Cloudflare Worker entry)
  web/             Next.js 15 web app (src/app → routes, src/lib → API client)
  authenticator/   Expo mobile authenticator app (TOTP/passkey client)
packages/
  auth/            Auth flows: login, MFA challenges, session & device logic
  config/          Shared runtime configuration
  database/        Prisma schema, migrations, seed, Prisma client factory
  mail/            Email providers (console / smtp / resend)
  security/        Crypto: AES-256-GCM, hashing, token generation, fingerprinting
  shared/          Shared utilities and constants
  types/           Shared TypeScript types (DB + API contracts)
  ui/              React component library (design system)
  validation/      Zod schemas for API request/response contracts
tests/
  e2e/             Playwright end-to-end suite
docker/            Compose file (Postgres, Redis, MailHog, app, Penpot)
docs/              Architecture, security model, deployment, API reference
```

---

## Getting Started (Local Development)

### Prerequisites

- Node.js **≥ 22**
- pnpm **≥ 10** (repo pins `pnpm@11.11.0` — `corepack enable` will pick it up)
- Docker (for Postgres, Redis, MailHog)

### 1. Install and configure

```bash
pnpm install
cp .env.example .env        # then fill in secrets (JWT_*, ENCRYPTION_KEY, ...)
```

### 2. Start infrastructure

```bash
docker compose -f docker/docker-compose.yml --profile infra up -d
```

This brings up PostgreSQL 17, Redis 7, and MailHog (SMTP catcher at `localhost:1025`,
web UI at <http://localhost:8025>).

### 3. Migrate and seed the database

```bash
pnpm db:migrate:dev     # apply Prisma migrations
pnpm db:seed            # creates the admin user (see .env ADMIN_*)
```

### 4. Run the stack

```bash
pnpm dev                # API on :4000, Web on :3000, in parallel
```

| Service | URL |
| --- | --- |
| Web app | <http://localhost:3000> |
| API | <http://localhost:4000> |
| API health | <http://localhost:4000/api/v1/health> |
| MailHog | <http://localhost:8025> |

### Useful scripts

```bash
pnpm dev:api            # API only
pnpm dev:web            # Web only
pnpm db:studio          # Prisma Studio
pnpm test               # unit tests (Vitest)
pnpm test:e2e           # Playwright e2e (needs local infra + .env)
pnpm typecheck          # type-check all packages
```

---

## Deploying to Cloudflare

### Production data plane

- **Postgres:** [Neon](https://neon.tech) (serverless Postgres). Use the pooled
  connection string (`-pooler` host) so the Worker can open many short-lived
  connections. The project uses `sslmode=require&channel_binding=require`.
- **Redis:** [Upstash](https://upstash.com) REST — no WebSocket/TCP needed, works
  natively from Workers.

### Workers

```bash
# API Worker (Hono)
cd apps/api
pnpm dlx wrangler@4 deploy
# then set secrets (see below)

# Web Worker (Next.js via OpenNext)
cd apps/web
pnpm run build:cloudflare
pnpm dlx wrangler@4 deploy
```

### Required secrets

Set these on the API Worker (`wrangler secret put <NAME>`), never in `wrangler.jsonc`:

| Secret | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string |
| `JWT_ACCESS_SECRET` | Signing access tokens |
| `JWT_REFRESH_SECRET` | Signing refresh tokens |
| `ENCRYPTION_KEY` | AES-256-GCM key for encrypting secrets at rest |

### CI/CD

`.github/workflows/cloudflare-deploy.yml` deploys both Workers on every push to
`main`: it builds the web app with OpenNext, deploys the API Worker, injects the four
secrets, and verifies the health endpoint returns `200`.

> **Deploy notes** (learned the hard way, all reflected in the workflow):
> - `cloudflare/wrangler-action@v3` cannot deploy the API: it runs `npm i` inside
>   `apps/api`, which fails on `workspace:*` deps (`EUNSUPPORTEDPROTOCOL`).
> - Plain `npx wrangler` fails on the runner; use `pnpm dlx wrangler@4`.
> - Prisma must be generated with `engineType=client` (WASM) before bundling so
>   wrangler resolves the `workerd` export condition correctly.

See [docs/cloudflare-deployment.md](docs/cloudflare-deployment.md) and
[docs/deployment.md](docs/deployment.md) for the full runbook.

---

## Environment Variables

See [.env.example](.env.example) for the complete annotated reference. Key groups:

| Group | Variables |
| --- | --- |
| App | `APP_NAME`, `APP_DOMAIN`, `API_URL`, `WEB_URL`, `API_CORS_ORIGINS` |
| Database | `DATABASE_URL`, `POSTGRES_*` |
| Cache | `REDIS_URL`, `REDIS_PORT`, `REDIS_PASSWORD` |
| JWT | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `JWT_ISSUER`, `JWT_AUDIENCE` |
| Cookies | `COOKIE_DOMAIN`, `COOKIE_SECURE`, `COOKIE_SAME_SITE` |
| Security | `BCRYPT_ROUNDS`, `PASSWORD_MIN_LENGTH`, `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES`, `SESSION_TIMEOUT_MINUTES`, `MAX_DEVICES_PER_USER` |
| MFA | `ENCRYPTION_KEY`, `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN`, `MFA_CHALLENGE_TTL`, `RECOVERY_CODES_COUNT`, `TRUSTED_DEVICE_TTL_DAYS` |
| Email | `MAIL_PROVIDER` (`console`/`smtp`/`resend`), `SMTP_*`, `RESEND_API_KEY` |
| Rate limit | `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` |
| Seed | `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` |

Generate production secrets with `openssl rand -base64 64`.

---

## Documentation

| Doc | What it covers |
| --- | --- |
| [Getting Started](docs/getting-started.md) | Step-by-step local setup |
| [Architecture](docs/architecture.md) | System design, components, data flow |
| [Security Model](docs/security-model.md) | Threat model, crypto, hardening |
| [Deployment](docs/deployment.md) | Self-hosted Docker deployment |
| [Cloudflare Deployment](docs/cloudflare-deployment.md) | Workers + Neon production runbook |
| [API Reference](docs/api-reference.md) | Endpoints and contracts |
| [Testing](docs/testing.md) | Unit + e2e strategy |

---

## License

MIT (see `package.json`)
