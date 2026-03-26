import PageContainer from '@/components/layout/page-container';
import { TicketsManagementClient } from '@/features/management/components/tickets-management-client';
import { requireSession } from '@/lib/auth/session';
import { getActiveWorkspaceCookie } from '@/lib/auth/workspace';
import {
  listTickets,
  listWorkspaceMemberOptions
} from '@/lib/platform/service';

export default async function WorkspaceTicketsPage() {
  const session = await requireSession();
  const activeWorkspaceId =
    (await getActiveWorkspaceCookie()) ||
    session.user.defaultWorkspaceId ||
    undefined;
  const [tickets, memberOptions] = await Promise.all([
    listTickets(activeWorkspaceId),
    listWorkspaceMemberOptions(activeWorkspaceId)
  ]);

  return (
    <PageContainer
      pageTitle='工单系统'
      pageDescription='工单用于承接日常问题、需求跟踪与内部协作。'
    >
      <TicketsManagementClient
        initialTickets={tickets}
        workspaceId={activeWorkspaceId}
        memberOptions={memberOptions}
      />
    </PageContainer>
  );
}
