'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import type { NavItem } from '@/types';
import { hasPermission } from '@/lib/auth/permission';

function readWorkspaceCookie() {
  if (typeof document === 'undefined') {
    return null;
  }

  const target = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('active_workspace_id='));

  return target ? decodeURIComponent(target.split('=')[1]) : null;
}

export function useFilteredNavItems(items: NavItem[]) {
  const { data } = useSession();
  const user = data?.user;
  const hasWorkspace = Boolean(data?.user?.workspaceIds?.length);
  const activeWorkspaceId = readWorkspaceCookie();

  return useMemo(() => {
    const canAccess = (item?: NavItem) => {
      if (!item?.access) {
        return true;
      }

      if (item.access.requireWorkspace && !hasWorkspace) {
        return false;
      }

      if (item.access.role && user?.systemRole !== item.access.role) {
        return false;
      }

      if (!user) {
        return false;
      }

      if (
        item.access.permission &&
        !hasPermission(user, item.access.permission, activeWorkspaceId)
      ) {
        return false;
      }

      return true;
    };

    return items.filter(canAccess).map((item) => ({
      ...item,
      items: item.items?.filter(canAccess) ?? []
    }));
  }, [activeWorkspaceId, hasWorkspace, items, user]);
}
