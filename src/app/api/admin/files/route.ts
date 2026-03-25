import { NextResponse } from 'next/server';
import { requireManagerApi } from '@/lib/auth/api-guard';
import { getSearchParam } from '@/lib/platform/api';
import { listFilesByEntity } from '@/lib/platform/service';

export async function GET(request: Request) {
  const workspaceId = getSearchParam(request, 'workspaceId');
  const entityType = getSearchParam(request, 'entityType');
  const entityId = getSearchParam(request, 'entityId');
  const { response } = await requireManagerApi(workspaceId);

  if (response) {
    return response;
  }

  if (
    !entityId ||
    !entityType ||
    !['ticket', 'ticket_comment', 'workspace', 'general'].includes(entityType)
  ) {
    return NextResponse.json(
      { message: '附件查询参数无效。' },
      { status: 400 }
    );
  }

  const files = await listFilesByEntity(
    entityType as 'ticket' | 'ticket_comment' | 'workspace' | 'general',
    entityId
  );

  return NextResponse.json({ files });
}
