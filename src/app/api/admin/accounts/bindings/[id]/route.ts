import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import {
  deleteManagedAccountBinding,
  updateManagedAccountBinding
} from '@/lib/account-management/mutations';
import { accountBindingPayloadSchema } from '@/lib/account-management/validators';
import {
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { actionPermissionCode } from '@/lib/platform/rbac';
import { PlatformMutationError } from '@/lib/platform/mutations';

function parseBindingId(value: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new PlatformMutationError('绑定关系ID无效。');
  }

  return parsed;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const workspaceId = getSearchParam(request, 'workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ message: '缺少工作区ID。' }, { status: 400 });
  }
  const body = await parseJsonRequest<unknown>(request);
  const parsed = accountBindingPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '绑定关系表单校验失败。' },
      { status: 400 }
    );
  }

  const { session, response } = await requireApiPermission(
    actionPermissionCode('update', 'dashboard', 'ops', 'accounts'),
    workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const account = await updateManagedAccountBinding(
      parseBindingId(routeParams.id),
      session.user.id,
      workspaceId,
      parsed.data
    );
    return NextResponse.json({ account });
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
  if (!workspaceId) {
    return NextResponse.json({ message: '缺少工作区ID。' }, { status: 400 });
  }
  const { session, response } = await requireApiPermission(
    actionPermissionCode('delete', 'dashboard', 'ops', 'accounts'),
    workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const account = await deleteManagedAccountBinding(
      parseBindingId(routeParams.id),
      session.user.id,
      workspaceId
    );
    return NextResponse.json({ success: true, account });
  } catch (error) {
    return handlePlatformError(error);
  }
}
