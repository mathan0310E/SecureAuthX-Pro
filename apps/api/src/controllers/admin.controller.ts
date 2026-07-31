import type { Request, Response } from 'express';
import { asyncHandler } from '@secureauthx/shared';
import type { AccountStatus, UserRole } from '@secureauthx/types';
import { ok } from '../utils/response';

/**
 * Admin Dashboard endpoints — user lifecycle management and analytics.
 * Every route is guarded by the `requireAdmin` middleware.
 */
export const adminController = {
  listUsers: asyncHandler(async (req: Request, res: Response) => {
    const data = await req.container!.admin.listUsers(req.query);
    ok(req, res, 'ADMIN_USERS_LISTED', 'Users.', data);
  }),

  setUserRole: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const { role } = req.body as { role: UserRole };
    const data = await req.container!.admin.setUserRole(req.user!.id, id, role, req);
    ok(req, res, 'ADMIN_USER_ROLE_UPDATED', 'User role updated.', data);
  }),

  setUserStatus: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: AccountStatus };
    const data = await req.container!.admin.setUserStatus(req.user!.id, id, status, req);
    ok(req, res, 'ADMIN_USER_STATUS_UPDATED', 'User status updated.', data);
  }),

  analyticsOverview: asyncHandler(async (req: Request, res: Response) => {
    const data = await req.container!.admin.analyticsOverview();
    ok(req, res, 'ADMIN_ANALYTICS_OVERVIEW', 'Analytics overview.', data);
  }),

  analyticsTrends: asyncHandler(async (req: Request, res: Response) => {
    const days = Number(req.query.days) || 14;
    const data = await req.container!.admin.analyticsTrends(days);
    ok(req, res, 'ADMIN_ANALYTICS_TRENDS', 'Analytics trends.', data);
  }),
};
