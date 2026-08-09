import { PrismaClient, type Prisma } from '@prisma/client';
import type { PrismaPg } from '@prisma/adapter-pg';
import { Pool, type PoolConfig } from 'pg';
import type { Env } from '@secureauthx/config';

/**
 * Builds a pg connection pool tuned for serverless/edge runtimes:
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
 */
export function createPgPool(connectionString: string): Pool {
  const config: PoolConfig = {
    connectionString,
    max: 1,
    connectionTimeoutMillis: 30_000,
    idleTimeoutMillis: 30_000,
  };
  return new Pool(config);
}

/**
 * Builds a PrismaClient configured for the environment.
 * Logging is kept out of the request hot path in production.
 *
 * On Cloudflare Workers an adapter (built from `pg-cloudflare`) is required
 * because the default Rust query engine does not run there. On Node.js the
 * adapter is omitted and the standard engine is used.
 */
export function createPrismaClient(
  env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>,
  adapter?: PrismaPg
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
