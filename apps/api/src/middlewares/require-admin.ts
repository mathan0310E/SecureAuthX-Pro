import type { MiddlewareHandler } from 'hono';
import { Errors } from '../utils/errors';
import type { AppEnv } from '../types/context';

/**
 * Rejects the request unless the authenticated user is an administrator.
 * Must run after `authRequired` (which sets the authenticated user).
 */
export const requireAdmin: MiddlewareHandler<AppEnv> = (c, next) => {
  const user = c.get('user');
  if (!user) throw Errors.unauthorized('Authentication required.');
  if (user.role !== 'ADMIN') throw Errors.forbidden('Administrator access required.');
  return next();
};
