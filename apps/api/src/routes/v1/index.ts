import { Router } from 'express';
import type { AppContainer } from '../../config/container';
import { healthRouter } from './health.routes';
import { createAuthRouter } from './auth.routes';

/**
 * Version 1 API router. Feature routers (auth, users, mfa, admin, ...)
 * mount here as later phases are implemented.
 */
export function createV1Router(container: AppContainer): Router {
  const router = Router();

  router.use('/health', healthRouter);
  router.use('/auth', createAuthRouter(container));

  return router;
}
