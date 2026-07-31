import { Router } from 'express';
import type { AppContainer } from '../config/container';
import { createV1Router } from './v1';
import { apiRateLimiter } from '../middlewares/security';

/**
 * Top-level API router. Versioning lives in the path (/api/v1).
 * Built as a factory so routers can receive the service container.
 */
export function createApiRouter(container: AppContainer): Router {
  const router = Router();

  router.use(apiRateLimiter);
  router.use('/v1', createV1Router(container));

  return router;
}
