import PageContainer from '@/components/layout/page-container';
import { PermissionsManagementClient } from '@/features/management/components/permissions-management-client';
import { hasPermission } from '@/lib/auth/permission';
import { requirePagePermission } from '@/lib/auth/session';
import { getActiveWorkspaceCookie } from '@/lib/auth/workspace';
import { actionPermissionCode, menuPermissionCode } from '@/lib/platform/rbac';
import {
  listPermissionMenuOptions,
  listPermissionTree
} from '@/lib/platform/service';

export default async function PermissionsPage() {
  const cookieWorkspaceId = await getActiveWorkspaceCookie();
  const session = await requirePagePermission(
    menuPermissionCode('dashboard', 'workspaces', 'permissions'),
    cookieWorkspaceId
  );
  const activeWorkspaceId =
    cookieWorkspaceId || session.user.defaultWorkspaceId || undefined;
  const [permissionTree, menuOptions] = await Promise.all([
    listPermissionTree('workspace'),
    listPermissionMenuOptions('workspace')
  ]);

  return (
    <PageContainer
      pageTitle='权限管理'
      pageDescription='权限树按菜单目录和页面动作展开，可在这里维护最小功能权限。'
    >
      <PermissionsManagementClient
        key={activeWorkspaceId ?? 'no-workspace'}
        initialPermissionTree={permissionTree}
        menuOptions={menuOptions}
        workspaceId={activeWorkspaceId}
        access={{
          canCreate: hasPermission(
            session.user,
            actionPermissionCode(
              'create',
              'dashboard',
              'workspaces',
              'permissions'
            ),
            activeWorkspaceId
          ),
          canUpdate: hasPermission(
            session.user,
            actionPermissionCode(
              'update',
              'dashboard',
              'workspaces',
              'permissions'
            ),
            activeWorkspaceId
          ),
          canDelete: hasPermission(
            session.user,
            actionPermissionCode(
              'delete',
              'dashboard',
              'workspaces',
              'permissions'
            ),
            activeWorkspaceId
          )
        }}
      />
    </PageContainer>
  );
}
