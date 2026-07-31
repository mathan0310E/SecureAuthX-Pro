import { z } from 'zod';
import { paginationQuerySchema } from './common';

// ---------------------------------------------------------------------------
// Admin dashboard schemas
// ---------------------------------------------------------------------------

export const adminListUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(255).optional(),
  status: z.enum(['ACTIVE', 'LOCKED', 'DISABLED', 'PENDING_VERIFICATION']).optional(),
});

export const setUserRoleSchema = z.object({
  role: z.enum(['USER', 'ADMIN']),
});

export const setUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'LOCKED', 'DISABLED', 'PENDING_VERIFICATION']),
});

export const analyticsTrendsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(14),
});

export type AdminListUsersQuery = z.infer<typeof adminListUsersQuerySchema>;
export type SetUserRoleBody = z.infer<typeof setUserRoleSchema>;
export type SetUserStatusBody = z.infer<typeof setUserStatusSchema>;
