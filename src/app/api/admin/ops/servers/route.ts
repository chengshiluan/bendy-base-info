import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import { createOpsServer } from '@/lib/server-management/mutations';
import { listOpsServers } from '@/lib/server-management/service';
import { serverPayloadSchema } from '@/lib/server-management/validators';
import type { OpsServerStatus } from '@/lib/server-management/types';
import {
  getPaginationParams,
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { actionPermissionCode, menuPermissionCode } from '@/lib/platform/rbac';

export async function GET(request: Request) {
  const workspaceId = getSearchParam(request, 'workspaceId');
  const { response } = await requireApiPermission(
    menuPermissionCode('dashboard', 'ops', 'servers'),
    workspaceId
  );
  if (response) return response;

  const { page, pageSize } = getPaginationParams(request);
  const search = getSearchParam(request, 'search');
  const status = getSearchParam(request, 'status');

  const result = await listOpsServers({
    workspaceId,
    page,
    pageSize,
    search,
    status: status as OpsServerStatus | 'all' | undefined
  });
  return NextResponse.json({ servers: result.items, pagination: result.pagination });
}

export async function POST(request: Request) {
  const body = await parseJsonRequest<unknown>(request);
  const parsed = serverPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: '服务器表单校验失败。', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { session, response } = await requireApiPermission(
    actionPermissionCode('create', 'dashboard', 'ops', 'servers'),
    parsed.data.workspaceId
  );
  if (response || !session) return response;

  try {
    const server = await createOpsServer(session.user.id, parsed.data);
    return NextResponse.json({ server });
  } catch (error) {
    return handlePlatformError(error);
  }
}
