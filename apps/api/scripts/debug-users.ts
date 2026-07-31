import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const users = await prisma.user.findMany({
  where: { email: { contains: 'sec-admin-smoke' } },
  select: {
    email: true,
    status: true,
    lockedUntil: true,
    failedLoginAttempts: true,
    emailVerified: true,
    mfaEnabled: true,
  },
});
console.log(JSON.stringify(users, null, 2));
await prisma.$disconnect();
