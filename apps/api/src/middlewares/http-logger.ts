import type { MiddlewareHandler } from 'hono';
import { logger } from '../config/logger';
import type { AppEnv } from '../types/context';

/**
 * HTTP access logging for the Hono gateway.
 * Tracks method, URL, status, response time, and request id.
 */
export const httpLogger: MiddlewareHandler<AppEnv> = async (c, next) => {
  const startedAt = Date.now();
  await next();

  const path = new URL(c.req.url).pathname;
  if (path === '/health' && c.req.method === 'GET') return;

  logger.http('HTTP request', {
    method: c.req.method,
    url: c.req.url,
    status: c.res.status,
    responseTimeMs: Date.now() - startedAt,
    requestId: c.get('requestId'),
    userAgent: c.req.header('user-agent'),
  });
};
