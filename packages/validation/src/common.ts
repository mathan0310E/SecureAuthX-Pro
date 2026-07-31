import { z } from 'zod';
import { PAGINATION, SECURITY } from '@secureauthx/config';
import { evaluatePassword } from '@secureauthx/security';

// ---------------------------------------------------------------------------
// Common primitives
// ---------------------------------------------------------------------------

export const uuidSchema = z
  .string()
  .uuid({ message: 'Must be a valid UUID.' });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(255, 'Email must be at most 255 characters.')
  .email('Must be a valid email address.');

export const pageSchema = z.coerce
  .number()
  .int()
  .min(1)
  .default(PAGINATION.DEFAULT_PAGE);

export const pageSizeSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(PAGINATION.MAX_PAGE_SIZE)
  .default(PAGINATION.DEFAULT_PAGE_SIZE);

export const paginationQuerySchema = z.object({
  page: pageSchema.optional(),
  pageSize: pageSizeSchema.optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// ---------------------------------------------------------------------------
// Password
// ---------------------------------------------------------------------------

/**
 * Password schema that enforces the platform policy.
 * A password fails validation when it is too short, too long, lacks
 * character-class diversity, or contains predictable substrings.
 */
export const passwordSchema = z
  .string()
  .min(1, 'Password is required.')
  .superRefine((value, ctx) => {
    const result = evaluatePassword(value, {
      minLength: SECURITY.PASSWORD_MIN_LENGTH,
      maxLength: SECURITY.PASSWORD_MAX_LENGTH,
    });

    if (!result.valid) {
      for (const error of result.errors) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
      }
    }
  });
