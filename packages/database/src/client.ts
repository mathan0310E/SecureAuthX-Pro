import { PrismaClient, type Prisma } from '@prisma/client';
import type { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '@secureauthx/config';

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
