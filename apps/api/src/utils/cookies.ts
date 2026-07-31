import type { Response } from 'express';
import { COOKIE_NAMES } from '@secureauthx/config';
import type { AuthTokens } from '@secureauthx/types';
import { env } from '../config/env';

interface CookieOptions {
  maxAgeMs: number;
  httpOnly: boolean;
}

function cookieOptions({ maxAgeMs, httpOnly }: CookieOptions) {
  return {
    path: '/',
    domain: env.COOKIE_DOMAIN,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    httpOnly,
    maxAge: maxAgeMs,
  } as const;
}

/**
 * Persists the auth token set on `res`. Access/refresh cookies are
 * httpOnly; the CSRF cookie must be readable by client JS (double-submit).
 */
export function setAuthCookies(
  res: Response,
  tokens: AuthTokens,
  accessMaxAgeSeconds: number,
  refreshMaxAgeSeconds: number
): void {
  res.cookie(
    COOKIE_NAMES.ACCESS_TOKEN,
    tokens.accessToken,
    cookieOptions({ maxAgeMs: accessMaxAgeSeconds * 1000, httpOnly: true })
  );
  res.cookie(
    COOKIE_NAMES.REFRESH_TOKEN,
    tokens.refreshToken,
    cookieOptions({ maxAgeMs: refreshMaxAgeSeconds * 1000, httpOnly: true })
  );
  res.cookie(
    COOKIE_NAMES.CSRF,
    tokens.csrfToken,
    cookieOptions({ maxAgeMs: refreshMaxAgeSeconds * 1000, httpOnly: false })
  );
}

/** Expires all auth cookies (logout). */
export function clearAuthCookies(res: Response): void {
  const base = cookieOptions({ maxAgeMs: 0, httpOnly: true });
  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, base);
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, base);
  res.clearCookie(COOKIE_NAMES.CSRF, { ...base, httpOnly: false });
}
