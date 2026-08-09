import { PrismaNeon } from '@prisma/adapter-neon';
import type { PoolConfig } from '@neondatabase/serverless';
import { PrismaClient } from '@prisma/client';
import type { Env } from '@secureauthx/config';
import { createPrismaClient } from './client';

/**
 * Builds a PrismaClient wired to the Neon serverless driver adapter
 * (`@prisma/adapter-neon` + `@neondatabase/serverless`).
 *
 * Unlike `pg` (node-postgres), which opens raw TCP connections to Neon's
 * pooler from the edge (a path that has proven unreliable from Cloudflare
 * Workers — handshakes stalling 20s+), the Neon serverless driver tunnels the
 * PostgreSQL protocol over a WebSocket to Neon's proxy (`wss://<host>/v2`),
 * reusing one WebSocket per isolate with pipelined startup. There is no
 * pgbouncer TCP connection to queue on and no per-isolate TCP+TLS+SCRAM
 * handshake to stall.
 *
 * The adapter is a factory (`PrismaNeon` implements SqlDriverAdapterFactory):
 * the generated PrismaClient calls `connect()` lazily per engine. The plain
 * `PoolConfig` is handed straight to the adapter — it owns its connection
 * lifecycle (WebSocket-based), so no external `pg` pool is needed.
 *
 * The existing pooled (or direct) Neon `DATABASE_URL` works unchanged.
 */
export function createPrismaNeonClient(
  env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>,
  connectionString: string
): PrismaClient {
  const config: PoolConfig = {
    connectionString,
    max: 1,
  };
  return createPrismaClient(env, new PrismaNeon(config));
}
