import type { MiddlewareHandler } from 'hono';
import type { AppContainer } from '../config/container';
import { Errors } from '../utils/errors';
import { toRequestContext } from '../utils/request-context';
import type { AppEnv } from '../types/context';

/**
 * Guards MFA-completion endpoints. The challenge must have been issued to
 * this browser (challenge cookie) and the client must present the same
 * challenge id in the body, so a challenge cannot be replayed elsewhere.
 */
export function createRequireMfaChallengeMiddleware(container: AppContainer): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const body = (await c.req.json().catch(() => ({}))) as { challengeId?: unknown };
    const challengeId = typeof body.challengeId === 'string' ? body.challengeId : '';
    if (!challengeId || !container.mfa.challengeCookieMatches(toRequestContext(c), challengeId)) {
      throw Errors.unauthorized('MFA challenge is invalid or has expired.');
    }
    return next();
  };
}
