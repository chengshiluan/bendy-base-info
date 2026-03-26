import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import {
  getPaginationParams,
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { createRole } from '@/lib/platform/mutations';
import { actionPermissionCode, menuPermissionCode } from '@/lib/platform/rbac';
import { listRolesPage } from '@/lib/platform/service';
import { rolePayloadSchema } from '@/lib/platform/validators';

export async function GET(request: Request) {
  const workspaceId = getSearchParam(request, 'workspaceId');
  const { response } = await requireApiPermission(
    menuPermissionCode('dashboard', 'workspaces', 'roles'),
    workspaceId
  );

  if (response) {
    return response;
  }

  const { page, pageSize } = getPaginationParams(request);
  const search = getSearchParam(request, 'search');
  const { items, pagination } = await listRolesPage({
    workspaceId,
    search,
    page,
    pageSize
  });

  return NextResponse.json({ roles: items, pagination });
}

export async function POST(request: Request) {
  const body = await parseJsonRequest<unknown>(request);
  const parsed = rolePayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '角色表单校验失败。' },
      { status: 400 }
    );
  }

  const { session, response } = await requireApiPermission(
    actionPermissionCode('create', 'dashboard', 'workspaces', 'roles'),
    parsed.data.workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const role = await createRole(session.user.id, parsed.data);
    return NextResponse.json({ role });
  } catch (error) {
    return handlePlatformError(error);
  }
}
