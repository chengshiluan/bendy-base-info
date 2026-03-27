import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import { handlePlatformError, parseJsonRequest } from '@/lib/platform/api';
import { archiveWorkspace, updateWorkspace } from '@/lib/platform/mutations';
import { actionPermissionCode } from '@/lib/platform/rbac';
import { workspacePayloadSchema } from '@/lib/platform/validators';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const body = await parseJsonRequest<unknown>(request);
  const parsed = workspacePayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '工作区表单校验失败。' },
      { status: 400 }
    );
  }

  const { session, response } = await requireApiPermission(
    actionPermissionCode('update', 'dashboard', 'workspaces', 'manage')
  );

  if (response || !session) {
    return response;
  }

  try {
    const workspace = await updateWorkspace(
      routeParams.id,
      session.user.id,
      parsed.data
    );
    return NextResponse.json({ workspace });
  } catch (error) {
    return handlePlatformError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const { session, response } = await requireApiPermission(
    actionPermissionCode('archive', 'dashboard', 'workspaces', 'manage')
  );

  if (response || !session) {
    return response;
  }

  try {
    const workspace = await archiveWorkspace(routeParams.id, session.user.id);
    return NextResponse.json({ success: true, workspace });
  } catch (error) {
    return handlePlatformError(error);
  }
}
