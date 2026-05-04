import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import { listServerFacts } from '@/lib/server-management/service';
import {
  getPaginationParams,
  getSearchParam,
  handlePlatformError
} from '@/lib/platform/api';
import { menuPermissionCode } from '@/lib/platform/rbac';
import { PlatformMutationError } from '@/lib/platform/mutations';

function parseServerId(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new PlatformMutationError('服务器ID无效。');
  }
  return parsed;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const workspaceId = getSearchParam(request, 'workspaceId');
  const { response } = await requireApiPermission(
    menuPermissionCode('dashboard', 'ops', 'servers'),
    workspaceId
  );
  if (response) return response;

  const { page, pageSize } = getPaginationParams(request);

  try {
    const result = await listServerFacts(parseServerId(id), page, pageSize);
    return NextResponse.json({ facts: result.items, pagination: result.pagination });
  } catch (error) {
    return handlePlatformError(error);
  }
}
