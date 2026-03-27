import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import {
  getPaginationParams,
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { createWorkspace } from '@/lib/platform/mutations';
import { actionPermissionCode, menuPermissionCode } from '@/lib/platform/rbac';
import {
  getWorkspaceSummaryMetrics,
  listWorkspacesPage
} from '@/lib/platform/service';
import { workspacePayloadSchema } from '@/lib/platform/validators';

export async function GET(request: Request) {
  const { session, response } = await requireApiPermission(
    menuPermissionCode('dashboard', 'workspaces', 'manage')
  );

  if (response || !session) {
    return response;
  }

  const { page, pageSize } = getPaginationParams(request);
  const search = getSearchParam(request, 'search');
  const [{ items, pagination }, summary] = await Promise.all([
    listWorkspacesPage({
      userId: session.user.id,
      systemRole: session.user.systemRole,
      search,
      page,
      pageSize
    }),
    getWorkspaceSummaryMetrics(session.user.id, session.user.systemRole)
  ]);

  return NextResponse.json({ workspaces: items, pagination, summary });
}

export async function POST(request: Request) {
  const body = await parseJsonRequest<unknown>(request);
  const parsed = workspacePayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '工作区表单校验失败。' },
      { status: 400 }
    );
  }

  const { session, response } = await requireApiPermission(
    actionPermissionCode('create', 'dashboard', 'workspaces', 'manage')
  );

  if (response || !session) {
    return response;
  }

  try {
    const workspace = await createWorkspace(session.user.id, parsed.data);
    return NextResponse.json({ workspace });
  } catch (error) {
    return handlePlatformError(error);
  }
}
