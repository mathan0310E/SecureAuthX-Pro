import './config/dotenv';

import { serve, type ServerType } from '@hono/node-server';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { cache } from './config/cache';
import { buildContainer } from './config/container';
import { logger } from './config/logger';
import { createApp } from './app';

let server: ServerType | undefined;

async function bootstrap(): Promise<void> {
  const container = buildContainer(prisma, cache);
  const app = createApp(container);

  // Verify database connectivity before accepting traffic.
  await prisma.$queryRaw`SELECT 1`;
  logger.info('Database connection verified.');

  server = serve(
    { fetch: app.fetch, port: env.API_PORT, hostname: env.API_BIND_ADDRESS },
    () => {
      logger.info(
        `${env.APP_NAME} listening on http://${env.API_BIND_ADDRESS}:${env.API_PORT} (${env.NODE_ENV})`
      );
    }
  );
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
    await cache.close();
    await prisma.$disconnect();
    server?.close();
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
