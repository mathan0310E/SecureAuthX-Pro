/**
 * Admin dashboard type contracts (user management + analytics).
 */

import type { AccountStatus, UserRole } from './auth';
import type { PaginationMeta } from './api';

export interface AdminUserRow {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminUsersListResponse {
  items: AdminUserRow[];
  meta: PaginationMeta;
}

export interface AnalyticsOverview {
  users: {
    total: number;
    active: number;
    locked: number;
    disabled: number;
    pendingVerification: number;
    mfaEnabled: number;
    /** Percentage (0-100) of all users with MFA enabled. */
    mfaAdoptionRate: number;
  };
  sessions: {
    active: number;
  };
  activity: {
    auditLogs24h: number;
    auditLogs7d: number;
    securityEvents24h: number;
    securityEvents7d: number;
  };
  generatedAt: string;
}

export interface AnalyticsTrendPoint {
  /** ISO date (yyyy-mm-dd) of the bucket. */
  date: string;
  signups: number;
  logins: number;
  mfaLogins: number;
  securityEvents: number;
}

export interface AnalyticsTrendsResponse {
  points: AnalyticsTrendPoint[];
  days: number;
}
