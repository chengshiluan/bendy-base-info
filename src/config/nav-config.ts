import { getPermissionScope, navigationPermissionTree } from '@/lib/platform/rbac';
import { NavItem } from '@/types';

function buildNavItems(items: typeof navigationPermissionTree): NavItem[] {
  return items
    .filter((item) => !item.hidden)
    .map((item) => ({
      title: item.title,
      url: item.url,
      icon: item.icon as NavItem['icon'],
      isActive: false,
      access: {
        permission: item.permissionCode,
        requireWorkspace: getPermissionScope(item.permissionCode) === 'workspace'
      },
      items: buildNavItems(item.children)
    }));
}

export function getNavItems(_translate: (key: string) => string): NavItem[] {
  return buildNavItems(navigationPermissionTree);
}
