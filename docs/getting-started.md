# Getting Started

Prerequisites: Node.js 22+, pnpm 10+, Docker.

## 1. Install & generate

```bash
pnpm install
pnpm db:generate
```

## 2. Start infrastructure

```bash
docker compose -f docker/docker-compose.yml --profile infra up -d
```

## 3. Migrate & seed

```bash
pnpm db:migrate
pnpm db:seed
```

## 4. Run the apps

```bash
pnpm dev          # API on :4000, Web on :3000
```

## 5. Verify

```bash
curl http://localhost:4000/api/v1/health
```

For one-command setup: `scripts/setup-dev.cmd` (Windows) or
`scripts/setup-dev.sh` (Linux/macOS).
