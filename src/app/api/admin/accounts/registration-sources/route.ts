import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import { createManagedRegistrationSource } from '@/lib/account-management/mutations';
import { listManagedRegistrationSources } from '@/lib/account-management/service';
import { registrationSourcePayloadSchema } from '@/lib/account-management/validators';
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

  const registrationSources = await listManagedRegistrationSources(
    workspaceId,
    search
  );
  return NextResponse.json({ registrationSources });
}

export async function POST(request: Request) {
  const body = await parseJsonRequest<unknown>(request);
  const parsed = registrationSourcePayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '注册源表单校验失败。' },
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
    const registrationSource = await createManagedRegistrationSource(
      session.user.id,
      parsed.data
    );
    return NextResponse.json({ registrationSource });
  } catch (error) {
    return handlePlatformError(error);
  }
}
