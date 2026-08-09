import {
  createPrismaNeonClient,
  createPrismaPgClient,
  guardPrisma,
  PrismaClient,
} from '@secureauthx/database';
import { env } from './env';

/**
 * Detects the Cloudflare Workers runtime (workerd sets
 * `navigator.userAgent` to `"Cloudflare-Workers"`). Node 22 also exposes a
 * global `navigator`, so the check must be exact, not just "exists".
 */
function isCloudflareWorker(): boolean {
  const navigator = (globalThis as { navigator?: { userAgent?: string } }).navigator;
  return navigator?.userAgent === 'Cloudflare-Workers';
}

/**
 * Serverless-safe Prisma client bound to a pure-JS driver adapter. No native
 * query engine is shipped, so this runs identically on the local Node server
 * and on Vercel functions.
 *
 * Runtime split:
 * - Cloudflare Worker → Neon serverless driver (`PrismaNeon`), which tunnels
 *   Postgres over WebSocket to Neon's proxy. `pg` over raw TCP to Neon's
 *   pooler stalls from the edge (20s+ handshakes); the WebSocket path does
 *   not touch pgbouncer's TCP connection queue.
 * - Node.js → node-postgres (`PrismaPg`) as before.
 *
 * Every call is raced against a ref'd watchdog (see with-timeout.ts): a
 * stalled connect/query (Neon compute wake, pooler queueing) must not leave
 * the Workers event loop empty, or the runtime cancels the request as
 * "script will never generate a response" (1101). A stall now surfaces as a
 * catchable timeout error instead.
 */
export const prisma: PrismaClient = guardPrisma(
  isCloudflareWorker()
    ? createPrismaNeonClient(env, env.DATABASE_URL)
    : createPrismaPgClient(env, env.DATABASE_URL),
  20_000
);
