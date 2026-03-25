import { NextResponse } from 'next/server';
import { requireManagerApi } from '@/lib/auth/api-guard';
import {
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { addTicketComment } from '@/lib/platform/mutations';
import { listTicketComments } from '@/lib/platform/service';
import { ticketCommentPayloadSchema } from '@/lib/platform/validators';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const workspaceId = getSearchParam(request, 'workspaceId');
  const { response } = await requireManagerApi(workspaceId);

  if (response) {
    return response;
  }

  const comments = await listTicketComments(routeParams.id);
  return NextResponse.json({ comments });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const workspaceId = getSearchParam(request, 'workspaceId');
  const body = await parseJsonRequest<unknown>(request);
  const parsed = ticketCommentPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '评论表单校验失败。' },
      { status: 400 }
    );
  }

  const { session, response } = await requireManagerApi(workspaceId);

  if (response || !session) {
    return response;
  }

  try {
    await addTicketComment(
      routeParams.id,
      session.user.id,
      parsed.data,
      workspaceId
    );
    const comments = await listTicketComments(routeParams.id);
    return NextResponse.json({ comments });
  } catch (error) {
    return handlePlatformError(error);
  }
}
