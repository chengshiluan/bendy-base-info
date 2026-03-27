import PageContainer from '@/components/layout/page-container';
import { RolesManagementClient } from '@/features/management/components/roles-management-client';
import { hasPermission } from '@/lib/auth/permission';
import { requirePagePermission } from '@/lib/auth/session';
import { getActiveWorkspaceCookie } from '@/lib/auth/workspace';
import {
  listRolesPage,
  listWorkspacePermissionTree
} from '@/lib/platform/service';
import { actionPermissionCode, menuPermissionCode } from '@/lib/platform/rbac';

export default async function RolesPage() {
  const cookieWorkspaceId = await getActiveWorkspaceCookie();
  const session = await requirePagePermission(
    menuPermissionCode('dashboard', 'workspaces', 'roles'),
    cookieWorkspaceId
  );
  const activeWorkspaceId =
    cookieWorkspaceId || session.user.defaultWorkspaceId || undefined;
  const emptyPagination = {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1
  };
  const [{ items, pagination }, permissionTree] = activeWorkspaceId
    ? await Promise.all([
        listRolesPage({ workspaceId: activeWorkspaceId }),
        listWorkspacePermissionTree()
      ])
    : [{ items: [], pagination: emptyPagination }, []];

  return (
    <PageContainer
      pageTitle='角色管理'
      pageDescription='角色挂在工作区下，并通过权限集合控制页面与按钮访问。'
    >
      <RolesManagementClient
        key={activeWorkspaceId ?? 'no-workspace'}
        initialRoles={items}
        initialPagination={pagination}
        workspaceId={activeWorkspaceId}
        permissionTree={permissionTree}
        access={{
          canCreate: hasPermission(
            session.user,
            actionPermissionCode('create', 'dashboard', 'workspaces', 'roles'),
            activeWorkspaceId
          ),
          canUpdate: hasPermission(
            session.user,
            actionPermissionCode('update', 'dashboard', 'workspaces', 'roles'),
            activeWorkspaceId
          ),
          canDelete: hasPermission(
            session.user,
            actionPermissionCode('delete', 'dashboard', 'workspaces', 'roles'),
            activeWorkspaceId
          )
        }}
      />
    </PageContainer>
  );
}
