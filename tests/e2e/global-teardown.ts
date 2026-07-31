import path from 'node:path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { E2E_USER } from './global-setup';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

export default async function globalTeardown(): Promise<void> {
  const prisma = new PrismaClient();
  await prisma.user.deleteMany({ where: { email: E2E_USER.email } });
  await prisma.$disconnect();
}
