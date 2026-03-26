import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import {
  getPaginationParams,
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { createTeam } from '@/lib/platform/mutations';
import { actionPermissionCode, menuPermissionCode } from '@/lib/platform/rbac';
import { listTeamsPage } from '@/lib/platform/service';
import { teamPayloadSchema } from '@/lib/platform/validators';

export async function GET(request: Request) {
  const workspaceId = getSearchParam(request, 'workspaceId');
  const { response } = await requireApiPermission(
    menuPermissionCode('dashboard', 'workspaces', 'teams'),
    workspaceId
  );

  if (response) {
    return response;
  }

  const { page, pageSize } = getPaginationParams(request);
  const search = getSearchParam(request, 'search');
  const { items, pagination } = await listTeamsPage({
    workspaceId,
    search,
    page,
    pageSize
  });

  return NextResponse.json({ teams: items, pagination });
}

export async function POST(request: Request) {
  const body = await parseJsonRequest<unknown>(request);
  const parsed = teamPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '团队表单校验失败。' },
      { status: 400 }
    );
  }

  const { session, response } = await requireApiPermission(
    actionPermissionCode('create', 'dashboard', 'workspaces', 'teams'),
    parsed.data.workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const team = await createTeam(session.user.id, parsed.data);
    return NextResponse.json({ team });
  } catch (error) {
    return handlePlatformError(error);
  }
}
