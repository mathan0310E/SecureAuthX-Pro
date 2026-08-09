import { createPrismaPgClient, guardPrisma, PrismaClient } from '@secureauthx/database';
import { env } from './env';

/**
 * Serverless-safe Prisma client bound to the pure-JS PostgreSQL driver
 * adapter. No native query engine is shipped, so this runs identically on
 * the local Node server and on Vercel functions.
 *
 * Every call is raced against a ref'd watchdog (see with-timeout.ts): a
 * stalled connect/query (Neon compute wake, pooler queueing) must not leave
 * the Workers event loop empty, or the runtime cancels the request as
 * "script will never generate a response" (1101). A stall now surfaces as a
 * catchable timeout error instead.
 */
export const prisma: PrismaClient = guardPrisma(
  createPrismaPgClient(env, env.DATABASE_URL),
  20_000
);
