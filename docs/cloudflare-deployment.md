# Cloudflare Deployment Guide

Deploy the **Next.js web app** to Cloudflare Workers (edge, global CDN) using
[OpenNext](https://opennext.js.org/cloudflare) (`@opennextjs/cloudflare`).
The Express API stays on a Node host; Cloudflare cannot run native Node
dependencies (see [API on Cloudflare](#api-on-cloudflare-future) below).

```
Browser ──> [Cloudflare Workers: Next.js (OpenNext)] ──/api──> [Express API (Node host)]
                                                                   │
                                                      ┌────────────┼────────────┐
                                                   PostgreSQL   Redis        SMTP
```

## 1. What is already set up

- `apps/web/wrangler.jsonc` — Worker config (name, `nodejs_compat`,
  `global_fetch_strictly_public`, assets, self-reference binding).
- `apps/web/open-next.config.ts` — OpenNext Cloudflare build config.
- `apps/web/package.json` — Cloudflare scripts and dev dependencies
  (`@opennextjs/cloudflare`, `wrangler`, `@cloudflare/workers-types`).
- `.github/workflows/cloudflare-deploy.yml` — CI deploy on push to `main`.
- `.env.cloudflare.example` — build-time environment reference.

## 2. Prerequisites

- Node.js 22+, pnpm 10+
- A Cloudflare account
- `pnpm --filter @secureauthx/web login` (or a
  [Cloudflare API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/))
  to authenticate `wrangler`

> **Windows note:** `@opennextjs/cloudflare` is not fully compatible with
> Windows — the post-build bundling step can fail when esbuild walks pnpm's
> `.pnpm` junctioned store. Use **WSL 2** for local Cloudflare builds, or rely
> on the CI workflow (Linux), which builds and deploys successfully.

## 3. Scripts

| Script | Purpose |
| --- | --- |
| `pnpm --filter @secureauthx/web build:cloudflare` | Build via `opennextjs-cloudflare build` (runs `next build` + emits `.open-next/`) |
| `pnpm --filter @secureauthx/web preview:cloudflare` | Local preview (`wrangler dev`) |
| `pnpm --filter @secureauthx/web deploy:cloudflare` | Build + deploy |
| `pnpm --filter @secureauthx/web upload:cloudflare` | Build + upload (gradual rollout) |
| `pnpm --filter @secureauthx/web cf-typegen` | Generate `cloudflare-env.d.ts` from bindings |

> Note: `next/font/google` downloads fonts at build time — the build requires
> network access (available on GitHub Actions).

## 4. Environment

Build-time variables (inlined by Next.js at build; set in CI secrets or the
dashboard):

| Variable | Notes |
| --- | --- |
| `API_URL` | Express API origin; used to build the `/api` rewrite |
| `WEB_URL` | Canonical origin of the deployed app (metadata, cookies) |
| `NEXT_PUBLIC_API_URL` | Browser-facing API base for client code |

Runtime secrets for the Worker (if any) go in the dashboard
(**Settings → Variables and Secrets**) or `apps/web/.dev.vars` locally —
never in `wrangler.jsonc`. API-side secrets (`JWT_*`, `DATABASE_URL`,
`REDIS_URL`, `ENCRYPTION_KEY`, `SMTP_*`) belong to the API host, not the Worker.

## 5. Deploy

### Manual

```bash
pnpm install

# Build-time vars must be set for the /api rewrite and metadata
$env:API_URL = "https://api.your-domain.com"
$env:WEB_URL  = "https://secureauthx-pro.your-subdomain.workers.dev"

pnpm --filter @secureauthx/web deploy:cloudflare
```

### CI (GitHub Actions)

Add these repository secrets:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | API token with Workers Script / edit permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID (Workers dashboard → right sidebar) |
| `API_URL` | e.g. `https://api.your-domain.com` |
| `WEB_URL` | e.g. `https://secureauthx-pro.your-subdomain.workers.dev` |
| `NEXT_PUBLIC_API_URL` | Same as `WEB_URL` |

Push to `main` (or run `workflow_dispatch`) → the
`cloudflare-deploy.yml` workflow builds with OpenNext and runs `wrangler deploy`.

## 6. Custom domain

1. Workers dashboard → your Worker (`secureauthx-pro-web`) → **Settings → Domains & Routes** → **Add → Custom domain**.
2. Follow the DNS verification steps. Cloudflare proxies the zone automatically.
3. Update `WEB_URL` / `NEXT_PUBLIC_API_URL` / `API_URL` and rebuild so cookies
   and WebAuthn origins match the final origin.

## 7. Verification

```bash
curl -fsS https://secureauthx-pro.your-subdomain.workers.dev/        # landing page
curl -fsS https://secureauthx-pro.your-subdomain.workers.dev/login   # auth UI
```

Login against a running API, then confirm the Security Activity and Admin
pages render. Check `observability` (Workers Analytics/Logs) for 5xx.

## API on Cloudflare (future)

A Hono-based Worker entry is already in progress in `apps/api/src/worker.ts`
(dependency-free entry + lazy app composition), but the API is **not yet
runnable on Workers** — the remaining blockers:

| Component | Why it's blocked | Options |
| --- | --- | --- |
| `bcrypt` | native binding, unavailable on Workers | `@node-rs/bcrypt` (WASM), or `jose`/argon2 WASM |
| `ioredis` | TCP sockets blocked on Workers | Upstash Redis REST (`@upstash/redis`) |
| Prisma (Postgres) | native query engine / TCP | `@prisma/adapter-pg` + Neon/Supabase over HTTPS, or D1 (SQLite — schema change) |
| `winston` file transport | no filesystem | Cloudflare Logpush / `console` |

Until then, run the API as a Node process behind a reverse proxy and point the
Worker's `API_URL` rewrite at it. See `docs/deployment.md` for the API host
guide.
