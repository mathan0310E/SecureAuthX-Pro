import type {
  AdminUserRow,
  AdminUsersListResponse,
  AnalyticsOverview,
  AnalyticsTrendsResponse,
} from '@secureauthx/types';
import type { AccountStatus, UserRole } from '@secureauthx/types';
import { apiFetch } from './client';

export interface AdminUsersQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: AccountStatus;
}

function toQuery(query: AdminUsersQuery): string {
  const params = new URLSearchParams();
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  if (query.search) params.set('search', query.search);
  if (query.status) params.set('status', query.status);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Administrator endpoints — user lifecycle management and analytics.
 * Callers must be signed in with the ADMIN role (the API enforces this).
 */
export const adminApi = {
  listUsers(query: AdminUsersQuery = {}): Promise<AdminUsersListResponse> {
    return apiFetch<AdminUsersListResponse>(`/api/v1/admin/users${toQuery(query)}`);
  },

  setRole(userId: string, role: UserRole): Promise<{ id: string; email: string; role: UserRole }> {
    return apiFetch(`/api/v1/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: { role },
    });
  },

  setStatus(
    userId: string,
    status: AccountStatus
  ): Promise<{ id: string; email: string; status: AccountStatus }> {
    return apiFetch(`/api/v1/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: { status },
    });
  },

  analyticsOverview(): Promise<AnalyticsOverview> {
    return apiFetch<AnalyticsOverview>('/api/v1/admin/analytics/overview');
  },

  analyticsTrends(days = 14): Promise<AnalyticsTrendsResponse> {
    return apiFetch<AnalyticsTrendsResponse>(`/api/v1/admin/analytics/trends?days=${days}`);
  },
};

export type { AdminUserRow };
