import type { NotFoundHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { Errors } from '../utils/errors';
import type { AppEnv } from '../types/context';

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) => {
  const error = Errors.notFound(`Route ${c.req.method} ${new URL(c.req.url).pathname} not found.`);
  return c.json(
    {
      status: 'error',
      code: error.code,
      message: error.message,
      requestId: c.get('requestId') ?? 'unknown',
      timestamp: new Date().toISOString(),
    },
    error.statusCode as ContentfulStatusCode
  );
};
