import { NextResponse } from 'next/server';
import {
  canAccessWorkspace,
  forbidden,
  requireApiPermission,
  requireApiSession
} from '@/lib/auth/api-guard';
import { hasPermission } from '@/lib/auth/permission';
import {
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { deleteTicket, updateTicket } from '@/lib/platform/mutations';
import { actionPermissionCode } from '@/lib/platform/rbac';
import { listTickets } from '@/lib/platform/service';
import { ticketPayloadSchema } from '@/lib/platform/validators';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const body = await parseJsonRequest<unknown>(request);
  const parsed = ticketPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '工单表单校验失败。' },
      { status: 400 }
    );
  }

  const { session, response } = await requireApiSession();

  if (response || !session) {
    return response;
  }

  if (!canAccessWorkspace(session, parsed.data.workspaceId)) {
    return forbidden('你无法访问当前工作区。');
  }

  const workspaceId = parsed.data.workspaceId;
  const canUpdateTicket = hasPermission(
    session.user,
    actionPermissionCode('update', 'dashboard', 'workspaces', 'tickets'),
    workspaceId
  );
  const canAssignTicket = hasPermission(
    session.user,
    actionPermissionCode('assign', 'dashboard', 'workspaces', 'tickets'),
    workspaceId
  );
  const canUpdateKanban = hasPermission(
    session.user,
    actionPermissionCode('update', 'dashboard', 'workspaces', 'kanban'),
    workspaceId
  );

  if (!canUpdateTicket && !canAssignTicket && !canUpdateKanban) {
    return forbidden('当前没有更新工单的权限。');
  }

  const currentTicket = (await listTickets(workspaceId)).find(
    (ticket) => ticket.id === routeParams.id
  );

  if (!currentTicket) {
    return NextResponse.json({ message: '工单不存在。' }, { status: 404 });
  }

  const nextDescription = parsed.data.description ?? null;
  const nextAssigneeId = parsed.data.assigneeId ?? null;
  const needsContentUpdate =
    currentTicket.title !== parsed.data.title.trim() ||
    (currentTicket.description ?? null) !== nextDescription ||
    currentTicket.priority !== parsed.data.priority;
  const needsStatusUpdate = currentTicket.status !== parsed.data.status;
  const needsAssignUpdate =
    (currentTicket.assigneeId ?? null) !== nextAssigneeId;

  if (needsContentUpdate && !canUpdateTicket) {
    return forbidden('当前没有编辑工单内容的权限。');
  }

  if (needsAssignUpdate && !canAssignTicket) {
    return forbidden('当前没有分配工单负责人的权限。');
  }

  if (needsStatusUpdate && !canUpdateTicket && !canUpdateKanban) {
    return forbidden('当前没有更新工单状态的权限。');
  }

  try {
    const ticket = await updateTicket(
      routeParams.id,
      session.user.id,
      parsed.data
    );
    return NextResponse.json({ ticket });
  } catch (error) {
    return handlePlatformError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const workspaceId = getSearchParam(request, 'workspaceId');
  const { session, response } = await requireApiPermission(
    actionPermissionCode('delete', 'dashboard', 'workspaces', 'tickets'),
    workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const ticket = await deleteTicket(
      routeParams.id,
      session.user.id,
      workspaceId
    );
    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    return handlePlatformError(error);
  }
}
