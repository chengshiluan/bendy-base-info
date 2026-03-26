import PageContainer from '@/components/layout/page-container';
import { NotificationsManagementClient } from '@/features/management/components/notifications-management-client';
import { hasPermission } from '@/lib/auth/permission';
import { requirePagePermission } from '@/lib/auth/session';
import { getActiveWorkspaceCookie } from '@/lib/auth/workspace';
import {
  listAdminNotificationsPage,
  listWorkspaceMemberOptions
} from '@/lib/platform/service';
import { actionPermissionCode, menuPermissionCode } from '@/lib/platform/rbac';

export default async function WorkspaceNotificationsPage() {
  const cookieWorkspaceId = await getActiveWorkspaceCookie();
  const session = await requirePagePermission(
    menuPermissionCode('dashboard', 'workspaces', 'notifications'),
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
        listAdminNotificationsPage({ workspaceId: activeWorkspaceId }),
        listWorkspaceMemberOptions(activeWorkspaceId)
      ])
    : [{ items: [], pagination: emptyPagination }, []];

  return (
    <PageContainer
      pageTitle='站内消息'
      pageDescription='这里承载系统通知、运维提醒与重要变更提醒。'
    >
      <NotificationsManagementClient
        key={activeWorkspaceId ?? 'no-workspace'}
        initialNotifications={items}
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
              'notifications'
            ),
            activeWorkspaceId
          ),
          canUpdate: hasPermission(
            session.user,
            actionPermissionCode(
              'update',
              'dashboard',
              'workspaces',
              'notifications'
            ),
            activeWorkspaceId
          ),
          canRead: hasPermission(
            session.user,
            actionPermissionCode(
              'read',
              'dashboard',
              'workspaces',
              'notifications'
            ),
            activeWorkspaceId
          ),
          canDelete: hasPermission(
            session.user,
            actionPermissionCode(
              'delete',
              'dashboard',
              'workspaces',
              'notifications'
            ),
            activeWorkspaceId
          )
        }}
      />
    </PageContainer>
  );
}
