import PageContainer from '@/components/layout/page-container';
import { PermissionsManagementClient } from '@/features/management/components/permissions-management-client';
import { hasPermission } from '@/lib/auth/permission';
import { requirePagePermission } from '@/lib/auth/session';
import { getActiveWorkspaceCookie } from '@/lib/auth/workspace';
import { actionPermissionCode, menuPermissionCode } from '@/lib/platform/rbac';
import { listPermissionsPage } from '@/lib/platform/service';

export default async function PermissionsPage() {
  const cookieWorkspaceId = await getActiveWorkspaceCookie();
  const session = await requirePagePermission(
    menuPermissionCode('dashboard', 'workspaces', 'permissions'),
    cookieWorkspaceId
  );
  const activeWorkspaceId =
    cookieWorkspaceId || session.user.defaultWorkspaceId || undefined;
  const { items, pagination } = await listPermissionsPage();

  return (
    <PageContainer
      pageTitle='权限管理'
      pageDescription='权限粒度已经下沉到按钮级，可直接维护编码、模块和动作。'
    >
      <PermissionsManagementClient
        initialPermissions={items}
        initialPagination={pagination}
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
