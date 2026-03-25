'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import type { NavItem } from '@/types';

export function useFilteredNavItems(items: NavItem[]) {
  const { data } = useSession();
  const permissions = useMemo(
    () => data?.user?.permissions ?? [],
    [data?.user?.permissions]
  );
  const role = data?.user?.systemRole;
  const hasWorkspace = Boolean(data?.user?.workspaceIds?.length);
  const hasWildcard = permissions.includes('*');

  return useMemo(() => {
    const canAccess = (item?: NavItem) => {
      if (!item?.access) {
        return true;
      }

      if (item.access.requireWorkspace && !hasWorkspace) {
        return false;
      }

      if (item.access.role && role !== item.access.role && !hasWildcard) {
        return false;
      }

      if (
        item.access.permission &&
        !hasWildcard &&
        !permissions.includes(item.access.permission)
      ) {
        return false;
      }

      return true;
    };

    return items.filter(canAccess).map((item) => ({
      ...item,
      items: item.items?.filter(canAccess) ?? []
    }));
  }, [hasWildcard, hasWorkspace, items, permissions, role]);
}
