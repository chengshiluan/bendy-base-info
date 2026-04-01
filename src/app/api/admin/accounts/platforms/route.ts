import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import { createManagedPlatform } from '@/lib/account-management/mutations';
import { listManagedPlatforms } from '@/lib/account-management/service';
import { platformPayloadSchema } from '@/lib/account-management/validators';
import {
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { actionPermissionCode, menuPermissionCode } from '@/lib/platform/rbac';

export async function GET(request: Request) {
  const workspaceId = getSearchParam(request, 'workspaceId');
  const search = getSearchParam(request, 'search');
  const { response } = await requireApiPermission(
    menuPermissionCode('dashboard', 'ops', 'accounts'),
    workspaceId
  );

  if (response) {
    return response;
  }

  const platforms = await listManagedPlatforms(workspaceId, search);
  return NextResponse.json({ platforms });
}

export async function POST(request: Request) {
  const body = await parseJsonRequest<unknown>(request);
  const parsed = platformPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '平台表单校验失败。' },
      { status: 400 }
    );
  }

  const { session, response } = await requireApiPermission(
    actionPermissionCode('create', 'dashboard', 'ops', 'accounts'),
    parsed.data.workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const platform = await createManagedPlatform(session.user.id, parsed.data);
    return NextResponse.json({ platform });
  } catch (error) {
    return handlePlatformError(error);
  }
}
