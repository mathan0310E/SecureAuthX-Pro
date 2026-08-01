import { prisma } from '../config/prisma';
import { pingCache } from '../config/cache';
import { env } from '../config/env';
import type { AppContext } from '../types/context';

const bootedAt = Date.now();

/**
 * Liveness + readiness probe for orchestrators and load balancers.
 * Returns 200 only when the DB and cache are reachable.
 */
export const healthController = {
  check: async (c: AppContext) => {
    const startedAt = Date.now();
    let database = 'down';
    let cache = 'down';

    try {
      await prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    cache = (await pingCache()) ? 'up' : 'down';

    const healthy = database === 'up' && cache === 'up';

    return c.json(
      {
        status: healthy ? 'success' : 'error',
        code: healthy ? 'HEALTHY' : 'UNHEALTHY',
        message: healthy ? 'Service is healthy.' : 'Service is unhealthy.',
        data: {
          name: env.APP_NAME,
          version: '1.0.0',
          environment: env.NODE_ENV,
          uptimeSeconds: Math.round((Date.now() - bootedAt) / 1000),
          checks: { database, cache },
          latencyMs: Date.now() - startedAt,
          timestamp: new Date().toISOString(),
        },
      },
      healthy ? 200 : 503
    );
  },
};
