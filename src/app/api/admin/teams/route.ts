import { NextResponse } from 'next/server';
import { requireManagerApi } from '@/lib/auth/api-guard';
import {
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { createTeam } from '@/lib/platform/mutations';
import { listTeams } from '@/lib/platform/service';
import { teamPayloadSchema } from '@/lib/platform/validators';

export async function GET(request: Request) {
  const workspaceId = getSearchParam(request, 'workspaceId');
  const { response } = await requireManagerApi(workspaceId);

  if (response) {
    return response;
  }

  const teams = await listTeams(workspaceId);
  return NextResponse.json({ teams });
}

export async function POST(request: Request) {
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
    const team = await createTeam(session.user.id, parsed.data);
    return NextResponse.json({ team });
  } catch (error) {
    return handlePlatformError(error);
  }
}
