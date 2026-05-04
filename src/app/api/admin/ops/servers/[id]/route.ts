import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import {
  deleteOpsServer,
  updateOpsServer
} from '@/lib/server-management/mutations';
import { getOpsServerById } from '@/lib/server-management/service';
import { serverUpdatePayloadSchema } from '@/lib/server-management/validators';
import {
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { actionPermissionCode, menuPermissionCode } from '@/lib/platform/rbac';
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

  try {
    const server = await getOpsServerById(parseServerId(id), workspaceId);
    if (!server) {
      return NextResponse.json({ message: '服务器不存在。' }, { status: 404 });
    }
    return NextResponse.json({ server });
  } catch (error) {
    return handlePlatformError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await parseJsonRequest<unknown>(request);
  const parsed = serverUpdatePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: '服务器表单校验失败。', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { session, response } = await requireApiPermission(
    actionPermissionCode('update', 'dashboard', 'ops', 'servers'),
    parsed.data.workspaceId
  );
  if (response || !session) return response;

  try {
    const server = await updateOpsServer(
      session.user.id,
      parseServerId(id),
      parsed.data
    );
    return NextResponse.json({ server });
  } catch (error) {
    return handlePlatformError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const workspaceId = getSearchParam(request, 'workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ message: '缺少工作区ID。' }, { status: 400 });
  }

  const { session, response } = await requireApiPermission(
    actionPermissionCode('delete', 'dashboard', 'ops', 'servers'),
    workspaceId
  );
  if (response || !session) return response;

  try {
    await deleteOpsServer(session.user.id, parseServerId(id), workspaceId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handlePlatformError(error);
  }
}
