import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { parseEnv } from '@secureauthx/config';
import bcrypt from 'bcrypt';

/**
 * Seeds the platform bootstrap administrator.
 * Idempotent — safe to run on an existing database.
 */
async function main(): Promise<void> {
  const { env } = parseEnv(process.env);
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  try {
    const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, env.BCRYPT_ROUNDS);

    const existing = await db.user.findUnique({ where: { email: env.ADMIN_EMAIL } });
    if (existing) {
      console.log(`[seed] Admin already exists (${env.ADMIN_EMAIL}); skipping.`);
      return;
    }

    const admin = await db.user.create({
      data: {
        email: env.ADMIN_EMAIL,
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            firstName: 'System',
            lastName: 'Administrator',
            displayName: env.ADMIN_NAME,
          },
        },
      },
      select: { id: true, email: true, role: true },
    });

    console.log(`[seed] Created administrator: ${admin.email} (${admin.id})`);
  } catch (error) {
    console.error('[seed] Failed:', error);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

void main();
