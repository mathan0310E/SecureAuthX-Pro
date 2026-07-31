import { Router } from 'express';
import {
  adminListUsersQuerySchema,
  analyticsTrendsQuerySchema,
  setUserRoleSchema,
  setUserStatusSchema,
} from '@secureauthx/validation';
import type { AppContainer } from '../../config/container';
import { createBoundAuthMiddleware } from '../../middlewares/bound-auth';
import { requireAdmin } from '../../middlewares/require-admin';
import { validate } from '../../middlewares/validate';
import { adminController } from '../../controllers/admin.controller';

/**
 * /api/v1/admin — administrator-only user management and analytics.
 */
export function createAdminRouter(container: AppContainer): Router {
  const router = Router();
  const authRequired = createBoundAuthMiddleware(container);

  router.use(authRequired, requireAdmin);

  router.get('/users', validate({ query: adminListUsersQuerySchema }), adminController.listUsers);
  router.patch('/users/:id/role', validate({ body: setUserRoleSchema }), adminController.setUserRole);
  router.patch('/users/:id/status', validate({ body: setUserStatusSchema }), adminController.setUserStatus);

  router.get('/analytics/overview', adminController.analyticsOverview);
  router.get(
    '/analytics/trends',
    validate({ query: analyticsTrendsQuerySchema }),
    adminController.analyticsTrends
  );

  return router;
}
