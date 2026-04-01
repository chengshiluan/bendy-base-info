import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import { createManagedAccountSecurity } from '@/lib/account-management/mutations';
import { accountSecurityPayloadSchema } from '@/lib/account-management/validators';
import {
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { actionPermissionCode } from '@/lib/platform/rbac';
import { PlatformMutationError } from '@/lib/platform/mutations';

function parseAccountId(value: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new PlatformMutationError('账号ID无效。');
  }

  return parsed;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const workspaceId = getSearchParam(request, 'workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ message: '缺少工作区ID。' }, { status: 400 });
  }
  const body = await parseJsonRequest<unknown>(request);
  const parsed = accountSecurityPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '密保表单校验失败。' },
      { status: 400 }
    );
  }

  const { session, response } = await requireApiPermission(
    actionPermissionCode('update', 'dashboard', 'ops', 'accounts'),
    workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const account = await createManagedAccountSecurity(
      parseAccountId(routeParams.id),
      session.user.id,
      workspaceId,
      parsed.data
    );
    return NextResponse.json({ account });
  } catch (error) {
    return handlePlatformError(error);
  }
}
