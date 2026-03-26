import { NextResponse } from 'next/server';
import { requireManagerApi } from '@/lib/auth/api-guard';
import {
  getPaginationParams,
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { createUser } from '@/lib/platform/mutations';
import { listUsersPage } from '@/lib/platform/service';
import { userPayloadSchema } from '@/lib/platform/validators';

export async function GET(request: Request) {
  const workspaceId = getSearchParam(request, 'workspaceId');
  const { response } = await requireManagerApi(workspaceId);

  if (response) {
    return response;
  }

  const { page, pageSize } = getPaginationParams(request);
  const search = getSearchParam(request, 'search');
  const { items, pagination } = await listUsersPage({
    workspaceId,
    search,
    page,
    pageSize
  });

  return NextResponse.json({ users: items, pagination });
}

export async function POST(request: Request) {
  const body = await parseJsonRequest<unknown>(request);
  const parsed = userPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '用户表单校验失败。' },
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
    const user = await createUser(session.user.id, parsed.data);
    return NextResponse.json({ user });
  } catch (error) {
    return handlePlatformError(error);
  }
}
