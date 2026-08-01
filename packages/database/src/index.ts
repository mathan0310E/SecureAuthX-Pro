import { Prisma, PrismaClient } from '@prisma/client';
import type { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '@secureauthx/config';
import { createPrismaClient } from './client';

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
