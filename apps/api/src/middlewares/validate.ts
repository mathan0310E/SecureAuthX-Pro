import type { MiddlewareHandler } from 'hono';
import type { ZodType } from 'zod';
import { ZodError } from 'zod';
import { Errors } from '../utils/errors';
import type { AppEnv } from '../types/context';

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Validates request parts against Zod schemas. On failure, throws a 422
 * VALIDATION_ERROR whose `details` list every offending field. Parsed values
 * are left on the Hono request (`c.req.json()` is cached), so controllers can
 * read them back without re-parsing.
 */
export function validate(schemas: ValidationSchemas): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    try {
      if (schemas.params) schemas.params.parse(c.req.param());
      if (schemas.query) schemas.query.parse(c.req.query());
      if (schemas.body) schemas.body.parse(await c.req.json().catch(() => ({})));
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        throw Errors.validation('Request validation failed.', details);
      }
      throw error;
    }
  };
}
