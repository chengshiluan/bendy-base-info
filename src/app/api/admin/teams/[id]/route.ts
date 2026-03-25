import { NextResponse } from 'next/server';
import { requireManagerApi } from '@/lib/auth/api-guard';
import {
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { deleteTeam, updateTeam } from '@/lib/platform/mutations';
import { teamPayloadSchema } from '@/lib/platform/validators';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const body = await parseJsonRequest<unknown>(request);
  const parsed = teamPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '团队表单校验失败。' },
      { status: 400 }
    );
  }

  const { session, response } = await requireManagerApi(
    parsed.data.workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const team = await updateTeam(routeParams.id, session.user.id, parsed.data);
    return NextResponse.json({ team });
  } catch (error) {
    return handlePlatformError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const workspaceId = getSearchParam(request, 'workspaceId');
  const { session, response } = await requireManagerApi(workspaceId);

  if (response || !session) {
    return response;
  }

  try {
    const team = await deleteTeam(routeParams.id, session.user.id, workspaceId);
    return NextResponse.json({ success: true, team });
  } catch (error) {
    return handlePlatformError(error);
  }
}
