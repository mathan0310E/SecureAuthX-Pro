import path from 'node:path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

/**
 * Seeds (or refreshes) deterministic fixture users for the e2e suite.
 * Runs once before the suite and tears them down in global-teardown.
 */
export const E2E_USER = {
  email: 'e2e.user@secureauthx.local',
  password: 'E2ePassword!2026',
};

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@secureauthx.local';

const prisma = new PrismaClient();

/**
 * Resets the seeded admin fixture to a deterministic state: MFA disabled and
 * any enrolled secrets/devices purged so logins never hit a challenge screen.
 * The dev database drifts (e.g. an MFA smoke run) between suite executions,
 * so we normalise it here rather than asserting on current state.
 */
async function resetAdminFixture(): Promise<void> {
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) return;

  await prisma.totpSecret.deleteMany({ where: { userId: admin.id } });
  await prisma.recoveryCode.deleteMany({ where: { userId: admin.id } });
  await prisma.webAuthnCredential.deleteMany({ where: { userId: admin.id } });
  await prisma.trustedDevice.deleteMany({ where: { userId: admin.id } });

  await prisma.user.update({
    where: { id: admin.id },
    data: {
      mfaEnabled: false,
      totpEnabled: false,
      webauthnEnabled: false,
      status: 'ACTIVE',
      emailVerified: true,
    },
  });
}

export default async function globalSetup(): Promise<void> {
  const bcrypt = (await import('bcrypt')).default;

  await prisma.user.deleteMany({ where: { email: E2E_USER.email } });
  await resetAdminFixture();

  const passwordHash = await bcrypt.hash(E2E_USER.password, 10);

  await prisma.user.create({
    data: {
      email: E2E_USER.email,
      passwordHash,
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          firstName: 'E2E',
          lastName: 'User',
          displayName: 'E2E User',
        },
      },
    },
  });

  await prisma.$disconnect();
}
