import { Router } from 'express';
import {
  auditLogsQuerySchema,
  securityEventsQuerySchema,
} from '@secureauthx/validation';
import type { AppContainer } from '../../config/container';
import { createBoundAuthMiddleware } from '../../middlewares/bound-auth';
import { validate } from '../../middlewares/validate';
import { securityController } from '../../controllers/security.controller';

/**
 * /api/v1/security — authenticated security telemetry (audit logs, events).
 */
export function createSecurityRouter(container: AppContainer): Router {
  const router = Router();
  const authRequired = createBoundAuthMiddleware(container);

  router.get(
    '/audit-logs',
    authRequired,
    validate({ query: auditLogsQuerySchema }),
    securityController.listAuditLogs
  );

  router.get(
    '/events',
    authRequired,
    validate({ query: securityEventsQuerySchema }),
    securityController.listSecurityEvents
  );

  return router;
}
