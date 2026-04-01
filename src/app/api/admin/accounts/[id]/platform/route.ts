import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import { bindManagedAccountPrimaryPlatform } from '@/lib/account-management/mutations';
import { accountPrimaryPlatformPayloadSchema } from '@/lib/account-management/validators';
import { handlePlatformError, parseJsonRequest } from '@/lib/platform/api';
import { actionPermissionCode } from '@/lib/platform/rbac';
import { PlatformMutationError } from '@/lib/platform/mutations';

function parseAccountId(value: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new PlatformMutationError('账号ID无效。');
  }

  return parsed;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const body = await parseJsonRequest<unknown>(request);
  const parsed = accountPrimaryPlatformPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '主平台绑定表单校验失败。' },
      { status: 400 }
    );
  }

  const { session, response } = await requireApiPermission(
    actionPermissionCode('update', 'dashboard', 'ops', 'accounts'),
    parsed.data.workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const account = await bindManagedAccountPrimaryPlatform(
      parseAccountId(routeParams.id),
      session.user.id,
      parsed.data
    );
    return NextResponse.json({ account });
  } catch (error) {
    return handlePlatformError(error);
  }
}
