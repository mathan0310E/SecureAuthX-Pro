import type { RequestHandler, Request } from 'express';
import {
  adminListUsersQuerySchema,
  analyticsTrendsQuerySchema,
  setUserRoleSchema,
  setUserStatusSchema,
} from '@secureauthx/validation';
import { Errors } from '../utils/errors';

/**
 * Rejects the request unless the authenticated user is an administrator.
 * Must run after `authRequired` (which sets `req.user`).
 */
export const requireAdmin: RequestHandler = (req: Request, _res, next) => {
  if (!req.user) {
    return next(Errors.unauthorized('Authentication required.'));
  }
  if (req.user.role !== 'ADMIN') {
    return next(Errors.forbidden('Administrator access required.'));
  }
  next();
};
