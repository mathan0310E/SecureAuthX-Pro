import type { MiddlewareHandler } from 'hono';
import type { AuthenticatedUser } from '@secureauthx/types';
import type { HttpRequestContext } from '@secureauthx/shared';
import { COOKIE_NAMES } from '@secureauthx/config';
import { Errors } from '../utils/errors';
import { toRequestContext } from '../utils/request-context';
import type { AppEnv } from '../types/context';

export type AccessTokenResolver = (req: HttpRequestContext) => string | null;

/**
 * Extracts the bearer access token from the Authorization header or the
 * httpOnly access-token cookie.
 */
export function resolveAccessToken(req: HttpRequestContext): string | null {
  const header = req.headers['authorization'];
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
 * that the referenced session is still valid. Attaches the user to the
 * Hono context for downstream handlers.
 */
export function createAuthenticateMiddleware(deps: {
  verify: (
    token: string
  ) => Promise<{ sub: string; sessionId: string; email: string; role: 'USER' | 'ADMIN' } | null>;
  findUser: (id: string) => Promise<AuthenticatedUser | null>;
  isSessionActive: (sessionId: string, userId: string) => Promise<boolean>;
  resolver?: AccessTokenResolver;
}): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const resolver = deps.resolver ?? resolveAccessToken;
    const token = resolver(toRequestContext(c));

    if (!token) throw Errors.unauthorized('Missing authentication token.');

    const payload = await deps.verify(token);
    if (!payload) throw Errors.unauthorized('Invalid or expired token.');

    const [user, sessionActive] = await Promise.all([
      deps.findUser(payload.sub),
      deps.isSessionActive(payload.sessionId, payload.sub),
    ]);

    if (!user) throw Errors.unauthorized('Account no longer exists.');
    if (user.status === 'DISABLED') throw Errors.forbidden('Account is disabled.');
    if (!sessionActive) throw Errors.unauthorized('Session is no longer active.');

    c.set('user', user);
    return next();
  };
}
