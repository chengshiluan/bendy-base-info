import PageContainer from '@/components/layout/page-container';
import { UsersManagementClient } from '@/features/management/components/users-management-client';
import { requireSession } from '@/lib/auth/session';
import { getActiveWorkspaceCookie } from '@/lib/auth/workspace';
import { listUsersPage } from '@/lib/platform/service';

export default async function UsersPage() {
  const session = await requireSession();
  const activeWorkspaceId =
    (await getActiveWorkspaceCookie()) ||
    session.user.defaultWorkspaceId ||
    undefined;
  const { items, pagination } = await listUsersPage({
    workspaceId: activeWorkspaceId
  });

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
      />
    </PageContainer>
  );
}
