import PageContainer from '@/components/layout/page-container';
import { TicketKanbanClient } from '@/features/management/components/ticket-kanban-client';
import { hasPermission } from '@/lib/auth/permission';
import { requirePagePermission } from '@/lib/auth/session';
import { getActiveWorkspaceCookie } from '@/lib/auth/workspace';
import { listTickets } from '@/lib/platform/service';
import {
  actionPermissionCode,
  menuPermissionCode
} from '@/lib/platform/rbac';

export const metadata = {
  title: 'Dashboard : Kanban'
};

export default async function WorkspaceKanbanPage() {
  const cookieWorkspaceId = await getActiveWorkspaceCookie();
  const session = await requirePagePermission(
    menuPermissionCode('dashboard', 'workspaces', 'kanban'),
    cookieWorkspaceId
  );
  const activeWorkspaceId =
    cookieWorkspaceId || session.user.defaultWorkspaceId || undefined;
  const tickets = activeWorkspaceId ? await listTickets(activeWorkspaceId) : [];
  const kanbanSnapshotKey = tickets
    .map((ticket) => `${ticket.id}:${ticket.status}:${ticket.updatedAt}`)
    .join('|');

  return (
    <PageContainer
      pageTitle='看板'
      pageDescription='直接基于工单数据拖拽状态，和工单系统保持同一套流转。'
    >
      <TicketKanbanClient
        key={`${activeWorkspaceId ?? 'no-workspace'}:${kanbanSnapshotKey}`}
        initialTickets={tickets}
        workspaceId={activeWorkspaceId}
        canUpdate={hasPermission(
          session.user,
          actionPermissionCode('update', 'dashboard', 'workspaces', 'kanban'),
          activeWorkspaceId
        )}
      />
    </PageContainer>
  );
}
