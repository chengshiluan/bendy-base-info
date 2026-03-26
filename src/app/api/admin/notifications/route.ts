import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import {
  getPaginationParams,
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { createNotification } from '@/lib/platform/mutations';
import { actionPermissionCode, menuPermissionCode } from '@/lib/platform/rbac';
import { listAdminNotificationsPage } from '@/lib/platform/service';
import { notificationPayloadSchema } from '@/lib/platform/validators';

export async function GET(request: Request) {
  const workspaceId = getSearchParam(request, 'workspaceId');
  const { response } = await requireApiPermission(
    menuPermissionCode('dashboard', 'workspaces', 'notifications'),
    workspaceId
  );

  if (response) {
    return response;
  }

  const { page, pageSize } = getPaginationParams(request);
  const search = getSearchParam(request, 'search');
  const filter = getSearchParam(request, 'filter') as
    | 'all'
    | 'unread'
    | 'read'
    | undefined;
  const { items, pagination } = await listAdminNotificationsPage({
    workspaceId,
    search,
    filter,
    page,
    pageSize
  });

  return NextResponse.json({ notifications: items, pagination });
}

export async function POST(request: Request) {
  const body = await parseJsonRequest<unknown>(request);
  const parsed = notificationPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '通知表单校验失败。' },
      { status: 400 }
    );
  }

  const workspaceId =
    getSearchParam(request, 'workspaceId') ??
    parsed.data.workspaceId ??
    undefined;
  const { session, response } = await requireApiPermission(
    actionPermissionCode('create', 'dashboard', 'workspaces', 'notifications'),
    workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const notification = await createNotification(session.user.id, parsed.data);
    return NextResponse.json({ notification });
  } catch (error) {
    return handlePlatformError(error);
  }
}
