import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const email = process.argv[2];
const p = new PrismaClient();
const u = await p.user.update({
  where: { email },
  data: { emailVerified: true, status: 'ACTIVE' },
});
console.log('verified', u.email, u.status);
await p.$disconnect();
