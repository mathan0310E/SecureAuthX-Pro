import { rateLimit, type Options } from 'express-rate-limit';
import type { Request } from 'express';
import { getClientIp } from '@secureauthx/shared';

export interface RateLimitConfig {
  windowMs: number;
  limit: number;
  message?: string;
  /** Optional external store (e.g. Redis-backed) for distributed limiting. */
  store?: Options['store'];
  /** Key generator; defaults to client IP. */
  keyGenerator?: (req: Request) => string;
}

const defaultMessage = 'Too many requests. Please try again later.';

/**
 * Creates a standard API rate limiter.
 * Per-IP by default; swap in a Redis store for multi-instance deployments.
 */
export function createRateLimiter(config: RateLimitConfig) {
  return rateLimit({
    windowMs: config.windowMs,
    limit: config.limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 'error',
      code: 'RATE_LIMIT_EXCEEDED',
      message: config.message ?? defaultMessage,
      timestamp: new Date().toISOString(),
    },
    keyGenerator: config.keyGenerator ?? ((req) => getClientIp(req)),
    store: config.store,
  });
}

/**
 * Aggressive limiter for sensitive endpoints (login, register, token refresh).
 */
export function createAuthRateLimiter(config: Pick<RateLimitConfig, 'windowMs' | 'limit' | 'store'>) {
  return createRateLimiter({
    ...config,
    message: 'Too many authentication attempts. Please try again later.',
  });
}
