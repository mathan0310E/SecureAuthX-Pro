import { createAuthRateLimiter } from '@secureauthx/security';
import { env } from '../config/env';

/**
 * Aggressive per-IP limiter for authentication endpoints
 * (login, register, refresh, password reset).
 */
export const authRateLimiter = createAuthRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
});
