import type { Request, Response } from 'express';
import { asyncHandler } from '@secureauthx/shared';

/** Consistent success envelope helper. */
export function success<T>(code: string, message: string, data: T) {
  return {
    status: 'success' as const,
    code,
    message,
    data,
    requestId: undefined as string | undefined,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Variant of the success helper that reads `req.id` so the response
 * carries the request trace id.
 */
export function ok<T>(req: Request, res: Response, code: string, message: string, data: T): void {
  res.json({
    status: 'success',
    code,
    message,
    data,
    requestId: req.id,
    timestamp: new Date().toISOString(),
  });
}

export { asyncHandler };
