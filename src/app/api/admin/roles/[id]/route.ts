import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import {
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { deleteRole, updateRole } from '@/lib/platform/mutations';
import { actionPermissionCode } from '@/lib/platform/rbac';
import { rolePayloadSchema } from '@/lib/platform/validators';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const body = await parseJsonRequest<unknown>(request);
  const parsed = rolePayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '角色表单校验失败。' },
      { status: 400 }
    );
  }

  const { session, response } = await requireApiPermission(
    actionPermissionCode('update', 'dashboard', 'workspaces', 'roles'),
    parsed.data.workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const role = await updateRole(routeParams.id, session.user.id, parsed.data);
    return NextResponse.json({ role });
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
    actionPermissionCode('delete', 'dashboard', 'workspaces', 'roles'),
    workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const role = await deleteRole(routeParams.id, session.user.id, workspaceId);
    return NextResponse.json({ success: true, role });
  } catch (error) {
    return handlePlatformError(error);
  }
}
