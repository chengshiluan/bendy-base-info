import PageContainer from '@/components/layout/page-container';
import { ServersManagementClient } from '@/features/management/components/servers-management-client';
import { hasPermission } from '@/lib/auth/permission';
import { requirePagePermission } from '@/lib/auth/session';
import { getActiveWorkspaceCookie } from '@/lib/auth/workspace';
import { listOpsServers } from '@/lib/server-management/service';
import { actionPermissionCode, menuPermissionCode } from '@/lib/platform/rbac';

export default async function OpsServersPage() {
  const cookieWorkspaceId = await getActiveWorkspaceCookie();
  const session = await requirePagePermission(
    menuPermissionCode('dashboard', 'ops', 'servers'),
    cookieWorkspaceId
  );
  const activeWorkspaceId =
    cookieWorkspaceId || session.user.defaultWorkspaceId || undefined;
  const emptyPagination = { page: 1, pageSize: 20, total: 0, totalPages: 1 };
  const { items, pagination } = activeWorkspaceId
    ? await listOpsServers({ workspaceId: activeWorkspaceId })
    : { items: [], pagination: emptyPagination };

  const canCreate = activeWorkspaceId
    ? hasPermission(
        session.user,
        actionPermissionCode('create', 'dashboard', 'ops', 'servers'),
        activeWorkspaceId
      )
    : false;
  const canUpdate = activeWorkspaceId
    ? hasPermission(
        session.user,
        actionPermissionCode('update', 'dashboard', 'ops', 'servers'),
        activeWorkspaceId
      )
    : false;
  const canDelete = activeWorkspaceId
    ? hasPermission(
        session.user,
        actionPermissionCode('delete', 'dashboard', 'ops', 'servers'),
        activeWorkspaceId
      )
    : false;
  const canCollect = activeWorkspaceId
    ? hasPermission(
        session.user,
        actionPermissionCode('collect', 'dashboard', 'ops', 'servers'),
        activeWorkspaceId
      )
    : false;

  return (
    <PageContainer
      pageTitle='服务器管理'
      pageDescription='登记工作区内的服务器，并通过 SSH 自动采集系统信息。'
    >
      <ServersManagementClient
        key={activeWorkspaceId ?? 'no-workspace'}
        workspaceId={activeWorkspaceId}
        initialServers={items}
        initialPagination={pagination}
        access={{ canCreate, canUpdate, canDelete, canCollect }}
      />
    </PageContainer>
  );
}
