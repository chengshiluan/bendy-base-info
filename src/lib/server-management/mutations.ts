import { and, eq, ne } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { recordAuditLog } from '@/lib/platform/audit';
import { PlatformMutationError } from '@/lib/platform/mutations';
import { encryptSecret } from './crypto';
import { dispatchCollect } from './dispatcher';
import { mapServerSummary } from './service';
import type { OpsServerSummary } from './types';
import type {
  ServerPayload,
  ServerUpdatePayload
} from './validators';

async function assertWorkspaceExists(workspaceId: string) {
  if (!db) {
    throw new PlatformMutationError('数据库未初始化。', 500);
  }
  const [row] = await db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId))
    .limit(1);
  if (!row) {
    throw new PlatformMutationError('工作区不存在。', 404);
  }
}

async function assertNameUnique(
  workspaceId: string,
  name: string,
  excludeId?: number
) {
  if (!db) return;
  const conditions = [
    eq(schema.opsServers.workspaceId, workspaceId),
    eq(schema.opsServers.name, name)
  ];
  if (excludeId) {
    conditions.push(ne(schema.opsServers.id, excludeId));
  }
  const [row] = await db
    .select({ id: schema.opsServers.id })
    .from(schema.opsServers)
    .where(and(...conditions))
    .limit(1);
  if (row) {
    throw new PlatformMutationError('当前工作区已存在同名服务器。');
  }
}

async function assertEndpointUnique(
  workspaceId: string,
  ip: string,
  sshPort: number,
  excludeId?: number
) {
  if (!db) return;
  const conditions = [
    eq(schema.opsServers.workspaceId, workspaceId),
    eq(schema.opsServers.ip, ip),
    eq(schema.opsServers.sshPort, sshPort)
  ];
  if (excludeId) {
    conditions.push(ne(schema.opsServers.id, excludeId));
  }
  const [row] = await db
    .select({ id: schema.opsServers.id })
    .from(schema.opsServers)
    .where(and(...conditions))
    .limit(1);
  if (row) {
    throw new PlatformMutationError('当前工作区已存在相同 IP 与端口的服务器。');
  }
}

export async function createOpsServer(
  actorId: string,
  payload: ServerPayload
): Promise<OpsServerSummary> {
  if (!db) {
    throw new PlatformMutationError('数据库未初始化。', 500);
  }
  await assertWorkspaceExists(payload.workspaceId);
  await assertNameUnique(payload.workspaceId, payload.name);
  await assertEndpointUnique(
    payload.workspaceId,
    payload.ip,
    payload.sshPort
  );

  if (!payload.secret) {
    throw new PlatformMutationError('请填写 SSH 凭据。');
  }

  const [inserted] = await db
    .insert(schema.opsServers)
    .values({
      workspaceId: payload.workspaceId,
      name: payload.name,
      hostname: payload.hostname,
      ip: payload.ip,
      sshPort: payload.sshPort,
      sshUser: payload.sshUser,
      authType: payload.authType,
      secretCipher: encryptSecret(payload.secret),
      secretPassphraseCipher: payload.passphrase
        ? encryptSecret(payload.passphrase)
        : null,
      status: 'pending',
      remark: payload.remark
    })
    .returning();

  await recordAuditLog({
    workspaceId: payload.workspaceId,
    actorId,
    action: 'ops.server.create',
    entityType: 'ops_server',
    entityId: String(inserted.id),
    summary: `新增服务器 ${payload.name} (${payload.ip})`
  });

  dispatchCollect(inserted.id);

  return mapServerSummary(inserted);
}

export async function updateOpsServer(
  actorId: string,
  id: number,
  payload: ServerUpdatePayload
): Promise<OpsServerSummary> {
  if (!db) {
    throw new PlatformMutationError('数据库未初始化。', 500);
  }

  const [existing] = await db
    .select()
    .from(schema.opsServers)
    .where(eq(schema.opsServers.id, id))
    .limit(1);
  if (!existing) {
    throw new PlatformMutationError('服务器不存在。', 404);
  }
  if (existing.workspaceId !== payload.workspaceId) {
    throw new PlatformMutationError('无法跨工作区修改服务器。', 403);
  }

  await assertNameUnique(payload.workspaceId, payload.name, id);
  await assertEndpointUnique(
    payload.workspaceId,
    payload.ip,
    payload.sshPort,
    id
  );

  const secretCipher = payload.keepSecret
    ? existing.secretCipher
    : payload.secret
      ? encryptSecret(payload.secret)
      : null;
  if (!secretCipher) {
    throw new PlatformMutationError('请填写 SSH 凭据。');
  }

  const passphraseCipher = payload.keepPassphrase
    ? existing.secretPassphraseCipher
    : payload.passphrase
      ? encryptSecret(payload.passphrase)
      : null;

  const [updated] = await db
    .update(schema.opsServers)
    .set({
      name: payload.name,
      hostname: payload.hostname,
      ip: payload.ip,
      sshPort: payload.sshPort,
      sshUser: payload.sshUser,
      authType: payload.authType,
      secretCipher,
      secretPassphraseCipher: passphraseCipher,
      remark: payload.remark,
      updatedAt: new Date()
    })
    .where(eq(schema.opsServers.id, id))
    .returning();

  await recordAuditLog({
    workspaceId: payload.workspaceId,
    actorId,
    action: 'ops.server.update',
    entityType: 'ops_server',
    entityId: String(id),
    summary: `更新服务器 ${payload.name}`
  });

  return mapServerSummary(updated);
}

export async function deleteOpsServer(
  actorId: string,
  id: number,
  workspaceId: string
) {
  if (!db) {
    throw new PlatformMutationError('数据库未初始化。', 500);
  }

  const [existing] = await db
    .select()
    .from(schema.opsServers)
    .where(eq(schema.opsServers.id, id))
    .limit(1);
  if (!existing) {
    throw new PlatformMutationError('服务器不存在。', 404);
  }
  if (existing.workspaceId !== workspaceId) {
    throw new PlatformMutationError('无法跨工作区删除服务器。', 403);
  }

  await db
    .update(schema.opsServers)
    .set({ lastFactsId: null, updatedAt: new Date() })
    .where(eq(schema.opsServers.id, id));
  await db
    .delete(schema.opsServerFacts)
    .where(eq(schema.opsServerFacts.serverId, id));
  await db.delete(schema.opsServers).where(eq(schema.opsServers.id, id));

  await recordAuditLog({
    workspaceId,
    actorId,
    action: 'ops.server.delete',
    entityType: 'ops_server',
    entityId: String(id),
    summary: `删除服务器 ${existing.name}`
  });
}

export async function triggerCollect(
  actorId: string,
  id: number,
  workspaceId: string
) {
  if (!db) {
    throw new PlatformMutationError('数据库未初始化。', 500);
  }
  const [existing] = await db
    .select({
      id: schema.opsServers.id,
      workspaceId: schema.opsServers.workspaceId,
      name: schema.opsServers.name,
      secretCipher: schema.opsServers.secretCipher
    })
    .from(schema.opsServers)
    .where(eq(schema.opsServers.id, id))
    .limit(1);
  if (!existing) {
    throw new PlatformMutationError('服务器不存在。', 404);
  }
  if (existing.workspaceId !== workspaceId) {
    throw new PlatformMutationError('无法跨工作区操作。', 403);
  }
  if (!existing.secretCipher) {
    throw new PlatformMutationError('服务器未配置 SSH 凭据，无法采集。');
  }

  dispatchCollect(id);

  await recordAuditLog({
    workspaceId,
    actorId,
    action: 'ops.server.collect',
    entityType: 'ops_server',
    entityId: String(id),
    summary: `手动触发采集 ${existing.name}`
  });
}
