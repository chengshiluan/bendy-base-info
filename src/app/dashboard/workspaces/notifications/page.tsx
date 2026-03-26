import PageContainer from '@/components/layout/page-container';
import { NotificationsManagementClient } from '@/features/management/components/notifications-management-client';
import { requireSession } from '@/lib/auth/session';
import { getActiveWorkspaceCookie } from '@/lib/auth/workspace';
import {
  listAdminNotifications,
  listWorkspaceMemberOptions
} from '@/lib/platform/service';

export default async function WorkspaceNotificationsPage() {
  const session = await requireSession();
  const activeWorkspaceId =
    (await getActiveWorkspaceCookie()) ||
    session.user.defaultWorkspaceId ||
    undefined;
  const [notifications, memberOptions] = await Promise.all([
    listAdminNotifications(activeWorkspaceId),
    listWorkspaceMemberOptions(activeWorkspaceId)
  ]);

  return (
    <PageContainer
      pageTitle='站内消息'
      pageDescription='这里承载系统通知、运维提醒与重要变更提醒。'
    >
      <NotificationsManagementClient
        initialNotifications={notifications}
        workspaceId={activeWorkspaceId}
        memberOptions={memberOptions}
      />
    </PageContainer>
  );
}
