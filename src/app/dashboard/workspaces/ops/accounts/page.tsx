import PageContainer from '@/components/layout/page-container';
import { AccountsManagementClient } from '@/features/management/components/accounts-management-client';
import { hasPermission } from '@/lib/auth/permission';
import { requirePagePermission } from '@/lib/auth/session';
import { getActiveWorkspaceCookie } from '@/lib/auth/workspace';
import {
  listManagedAccountsPage,
  listManagedPlatforms,
  listManagedRegistrationSources
} from '@/lib/account-management/service';
import { actionPermissionCode, menuPermissionCode } from '@/lib/platform/rbac';

export default async function OpsAccountsPage() {
  const cookieWorkspaceId = await getActiveWorkspaceCookie();
  const session = await requirePagePermission(
    menuPermissionCode('dashboard', 'ops', 'accounts'),
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
  const [{ items, pagination }, platforms, registrationSources] =
    activeWorkspaceId
      ? await Promise.all([
          listManagedAccountsPage({
            workspaceId: activeWorkspaceId
          }),
          listManagedPlatforms(activeWorkspaceId),
          listManagedRegistrationSources(activeWorkspaceId)
        ])
      : [{ items: [], pagination: emptyPagination }, [], []];

  return (
    <PageContainer
      pageTitle='账号管理'
      pageDescription='围绕当前工作区统一维护账号、平台、密钥、绑定关系、注册源、密保和财富信息。'
    >
      <AccountsManagementClient
        key={activeWorkspaceId ?? 'no-workspace'}
        initialAccounts={items}
        initialPagination={pagination}
        initialPlatforms={platforms}
        initialRegistrationSources={registrationSources}
        workspaceId={activeWorkspaceId}
        access={{
          canCreate: hasPermission(
            session.user,
            actionPermissionCode('create', 'dashboard', 'ops', 'accounts'),
            activeWorkspaceId
          ),
          canUpdate: hasPermission(
            session.user,
            actionPermissionCode('update', 'dashboard', 'ops', 'accounts'),
            activeWorkspaceId
          ),
          canDelete: hasPermission(
            session.user,
            actionPermissionCode('delete', 'dashboard', 'ops', 'accounts'),
            activeWorkspaceId
          )
        }}
      />
    </PageContainer>
  );
}
