import type { NextFunction, Request, Response } from 'express';
import { COOKIE_NAMES } from '@secureauthx/config';
import { safeEqual } from '@secureauthx/shared';
import { Errors } from '../utils/errors';

/**
 * Double-submit cookie CSRF protection. The client must echo the CSRF
 * cookie value in the `x-csrf-token` header. Applied to state-changing
 * cookie-authenticated endpoints (e.g. token refresh).
 */
export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  const cookieToken = req.cookies?.[COOKIE_NAMES.CSRF];
  const headerToken = req.headers['x-csrf-token'];

  if (
    typeof cookieToken === 'string' &&
    cookieToken.length > 0 &&
    typeof headerToken === 'string' &&
    headerToken.length > 0 &&
    safeEqual(cookieToken, headerToken)
  ) {
    next();
    return;
  }

  next(Errors.forbidden('CSRF token validation failed.'));
}
