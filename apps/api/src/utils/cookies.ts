import { setCookie, deleteCookie } from 'hono/cookie';
import { COOKIE_NAMES } from '@secureauthx/config';
import type { AuthTokens } from '@secureauthx/types';
import type { AppContext } from '../types/context';
import { env } from '../config/env';

type CookieOptions = NonNullable<Parameters<typeof setCookie>[3]>;

const SAME_SITE: Record<string, CookieOptions['sameSite']> = {
  lax: 'Lax',
  strict: 'Strict',
  none: 'None',
};

function cookieOptions({ maxAgeMs, httpOnly }: { maxAgeMs: number; httpOnly: boolean }): CookieOptions {
  return {
    path: '/',
    domain: env.COOKIE_DOMAIN,
    secure: env.COOKIE_SECURE,
    sameSite: SAME_SITE[env.COOKIE_SAME_SITE] ?? 'Lax',
    httpOnly,
    maxAge: Math.max(0, Math.floor(maxAgeMs / 1000)),
  };
}

/**
 * Persists the auth token set on the response. Access/refresh cookies are
 * httpOnly; the CSRF cookie must be readable by client JS (double-submit).
 */
export function setAuthCookies(
  c: AppContext,
  tokens: AuthTokens,
  accessMaxAgeSeconds: number,
  refreshMaxAgeSeconds: number
): void {
  setCookie(
    c,
    COOKIE_NAMES.ACCESS_TOKEN,
    tokens.accessToken,
    cookieOptions({ maxAgeMs: accessMaxAgeSeconds * 1000, httpOnly: true })
  );
  setCookie(
    c,
    COOKIE_NAMES.REFRESH_TOKEN,
    tokens.refreshToken,
    cookieOptions({ maxAgeMs: refreshMaxAgeSeconds * 1000, httpOnly: true })
  );
  setCookie(
    c,
    COOKIE_NAMES.CSRF,
    tokens.csrfToken,
    cookieOptions({ maxAgeMs: refreshMaxAgeSeconds * 1000, httpOnly: false })
  );
}

/** Expires all auth cookies (logout). */
export function clearAuthCookies(c: AppContext): void {
  deleteCookie(c, COOKIE_NAMES.ACCESS_TOKEN, cookieOptions({ maxAgeMs: 0, httpOnly: true }));
  deleteCookie(c, COOKIE_NAMES.REFRESH_TOKEN, cookieOptions({ maxAgeMs: 0, httpOnly: true }));
  deleteCookie(c, COOKIE_NAMES.CSRF, cookieOptions({ maxAgeMs: 0, httpOnly: false }));
  deleteCookie(c, COOKIE_NAMES.MFA_CHALLENGE, cookieOptions({ maxAgeMs: 0, httpOnly: true }));
}

/**
 * Binds a pending MFA challenge to the browser so a challenge issued to one
 * client cannot be completed from another.
 */
export function setMfaChallengeCookie(c: AppContext, challengeId: string, ttlSeconds: number): void {
  setCookie(
    c,
    COOKIE_NAMES.MFA_CHALLENGE,
    challengeId,
    cookieOptions({ maxAgeMs: ttlSeconds * 1000, httpOnly: true })
  );
}

export function clearMfaChallengeCookie(c: AppContext): void {
  deleteCookie(c, COOKIE_NAMES.MFA_CHALLENGE, cookieOptions({ maxAgeMs: 0, httpOnly: true }));
}

/** Marks the device as trusted so later logins skip the second factor. */
export function setTrustedDeviceCookie(c: AppContext, token: string, ttlSeconds: number): void {
  setCookie(
    c,
    COOKIE_NAMES.TRUSTED_DEVICE,
    token,
    cookieOptions({ maxAgeMs: ttlSeconds * 1000, httpOnly: true })
  );
}

export function clearTrustedDeviceCookie(c: AppContext): void {
  deleteCookie(c, COOKIE_NAMES.TRUSTED_DEVICE, cookieOptions({ maxAgeMs: 0, httpOnly: true }));
}
