import { getPrismaClient, PrismaClient } from '@secureauthx/database';
import { env } from './env';

export const prisma: PrismaClient = getPrismaClient(env);
