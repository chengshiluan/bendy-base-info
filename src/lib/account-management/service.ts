import { asc, desc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { paginateItems } from '@/lib/platform/pagination';
import type {
  ManagedAccountBindingSummary,
  ManagedAccountDetail,
  ManagedAccountKeySummary,
  ManagedAccountSecuritySummary,
  ManagedAccountSummary,
  ManagedPlatformSummary,
  ManagedRegistrationSourceSummary,
  ManagedWealthEntry,
  PaginatedResult
} from '@/lib/platform/types';
import { PlatformMutationError } from '@/lib/platform/mutations';

type SearchPageQuery = {
  workspaceId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  status?: ManagedAccountSummary['status'] | 'all';
  attribute?: ManagedAccountSummary['attribute'] | 'all';
  confidence?: ManagedAccountSummary['confidence'] | 'all';
};

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  return value.toISOString();
}

function normalizeKeyword(value?: string) {
  return value?.trim().toLowerCase() ?? '';
}

function matchesKeyword(
  keyword: string,
  values: Array<string | null | undefined>
) {
  if (!keyword) {
    return true;
  }

  return values
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(keyword));
}

function parseWealthEntries(
  value: string | null | undefined
): ManagedWealthEntry[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return [];
    }

    return Object.entries(parsed)
      .filter(([key, entryValue]) => key.trim() && entryValue != null)
      .map(([key, entryValue]) => ({
        key,
        value: String(entryValue)
      }));
  } catch (_error) {
    return [];
  }
}

function mapPlatformSummary(row: {
  id: number;
  workspaceId: string;
  name: string;
  url: string;
  iconUrl: string;
  region: ManagedPlatformSummary['region'];
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}): ManagedPlatformSummary {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    url: row.url,
    iconUrl: row.iconUrl,
    region: row.region,
    createdAt: formatDateTime(row.createdAt) ?? undefined,
    updatedAt: formatDateTime(row.updatedAt) ?? undefined
  };
}

function mapRegistrationSourceSummary(row: {
  id: number;
  workspaceId: string;
  name: string;
  code: string;
  website: string | null;
  remark: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}): ManagedRegistrationSourceSummary {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    code: row.code,
    website: row.website ?? null,
    remark: row.remark ?? null,
    createdAt: formatDateTime(row.createdAt) ?? undefined,
    updatedAt: formatDateTime(row.updatedAt) ?? undefined
  };
}

export async function listManagedPlatforms(
  workspaceId?: string,
  search?: string
): Promise<ManagedPlatformSummary[]> {
  if (!db || !workspaceId) {
    return [];
  }

  const rows = await db
    .select({
      id: schema.accountManagementPlatforms.id,
      workspaceId: schema.accountManagementPlatforms.workspaceId,
      name: schema.accountManagementPlatforms.name,
      url: schema.accountManagementPlatforms.url,
      iconUrl: schema.accountManagementPlatforms.iconUrl,
      region: schema.accountManagementPlatforms.region,
      createdAt: schema.accountManagementPlatforms.createdAt,
      updatedAt: schema.accountManagementPlatforms.updatedAt
    })
    .from(schema.accountManagementPlatforms)
    .where(eq(schema.accountManagementPlatforms.workspaceId, workspaceId))
    .orderBy(asc(schema.accountManagementPlatforms.name));

  const keyword = normalizeKeyword(search);
  return rows
    .filter((row) => matchesKeyword(keyword, [row.name, row.url]))
    .map(mapPlatformSummary);
}

export async function listManagedRegistrationSources(
  workspaceId?: string,
  search?: string
): Promise<ManagedRegistrationSourceSummary[]> {
  if (!db || !workspaceId) {
    return [];
  }

  const rows = await db
    .select({
      id: schema.accountManagementRegistrationSources.id,
      workspaceId: schema.accountManagementRegistrationSources.workspaceId,
      name: schema.accountManagementRegistrationSources.name,
      code: schema.accountManagementRegistrationSources.code,
      website: schema.accountManagementRegistrationSources.website,
      remark: schema.accountManagementRegistrationSources.remark,
      createdAt: schema.accountManagementRegistrationSources.createdAt,
      updatedAt: schema.accountManagementRegistrationSources.updatedAt
    })
    .from(schema.accountManagementRegistrationSources)
    .where(
      eq(schema.accountManagementRegistrationSources.workspaceId, workspaceId)
    )
    .orderBy(asc(schema.accountManagementRegistrationSources.name));

  const keyword = normalizeKeyword(search);
  return rows
    .filter((row) =>
      matchesKeyword(keyword, [row.name, row.code, row.website, row.remark])
    )
    .map(mapRegistrationSourceSummary);
}

type AccountBaseRow = {
  id: number;
  workspaceId: string;
  platformId: number | null;
  platformName: string | null;
  platformIconUrl: string | null;
  platformUrl: string | null;
  account: string;
  attribute: ManagedAccountSummary['attribute'];
  confidence: ManagedAccountSummary['confidence'];
  registeredAt: Date | null;
  status: ManagedAccountSummary['status'];
  wealthJson: string | null;
};

async function listAccountRows(workspaceId: string) {
  return db!
    .select({
      id: schema.accountManagementAccounts.id,
      workspaceId: schema.accountManagementAccounts.workspaceId,
      platformId: schema.accountManagementAccounts.platformId,
      platformName: schema.accountManagementPlatforms.name,
      platformIconUrl: schema.accountManagementPlatforms.iconUrl,
      platformUrl: schema.accountManagementPlatforms.url,
      account: schema.accountManagementAccounts.account,
      attribute: schema.accountManagementAccounts.attribute,
      confidence: schema.accountManagementAccounts.confidence,
      registeredAt: schema.accountManagementAccounts.registeredAt,
      status: schema.accountManagementAccounts.status,
      wealthJson: schema.accountManagementAccounts.wealthJson,
      passwordHash: schema.accountManagementAccounts.passwordHash
    })
    .from(schema.accountManagementAccounts)
    .leftJoin(
      schema.accountManagementPlatforms,
      eq(
        schema.accountManagementAccounts.platformId,
        schema.accountManagementPlatforms.id
      )
    )
    .where(eq(schema.accountManagementAccounts.workspaceId, workspaceId))
    .orderBy(
      desc(schema.accountManagementAccounts.registeredAt),
      desc(schema.accountManagementAccounts.updatedAt)
    );
}

export async function listManagedAccounts(
  workspaceId?: string
): Promise<ManagedAccountSummary[]> {
  if (!db || !workspaceId) {
    return [];
  }

  const rows = await listAccountRows(workspaceId);
  const accountIds = rows.map((row) => row.id);

  const [keyRows, bindingRows, securityRows, sourceRows] = accountIds.length
    ? await Promise.all([
        db!
          .select({
            accountId: schema.accountManagementKeys.accountId
          })
          .from(schema.accountManagementKeys)
          .where(inArray(schema.accountManagementKeys.accountId, accountIds)),
        db!
          .select({
            accountId: schema.accountManagementBindings.accountId
          })
          .from(schema.accountManagementBindings)
          .where(
            inArray(schema.accountManagementBindings.accountId, accountIds)
          ),
        db!
          .select({
            accountId: schema.accountManagementSecurities.accountId
          })
          .from(schema.accountManagementSecurities)
          .where(
            inArray(schema.accountManagementSecurities.accountId, accountIds)
          ),
        db!
          .select({
            accountId:
              schema.accountManagementAccountRegistrationSources.accountId,
            id: schema.accountManagementRegistrationSources.id,
            workspaceId:
              schema.accountManagementRegistrationSources.workspaceId,
            name: schema.accountManagementRegistrationSources.name,
            code: schema.accountManagementRegistrationSources.code,
            website: schema.accountManagementRegistrationSources.website,
            remark: schema.accountManagementRegistrationSources.remark,
            createdAt: schema.accountManagementRegistrationSources.createdAt,
            updatedAt: schema.accountManagementRegistrationSources.updatedAt
          })
          .from(schema.accountManagementAccountRegistrationSources)
          .innerJoin(
            schema.accountManagementRegistrationSources,
            eq(
              schema.accountManagementAccountRegistrationSources.sourceId,
              schema.accountManagementRegistrationSources.id
            )
          )
          .where(
            inArray(
              schema.accountManagementAccountRegistrationSources.accountId,
              accountIds
            )
          )
      ])
    : [[], [], [], []];

  const keyCountMap = new Map<number, number>();
  keyRows.forEach((row) => {
    keyCountMap.set(row.accountId, (keyCountMap.get(row.accountId) ?? 0) + 1);
  });

  const bindingCountMap = new Map<number, number>();
  bindingRows.forEach((row) => {
    bindingCountMap.set(
      row.accountId,
      (bindingCountMap.get(row.accountId) ?? 0) + 1
    );
  });

  const securityCountMap = new Map<number, number>();
  securityRows.forEach((row) => {
    securityCountMap.set(
      row.accountId,
      (securityCountMap.get(row.accountId) ?? 0) + 1
    );
  });

  const sourceMap = new Map<number, ManagedRegistrationSourceSummary[]>();
  sourceRows.forEach((row) => {
    const current = sourceMap.get(row.accountId) ?? [];
    current.push(
      mapRegistrationSourceSummary({
        id: row.id,
        workspaceId: row.workspaceId,
        name: row.name,
        code: row.code,
        website: row.website,
        remark: row.remark,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      })
    );
    sourceMap.set(row.accountId, current);
  });

  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspaceId,
    platformId: row.platformId,
    platformName: row.platformName ?? null,
    platformIconUrl: row.platformIconUrl ?? null,
    platformUrl: row.platformUrl ?? null,
    account: row.account,
    attribute: row.attribute,
    confidence: row.confidence,
    keyCount: keyCountMap.get(row.id) ?? 0,
    bindingCount: bindingCountMap.get(row.id) ?? 0,
    registrationSources: sourceMap.get(row.id) ?? [],
    hasPassword: Boolean(row.passwordHash),
    securityCount: securityCountMap.get(row.id) ?? 0,
    registeredAt: formatDateTime(row.registeredAt),
    status: row.status,
    wealthEntries: parseWealthEntries(row.wealthJson)
  }));
}

export async function listManagedAccountsPage(
  query: SearchPageQuery
): Promise<PaginatedResult<ManagedAccountSummary>> {
  const accounts = await listManagedAccounts(query.workspaceId);
  const keyword = normalizeKeyword(query.search);
  const filtered = accounts.filter((account) => {
    const matchesStatus =
      !query.status || query.status === 'all'
        ? true
        : account.status === query.status;
    const matchesAttribute =
      !query.attribute || query.attribute === 'all'
        ? true
        : account.attribute === query.attribute;
    const matchesConfidence =
      !query.confidence || query.confidence === 'all'
        ? true
        : account.confidence === query.confidence;

    return (
      matchesStatus &&
      matchesAttribute &&
      matchesConfidence &&
      matchesKeyword(keyword, [
        account.account,
        account.platformName,
        ...account.registrationSources.map((source) => source.name)
      ])
    );
  });

  return paginateItems(filtered, query.page, query.pageSize);
}

export async function getManagedAccountDetail(
  accountId: number,
  workspaceId?: string | null
): Promise<ManagedAccountDetail> {
  if (!db) {
    throw new PlatformMutationError(
      '数据库尚未配置，当前无法查询账号信息。',
      503
    );
  }

  const [row] = await db
    .select({
      id: schema.accountManagementAccounts.id,
      workspaceId: schema.accountManagementAccounts.workspaceId,
      platformId: schema.accountManagementAccounts.platformId,
      platformName: schema.accountManagementPlatforms.name,
      platformIconUrl: schema.accountManagementPlatforms.iconUrl,
      platformUrl: schema.accountManagementPlatforms.url,
      account: schema.accountManagementAccounts.account,
      attribute: schema.accountManagementAccounts.attribute,
      confidence: schema.accountManagementAccounts.confidence,
      registeredAt: schema.accountManagementAccounts.registeredAt,
      status: schema.accountManagementAccounts.status,
      wealthJson: schema.accountManagementAccounts.wealthJson,
      passwordHash: schema.accountManagementAccounts.passwordHash
    })
    .from(schema.accountManagementAccounts)
    .leftJoin(
      schema.accountManagementPlatforms,
      eq(
        schema.accountManagementAccounts.platformId,
        schema.accountManagementPlatforms.id
      )
    )
    .where(eq(schema.accountManagementAccounts.id, accountId));

  if (!row) {
    throw new PlatformMutationError('账号不存在。', 404);
  }

  if (workspaceId && row.workspaceId !== workspaceId) {
    throw new PlatformMutationError('账号不属于当前工作区。', 403);
  }

  const [keys, bindings, securities, sourceRows] = await Promise.all([
    db
      .select({
        id: schema.accountManagementKeys.id,
        title: schema.accountManagementKeys.title,
        content: schema.accountManagementKeys.content,
        expiresAt: schema.accountManagementKeys.expiresAt,
        createdAt: schema.accountManagementKeys.createdAt,
        updatedAt: schema.accountManagementKeys.updatedAt
      })
      .from(schema.accountManagementKeys)
      .where(eq(schema.accountManagementKeys.accountId, accountId))
      .orderBy(desc(schema.accountManagementKeys.updatedAt)),
    db
      .select({
        id: schema.accountManagementBindings.id,
        platformId: schema.accountManagementBindings.platformId,
        platformName: schema.accountManagementPlatforms.name,
        platformIconUrl: schema.accountManagementPlatforms.iconUrl,
        platformUrl: schema.accountManagementPlatforms.url,
        platformAccount: schema.accountManagementBindings.platformAccount,
        createdAt: schema.accountManagementBindings.createdAt,
        updatedAt: schema.accountManagementBindings.updatedAt
      })
      .from(schema.accountManagementBindings)
      .leftJoin(
        schema.accountManagementPlatforms,
        eq(
          schema.accountManagementBindings.platformId,
          schema.accountManagementPlatforms.id
        )
      )
      .where(eq(schema.accountManagementBindings.accountId, accountId))
      .orderBy(desc(schema.accountManagementBindings.updatedAt)),
    db
      .select({
        id: schema.accountManagementSecurities.id,
        securityType: schema.accountManagementSecurities.securityType,
        content: schema.accountManagementSecurities.content,
        createdAt: schema.accountManagementSecurities.createdAt,
        updatedAt: schema.accountManagementSecurities.updatedAt
      })
      .from(schema.accountManagementSecurities)
      .where(eq(schema.accountManagementSecurities.accountId, accountId))
      .orderBy(desc(schema.accountManagementSecurities.updatedAt)),
    db
      .select({
        sourceId: schema.accountManagementRegistrationSources.id,
        workspaceId: schema.accountManagementRegistrationSources.workspaceId,
        name: schema.accountManagementRegistrationSources.name,
        code: schema.accountManagementRegistrationSources.code,
        website: schema.accountManagementRegistrationSources.website,
        remark: schema.accountManagementRegistrationSources.remark,
        createdAt: schema.accountManagementRegistrationSources.createdAt,
        updatedAt: schema.accountManagementRegistrationSources.updatedAt
      })
      .from(schema.accountManagementAccountRegistrationSources)
      .innerJoin(
        schema.accountManagementRegistrationSources,
        eq(
          schema.accountManagementAccountRegistrationSources.sourceId,
          schema.accountManagementRegistrationSources.id
        )
      )
      .where(
        eq(
          schema.accountManagementAccountRegistrationSources.accountId,
          accountId
        )
      )
      .orderBy(asc(schema.accountManagementRegistrationSources.name))
  ]);

  const mappedKeys: ManagedAccountKeySummary[] = keys.map((key) => ({
    id: key.id,
    title: key.title,
    content: key.content,
    expiresAt: formatDateTime(key.expiresAt),
    createdAt: formatDateTime(key.createdAt) ?? '-',
    updatedAt: formatDateTime(key.updatedAt) ?? '-'
  }));

  const mappedBindings: ManagedAccountBindingSummary[] = bindings.map(
    (binding) => ({
      id: binding.id,
      platformId: binding.platformId,
      platformName: binding.platformName ?? null,
      platformIconUrl: binding.platformIconUrl ?? null,
      platformUrl: binding.platformUrl ?? null,
      platformAccount: binding.platformAccount,
      createdAt: formatDateTime(binding.createdAt) ?? '-',
      updatedAt: formatDateTime(binding.updatedAt) ?? '-'
    })
  );

  const mappedSecurities: ManagedAccountSecuritySummary[] = securities.map(
    (security) => ({
      id: security.id,
      securityType: security.securityType,
      content: security.content,
      createdAt: formatDateTime(security.createdAt) ?? '-',
      updatedAt: formatDateTime(security.updatedAt) ?? '-'
    })
  );

  const mappedSources = sourceRows.map((row) =>
    mapRegistrationSourceSummary({
      id: row.sourceId,
      workspaceId: row.workspaceId,
      name: row.name,
      code: row.code,
      website: row.website,
      remark: row.remark,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })
  );

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    platformId: row.platformId,
    platformName: row.platformName ?? null,
    platformIconUrl: row.platformIconUrl ?? null,
    platformUrl: row.platformUrl ?? null,
    account: row.account,
    attribute: row.attribute,
    confidence: row.confidence,
    keyCount: mappedKeys.length,
    bindingCount: mappedBindings.length,
    registrationSources: mappedSources,
    registrationSourceIds: mappedSources.map((source) => source.id),
    hasPassword: Boolean(row.passwordHash),
    securityCount: mappedSecurities.length,
    registeredAt: formatDateTime(row.registeredAt),
    status: row.status,
    wealthEntries: parseWealthEntries(row.wealthJson),
    keys: mappedKeys,
    bindings: mappedBindings,
    securities: mappedSecurities
  };
}

export async function getManagedPlatformById(
  platformId: number,
  workspaceId?: string | null
): Promise<ManagedPlatformSummary> {
  if (!db) {
    throw new PlatformMutationError(
      '数据库尚未配置，当前无法查询平台信息。',
      503
    );
  }

  const [row] = await db
    .select({
      id: schema.accountManagementPlatforms.id,
      workspaceId: schema.accountManagementPlatforms.workspaceId,
      name: schema.accountManagementPlatforms.name,
      url: schema.accountManagementPlatforms.url,
      iconUrl: schema.accountManagementPlatforms.iconUrl,
      region: schema.accountManagementPlatforms.region,
      createdAt: schema.accountManagementPlatforms.createdAt,
      updatedAt: schema.accountManagementPlatforms.updatedAt
    })
    .from(schema.accountManagementPlatforms)
    .where(eq(schema.accountManagementPlatforms.id, platformId));

  if (!row) {
    throw new PlatformMutationError('平台不存在。', 404);
  }

  if (workspaceId && row.workspaceId !== workspaceId) {
    throw new PlatformMutationError('平台不属于当前工作区。', 403);
  }

  return mapPlatformSummary(row);
}

export async function getManagedRegistrationSourceById(
  sourceId: number,
  workspaceId?: string | null
): Promise<ManagedRegistrationSourceSummary> {
  if (!db) {
    throw new PlatformMutationError(
      '数据库尚未配置，当前无法查询注册源信息。',
      503
    );
  }

  const [row] = await db
    .select({
      id: schema.accountManagementRegistrationSources.id,
      workspaceId: schema.accountManagementRegistrationSources.workspaceId,
      name: schema.accountManagementRegistrationSources.name,
      code: schema.accountManagementRegistrationSources.code,
      website: schema.accountManagementRegistrationSources.website,
      remark: schema.accountManagementRegistrationSources.remark,
      createdAt: schema.accountManagementRegistrationSources.createdAt,
      updatedAt: schema.accountManagementRegistrationSources.updatedAt
    })
    .from(schema.accountManagementRegistrationSources)
    .where(eq(schema.accountManagementRegistrationSources.id, sourceId));

  if (!row) {
    throw new PlatformMutationError('注册源不存在。', 404);
  }

  if (workspaceId && row.workspaceId !== workspaceId) {
    throw new PlatformMutationError('注册源不属于当前工作区。', 403);
  }

  return mapRegistrationSourceSummary(row);
}
