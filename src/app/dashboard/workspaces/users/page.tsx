import PageContainer from '@/components/layout/page-container';
import { UsersManagementClient } from '@/features/management/components/users-management-client';
import { hasPermission } from '@/lib/auth/permission';
import { requirePagePermission } from '@/lib/auth/session';
import { getActiveWorkspaceCookie } from '@/lib/auth/workspace';
import { listRoleOptions, listUsersPage } from '@/lib/platform/service';
import {
  actionPermissionCode,
  menuPermissionCode
} from '@/lib/platform/rbac';

export default async function UsersPage() {
  const cookieWorkspaceId = await getActiveWorkspaceCookie();
  const session = await requirePagePermission(
    menuPermissionCode('dashboard', 'workspaces', 'users'),
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
  const [{ items, pagination }, roleOptions] = activeWorkspaceId
    ? await Promise.all([
        listUsersPage({
          workspaceId: activeWorkspaceId
        }),
        listRoleOptions(activeWorkspaceId)
      ])
    : [{ items: [], pagination: emptyPagination }, []];

  return (
    <PageContainer
      pageTitle='用户管理'
      pageDescription='系统用户以 GitHub 用户名为唯一主键，可通过邮箱验证码辅助登录。'
    >
      <UsersManagementClient
        key={activeWorkspaceId ?? 'no-workspace'}
        initialUsers={items}
        initialPagination={pagination}
        workspaceId={activeWorkspaceId}
        roleOptions={roleOptions}
        access={{
          canCreate: hasPermission(
            session.user,
            actionPermissionCode(
              'create',
              'dashboard',
              'workspaces',
              'users'
            ),
            activeWorkspaceId
          ),
          canUpdate: hasPermission(
            session.user,
            actionPermissionCode(
              'update',
              'dashboard',
              'workspaces',
              'users'
            ),
            activeWorkspaceId
          ),
          canDelete: hasPermission(
            session.user,
            actionPermissionCode(
              'delete',
              'dashboard',
              'workspaces',
              'users'
            ),
            activeWorkspaceId
          )
        }}
      />
    </PageContainer>
  );
}
