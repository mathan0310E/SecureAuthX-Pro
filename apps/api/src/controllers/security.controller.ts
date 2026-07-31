import type { Request, Response } from 'express';
import { asyncHandler } from '@secureauthx/shared';
import { ok } from '../utils/response';

/**
 * Security Dashboard endpoints — the signed-in user's own audit trail and
 * security events. All queries are scoped to the authenticated user.
 */
export const securityController = {
  listAuditLogs: asyncHandler(async (req: Request, res: Response) => {
    const data = await req.container!.security.listMyAuditLogs(req.user!.id, req.query);
    ok(req, res, 'AUDIT_LOGS_FETCHED', 'Audit logs.', data);
  }),

  listSecurityEvents: asyncHandler(async (req: Request, res: Response) => {
    const data = await req.container!.security.listMySecurityEvents(req.user!.id, req.query);
    ok(req, res, 'SECURITY_EVENTS_FETCHED', 'Security events.', data);
  }),
};
