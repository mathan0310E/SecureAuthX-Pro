import { randomUUID } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/context';

/**
 * Assigns a requestId to every request for traceability across logs,
 * audit entries, and error responses.
 */
export const requestIdMiddleware: MiddlewareHandler<AppEnv> = (c, next) => {
  const incoming = c.req.header('x-request-id');
  const requestId = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);
  return next();
};
