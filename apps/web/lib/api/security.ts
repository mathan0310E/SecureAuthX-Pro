import type { AuditLogListResponse, SecurityEventListResponse } from '@secureauthx/types';
import { apiFetch } from './client';

export interface SecurityFeedQuery {
  page?: number;
  pageSize?: number;
  severity?: 'INFO' | 'WARN' | 'CRITICAL';
  action?: string;
}

function toQuery(query: SecurityFeedQuery): string {
  const params = new URLSearchParams();
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  if (query.severity) params.set('severity', query.severity);
  if (query.action) params.set('action', query.action);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Security telemetry endpoints — the signed-in user's own activity feed.
 */
export const securityApi = {
  listAuditLogs(query: SecurityFeedQuery = {}): Promise<AuditLogListResponse> {
    return apiFetch<AuditLogListResponse>(`/api/v1/security/audit-logs${toQuery(query)}`);
  },

  listSecurityEvents(query: SecurityFeedQuery = {}): Promise<SecurityEventListResponse> {
    return apiFetch<SecurityEventListResponse>(`/api/v1/security/events${toQuery(query)}`);
  },
};
