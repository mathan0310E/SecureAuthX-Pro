import type { ErrorHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { logger } from '../config/logger';
import { env } from '../config/env';
import type { AppEnv } from '../types/context';

interface ErrorBody {
  status: 'error';
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
  timestamp: string;
}

/**
 * Global error handler. Formats AppError instances into the consistent
 * envelope, converts unexpected errors into 500s, and logs everything.
 */
export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get('requestId') ?? 'unknown';
  const path = new URL(c.req.url).pathname;

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error.';
  let details: unknown;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed.';
    details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
  } else if (err instanceof Error) {
    message = env.NODE_ENV === 'production' ? message : err.message;
  }

  if (statusCode >= 500) {
    logger.error('Unhandled error', {
      requestId,
      method: c.req.method,
      path,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
  } else {
    logger.warn('Request error', {
      requestId,
      method: c.req.method,
      path,
      code,
      message,
    });
  }

  const body: ErrorBody = {
    status: 'error',
    code,
    message,
    requestId,
    timestamp: new Date().toISOString(),
  };
  if (details !== undefined && env.NODE_ENV !== 'production') body.details = details;

  return c.json(body, statusCode as ContentfulStatusCode);
};
