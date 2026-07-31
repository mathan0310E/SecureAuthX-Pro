/**
 * Typed application error carrying an HTTP status code and an error code
 * string for the consistent API error envelope.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;
  readonly isOperational: boolean;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    options?: { details?: unknown; cause?: unknown }
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = options?.details;
    this.isOperational = true;
    if (options?.cause) this.cause = options.cause;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export const Errors = {
  badRequest: (message = 'Invalid request.', details?: unknown) =>
    new AppError(400, 'BAD_REQUEST', message, { details }),
  unauthorized: (message = 'Authentication required.') =>
    new AppError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'You do not have permission to perform this action.') =>
    new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'Resource not found.') =>
    new AppError(404, 'NOT_FOUND', message),
  conflict: (message = 'Resource already exists.', details?: unknown) =>
    new AppError(409, 'CONFLICT', message, { details }),
  tooManyRequests: (message = 'Too many requests. Please try again later.') =>
    new AppError(429, 'RATE_LIMIT_EXCEEDED', message),
  validation: (message = 'Validation failed.', details?: unknown) =>
    new AppError(422, 'VALIDATION_ERROR', message, { details }),
  internal: (message = 'Internal server error.') =>
    new AppError(500, 'INTERNAL_ERROR', message),
} as const;
