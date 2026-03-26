import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import {
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import {
  deleteNotification,
  setNotificationReadState,
  updateNotification
} from '@/lib/platform/mutations';
import {
  notificationPayloadSchema,
  notificationReadPayloadSchema
} from '@/lib/platform/validators';
import { actionPermissionCode } from '@/lib/platform/rbac';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
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
    actionPermissionCode('update', 'dashboard', 'workspaces', 'notifications'),
    workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const notification = await updateNotification(
      routeParams.id,
      session.user.id,
      parsed.data
    );
    return NextResponse.json({ notification });
  } catch (error) {
    return handlePlatformError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const body = await parseJsonRequest<unknown>(request);
  const parsed = notificationReadPayloadSchema.safeParse(body);
  const workspaceId = getSearchParam(request, 'workspaceId');

  if (!parsed.success) {
    return NextResponse.json(
      { message: '通知状态校验失败。' },
      { status: 400 }
    );
  }

  const { session, response } = await requireApiPermission(
    actionPermissionCode('read', 'dashboard', 'workspaces', 'notifications'),
    workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const notification = await setNotificationReadState(
      routeParams.id,
      session.user.id,
      parsed.data.isRead,
      workspaceId
    );
    return NextResponse.json({ notification });
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
    actionPermissionCode('delete', 'dashboard', 'workspaces', 'notifications'),
    workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const notification = await deleteNotification(
      routeParams.id,
      session.user.id,
      workspaceId
    );
    return NextResponse.json({ success: true, notification });
  } catch (error) {
    return handlePlatformError(error);
  }
}
