import PageContainer from '@/components/layout/page-container';
import { TicketKanbanClient } from '@/features/management/components/ticket-kanban-client';
import { requireSession } from '@/lib/auth/session';
import { getActiveWorkspaceCookie } from '@/lib/auth/workspace';
import { listTickets } from '@/lib/platform/service';

export const metadata = {
  title: 'Dashboard : Kanban'
};

export default async function KanbanPage() {
  const session = await requireSession();
  const activeWorkspaceId =
    (await getActiveWorkspaceCookie()) ||
    session.user.defaultWorkspaceId ||
    undefined;
  const tickets = await listTickets(activeWorkspaceId);

  return (
    <PageContainer
      pageTitle='看板'
      pageDescription='直接基于工单数据拖拽状态，和工单系统保持同一套流转。'
    >
      <TicketKanbanClient
        initialTickets={tickets}
        workspaceId={activeWorkspaceId}
      />
    </PageContainer>
  );
}
