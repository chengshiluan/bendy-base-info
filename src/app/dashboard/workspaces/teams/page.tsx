import PageContainer from '@/components/layout/page-container';
import { TeamsManagementClient } from '@/features/management/components/teams-management-client';
import { requireSession } from '@/lib/auth/session';
import { getActiveWorkspaceCookie } from '@/lib/auth/workspace';
import {
  listTeamsPage,
  listWorkspaceMemberOptions
} from '@/lib/platform/service';

export default async function TeamsPage() {
  const session = await requireSession();
  const activeWorkspaceId =
    (await getActiveWorkspaceCookie()) ||
    session.user.defaultWorkspaceId ||
    undefined;
  const [{ items, pagination }, memberOptions] = await Promise.all([
    listTeamsPage({ workspaceId: activeWorkspaceId }),
    listWorkspaceMemberOptions(activeWorkspaceId)
  ]);

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
      />
    </PageContainer>
  );
}
