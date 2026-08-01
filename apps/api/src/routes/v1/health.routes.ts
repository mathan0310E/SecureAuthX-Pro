import { Hono } from 'hono';
import type { AppEnv } from '../../types/context';
import { healthController } from '../../controllers/health.controller';

/**
 * GET /health — liveness & readiness probe.
 */
export function createHealthRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/', healthController.check);

  return router;
}
