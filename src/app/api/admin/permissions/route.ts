import { NextResponse } from 'next/server';
import { requireManagerApi } from '@/lib/auth/api-guard';
import { handlePlatformError, parseJsonRequest } from '@/lib/platform/api';
import { createPermission } from '@/lib/platform/mutations';
import { listPermissions } from '@/lib/platform/service';
import { permissionPayloadSchema } from '@/lib/platform/validators';

export async function GET() {
  const { response } = await requireManagerApi();

  if (response) {
    return response;
  }

  const permissions = await listPermissions();
  return NextResponse.json({ permissions });
}

export async function POST(request: Request) {
  const body = await parseJsonRequest<unknown>(request);
  const parsed = permissionPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '权限表单校验失败。' },
      { status: 400 }
    );
  }

  const { session, response } = await requireManagerApi();

  if (response || !session) {
    return response;
  }

  try {
    const permission = await createPermission(session.user.id, parsed.data);
    return NextResponse.json({ permission });
  } catch (error) {
    return handlePlatformError(error);
  }
}
