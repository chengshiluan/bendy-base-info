import { NextResponse } from 'next/server';
import { requireManagerApi } from '@/lib/auth/api-guard';
import {
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { deleteUser, updateUser } from '@/lib/platform/mutations';
import { userPayloadSchema } from '@/lib/platform/validators';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const body = await parseJsonRequest<unknown>(request);
  const parsed = userPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '用户表单校验失败。' },
      { status: 400 }
    );
  }

  const { session, response } = await requireManagerApi(
    parsed.data.workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const user = await updateUser(routeParams.id, session.user.id, parsed.data);
    return NextResponse.json({ user });
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
    const user = await deleteUser(routeParams.id, session.user.id, workspaceId);
    return NextResponse.json({ success: true, user });
  } catch (error) {
    return handlePlatformError(error);
  }
}
