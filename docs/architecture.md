# SecureAuthX Pro — Architecture

## High-level design

```
                         ┌──────────────────────────────┐
                         │        Nginx (reverse proxy) │
                         └──────────────┬───────────────┘
                    ┌───────────────────┴──────────────────┐
              ┌─────▼─────┐                           ┌────▼─────┐
              │  Web app  │◄───── HTTPS ─────────────►│  API     │
              │  Next.js  │    /api/v1/*               │  Express │
              └─────┬─────┘                           └────┬─────┘
                    │                                       │
                    │                                       ├──► PostgreSQL 17
                    │                                       ├──► Redis 7
                    │                                       └──► SMTP (optional)
                    └──────────────────────────────────────────┘
                          (browser ↔ API via httpOnly cookies + CSRF token)
```

- **Web** (`apps/web`): Next.js 15 App Router, React 19, Tailwind v4, shadcn/ui.
- **API** (`apps/api`): Express + TypeScript, clean architecture, `/api/v1` versioning.
- **Shared packages** (`packages/*`): typed contracts shared across both apps.

## Monorepo layout

```
SecureAuthX-Pro/
├── apps/
│   ├── web/            Next.js 15 frontend
│   └── api/            Express API (controllers → services → repositories)
├── packages/
│   ├── config/         validated environment + constants
│   ├── types/          shared TypeScript contracts
│   ├── shared/         utils (async handler, pagination, crypto, device)
│   ├── security/       password policy, JWT, rate limiting, sanitization
│   ├── auth/           auth domain services (password hashing, flows)
│   ├── database/       Prisma schema, client, seed
│   ├── validation/     Zod schemas
│   └── ui/             shared design tokens + primitives
├── docker/             compose stack, Dockerfiles
├── nginx/              reverse proxy config
├── tests/e2e/          Playwright end-to-end suite
└── docs/               documentation
```

## Data model (PostgreSQL 17)

All primary keys are UUIDs; every relationship is a foreign key with explicit
`onDelete` behavior. See `packages/database/prisma/schema.prisma` for the
canonical schema. Tables:

| Table                   | Purpose                                   |
| ----------------------- | ----------------------------------------- |
| `users`                 | Identity root: credentials, role, status  |
| `profiles`              | 1:1 profile data                          |
| `sessions`              | Refresh-token sessions (rotated, hashed)  |
| `trusted_devices`       | Fingerprinted trusted devices             |
| `totp_secrets`          | TOTP secret material (encrypted at rest)  |
| `recovery_codes`        | One-time use backup codes (hashed)        |
| `webauthn_credentials`  | Passkey credential public keys            |
| `email_verifications`   | Email verification tokens (hashed)        |
| `password_reset_tokens` | Password reset tokens (hashed)            |
| `audit_logs`            | Immutable audit trail                     |
| `security_events`       | Security telemetry (anomalies, lockouts)  |
| `notifications`         | In-app notifications                      |

## Security model

- **Passwords** — bcrypt (cost 12), policy enforced server-side.
- **Tokens** — short-lived HS256 JWT access tokens; refresh tokens are rotated
  on every use and stored as SHA-256 hashes in `sessions` to detect reuse.
- **Cookies** — `HttpOnly`, `SameSite`, `Secure` in production; CSRF token
  issued alongside.
- **Transport** — Helmet headers, CORS allow-list, per-IP rate limiting,
  account lockout after N failed attempts.
- **Secrets** — never stored plaintext; verified via SHA-256 hashes at rest.
