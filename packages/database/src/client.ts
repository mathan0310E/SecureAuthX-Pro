import { PrismaClient, type Prisma } from '@prisma/client';
import type { PrismaPg } from '@prisma/adapter-pg';
import { Pool, type PoolConfig } from 'pg';
import type { Env } from '@secureauthx/config';

/**
 * Builds a pg connection pool tuned for serverless/edge runtimes:
 * - `max: 2` — bounds per-isolate connections so we never pressure Neon's
 *   pooler (default pg max is 10 per isolate; many isolates × 10 exceeds
 *   Neon's connection budget and makes connections queue/stall).
 * - `connectionTimeoutMillis: 8000` — a stalled TCP/TLS+SCRAM handshake now
 *   fails fast with a catchable error instead of waiting forever. pg's
 *   default is 0 (never time out), and a never-settling connect promise is
 *   exactly what the Workers runtime kills as "The script will never
 *   generate a response" (1101).
 * - `idleTimeoutMillis: 90000` — kept above the API Worker's keepalive cron
 *   interval (60s) so the warm connection survives between pings and user
 *   requests skip the multi-second Neon handshake.
 */
export function createPgPool(connectionString: string): Pool {
  const config: PoolConfig = {
    connectionString,
    max: 2,
    connectionTimeoutMillis: 8_000,
    idleTimeoutMillis: 90_000,
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
