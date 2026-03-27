import PageContainer from '@/components/layout/page-container';
import { WorkspacesManagementClient } from '@/features/management/components/workspaces-management-client';
import { hasPermission } from '@/lib/auth/permission';
import { requirePagePermission } from '@/lib/auth/session';
import { actionPermissionCode, menuPermissionCode } from '@/lib/platform/rbac';
import {
  getWorkspaceSummaryMetrics,
  listWorkspacesPage
} from '@/lib/platform/service';

export default async function WorkspacesPage() {
  const session = await requirePagePermission(
    menuPermissionCode('dashboard', 'workspaces', 'manage')
  );
  const [{ items, pagination }, summary] = await Promise.all([
    listWorkspacesPage({
      userId: session.user.id,
      systemRole: session.user.systemRole
    }),
    getWorkspaceSummaryMetrics(session.user.id, session.user.systemRole)
  ]);

  return (
    <PageContainer
      pageTitle='工作区管理'
      pageDescription='查看系统内的工作区、成员规模与团队承载情况，并维护工作区生命周期。'
    >
      <WorkspacesManagementClient
        initialWorkspaces={items}
        initialPagination={pagination}
        initialMetrics={summary}
        access={{
          canCreate: hasPermission(
            session.user,
            actionPermissionCode('create', 'dashboard', 'workspaces', 'manage')
          ),
          canUpdate: hasPermission(
            session.user,
            actionPermissionCode('update', 'dashboard', 'workspaces', 'manage')
          ),
          canArchive: hasPermission(
            session.user,
            actionPermissionCode('archive', 'dashboard', 'workspaces', 'manage')
          )
        }}
      />
    </PageContainer>
  );
}
