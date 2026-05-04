import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import { triggerCollect } from '@/lib/server-management/mutations';
import { getSearchParam, handlePlatformError } from '@/lib/platform/api';
import { actionPermissionCode } from '@/lib/platform/rbac';
import { PlatformMutationError } from '@/lib/platform/mutations';

function parseServerId(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new PlatformMutationError('服务器ID无效。');
  }
  return parsed;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const workspaceId = getSearchParam(request, 'workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ message: '缺少工作区ID。' }, { status: 400 });
  }

  const { session, response } = await requireApiPermission(
    actionPermissionCode('collect', 'dashboard', 'ops', 'servers'),
    workspaceId
  );
  if (response || !session) return response;

  try {
    await triggerCollect(session.user.id, parseServerId(id), workspaceId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handlePlatformError(error);
  }
}
