import { env } from './config/env';
import { prisma } from './config/prisma';
import { redis, closeRedis } from './config/redis';
import { buildContainer } from './config/container';
import { logger } from './config/logger';
import { createApp, listen } from './app';

async function bootstrap(): Promise<void> {
  const container = buildContainer(prisma, redis);
  const app = createApp(container);

  // Verify database connectivity before accepting traffic.
  await prisma.$queryRaw`SELECT 1`;
  logger.info('Database connection verified.');

  listen(app);
}

bootstrap().catch((error) => {
  logger.error('Failed to start API server', {
    error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
  });
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}; shutting down gracefully...`);

  try {
    await closeRedis();
    await prisma.$disconnect();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
});
