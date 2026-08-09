import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';
import type { Hono } from 'hono';
import { buildSecureHeadersOptions, createRateLimiter } from '@secureauthx/security';
import { env } from '../config/env';
import type { AppEnv } from '../types/context';

/**
 * Global security posture for the API gateway:
 * - Security headers (CSP, HSTS, referrer policy, permissions policy)
 * - CORS restricted to configured origins
 *
 * NOTE: Response compression is intentionally disabled. The web Worker
 * (Next.js/OpenNext rewrite) proxies /api/* and drops the Content-Encoding
 * header while forwarding the gzip body, which breaks browser JSON parsing.
 * Payloads are small; Cloudflare's edge still compresses static assets.
 */
export function configureSecurity(app: Hono<AppEnv>): void {
  const isProd = env.NODE_ENV === 'production';

  app.use('*', secureHeaders(buildSecureHeadersOptions(env.WEB_URL, isProd)));

  app.use(
    '*',
    cors({
      origin: (origin) => {
        // Allow requests without an Origin (curl, server-to-server, healthchecks)
        if (!origin) return null;
        return env.API_CORS_ORIGINS.includes(origin) ? origin : null;
      },
      credentials: true,
      exposeHeaders: ['x-request-id'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      maxAge: 86400,
    })
  );
}

/**
 * Global API rate limiter applied to all /api routes.
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
});
