import { getPermissionScope } from '@/lib/platform/rbac';

type PermissionAwareUser = {
  systemRole?: 'super_admin' | 'admin' | 'member';
  permissions?: string[];
  workspacePermissions?: Record<string, string[]>;
};

export function normalizeWorkspacePermissionMap(
  value: unknown
): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([workspaceId, permissions]) => [
      workspaceId,
      Array.isArray(permissions)
        ? permissions.filter(
            (permission): permission is string => typeof permission === 'string'
          )
        : []
    ])
  );
}

export function hasPermission(
  user: PermissionAwareUser | null | undefined,
  permissionCode?: string | null,
  workspaceId?: string | null
) {
  if (!permissionCode) {
    return true;
  }

  if (!user) {
    return false;
  }

  const permissions = user.permissions ?? [];
  if (user.systemRole === 'super_admin' || permissions.includes('*')) {
    return true;
  }

  const scope = getPermissionScope(permissionCode);
  if (scope === 'workspace') {
    const workspacePermissions = user.workspacePermissions ?? {};

    if (workspaceId) {
      return (workspacePermissions[workspaceId] ?? []).includes(permissionCode);
    }

    return Object.values(workspacePermissions).some((permissionList) =>
      permissionList.includes(permissionCode)
    );
  }

  return permissions.includes(permissionCode);
}

export function hasAnyPermission(
  user: PermissionAwareUser | null | undefined,
  permissionCodes: Array<string | null | undefined>,
  workspaceId?: string | null
) {
  return permissionCodes.some((permissionCode) =>
    hasPermission(user, permissionCode, workspaceId)
  );
}
