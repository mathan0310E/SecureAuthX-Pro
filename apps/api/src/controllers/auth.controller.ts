import { COOKIE_NAMES } from '@secureauthx/config';
import { Errors } from '../utils/errors';
import { ok } from '../utils/response';
import { setAuthCookies, clearAuthCookies, setMfaChallengeCookie } from '../utils/cookies';
import { env } from '../config/env';
import { parseCookies, toRequestContext } from '../utils/request-context';
import type { AppContext } from '../types/context';

/**
 * Auth endpoints. Controllers stay thin — all business logic lives in
 * AuthService, resolved from the per-request container.
 */
export const authController = {
  register: async (c: AppContext) => {
    const body = await c.req.json();
    const data = await c.get('container').auth.register(body, toRequestContext(c));
    return ok(c, 'REGISTERED', 'Account created. Please verify your email address.', data, 201);
  },

  login: async (c: AppContext) => {
    const body = await c.req.json();
    const data = await c.get('container').auth.login(body, toRequestContext(c));
    if ('tokens' in data) {
      setAuthCookies(c, data.tokens, env.JWT_ACCESS_TTL, data.tokens.expiresIn);
      return ok(c, 'LOGIN_SUCCESS', 'Signed in successfully.', data);
    }
    setMfaChallengeCookie(c, data.challenge.challengeId, env.MFA_CHALLENGE_TTL);
    return ok(c, 'MFA_REQUIRED', 'Second factor required.', data);
  },

  refresh: async (c: AppContext) => {
    const cookies = parseCookies(c.req.header('cookie'));
    const body = (await c.req.json().catch(() => ({}))) as { refreshToken?: unknown };
    const refreshToken =
      cookies[COOKIE_NAMES.REFRESH_TOKEN] ??
      (typeof body.refreshToken === 'string' ? body.refreshToken : undefined);
    if (!refreshToken) {
      throw Errors.unauthorized('Missing refresh token.');
    }
    const data = await c.get('container').auth.refresh(refreshToken, toRequestContext(c));
    setAuthCookies(c, data.tokens, env.JWT_ACCESS_TTL, data.tokens.expiresIn);
    return ok(c, 'TOKEN_REFRESHED', 'Tokens refreshed.', data);
  },

  verifyEmail: async (c: AppContext) => {
    const body = await c.req.json();
    const data = await c.get('container').auth.verifyEmail(body.token, toRequestContext(c));
    return ok(c, 'EMAIL_VERIFIED', 'Email verified successfully.', data);
  },

  resendVerification: async (c: AppContext) => {
    const body = await c.req.json();
    const data = await c.get('container').auth.resendVerification(body.email, toRequestContext(c));
    return ok(
      c,
      'VERIFICATION_SENT',
      'If the account exists and is unverified, a verification email has been sent.',
      data
    );
  },

  me: async (c: AppContext) => {
    return ok(c, 'USER_FETCHED', 'Authenticated user.', { user: c.get('user') });
  },

  logout: async (c: AppContext) => {
    const data = await c.get('container').auth.logout(toRequestContext(c));
    clearAuthCookies(c);
    return ok(c, 'LOGGED_OUT', 'Signed out successfully.', data);
  },
};
