# Testing

The platform is verified at three levels: unit, integration, and end-to-end.

## Unit & integration (API — Vitest)

```bash
pnpm --filter @secureauthx/api test            # all
pnpm --filter @secureauthx/api exec vitest run tests/unit        # unit only
pnpm --filter @secureauthx/api exec vitest run tests/integration # integration only
```

- **Unit** (`apps/api/tests/unit`) — pure logic with no I/O: TOTP primitives, AES-GCM encryption, password hashing & policy, JWT sign/verify/rotation, validation schemas, pagination helpers, error envelopes.
- **Integration** (`apps/api/tests/integration`) — boots the real Express app with the live Postgres + Redis via `createApp(buildContainer(prisma, redis))` and exercises routes with supertest: register → verify → login → `/me` → logout, wrong credentials, non-admin `403`, admin analytics.

`apps/api/vitest.config.ts` raises the rate-limit ceilings in test mode so a run does not trip them. Integration tests clean up the users they create.

## End-to-end (Playwright)

```bash
pnpm --filter @secureauthx/e2e install:browsers   # once
pnpm --filter @secureauthx/e2e test               # all 3 browsers
pnpm --filter @secureauthx/e2e test --project=chromium
```

Prereq: web on `:3000` and API on `:4000` (or set `WEB_URL`).

`tests/e2e/global-setup.ts` seeds a deterministic, verified `e2e.user@secureauthx.local` fixture and resets the admin fixture (MFA off, sessions/keys purged) so the suite is reproducible regardless of dev-database drift. The suite covers:

- Auth: sign-in page renders, bad credentials rejected, sign-in lands on dashboard, sign-out returns to login.
- Security: the activity dashboard renders audit-log entries and the events tab.
- Admin: non-admins are redirected away from `/admin`; admins see analytics + the users table and can filter by search.

Runs across chromium, firefox, and webkit (serialized to keep logins deterministic).

## Smoke scripts (live API)

```bash
$env:DATABASE_URL='postgresql://secureauthx:secureauthx_dev_password@localhost:5432/secureauthx?schema=public'
pnpm --filter @secureauthx/api exec tsx scripts/mfa-smoke.ts
pnpm --filter @secureauthx/api exec tsx scripts/security-admin-smoke.ts
```

Each prints `ALL PASS`. They cover the full MFA lifecycle and admin RBAC against a running API instance, cleaning up the users they create.

## Full gate

```bash
pnpm -r typecheck   # all 12 workspace packages
pnpm --filter @secureauthx/web lint
pnpm --filter @secureauthx/api test
pnpm --filter @secureauthx/e2e test
```
