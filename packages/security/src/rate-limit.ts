import type { Context, MiddlewareHandler } from 'hono';
import { getClientIp, type HttpRequestContext } from '@secureauthx/shared';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Pluggable limiter backend. The default in-memory store is per-isolate
 * (correct for local dev and single-isolate Workers); pass an Upstash-backed
 * store for globally-consistent limiting across Worker isolates.
 */
export interface RateLimitStore {
  consume(key: string, windowMs: number, limit: number): Promise<RateLimitResult>;
}

/**
 * In-memory sliding-window-lite store. Expired buckets are swept lazily so
 * memory stays bounded under sustained traffic.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  async consume(key: string, windowMs: number, limit: number): Promise<RateLimitResult> {
    const now = Date.now();

    if (this.buckets.size > 10_000) {
      for (const [k, b] of this.buckets) {
        if (b.resetAt <= now) this.buckets.delete(k);
      }
    }

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { success: true, limit, remaining: limit - 1, resetAt: now + windowMs };
    }

    bucket.count += 1;
    return {
      success: bucket.count <= limit,
      limit,
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt,
    };
  }
}

/** Materializes just the header surface shared helpers need from a Hono context. */
function toRequestContext(c: Context): HttpRequestContext {
  const headers: Record<string, string | string[] | undefined> = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return { headers };
}

export interface RateLimitConfig {
  windowMs: number;
  limit: number;
  message?: string;
  /** Optional external store for distributed limiting (e.g. Upstash-backed). */
  store?: RateLimitStore;
  /** Key generator; defaults to the client IP. */
  keyGenerator?: (c: Context) => string;
}

/**
 * Creates a Hono middleware enforcing a per-key window limit.
 * Responds 429 RATE_LIMIT_EXCEEDED with standard `ratelimit-*` headers.
 */
export function createRateLimiter(config: RateLimitConfig): MiddlewareHandler {
  const store = config.store ?? new InMemoryRateLimitStore();
  const keyGenerator = config.keyGenerator ?? ((c: Context) => getClientIp(toRequestContext(c)));
  const message = config.message ?? 'Too many requests. Please try again later.';

  return async (c, next) => {
    const key = keyGenerator(c);
    const result = await store.consume(key, config.windowMs, config.limit);

    c.header('ratelimit-limit', String(result.limit));
    c.header('ratelimit-remaining', String(result.remaining));
    c.header('ratelimit-reset', String(Math.ceil(result.resetAt / 1000)));

    if (!result.success) {
      return c.json(
        {
          status: 'error',
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          timestamp: new Date().toISOString(),
        },
        429
      );
    }

    await next();
  };
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
