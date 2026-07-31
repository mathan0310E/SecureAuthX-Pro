/**
 * Security telemetry type contracts (audit logs + security events).
 */

import type { AuditSeverity } from './auth';

export interface AuditLogEntry {
  id: string;
  action: string;
  severity: AuditSeverity;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface SecurityEventEntry {
  id: string;
  type: string;
  severity: AuditSeverity;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogListResponse {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SecurityEventListResponse {
  items: SecurityEventEntry[];
  total: number;
  page: number;
  pageSize: number;
}
