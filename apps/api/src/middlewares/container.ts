import type { MiddlewareHandler } from 'hono';
import type { AppContainer } from '../config/container';
import type { AppEnv } from '../types/context';

/**
 * Attaches the service container to every request so controllers can
 * resolve dependencies without importing globals.
 */
export function containerMiddleware(container: AppContainer): MiddlewareHandler<AppEnv> {
  return (c, next) => {
    c.set('container', container);
    return next();
  };
}
