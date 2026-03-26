'use client';

import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PaginationMeta } from '@/lib/platform/types';

interface ManagementPaginationProps {
  pagination: PaginationMeta;
  pending?: boolean;
  onPageChange: (page: number) => void;
}

export function ManagementPagination({
  pagination,
  pending = false,
  onPageChange
}: ManagementPaginationProps) {
  const { page, total, totalPages } = pagination;
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className='flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between'>
      <div className='text-muted-foreground text-sm'>
        共 {total} 条，当前第 {page} / {totalPages} 页
      </div>
      <div className='flex items-center gap-2'>
        <Button
          variant='outline'
          size='icon'
          aria-label='跳转第一页'
          disabled={pending || !hasPrevious}
          onClick={() => onPageChange(1)}
        >
          <ChevronsLeft className='size-4' />
        </Button>
        <Button
          variant='outline'
          size='sm'
          disabled={pending || !hasPrevious}
          onClick={() => onPageChange(page - 1)}
        >
          上一页
        </Button>
        <Button
          variant='outline'
          size='sm'
          disabled={pending || !hasNext}
          onClick={() => onPageChange(page + 1)}
        >
          下一页
        </Button>
        <Button
          variant='outline'
          size='icon'
          aria-label='跳转最后一页'
          disabled={pending || !hasNext}
          onClick={() => onPageChange(totalPages)}
        >
          <ChevronsRight className='size-4' />
        </Button>
      </div>
    </div>
  );
}
