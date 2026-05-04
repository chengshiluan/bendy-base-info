import { and, desc, eq, like, or } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { paginateItems } from '@/lib/platform/pagination';
import type { PaginatedResult } from '@/lib/platform/types';
import type {
  OpsServerDetail,
  OpsServerDiskEntry,
  OpsServerFactsSummary,
  OpsServerNetworkInterface,
  OpsServerServiceEntry,
  OpsServerStatus,
  OpsServerSummary
} from './types';

type ServerRow = typeof schema.opsServers.$inferSelect;
type FactsRow = typeof schema.opsServerFacts.$inferSelect;

function formatDate(value: Date | string | null | undefined) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.toISOString();
}

export function mapServerSummary(row: ServerRow): OpsServerSummary {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    hostname: row.hostname ?? null,
    ip: row.ip,
    sshPort: row.sshPort,
    sshUser: row.sshUser,
    authType: row.authType,
    status: row.status,
    hasSecret: Boolean(row.secretCipher),
    hasPassphrase: Boolean(row.secretPassphraseCipher),
    lastCollectedAt: formatDate(row.lastCollectedAt),
    lastFactsId: row.lastFactsId ?? null,
    collectError: row.collectError ?? null,
    remark: row.remark ?? null,
    createdAt: formatDate(row.createdAt) ?? new Date().toISOString(),
    updatedAt: formatDate(row.updatedAt) ?? new Date().toISOString()
  };
}

export function mapFactsSummary(row: FactsRow): OpsServerFactsSummary {
  return {
    id: row.id,
    serverId: row.serverId,
    collectedAt: formatDate(row.collectedAt) ?? new Date().toISOString(),
    osName: row.osName ?? null,
    osVersion: row.osVersion ?? null,
    kernel: row.kernel ?? null,
    arch: row.arch ?? null,
    cpuModel: row.cpuModel ?? null,
    cpuCores: row.cpuCores ?? null,
    memoryTotalMb: row.memoryTotalMb ?? null,
    memoryUsedMb: row.memoryUsedMb ?? null,
    uptimeSeconds: row.uptimeSeconds ?? null,
    disks: (row.diskJson as OpsServerDiskEntry[] | null) ?? [],
    networks: (row.networkJson as OpsServerNetworkInterface[] | null) ?? [],
    services: (row.servicesJson as OpsServerServiceEntry[] | null) ?? [],
    raw: (row.rawJson as Record<string, unknown> | null) ?? {}
  };
}

export interface ListServersQuery {
  workspaceId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: OpsServerStatus | 'all';
}

export async function listOpsServers(
  query: ListServersQuery
): Promise<PaginatedResult<OpsServerSummary>> {
  const emptyPagination = {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1
  };
  if (!db || !query.workspaceId) {
    return { items: [], pagination: emptyPagination };
  }

  const conditions = [eq(schema.opsServers.workspaceId, query.workspaceId)];
  if (query.status && query.status !== 'all') {
    conditions.push(eq(schema.opsServers.status, query.status));
  }
  if (query.search) {
    const keyword = `%${query.search.trim()}%`;
    if (keyword.length > 2) {
      const orClause = or(
        like(schema.opsServers.name, keyword),
        like(schema.opsServers.ip, keyword),
        like(schema.opsServers.hostname, keyword)
      );
      if (orClause) {
        conditions.push(orClause);
      }
    }
  }

  const rows = await db
    .select()
    .from(schema.opsServers)
    .where(and(...conditions))
    .orderBy(desc(schema.opsServers.updatedAt));

  const summaries = rows.map(mapServerSummary);
  return paginateItems(summaries, query.page, query.pageSize);
}

export async function getOpsServerById(
  id: number,
  workspaceId?: string
): Promise<OpsServerDetail | null> {
  if (!db) return null;
  const conditions = [eq(schema.opsServers.id, id)];
  if (workspaceId) {
    conditions.push(eq(schema.opsServers.workspaceId, workspaceId));
  }
  const [row] = await db
    .select()
    .from(schema.opsServers)
    .where(and(...conditions))
    .limit(1);
  if (!row) return null;

  const summary = mapServerSummary(row);
  let latestFacts: OpsServerFactsSummary | null = null;
  if (row.lastFactsId) {
    const [factsRow] = await db
      .select()
      .from(schema.opsServerFacts)
      .where(eq(schema.opsServerFacts.id, row.lastFactsId))
      .limit(1);
    if (factsRow) {
      latestFacts = mapFactsSummary(factsRow);
    }
  }
  return { ...summary, latestFacts };
}

export async function listServerFacts(
  serverId: number,
  page = 1,
  pageSize = 20
): Promise<PaginatedResult<OpsServerFactsSummary>> {
  if (!db) {
    return {
      items: [],
      pagination: { page: 1, pageSize, total: 0, totalPages: 1 }
    };
  }
  const rows = await db
    .select()
    .from(schema.opsServerFacts)
    .where(eq(schema.opsServerFacts.serverId, serverId))
    .orderBy(desc(schema.opsServerFacts.collectedAt));
  return paginateItems(rows.map(mapFactsSummary), page, pageSize);
}

export async function getServerSecret(id: number): Promise<{
  secret: string | null;
  passphrase: string | null;
  authType: (typeof schema.opsServers.$inferSelect)['authType'];
} | null> {
  if (!db) return null;
  const [row] = await db
    .select({
      secretCipher: schema.opsServers.secretCipher,
      secretPassphraseCipher: schema.opsServers.secretPassphraseCipher,
      authType: schema.opsServers.authType
    })
    .from(schema.opsServers)
    .where(eq(schema.opsServers.id, id))
    .limit(1);
  if (!row) return null;
  return {
    secret: row.secretCipher,
    passphrase: row.secretPassphraseCipher,
    authType: row.authType
  };
}
