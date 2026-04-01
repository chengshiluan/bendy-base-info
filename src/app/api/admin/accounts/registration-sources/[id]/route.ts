import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import {
  deleteManagedRegistrationSource,
  updateManagedRegistrationSource
} from '@/lib/account-management/mutations';
import { getManagedRegistrationSourceById } from '@/lib/account-management/service';
import { registrationSourcePayloadSchema } from '@/lib/account-management/validators';
import {
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { actionPermissionCode, menuPermissionCode } from '@/lib/platform/rbac';
import { PlatformMutationError } from '@/lib/platform/mutations';

function parseSourceId(value: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new PlatformMutationError('注册源ID无效。');
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
    const registrationSource = await getManagedRegistrationSourceById(
      parseSourceId(routeParams.id),
      workspaceId
    );
    return NextResponse.json({ registrationSource });
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
  const parsed = registrationSourcePayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '注册源表单校验失败。' },
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
    const registrationSource = await updateManagedRegistrationSource(
      parseSourceId(routeParams.id),
      session.user.id,
      parsed.data
    );
    return NextResponse.json({ registrationSource });
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
    const registrationSource = await deleteManagedRegistrationSource(
      parseSourceId(routeParams.id),
      session.user.id,
      workspaceId
    );
    return NextResponse.json({ success: true, registrationSource });
  } catch (error) {
    return handlePlatformError(error);
  }
}
