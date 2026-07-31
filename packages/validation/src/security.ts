import { z } from 'zod';
import { paginationQuerySchema } from './common';

// ---------------------------------------------------------------------------
// Security telemetry query schemas
// ---------------------------------------------------------------------------

export const auditLogsQuerySchema = paginationQuerySchema.extend({
  severity: z.enum(['INFO', 'WARN', 'CRITICAL']).optional(),
  action: z.string().trim().max(120).optional(),
});

export const securityEventsQuerySchema = paginationQuerySchema.extend({
  severity: z.enum(['INFO', 'WARN', 'CRITICAL']).optional(),
  type: z.string().trim().max(80).optional(),
});

export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;
export type SecurityEventsQuery = z.infer<typeof securityEventsQuerySchema>;
