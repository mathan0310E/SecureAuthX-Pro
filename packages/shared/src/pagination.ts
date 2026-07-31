import { PAGINATION } from '@secureauthx/config';
import type { PaginationMeta } from '@secureauthx/types';

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface ResolvedPagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

/**
 * Parses and clamps raw `page`/`pageSize` query values.
 */
export function resolvePagination(query: PaginationParams): ResolvedPagination {
  const rawPage = query.page ?? PAGINATION.DEFAULT_PAGE;
  const rawPageSize = query.pageSize ?? PAGINATION.DEFAULT_PAGE_SIZE;

  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : PAGINATION.DEFAULT_PAGE;
  const pageSize =
    Number.isInteger(rawPageSize) && rawPageSize > 0
      ? Math.min(rawPageSize, PAGINATION.MAX_PAGE_SIZE)
      : PAGINATION.DEFAULT_PAGE_SIZE;

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

/**
 * Builds the pagination metadata block for API responses.
 */
export function buildPaginationMeta(
  page: number,
  pageSize: number,
  totalItems: number
): PaginationMeta {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
