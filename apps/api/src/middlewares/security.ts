import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { buildSecurityHeadersConfig, createRateLimiter } from '@secureauthx/security';
import { env } from '../config/env';

/**
 * Global security posture for the API gateway:
 * - Helmet security headers (CSP, HSTS, referrer policy, permissions policy)
 * - CORS restricted to configured origins
 * - Response compression
 */
export function configureSecurity(app: { use: (mw: unknown) => void }): void {
  const isProd = env.NODE_ENV === 'production';

  app.use(helmet(buildSecurityHeadersConfig(env.WEB_URL, isProd) as Parameters<typeof helmet>[0]));

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests without an Origin (curl, server-to-server, healthchecks)
        if (!origin) return callback(null, true);
        if (env.API_CORS_ORIGINS.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      exposedHeaders: ['x-request-id'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      maxAge: 86400,
    })
  );

  app.use(compression());
}

/**
 * Global API rate limiter applied to all /api routes.
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
});
