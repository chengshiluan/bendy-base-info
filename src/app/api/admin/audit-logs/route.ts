import { NextResponse } from 'next/server';
import { requireManagerApi } from '@/lib/auth/api-guard';
import { getSearchParam } from '@/lib/platform/api';
import { listAuditLogs } from '@/lib/platform/service';

export async function GET(request: Request) {
  const workspaceId = getSearchParam(request, 'workspaceId');
  const limit = Number(getSearchParam(request, 'limit') ?? '10');
  const { response } = await requireManagerApi(workspaceId);

  if (response) {
    return response;
  }

  const auditLogs = await listAuditLogs(
    workspaceId,
    Number.isFinite(limit) && limit > 0 ? limit : 10
  );

  return NextResponse.json({ auditLogs });
}
