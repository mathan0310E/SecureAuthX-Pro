import type { AccountStatus, UserRole } from '@secureauthx/types';
import { ok } from '../utils/response';
import { toRequestContext } from '../utils/request-context';
import type { AppContext } from '../types/context';

/**
 * Admin Dashboard endpoints — user lifecycle management and analytics.
 * Every route is guarded by the `requireAdmin` middleware.
 */
export const adminController = {
  listUsers: async (c: AppContext) => {
    const q = c.req.query();
    const data = await c.get('container').admin.listUsers({
      page: q.page ? parseInt(q.page, 10) : undefined,
      pageSize: q.pageSize ? parseInt(q.pageSize, 10) : undefined,
      search: q.search,
      status: q.status,
    });
    return ok(c, 'ADMIN_USERS_LISTED', 'Users.', data);
  },

  setUserRole: async (c: AppContext) => {
    const id = c.req.param('id')!;
    const body = await c.req.json<{ role: UserRole }>();
    const data = await c
      .get('container')
      .admin.setUserRole(c.get('user')!.id, id, body.role, toRequestContext(c));
    return ok(c, 'ADMIN_USER_ROLE_UPDATED', 'User role updated.', data);
  },

  setUserStatus: async (c: AppContext) => {
    const id = c.req.param('id')!;
    const body = await c.req.json<{ status: AccountStatus }>();
    const data = await c
      .get('container')
      .admin.setUserStatus(c.get('user')!.id, id, body.status, toRequestContext(c));
    return ok(c, 'ADMIN_USER_STATUS_UPDATED', 'User status updated.', data);
  },

  analyticsOverview: async (c: AppContext) => {
    const data = await c.get('container').admin.analyticsOverview();
    return ok(c, 'ADMIN_ANALYTICS_OVERVIEW', 'Analytics overview.', data);
  },

  analyticsTrends: async (c: AppContext) => {
    const q = c.req.query();
    const days = q.days ? Number(q.days) : 14;
    const data = await c.get('container').admin.analyticsTrends(days);
    return ok(c, 'ADMIN_ANALYTICS_TRENDS', 'Analytics trends.', data);
  },
};
