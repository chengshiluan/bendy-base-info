import PageContainer from '@/components/layout/page-container';
import { TicketsManagementClient } from '@/features/management/components/tickets-management-client';
import { requireSession } from '@/lib/auth/session';
import { getActiveWorkspaceCookie } from '@/lib/auth/workspace';
import {
  listTicketsPage,
  listWorkspaceMemberOptions
} from '@/lib/platform/service';

export default async function WorkspaceTicketsPage() {
  const session = await requireSession();
  const activeWorkspaceId =
    (await getActiveWorkspaceCookie()) ||
    session.user.defaultWorkspaceId ||
    undefined;
  const [{ items, pagination }, memberOptions] = await Promise.all([
    listTicketsPage({ workspaceId: activeWorkspaceId }),
    listWorkspaceMemberOptions(activeWorkspaceId)
  ]);

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
      />
    </PageContainer>
  );
}
