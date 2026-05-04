import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import { getSearchParam, handlePlatformError } from '@/lib/platform/api';
import { menuPermissionCode } from '@/lib/platform/rbac';
import { listPermissionBindings } from '@/lib/platform/service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const workspaceId = getSearchParam(request, 'workspaceId');
  const { response } = await requireApiPermission(
    menuPermissionCode('dashboard', 'workspaces', 'permissions'),
    workspaceId
  );

  if (response) {
    return response;
  }

  if (!workspaceId) {
    return NextResponse.json({ message: '缺少工作区参数。' }, { status: 400 });
  }

  try {
    const roles = await listPermissionBindings(routeParams.id, workspaceId);
    return NextResponse.json({ roles });
  } catch (error) {
    return handlePlatformError(error);
  }
}
