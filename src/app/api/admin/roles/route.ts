import { NextResponse } from 'next/server';
import { requireManagerApi } from '@/lib/auth/api-guard';
import {
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { createRole } from '@/lib/platform/mutations';
import { listRoles } from '@/lib/platform/service';
import { rolePayloadSchema } from '@/lib/platform/validators';

export async function GET(request: Request) {
  const workspaceId = getSearchParam(request, 'workspaceId');
  const { response } = await requireManagerApi(workspaceId);

  if (response) {
    return response;
  }

  const roles = await listRoles(workspaceId);
  return NextResponse.json({ roles });
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

  const { session, response } = await requireManagerApi(
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
