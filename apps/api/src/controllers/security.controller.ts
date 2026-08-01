import { ok } from '../utils/response';
import type { AppContext } from '../types/context';

/**
 * Security Dashboard endpoints — the signed-in user's own audit trail and
 * security events. All queries are scoped to the authenticated user.
 */
export const securityController = {
  listAuditLogs: async (c: AppContext) => {
    const q = c.req.query();
    const data = await c.get('container').security.listMyAuditLogs(c.get('user')!.id, {
      page: q.page ? parseInt(q.page, 10) : undefined,
      pageSize: q.pageSize ? parseInt(q.pageSize, 10) : undefined,
      severity: q.severity,
      action: q.action,
    });
    return ok(c, 'AUDIT_LOGS_FETCHED', 'Audit logs.', data);
  },

  listSecurityEvents: async (c: AppContext) => {
    const q = c.req.query();
    const data = await c.get('container').security.listMySecurityEvents(c.get('user')!.id, {
      page: q.page ? parseInt(q.page, 10) : undefined,
      pageSize: q.pageSize ? parseInt(q.pageSize, 10) : undefined,
      severity: q.severity,
      type: q.type,
    });
    return ok(c, 'SECURITY_EVENTS_FETCHED', 'Security events.', data);
  },
};
