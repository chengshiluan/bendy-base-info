import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/api-guard';
import { handlePlatformError, parseJsonRequest } from '@/lib/platform/api';
import { importGithubUsersToWorkspace } from '@/lib/platform/mutations';
import { actionPermissionCode } from '@/lib/platform/rbac';
import { githubUserImportPayloadSchema } from '@/lib/platform/validators';

export async function POST(request: Request) {
  const body = await parseJsonRequest<unknown>(request);
  const parsed = githubUserImportPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: 'GitHub 成员导入参数不合法。' },
      { status: 400 }
    );
  }

  const { session, response } = await requireApiPermission(
    actionPermissionCode('import', 'dashboard', 'workspaces', 'teams'),
    parsed.data.workspaceId
  );

  if (response || !session) {
    return response;
  }

  try {
    const importedUsers = await importGithubUsersToWorkspace(
      session.user.id,
      parsed.data
    );
    return NextResponse.json({ importedUsers });
  } catch (error) {
    return handlePlatformError(error);
  }
}
