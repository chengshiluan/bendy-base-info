import { NextResponse } from 'next/server';
import { forbidden, requireApiPermission } from '@/lib/auth/api-guard';
import { hasPermission } from '@/lib/auth/permission';
import {
  getPaginationParams,
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { createTicket } from '@/lib/platform/mutations';
import { actionPermissionCode, menuPermissionCode } from '@/lib/platform/rbac';
import { listTicketsPage } from '@/lib/platform/service';
import { ticketPayloadSchema } from '@/lib/platform/validators';

export async function GET(request: Request) {
  const workspaceId = getSearchParam(request, 'workspaceId');
  const { response } = await requireApiPermission(
    menuPermissionCode('dashboard', 'workspaces', 'tickets'),
    workspaceId
  );

  if (response) {
    return response;
  }

  const { page, pageSize } = getPaginationParams(request);
  const search = getSearchParam(request, 'search');
  const filter = getSearchParam(request, 'filter') as
    | 'all'
    | 'open'
    | 'in_progress'
    | 'resolved'
    | 'closed'
    | undefined;
  const { items, pagination } = await listTicketsPage({
    workspaceId,
    search,
    filter,
    page,
    pageSize
  });

  return NextResponse.json({ tickets: items, pagination });
}

export async function POST(request: Request) {
  const body = await parseJsonRequest<unknown>(request);
  const parsed = ticketPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '工单表单校验失败。' },
      { status: 400 }
    );
  }

  const { session, response } = await requireApiPermission(
    actionPermissionCode('create', 'dashboard', 'workspaces', 'tickets'),
    parsed.data.workspaceId
  );

  if (response || !session) {
    return response;
  }

  if (
    parsed.data.assigneeId &&
    !hasPermission(
      session.user,
      actionPermissionCode('assign', 'dashboard', 'workspaces', 'tickets'),
      parsed.data.workspaceId
    )
  ) {
    return forbidden('当前没有在创建时分配负责人的权限。');
  }

  try {
    const ticket = await createTicket(session.user.id, parsed.data);
    return NextResponse.json({ ticket });
  } catch (error) {
    return handlePlatformError(error);
  }
}
