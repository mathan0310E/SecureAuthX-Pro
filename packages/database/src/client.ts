import { PrismaClient, type Prisma } from '@prisma/client';
import type { Env } from '@secureauthx/config';

/**
 * Builds a PrismaClient configured for the environment.
 * Logging is kept out of the request hot path in production.
 */
export function createPrismaClient(env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>): PrismaClient {
  const client = new PrismaClient({
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
