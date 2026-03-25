import PageContainer from '@/components/layout/page-container';
import { WorkspacesManagementClient } from '@/features/management/components/workspaces-management-client';
import { requireSession } from '@/lib/auth/session';
import { listWorkspaces } from '@/lib/platform/service';

export default async function WorkspacesPage() {
  const session = await requireSession();
  const workspaces = await listWorkspaces(
    session.user.id,
    session.user.systemRole
  );

  return (
    <PageContainer
      pageTitle='工作区管理'
      pageDescription='查看系统内的工作区、成员规模与团队承载情况，并维护工作区生命周期。'
    >
      <WorkspacesManagementClient
        initialWorkspaces={workspaces}
        canManage={session.user.systemRole === 'super_admin'}
      />
    </PageContainer>
  );
}
