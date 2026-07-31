import type { Request, Response } from 'express';
import { Errors } from '../utils/errors';

export function notFoundHandler(req: Request, res: Response): void {
  const error = Errors.notFound(`Route ${req.method} ${req.path} not found.`);
  res.status(error.statusCode).json({
    status: 'error',
    code: error.code,
    message: error.message,
    requestId: req.id,
    timestamp: new Date().toISOString(),
  });
}
