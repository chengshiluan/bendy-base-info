import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import {
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { deletePermission, updatePermission } from '@/lib/platform/mutations';
import { actionPermissionCode } from '@/lib/platform/rbac';
import { permissionPayloadSchema } from '@/lib/platform/validators';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const body = await parseJsonRequest<unknown>(request);
  const parsed = permissionPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '权限表单校验失败。' },
      { status: 400 }
    );
  }

  const workspaceId = getSearchParam(request, 'workspaceId');
  const { session, response } = await requireApiPermission(
    actionPermissionCode('update', 'dashboard', 'workspaces', 'permissions'),
    workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const permission = await updatePermission(
      routeParams.id,
      session.user.id,
      parsed.data
    );
    return NextResponse.json({ permission });
  } catch (error) {
    return handlePlatformError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const workspaceId = getSearchParam(_request, 'workspaceId');
  const { session, response } = await requireApiPermission(
    actionPermissionCode('delete', 'dashboard', 'workspaces', 'permissions'),
    workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const permission = await deletePermission(routeParams.id, session.user.id);
    return NextResponse.json({ success: true, permission });
  } catch (error) {
    return handlePlatformError(error);
  }
}
