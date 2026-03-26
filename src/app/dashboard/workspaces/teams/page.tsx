import PageContainer from '@/components/layout/page-container';
import { TeamsManagementClient } from '@/features/management/components/teams-management-client';
import { hasPermission } from '@/lib/auth/permission';
import { requirePagePermission } from '@/lib/auth/session';
import { getActiveWorkspaceCookie } from '@/lib/auth/workspace';
import {
  listTeamsPage,
  listWorkspaceMemberOptions
} from '@/lib/platform/service';
import { actionPermissionCode, menuPermissionCode } from '@/lib/platform/rbac';

export default async function TeamsPage() {
  const cookieWorkspaceId = await getActiveWorkspaceCookie();
  const session = await requirePagePermission(
    menuPermissionCode('dashboard', 'workspaces', 'teams'),
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
  const [{ items, pagination }, memberOptions] = activeWorkspaceId
    ? await Promise.all([
        listTeamsPage({ workspaceId: activeWorkspaceId }),
        listWorkspaceMemberOptions(activeWorkspaceId)
      ])
    : [{ items: [], pagination: emptyPagination }, []];

  return (
    <PageContainer
      pageTitle='团队管理'
      pageDescription='管理当前工作区下的团队分组、负责人和成员规模。'
    >
      <TeamsManagementClient
        key={activeWorkspaceId ?? 'no-workspace'}
        initialTeams={items}
        initialPagination={pagination}
        workspaceId={activeWorkspaceId}
        memberOptions={memberOptions}
        access={{
          canCreate: hasPermission(
            session.user,
            actionPermissionCode('create', 'dashboard', 'workspaces', 'teams'),
            activeWorkspaceId
          ),
          canUpdate: hasPermission(
            session.user,
            actionPermissionCode('update', 'dashboard', 'workspaces', 'teams'),
            activeWorkspaceId
          ),
          canDelete: hasPermission(
            session.user,
            actionPermissionCode('delete', 'dashboard', 'workspaces', 'teams'),
            activeWorkspaceId
          ),
          canImportMembers: hasPermission(
            session.user,
            actionPermissionCode('import', 'dashboard', 'workspaces', 'teams'),
            activeWorkspaceId
          )
        }}
      />
    </PageContainer>
  );
}
