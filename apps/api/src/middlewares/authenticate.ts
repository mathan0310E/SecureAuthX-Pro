import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedUser } from '@secureauthx/types';
import { COOKIE_NAMES } from '@secureauthx/config';
import { Errors } from '../utils/errors';

export type AccessTokenResolver = (req: Request) => string | null;

/**
 * Extracts the bearer access token from the Authorization header or the
 * httpOnly access-token cookie.
 */
export function resolveAccessToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    if (token.length > 0) return token;
  }

  const cookie = req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN];
  if (typeof cookie === 'string' && cookie.length > 0) return cookie;

  return null;
}

/**
 * Authenticates the request by verifying the access token and checking
 * that the referenced session is still valid. Attaches `req.user`.
 */
export function createAuthenticateMiddleware(deps: {
  verify: (token: string) => { sub: string; sessionId: string; email: string; role: 'USER' | 'ADMIN' } | null;
  findUser: (id: string) => Promise<AuthenticatedUser | null>;
  isSessionActive: (sessionId: string, userId: string) => Promise<boolean>;
  resolver?: AccessTokenResolver;
}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const resolver = deps.resolver ?? resolveAccessToken;
    const token = resolver(req);

    if (!token) {
      next(Errors.unauthorized('Missing authentication token.'));
      return;
    }

    const payload = deps.verify(token);
    if (!payload) {
      next(Errors.unauthorized('Invalid or expired token.'));
      return;
    }

    const [user, sessionActive] = await Promise.all([
      deps.findUser(payload.sub),
      deps.isSessionActive(payload.sessionId, payload.sub),
    ]);

    if (!user) {
      next(Errors.unauthorized('Account no longer exists.'));
      return;
    }

    if (user.status === 'DISABLED') {
      next(Errors.forbidden('Account is disabled.'));
      return;
    }

    if (!sessionActive) {
      next(Errors.unauthorized('Session is no longer active.'));
      return;
    }

    req.user = user;
    next();
  };
}
