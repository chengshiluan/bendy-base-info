import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import {
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { createPermission } from '@/lib/platform/mutations';
import { actionPermissionCode, menuPermissionCode } from '@/lib/platform/rbac';
import {
  listPermissionMenuOptions,
  listWorkspacePermissionTree
} from '@/lib/platform/service';
import { permissionPayloadSchema } from '@/lib/platform/validators';

export async function GET(request: Request) {
  const workspaceId = getSearchParam(request, 'workspaceId');
  const { response } = await requireApiPermission(
    menuPermissionCode('dashboard', 'workspaces', 'permissions'),
    workspaceId
  );

  if (response) {
    return response;
  }

  const [permissions, menuOptions] = await Promise.all([
    listWorkspacePermissionTree(),
    listPermissionMenuOptions('workspace')
  ]);

  return NextResponse.json({ permissions, menuOptions });
}

export async function POST(request: Request) {
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
    actionPermissionCode('create', 'dashboard', 'workspaces', 'permissions'),
    workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const permission = await createPermission(session.user.id, parsed.data);
    return NextResponse.json({ permission });
  } catch (error) {
    return handlePlatformError(error);
  }
}
