import { Router } from 'express';
import type { AppContainer } from '../../config/container';
import { healthRouter } from './health.routes';
import { createAuthRouter } from './auth.routes';
import { createMfaRouter } from './mfa.routes';
import { createSecurityRouter } from './security.routes';
import { createAdminRouter } from './admin.routes';

/**
 * Version 1 API router. Feature routers (auth, users, mfa, admin, ...)
 * mount here as later phases are implemented.
 */
export function createV1Router(container: AppContainer): Router {
  const router = Router();

  router.use('/health', healthRouter);
  router.use('/auth', createAuthRouter(container));
  router.use('/mfa', createMfaRouter(container));
  router.use('/security', createSecurityRouter(container));
  router.use('/admin', createAdminRouter(container));

  return router;
}
