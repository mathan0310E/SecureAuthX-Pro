import { Hono } from 'hono';
import type { AppContainer } from '../../config/container';
import type { AppEnv } from '../../types/context';
import { createHealthRouter } from './health.routes';
import { createAuthRouter } from './auth.routes';
import { createMfaRouter } from './mfa.routes';
import { createSecurityRouter } from './security.routes';
import { createAdminRouter } from './admin.routes';

/**
 * Version 1 API router. Feature routers (auth, mfa, security, admin, ...)
 * mount here as later phases are implemented.
 */
export function createV1Router(container: AppContainer): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.route('/health', createHealthRouter());
  router.route('/auth', createAuthRouter(container));
  router.route('/mfa', createMfaRouter(container));
  router.route('/security', createSecurityRouter(container));
  router.route('/admin', createAdminRouter(container));

  return router;
}
