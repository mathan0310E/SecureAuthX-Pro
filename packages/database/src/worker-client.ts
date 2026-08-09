import type { Env } from '@secureauthx/config';
import { PrismaClient } from '@prisma/client';
import { createPrismaNeonClient } from './neon-client';

/**
 * Creates a PrismaClient for use inside a Cloudflare Worker, wired to the
 * Neon serverless driver adapter (`@prisma/adapter-neon`). The driver routes
 * the PostgreSQL protocol over WebSockets to Neon's proxy — no raw TCP
 * connections to Neon's pooler, which is what `pg` used and what stalled
 * from the edge. Requires `nodejs_compat` on the Worker.
 */
export function createPrismaWorkerClient(
  datasourceUrl: string,
  env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>
): PrismaClient {
  return createPrismaNeonClient(env, datasourceUrl);
}
