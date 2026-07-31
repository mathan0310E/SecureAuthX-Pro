import type { Request, Response } from 'express';
import { asyncHandler } from '@secureauthx/shared';
import { pingRedis } from '../config/redis';
import { prisma } from '../config/prisma';
import { env } from '../config/env';

/**
 * Liveness + readiness probe for orchestrators and load balancers.
 * Returns 200 only when the DB and Redis are reachable.
 */
export const healthController = {
  check: asyncHandler(async (req: Request, res: Response) => {
    const startedAt = Date.now();
    let database = 'down';
    let cache = 'down';

    try {
      await prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    cache = (await pingRedis()) ? 'up' : 'down';

    const healthy = database === 'up' && cache === 'up';

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'success' : 'error',
      code: healthy ? 'HEALTHY' : 'UNHEALTHY',
      message: healthy ? 'Service is healthy.' : 'Service is unhealthy.',
      data: {
        name: env.APP_NAME,
        version: '1.0.0',
        environment: env.NODE_ENV,
        uptimeSeconds: Math.round(process.uptime()),
        checks: { database, cache },
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
    });
  }),
};
