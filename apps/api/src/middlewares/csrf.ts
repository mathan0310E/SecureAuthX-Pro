import type { MiddlewareHandler } from 'hono';
import { COOKIE_NAMES } from '@secureauthx/config';
import { safeEqual } from '@secureauthx/shared';
import { Errors } from '../utils/errors';
import { parseCookies } from '../utils/request-context';
import type { AppEnv } from '../types/context';

/**
 * Double-submit cookie CSRF protection. The client must echo the CSRF
 * cookie value in the `x-csrf-token` header. Applied to state-changing
 * cookie-authenticated endpoints (e.g. token refresh).
 */
export const requireCsrf: MiddlewareHandler<AppEnv> = (c, next) => {
  const cookieToken = parseCookies(c.req.header('cookie'))[COOKIE_NAMES.CSRF];
  const headerToken = c.req.header('x-csrf-token');

  if (
    typeof cookieToken === 'string' &&
    cookieToken.length > 0 &&
    typeof headerToken === 'string' &&
    headerToken.length > 0 &&
    safeEqual(cookieToken, headerToken)
  ) {
    return next();
  }

  throw Errors.forbidden('CSRF token validation failed.');
};
