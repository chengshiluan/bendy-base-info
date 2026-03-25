import { NextResponse } from 'next/server';
import { requireManagerApi } from '@/lib/auth/api-guard';
import {
  getSearchParam,
  handlePlatformError,
  parseJsonRequest
} from '@/lib/platform/api';
import { deleteTicket, updateTicket } from '@/lib/platform/mutations';
import { ticketPayloadSchema } from '@/lib/platform/validators';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const body = await parseJsonRequest<unknown>(request);
  const parsed = ticketPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '工单表单校验失败。' },
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
    const ticket = await updateTicket(
      routeParams.id,
      session.user.id,
      parsed.data
    );
    return NextResponse.json({ ticket });
  } catch (error) {
    return handlePlatformError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const workspaceId = getSearchParam(request, 'workspaceId');
  const { session, response } = await requireManagerApi(workspaceId);

  if (response || !session) {
    return response;
  }

  try {
    const ticket = await deleteTicket(
      routeParams.id,
      session.user.id,
      workspaceId
    );
    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    return handlePlatformError(error);
  }
}
