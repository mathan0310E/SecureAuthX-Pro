import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { logger } from '../config/logger';
import { env } from '../config/env';

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
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.id ?? 'unknown';

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
    if (err.name === 'PayloadTooLargeError') {
      statusCode = 413;
      code = 'PAYLOAD_TOO_LARGE';
      message = 'Request body too large.';
    }
    if (err.message.includes('Not allowed by CORS')) {
      statusCode = 403;
      code = 'CORS_ORIGIN_DENIED';
      message = 'Origin is not allowed.';
    }
  }

  if (statusCode >= 500) {
    logger.error('Unhandled error', {
      requestId,
      method: req.method,
      path: req.path,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
  } else {
    logger.warn('Request error', {
      requestId,
      method: req.method,
      path: req.path,
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

  res.status(statusCode).json(body);
}
