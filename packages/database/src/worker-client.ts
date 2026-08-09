import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type { Env } from '@secureauthx/config';
import { createPgPool, createPrismaClient } from './client';

/**
 * Creates a PrismaClient wired to `pg` via Prisma's PostgreSQL driver
 * adapter, for use inside a Cloudflare Worker. `pg` connects to Postgres
 * using Cloudflare's `connect()` TCP API — no native query engine binary is
 * shipped. Requires `nodejs_compat` on the Worker.
 */
export function createPrismaWorkerClient(
  datasourceUrl: string,
  env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>
): PrismaClient {
  const adapter = new PrismaPg(createPgPool(datasourceUrl));
  return createPrismaClient(env, adapter);
}
