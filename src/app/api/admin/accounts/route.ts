import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import { createManagedAccount } from '@/lib/account-management/mutations';
import { listManagedAccountsPage } from '@/lib/account-management/service';
import { accountPayloadSchema } from '@/lib/account-management/validators';
import {
  getPaginationParams,
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { actionPermissionCode, menuPermissionCode } from '@/lib/platform/rbac';

export async function GET(request: Request) {
  const workspaceId = getSearchParam(request, 'workspaceId');
  const { response } = await requireApiPermission(
    menuPermissionCode('dashboard', 'ops', 'accounts'),
    workspaceId
  );

  if (response) {
    return response;
  }

  const { page, pageSize } = getPaginationParams(request);
  const search = getSearchParam(request, 'search');
  const status = getSearchParam(request, 'status');
  const attribute = getSearchParam(request, 'attribute');
  const confidence = getSearchParam(request, 'confidence');
  const { items, pagination } = await listManagedAccountsPage({
    workspaceId,
    page,
    pageSize,
    search,
    status: status as 'all' | 'cancelled' | 'available' | 'banned' | undefined,
    attribute: attribute as 'all' | 'self_hosted' | 'third_party' | undefined,
    confidence: confidence as
      | 'all'
      | 'very_high'
      | 'high'
      | 'medium'
      | 'low'
      | undefined
  });

  return NextResponse.json({ accounts: items, pagination });
}

export async function POST(request: Request) {
  const body = await parseJsonRequest<unknown>(request);
  const parsed = accountPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '账号表单校验失败。' },
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
    const account = await createManagedAccount(session.user.id, parsed.data);
    return NextResponse.json({ account });
  } catch (error) {
    return handlePlatformError(error);
  }
}
