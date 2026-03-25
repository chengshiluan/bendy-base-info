import { db, schema } from '@/lib/db';

interface RecordAuditLogParams {
  workspaceId?: string | null;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}

export async function recordAuditLog({
  workspaceId,
  actorId,
  action,
  entityType,
  entityId,
  summary,
  metadata
}: RecordAuditLogParams) {
  if (!db) {
    return;
  }

  await db.insert(schema.auditLogs).values({
    workspaceId: workspaceId ?? null,
    actorId: actorId ?? null,
    action,
    entityType,
    entityId: entityId ?? null,
    summary,
    metadata: metadata ?? {}
  });
}
