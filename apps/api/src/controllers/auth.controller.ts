import type { Request, Response } from 'express';
import { COOKIE_NAMES } from '@secureauthx/config';
import { Errors } from '../utils/errors';
import { ok } from '../utils/response';
import { setAuthCookies, clearAuthCookies, setMfaChallengeCookie } from '../utils/cookies';
import { env } from '../config/env';
import { asyncHandler } from '@secureauthx/shared';

/**
 * Auth endpoints. Controllers stay thin — all business logic lives in
 * AuthService, resolved from the per-request container.
 */
export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const data = await req.container!.auth.register(req.body, req);
    res.status(201);
    ok(req, res, 'REGISTERED', 'Account created. Please verify your email address.', data);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const data = await req.container!.auth.login(req.body, req);
    if ('tokens' in data) {
      setAuthCookies(res, data.tokens, env.JWT_ACCESS_TTL, data.tokens.expiresIn);
      ok(req, res, 'LOGIN_SUCCESS', 'Signed in successfully.', data);
      return;
    }
    setMfaChallengeCookie(res, data.challenge.challengeId, env.MFA_CHALLENGE_TTL);
    ok(req, res, 'MFA_REQUIRED', 'Second factor required.', data);
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken =
      req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] ??
      (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined);
    if (!refreshToken) {
      throw Errors.unauthorized('Missing refresh token.');
    }
    const data = await req.container!.auth.refresh(refreshToken, req);
    setAuthCookies(res, data.tokens, env.JWT_ACCESS_TTL, data.tokens.expiresIn);
    ok(req, res, 'TOKEN_REFRESHED', 'Tokens refreshed.', data);
  }),

  verifyEmail: asyncHandler(async (req: Request, res: Response) => {
    const data = await req.container!.auth.verifyEmail(req.body.token, req);
    ok(req, res, 'EMAIL_VERIFIED', 'Email verified successfully.', data);
  }),

  resendVerification: asyncHandler(async (req: Request, res: Response) => {
    const data = await req.container!.auth.resendVerification(req.body.email, req);
    ok(
      req,
      res,
      'VERIFICATION_SENT',
      'If the account exists and is unverified, a verification email has been sent.',
      data
    );
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, 'USER_FETCHED', 'Authenticated user.', { user: req.user });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const data = await req.container!.auth.logout(req);
    clearAuthCookies(res);
    ok(req, res, 'LOGGED_OUT', 'Signed out successfully.', data);
  }),
};
