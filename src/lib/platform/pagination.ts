import type { PaginatedResult } from './types';

export const DEFAULT_PAGE_SIZE = 20;

function clampPositiveInteger(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

export function paginateItems<T>(
  items: T[],
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE
): PaginatedResult<T> {
  const safePageSize = clampPositiveInteger(pageSize);
  const total = items.length;
  const totalPages = total > 0 ? Math.ceil(total / safePageSize) : 1;
  const safePage = Math.min(clampPositiveInteger(page), totalPages);
  const startIndex = (safePage - 1) * safePageSize;

  return {
    items: items.slice(startIndex, startIndex + safePageSize),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages
    }
  };
}
