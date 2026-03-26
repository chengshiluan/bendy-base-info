import PageContainer from '@/components/layout/page-container';
import { TicketsManagementClient } from '@/features/management/components/tickets-management-client';
import { hasPermission } from '@/lib/auth/permission';
import { requirePagePermission } from '@/lib/auth/session';
import { getActiveWorkspaceCookie } from '@/lib/auth/workspace';
import {
  listTicketsPage,
  listWorkspaceMemberOptions
} from '@/lib/platform/service';
import {
  actionPermissionCode,
  menuPermissionCode
} from '@/lib/platform/rbac';

export default async function WorkspaceTicketsPage() {
  const cookieWorkspaceId = await getActiveWorkspaceCookie();
  const session = await requirePagePermission(
    menuPermissionCode('dashboard', 'workspaces', 'tickets'),
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
        listTicketsPage({ workspaceId: activeWorkspaceId }),
        listWorkspaceMemberOptions(activeWorkspaceId)
      ])
    : [{ items: [], pagination: emptyPagination }, []];

  return (
    <PageContainer
      pageTitle='工单系统'
      pageDescription='工单用于承接日常问题、需求跟踪与内部协作。'
    >
      <TicketsManagementClient
        key={activeWorkspaceId ?? 'no-workspace'}
        initialTickets={items}
        initialPagination={pagination}
        workspaceId={activeWorkspaceId}
        memberOptions={memberOptions}
        access={{
          canCreate: hasPermission(
            session.user,
            actionPermissionCode(
              'create',
              'dashboard',
              'workspaces',
              'tickets'
            ),
            activeWorkspaceId
          ),
          canUpdate: hasPermission(
            session.user,
            actionPermissionCode(
              'update',
              'dashboard',
              'workspaces',
              'tickets'
            ),
            activeWorkspaceId
          ),
          canDelete: hasPermission(
            session.user,
            actionPermissionCode(
              'delete',
              'dashboard',
              'workspaces',
              'tickets'
            ),
            activeWorkspaceId
          ),
          canAssign: hasPermission(
            session.user,
            actionPermissionCode(
              'assign',
              'dashboard',
              'workspaces',
              'tickets'
            ),
            activeWorkspaceId
          ),
          canComment: hasPermission(
            session.user,
            actionPermissionCode(
              'comment',
              'dashboard',
              'workspaces',
              'tickets'
            ),
            activeWorkspaceId
          ),
          canUpload: hasPermission(
            session.user,
            actionPermissionCode(
              'upload',
              'dashboard',
              'workspaces',
              'tickets'
            ),
            activeWorkspaceId
          )
        }}
      />
    </PageContainer>
  );
}
