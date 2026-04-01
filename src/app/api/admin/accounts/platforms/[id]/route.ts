import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import {
  deleteManagedPlatform,
  updateManagedPlatform
} from '@/lib/account-management/mutations';
import { getManagedPlatformById } from '@/lib/account-management/service';
import { platformPayloadSchema } from '@/lib/account-management/validators';
import {
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { actionPermissionCode, menuPermissionCode } from '@/lib/platform/rbac';
import { PlatformMutationError } from '@/lib/platform/mutations';

function parsePlatformId(value: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new PlatformMutationError('平台ID无效。');
  }

  return parsed;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const workspaceId = getSearchParam(request, 'workspaceId');
  const { response } = await requireApiPermission(
    menuPermissionCode('dashboard', 'ops', 'accounts'),
    workspaceId
  );

  if (response) {
    return response;
  }

  try {
    const platform = await getManagedPlatformById(
      parsePlatformId(routeParams.id),
      workspaceId
    );
    return NextResponse.json({ platform });
  } catch (error) {
    return handlePlatformError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const body = await parseJsonRequest<unknown>(request);
  const parsed = platformPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '平台表单校验失败。' },
      { status: 400 }
    );
  }

  const { session, response } = await requireApiPermission(
    actionPermissionCode('update', 'dashboard', 'ops', 'accounts'),
    parsed.data.workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const platform = await updateManagedPlatform(
      parsePlatformId(routeParams.id),
      session.user.id,
      parsed.data
    );
    return NextResponse.json({ platform });
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
    const platform = await deleteManagedPlatform(
      parsePlatformId(routeParams.id),
      session.user.id,
      workspaceId
    );
    return NextResponse.json({ success: true, platform });
  } catch (error) {
    return handlePlatformError(error);
  }
}
