/**
 * Consistent API envelope used across every SecureAuthX Pro endpoint.
 */

export type ApiStatus = 'success' | 'error';

export interface ApiSuccessEnvelope<T = unknown> {
  status: ApiStatus;
  code: string;
  message: string;
  data: T;
  meta?: PaginationMeta;
  requestId?: string;
  timestamp: string;
}

export interface ApiErrorEnvelope {
  status: ApiStatus;
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedData<T> {
  items: T[];
  meta: PaginationMeta;
}

export type PaginatedResponse<T> = ApiSuccessEnvelope<PaginatedData<T>>;
