import { NextResponse } from 'next/server';
import { requireManagerApi } from '@/lib/auth/api-guard';
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

  const { session, response } = await requireManagerApi(
    parsed.data.workspaceId ?? undefined
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

  const { session, response } = await requireManagerApi(workspaceId);

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
  const { session, response } = await requireManagerApi(workspaceId);

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
