import PageContainer from '@/components/layout/page-container';
import { NotificationsManagementClient } from '@/features/management/components/notifications-management-client';
import { requireSession } from '@/lib/auth/session';
import { getActiveWorkspaceCookie } from '@/lib/auth/workspace';
import {
  listAdminNotificationsPage,
  listWorkspaceMemberOptions
} from '@/lib/platform/service';

export default async function WorkspaceNotificationsPage() {
  const session = await requireSession();
  const activeWorkspaceId =
    (await getActiveWorkspaceCookie()) ||
    session.user.defaultWorkspaceId ||
    undefined;
  const [{ items, pagination }, memberOptions] = await Promise.all([
    listAdminNotificationsPage({ workspaceId: activeWorkspaceId }),
    listWorkspaceMemberOptions(activeWorkspaceId)
  ]);

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
      />
    </PageContainer>
  );
}
