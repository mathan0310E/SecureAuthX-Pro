import { Hono } from 'hono';
import type { AppContainer } from '../config/container';
import { createV1Router } from './v1';
import { apiRateLimiter } from '../middlewares/security';
import type { AppEnv } from '../types/context';

/**
 * Top-level API router. Versioning lives in the path (/api/v1).
 * Built as a factory so routers can receive the service container.
 */
export function createApiRouter(container: AppContainer): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.use('*', apiRateLimiter);
  router.route('/v1', createV1Router(container));

  return router;
}
