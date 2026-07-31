import { describe, expect, it } from 'vitest';
import { buildPaginationMeta, resolvePagination } from '@secureauthx/shared';

describe('resolvePagination', () => {
  it('applies defaults', () => {
    const p = resolvePagination({});
    expect(p.page).toBe(1);
    expect(p.skip).toBe(0);
    expect(p.take).toBeGreaterThan(0);
  });

  it('clamps page size to the configured maximum', () => {
    const p = resolvePagination({ pageSize: 100_000 });
    expect(p.take).toBeLessThanOrEqual(100);
  });

  it('rejects non-positive values with defaults', () => {
    const p = resolvePagination({ page: 0, pageSize: -5 });
    expect(p.page).toBe(1);
    expect(p.take).toBeGreaterThan(0);
  });

  it('computes skip from page', () => {
    const p = resolvePagination({ page: 3, pageSize: 20 });
    expect(p.skip).toBe(40);
    expect(p.take).toBe(20);
  });
});

describe('buildPaginationMeta', () => {
  it('builds a correct meta block', () => {
    const meta = buildPaginationMeta(1, 10, 25);
    expect(meta.totalItems).toBe(25);
    expect(meta.totalPages).toBe(3);
    expect(meta.hasNextPage).toBe(true);
    expect(meta.hasPreviousPage).toBe(false);
  });

  it('handles the last page and empty data', () => {
    expect(buildPaginationMeta(3, 10, 25).hasNextPage).toBe(false);
    expect(buildPaginationMeta(1, 10, 0).totalPages).toBe(0);
  });
});
