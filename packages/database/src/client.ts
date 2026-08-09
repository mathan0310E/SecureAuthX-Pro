import { PrismaClient, type Prisma } from '@prisma/client';
import type { PrismaPg } from '@prisma/adapter-pg';
import type { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, type PoolConfig } from 'pg';
import type { Env } from '@secureauthx/config';

/**
 * Pool configuration tuned for serverless/edge runtimes:
 * - `max: 1` — one connection per isolate. Neon's pooler has a small
 *   per-role budget; many isolates × multiple connections saturates it and
 *   new connects QUEUE (stall) instead of failing. One connection per
 *   isolate keeps concurrent pooler usage near zero.
 * - `idleTimeoutMillis: 30000` — release the connection quickly after use.
 *   Long-lived idle connections from resident isolates (kept alive by the
 *   keepalive cron) were stacking up and exhausting the pooler.
 * - `connectionTimeoutMillis: 30000` — long enough for Neon to wake a
 *   suspended compute (free-tier autosuspend wake can take 5–30s). The API
 *   Worker's ref'd watchdog (with-timeout.ts) bounds the *user-visible* wait
 *   at 20s, so this only needs to let a wake complete rather than fail fast.
 *
 * Exported separately so Prisma adapter factories can be handed the plain
 * config (`PrismaPg` accepts `Pool | PoolConfig`) without tripping over the
 * class-identity of `pg.Pool` between duplicate copies of `@types/pg`. The
 * return type is a narrow structural shape (concrete numbers) that is
 * assignable to every `PoolConfig` copy in the dependency tree.
 */
export function createPgPoolConfig(connectionString: string): {
  connectionString: string;
  max: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
} {
  return {
    connectionString,
    max: 1,
    connectionTimeoutMillis: 30_000,
    idleTimeoutMillis: 30_000,
  };
}

export function createPgPool(connectionString: string): Pool {
  return new Pool(createPgPoolConfig(connectionString));
}

/**
 * Builds a PrismaClient configured for the environment.
 * Logging is kept out of the request hot path in production.
 *
 * On Cloudflare Workers an adapter is required because the default Rust query
 * engine does not run there. Two adapter options exist:
 * - `PrismaPg` (node-postgres over Cloudflare's `connect()` TCP API) — used on
 *   Node.js and for the legacy Worker path.
 * - `PrismaNeon` (Neon serverless driver over WebSocket) — the recommended
 *   Worker path; avoids TCP/TLS handshakes to Neon's pooler.
 * On Node.js the adapter can be omitted and the standard engine is used.
 */
export function createPrismaClient(
  env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>,
  adapter?: PrismaPg | PrismaNeon
): PrismaClient {
  const client = new PrismaClient({
    adapter: adapter ?? null,
    log:
      env.NODE_ENV === 'development'
        ? [
            { level: 'warn', emit: 'stdout' },
            { level: 'error', emit: 'stdout' },
            ...(env.LOG_LEVEL === 'debug'
              ? [{ level: 'query' as const, emit: 'stdout' as const }]
              : []),
          ]
        : [
            { level: 'warn', emit: 'stdout' },
            { level: 'error', emit: 'stdout' },
          ],
  });

  return client;
}

/**
 * The global PrismaClient instance.
 * Cached across hot reloads in development to avoid exhausting connections.
 */
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export type PrismaTransaction = Prisma.TransactionClient;

export { PrismaClient };
export type { Prisma };
