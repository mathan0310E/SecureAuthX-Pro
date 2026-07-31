import type { NextFunction, Request, Response } from 'express';
import type { z, ZodType } from 'zod';
import { ZodError } from 'zod';
import { Errors } from '../utils/errors';

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Validates request parts against Zod schemas. On failure, responds with a
 * 422 VALIDATION_ERROR whose `details` list every offending field.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        next(Errors.validation('Request validation failed.', details));
        return;
      }
      next(error);
    }
  };
}

export type { z };
