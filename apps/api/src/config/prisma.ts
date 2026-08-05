import { createPrismaPgClient, PrismaClient } from '@secureauthx/database';
import { env } from './env';

/**
 * Serverless-safe Prisma client bound to the pure-JS PostgreSQL driver
 * adapter. No native query engine is shipped, so this runs identically on
 * the local Node server and on Vercel functions.
 */
export const prisma: PrismaClient = createPrismaPgClient(env, env.DATABASE_URL);
