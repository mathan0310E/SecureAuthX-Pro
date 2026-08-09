import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '@secureauthx/config';
import { createPgPool, createPrismaClient } from './client';
export { guardPrisma, withDbTimeout } from './with-timeout';

export { Prisma, PrismaClient };
export * from './client';
export * from './worker-client';
export * from './repositories';

// Re-export generated types (models, enums, payload types) for ergonomic imports.
export type {
  User,
  Profile,
  Session,
  TrustedDevice,
  AuditLog,
  SecurityEvent,
  EmailVerification,
  PasswordResetToken,
  TotpSecret,
  RecoveryCode,
  WebAuthnCredential,
  Notification,
  UserRole,
  UserStatus,
  SessionStatus,
  Severity,
} from '@prisma/client';

export type PrismaEnv = Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>;

/**
 * Lazily-initialized singleton PrismaClient.
 * Pass the validated environment once at process startup. On Cloudflare
 * Workers pass a driver adapter (see `createPrismaWorkerClient`).
 */
export function getPrismaClient(env: PrismaEnv, adapter?: PrismaPg): PrismaClient {
  if (!globalThis.prisma) {
    globalThis.prisma = createPrismaClient(env, adapter);
  }
  return globalThis.prisma;
}

/**
 * Creates (or reuses) the singleton PrismaClient wired to the pure-JS
 * PostgreSQL driver adapter. No native query-engine binary is required,
 * which makes this the safe path for Vercel serverless functions and any
 * sandboxed runtime that cannot ship the Prisma engine.
 */
export function createPrismaPgClient(env: PrismaEnv, connectionString: string): PrismaClient {
  return getPrismaClient(env, new PrismaPg(createPgPool(connectionString)));
}
