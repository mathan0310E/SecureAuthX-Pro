import type { NextFunction, Request, Response } from 'express';
import type { AppContainer } from '../config/container';
import { Errors } from '../utils/errors';

/**
 * Guards MFA-completion endpoints. The challenge must have been issued to
 * this browser (challenge cookie) and the client must present the same
 * challenge id in the body, so a challenge cannot be replayed elsewhere.
 */
export function createRequireMfaChallengeMiddleware(container: AppContainer) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const challengeId = typeof req.body?.challengeId === 'string' ? req.body.challengeId : '';
    if (!challengeId || !container.mfa.challengeCookieMatches(req, challengeId)) {
      next(Errors.unauthorized('MFA challenge is invalid or has expired.'));
      return;
    }
    next();
  };
}
