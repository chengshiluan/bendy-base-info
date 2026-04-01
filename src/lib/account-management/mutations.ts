import { createHash } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { slugify } from '@/lib/utils';
import { recordAuditLog } from '@/lib/platform/audit';
import { PlatformMutationError } from '@/lib/platform/mutations';
import {
  getManagedAccountDetail,
  getManagedPlatformById,
  getManagedRegistrationSourceById
} from './service';

type AccountPayload = {
  workspaceId: string;
  platformId: number | null;
  account: string;
  attribute: 'self_hosted' | 'third_party';
  confidence: 'very_high' | 'high' | 'medium' | 'low';
  password: string | null;
  registeredAt: string | null;
  status: 'cancelled' | 'available' | 'banned';
  wealthEntries: Array<{ key: string; value: string }>;
  sourceIds: number[];
};

type PlatformPayload = {
  workspaceId: string;
  name: string;
  url: string;
  iconUrl: string | null;
  region: 'overseas' | 'mainland' | 'hk_mo_tw';
};

type RegistrationSourcePayload = {
  workspaceId: string;
  name: string;
  code: string;
  website: string | null;
  remark: string | null;
};

type AccountKeyPayload = {
  title: string;
  content: string;
  expiresAt: string | null;
};

type AccountBindingPayload = {
  platformId: number | null;
  platformAccount: string;
};

type AccountSecurityPayload = {
  securityType: 'question' | 'two_factor' | 'contact' | 'emergency_email';
  content: string;
};

function requireDatabase() {
  if (!db) {
    throw new PlatformMutationError(
      '数据库尚未配置，当前无法执行账号管理写入操作。',
      503
    );
  }

  return db;
}

function normalizeNullable(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function parseDateTimeInput(
  value: string | null | undefined,
  fieldLabel: string
): Date | null {
  const normalized = normalizeNullable(value);

  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    throw new PlatformMutationError(`${fieldLabel}格式不正确。`);
  }

  return parsed;
}

function hashPassword(password: string) {
  return createHash('md5').update(password, 'utf8').digest('hex');
}

function normalizeSourceCode(value: string) {
  return slugify(value).replace(/-/g, '_');
}

function uniqueNumberValues(values: number[] = []) {
  return Array.from(
    new Set(values.filter((value) => Number.isInteger(value) && value > 0))
  );
}

function buildWealthJson(entries: Array<{ key: string; value: string }>) {
  if (!entries.length) {
    return null;
  }

  const valueMap: Record<string, string> = {};

  entries.forEach((entry) => {
    const key = entry.key.trim();
    const value = entry.value.trim();

    if (!key || !value) {
      return;
    }

    if (key in valueMap) {
      throw new PlatformMutationError(
        `财富字段标题“${key}”重复，请调整后再保存。`
      );
    }

    valueMap[key] = value;
  });

  return Object.keys(valueMap).length ? JSON.stringify(valueMap) : null;
}

function resolvePlatformIconUrl(url: string, iconUrl?: string | null) {
  const normalizedIconUrl = normalizeNullable(iconUrl);

  if (normalizedIconUrl) {
    return normalizedIconUrl;
  }

  return new URL('/favicon.ico', url).toString();
}

async function getWorkspaceRecord(workspaceId: string) {
  const database = requireDatabase();
  const [workspace] = await database
    .select({
      id: schema.workspaces.id,
      name: schema.workspaces.name
    })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId));

  if (!workspace) {
    throw new PlatformMutationError('工作区不存在。', 404);
  }

  return workspace;
}

async function ensurePlatformBelongsToWorkspace(
  platformId: number | null,
  workspaceId: string
) {
  if (!platformId) {
    return null;
  }

  const platform = await getManagedPlatformById(platformId, workspaceId);
  return platform;
}

async function ensureRegistrationSourcesBelongToWorkspace(
  sourceIds: number[],
  workspaceId: string
) {
  const uniqueSourceIds = uniqueNumberValues(sourceIds);

  if (!uniqueSourceIds.length) {
    return [];
  }

  const database = requireDatabase();
  const rows = await database
    .select({
      id: schema.accountManagementRegistrationSources.id,
      workspaceId: schema.accountManagementRegistrationSources.workspaceId
    })
    .from(schema.accountManagementRegistrationSources)
    .where(
      inArray(schema.accountManagementRegistrationSources.id, uniqueSourceIds)
    );

  if (rows.length !== uniqueSourceIds.length) {
    throw new PlatformMutationError(
      '存在已删除或不可用的注册源，请刷新后重试。'
    );
  }

  const invalidRow = rows.find((row) => row.workspaceId !== workspaceId);

  if (invalidRow) {
    throw new PlatformMutationError('注册源不属于当前工作区。', 403);
  }

  return uniqueSourceIds;
}

async function getManagedAccountRecord(accountId: number) {
  const database = requireDatabase();
  const [account] = await database
    .select({
      id: schema.accountManagementAccounts.id,
      workspaceId: schema.accountManagementAccounts.workspaceId,
      account: schema.accountManagementAccounts.account,
      platformId: schema.accountManagementAccounts.platformId,
      passwordHash: schema.accountManagementAccounts.passwordHash
    })
    .from(schema.accountManagementAccounts)
    .where(eq(schema.accountManagementAccounts.id, accountId));

  if (!account) {
    throw new PlatformMutationError('账号不存在。', 404);
  }

  return account;
}

async function ensureAccountBelongsToWorkspace(
  accountId: number,
  workspaceId: string
) {
  const account = await getManagedAccountRecord(accountId);

  if (account.workspaceId !== workspaceId) {
    throw new PlatformMutationError('账号不属于当前工作区。', 403);
  }

  return account;
}

async function syncAccountSourceIds(
  accountId: number,
  sourceIds: number[],
  workspaceId: string
) {
  const database = requireDatabase();
  const normalizedSourceIds = await ensureRegistrationSourcesBelongToWorkspace(
    sourceIds,
    workspaceId
  );

  const currentMappings = await database
    .select({
      sourceId: schema.accountManagementAccountRegistrationSources.sourceId
    })
    .from(schema.accountManagementAccountRegistrationSources)
    .where(
      eq(
        schema.accountManagementAccountRegistrationSources.accountId,
        accountId
      )
    );

  const currentSourceIds = currentMappings.map((item) => item.sourceId);
  const nextSourceIdSet = new Set(normalizedSourceIds);
  const currentSourceIdSet = new Set(currentSourceIds);
  const toDelete = currentSourceIds.filter(
    (sourceId) => !nextSourceIdSet.has(sourceId)
  );
  const toInsert = normalizedSourceIds.filter(
    (sourceId) => !currentSourceIdSet.has(sourceId)
  );

  if (toDelete.length) {
    await database
      .delete(schema.accountManagementAccountRegistrationSources)
      .where(
        and(
          eq(
            schema.accountManagementAccountRegistrationSources.accountId,
            accountId
          ),
          inArray(
            schema.accountManagementAccountRegistrationSources.sourceId,
            toDelete
          )
        )
      );
  }

  if (toInsert.length) {
    await database
      .insert(schema.accountManagementAccountRegistrationSources)
      .values(
        toInsert.map((sourceId) => ({
          accountId,
          sourceId
        }))
      );
  }

  return normalizedSourceIds;
}

export async function createManagedAccount(
  actorId: string,
  input: AccountPayload
) {
  const database = requireDatabase();
  const workspace = await getWorkspaceRecord(input.workspaceId);
  await ensurePlatformBelongsToWorkspace(input.platformId, input.workspaceId);
  const normalizedAccount = input.account.trim();
  const registeredAt = parseDateTimeInput(input.registeredAt, '注册时间');
  const wealthJson = buildWealthJson(input.wealthEntries);
  const password = normalizeNullable(input.password);

  const [createdAccount] = await database
    .insert(schema.accountManagementAccounts)
    .values({
      workspaceId: input.workspaceId,
      platformId: input.platformId,
      account: normalizedAccount,
      attribute: input.attribute,
      confidence: input.confidence,
      passwordHash: password ? hashPassword(password) : null,
      registeredAt,
      status: input.status,
      wealthJson
    })
    .returning({ id: schema.accountManagementAccounts.id });

  await syncAccountSourceIds(
    createdAccount.id,
    input.sourceIds,
    input.workspaceId
  );

  await recordAuditLog({
    workspaceId: input.workspaceId,
    actorId,
    action: 'account_management.account.create',
    entityType: 'account_management_account',
    entityId: String(createdAccount.id),
    summary: `在工作区 ${workspace.name} 中新增了账号 ${normalizedAccount}。`,
    metadata: {
      accountId: createdAccount.id,
      platformId: input.platformId,
      sourceIds: uniqueNumberValues(input.sourceIds)
    }
  });

  return getManagedAccountDetail(createdAccount.id, input.workspaceId);
}

export async function updateManagedAccount(
  accountId: number,
  actorId: string,
  input: AccountPayload
) {
  const database = requireDatabase();
  const account = await ensureAccountBelongsToWorkspace(
    accountId,
    input.workspaceId
  );
  const workspace = await getWorkspaceRecord(input.workspaceId);
  await ensurePlatformBelongsToWorkspace(input.platformId, input.workspaceId);
  const registeredAt = parseDateTimeInput(input.registeredAt, '注册时间');
  const wealthJson = buildWealthJson(input.wealthEntries);
  const password = normalizeNullable(input.password);

  await database
    .update(schema.accountManagementAccounts)
    .set({
      platformId: input.platformId,
      account: input.account.trim(),
      attribute: input.attribute,
      confidence: input.confidence,
      passwordHash: password ? hashPassword(password) : account.passwordHash,
      registeredAt,
      status: input.status,
      wealthJson,
      updatedAt: new Date()
    })
    .where(eq(schema.accountManagementAccounts.id, accountId));

  await syncAccountSourceIds(accountId, input.sourceIds, input.workspaceId);

  await recordAuditLog({
    workspaceId: input.workspaceId,
    actorId,
    action: 'account_management.account.update',
    entityType: 'account_management_account',
    entityId: String(accountId),
    summary: `更新了工作区 ${workspace.name} 中的账号 ${input.account.trim()}。`,
    metadata: {
      accountId,
      platformId: input.platformId,
      sourceIds: uniqueNumberValues(input.sourceIds)
    }
  });

  return getManagedAccountDetail(accountId, input.workspaceId);
}

export async function deleteManagedAccount(
  accountId: number,
  actorId: string,
  workspaceId: string
) {
  const database = requireDatabase();
  const account = await ensureAccountBelongsToWorkspace(accountId, workspaceId);

  await database
    .update(schema.accountManagementAccounts)
    .set({
      status: 'cancelled',
      updatedAt: new Date()
    })
    .where(eq(schema.accountManagementAccounts.id, accountId));

  await recordAuditLog({
    workspaceId,
    actorId,
    action: 'account_management.account.delete',
    entityType: 'account_management_account',
    entityId: String(accountId),
    summary: `将账号 ${account.account} 标记为已注销。`,
    metadata: {
      accountId,
      deleteMode: 'logical'
    }
  });

  return getManagedAccountDetail(accountId, workspaceId);
}

export async function bindManagedAccountPrimaryPlatform(
  accountId: number,
  actorId: string,
  input: {
    workspaceId: string;
    platformId: number | null;
  }
) {
  const database = requireDatabase();
  const account = await ensureAccountBelongsToWorkspace(
    accountId,
    input.workspaceId
  );
  await ensurePlatformBelongsToWorkspace(input.platformId, input.workspaceId);

  await database
    .update(schema.accountManagementAccounts)
    .set({
      platformId: input.platformId,
      updatedAt: new Date()
    })
    .where(eq(schema.accountManagementAccounts.id, accountId));

  await recordAuditLog({
    workspaceId: input.workspaceId,
    actorId,
    action: 'account_management.account.bind_platform',
    entityType: 'account_management_account',
    entityId: String(accountId),
    summary: input.platformId
      ? `为账号 ${account.account} 重新绑定了主平台。`
      : `移除了账号 ${account.account} 的主平台绑定。`,
    metadata: {
      accountId,
      platformId: input.platformId
    }
  });

  return getManagedAccountDetail(accountId, input.workspaceId);
}

export async function createManagedPlatform(
  actorId: string,
  input: PlatformPayload
) {
  const database = requireDatabase();
  const workspace = await getWorkspaceRecord(input.workspaceId);
  const iconUrl = resolvePlatformIconUrl(input.url, input.iconUrl);

  const [createdPlatform] = await database
    .insert(schema.accountManagementPlatforms)
    .values({
      workspaceId: input.workspaceId,
      name: input.name.trim(),
      url: input.url.trim(),
      iconUrl,
      region: input.region
    })
    .returning({ id: schema.accountManagementPlatforms.id });

  await recordAuditLog({
    workspaceId: input.workspaceId,
    actorId,
    action: 'account_management.platform.create',
    entityType: 'account_management_platform',
    entityId: String(createdPlatform.id),
    summary: `在工作区 ${workspace.name} 中新增了平台 ${input.name.trim()}。`,
    metadata: {
      platformId: createdPlatform.id
    }
  });

  return getManagedPlatformById(createdPlatform.id, input.workspaceId);
}

export async function updateManagedPlatform(
  platformId: number,
  actorId: string,
  input: PlatformPayload
) {
  const database = requireDatabase();
  const platform = await getManagedPlatformById(platformId, input.workspaceId);
  const iconUrl = resolvePlatformIconUrl(input.url, input.iconUrl);

  await database
    .update(schema.accountManagementPlatforms)
    .set({
      name: input.name.trim(),
      url: input.url.trim(),
      iconUrl,
      region: input.region,
      updatedAt: new Date()
    })
    .where(eq(schema.accountManagementPlatforms.id, platformId));

  await recordAuditLog({
    workspaceId: input.workspaceId,
    actorId,
    action: 'account_management.platform.update',
    entityType: 'account_management_platform',
    entityId: String(platformId),
    summary: `更新了平台 ${platform.name}。`,
    metadata: {
      platformId
    }
  });

  return getManagedPlatformById(platformId, input.workspaceId);
}

export async function deleteManagedPlatform(
  platformId: number,
  actorId: string,
  workspaceId: string
) {
  const database = requireDatabase();
  const platform = await getManagedPlatformById(platformId, workspaceId);

  await database
    .delete(schema.accountManagementPlatforms)
    .where(eq(schema.accountManagementPlatforms.id, platformId));

  await recordAuditLog({
    workspaceId,
    actorId,
    action: 'account_management.platform.delete',
    entityType: 'account_management_platform',
    entityId: String(platformId),
    summary: `删除了平台 ${platform.name}。`,
    metadata: {
      platformId
    }
  });

  return platform;
}

export async function createManagedRegistrationSource(
  actorId: string,
  input: RegistrationSourcePayload
) {
  const database = requireDatabase();
  const workspace = await getWorkspaceRecord(input.workspaceId);
  const code = normalizeSourceCode(input.code);

  if (!code) {
    throw new PlatformMutationError('注册源标识不能为空。');
  }

  const [createdSource] = await database
    .insert(schema.accountManagementRegistrationSources)
    .values({
      workspaceId: input.workspaceId,
      name: input.name.trim(),
      code,
      website: normalizeNullable(input.website),
      remark: normalizeNullable(input.remark)
    })
    .returning({ id: schema.accountManagementRegistrationSources.id });

  await recordAuditLog({
    workspaceId: input.workspaceId,
    actorId,
    action: 'account_management.source.create',
    entityType: 'account_management_registration_source',
    entityId: String(createdSource.id),
    summary: `在工作区 ${workspace.name} 中新增了注册源 ${input.name.trim()}。`,
    metadata: {
      sourceId: createdSource.id
    }
  });

  return getManagedRegistrationSourceById(createdSource.id, input.workspaceId);
}

export async function updateManagedRegistrationSource(
  sourceId: number,
  actorId: string,
  input: RegistrationSourcePayload
) {
  const database = requireDatabase();
  const source = await getManagedRegistrationSourceById(
    sourceId,
    input.workspaceId
  );
  const code = normalizeSourceCode(input.code);

  if (!code) {
    throw new PlatformMutationError('注册源标识不能为空。');
  }

  await database
    .update(schema.accountManagementRegistrationSources)
    .set({
      name: input.name.trim(),
      code,
      website: normalizeNullable(input.website),
      remark: normalizeNullable(input.remark),
      updatedAt: new Date()
    })
    .where(eq(schema.accountManagementRegistrationSources.id, sourceId));

  await recordAuditLog({
    workspaceId: input.workspaceId,
    actorId,
    action: 'account_management.source.update',
    entityType: 'account_management_registration_source',
    entityId: String(sourceId),
    summary: `更新了注册源 ${source.name}。`,
    metadata: {
      sourceId
    }
  });

  return getManagedRegistrationSourceById(sourceId, input.workspaceId);
}

export async function deleteManagedRegistrationSource(
  sourceId: number,
  actorId: string,
  workspaceId: string
) {
  const database = requireDatabase();
  const source = await getManagedRegistrationSourceById(sourceId, workspaceId);

  await database
    .delete(schema.accountManagementRegistrationSources)
    .where(eq(schema.accountManagementRegistrationSources.id, sourceId));

  await recordAuditLog({
    workspaceId,
    actorId,
    action: 'account_management.source.delete',
    entityType: 'account_management_registration_source',
    entityId: String(sourceId),
    summary: `删除了注册源 ${source.name}。`,
    metadata: {
      sourceId
    }
  });

  return source;
}

export async function syncManagedAccountRegistrationSources(
  accountId: number,
  actorId: string,
  workspaceId: string,
  sourceIds: number[]
) {
  const account = await ensureAccountBelongsToWorkspace(accountId, workspaceId);
  const normalizedSourceIds = await syncAccountSourceIds(
    accountId,
    sourceIds,
    workspaceId
  );

  await recordAuditLog({
    workspaceId,
    actorId,
    action: 'account_management.account.sync_sources',
    entityType: 'account_management_account',
    entityId: String(accountId),
    summary: `更新了账号 ${account.account} 的注册源绑定。`,
    metadata: {
      accountId,
      sourceIds: normalizedSourceIds
    }
  });

  return getManagedAccountDetail(accountId, workspaceId);
}

export async function createManagedAccountKey(
  accountId: number,
  actorId: string,
  workspaceId: string,
  input: AccountKeyPayload
) {
  const database = requireDatabase();
  const account = await ensureAccountBelongsToWorkspace(accountId, workspaceId);

  await database.insert(schema.accountManagementKeys).values({
    accountId,
    title: input.title.trim(),
    content: input.content.trim(),
    expiresAt: parseDateTimeInput(input.expiresAt, '过期时间')
  });

  await recordAuditLog({
    workspaceId,
    actorId,
    action: 'account_management.key.create',
    entityType: 'account_management_account',
    entityId: String(accountId),
    summary: `为账号 ${account.account} 新增了一条密钥记录。`,
    metadata: {
      accountId
    }
  });

  return getManagedAccountDetail(accountId, workspaceId);
}

export async function updateManagedAccountKey(
  keyId: number,
  actorId: string,
  workspaceId: string,
  input: AccountKeyPayload
) {
  const database = requireDatabase();
  const [key] = await database
    .select({
      id: schema.accountManagementKeys.id,
      accountId: schema.accountManagementKeys.accountId
    })
    .from(schema.accountManagementKeys)
    .where(eq(schema.accountManagementKeys.id, keyId));

  if (!key) {
    throw new PlatformMutationError('密钥不存在。', 404);
  }

  await ensureAccountBelongsToWorkspace(key.accountId, workspaceId);

  await database
    .update(schema.accountManagementKeys)
    .set({
      title: input.title.trim(),
      content: input.content.trim(),
      expiresAt: parseDateTimeInput(input.expiresAt, '过期时间'),
      updatedAt: new Date()
    })
    .where(eq(schema.accountManagementKeys.id, keyId));

  await recordAuditLog({
    workspaceId,
    actorId,
    action: 'account_management.key.update',
    entityType: 'account_management_account',
    entityId: String(key.accountId),
    summary: '更新了一条密钥记录。',
    metadata: {
      accountId: key.accountId,
      keyId
    }
  });

  return getManagedAccountDetail(key.accountId, workspaceId);
}

export async function deleteManagedAccountKey(
  keyId: number,
  actorId: string,
  workspaceId: string
) {
  const database = requireDatabase();
  const [key] = await database
    .select({
      id: schema.accountManagementKeys.id,
      accountId: schema.accountManagementKeys.accountId
    })
    .from(schema.accountManagementKeys)
    .where(eq(schema.accountManagementKeys.id, keyId));

  if (!key) {
    throw new PlatformMutationError('密钥不存在。', 404);
  }

  await ensureAccountBelongsToWorkspace(key.accountId, workspaceId);

  await database
    .delete(schema.accountManagementKeys)
    .where(eq(schema.accountManagementKeys.id, keyId));

  await recordAuditLog({
    workspaceId,
    actorId,
    action: 'account_management.key.delete',
    entityType: 'account_management_account',
    entityId: String(key.accountId),
    summary: '删除了一条密钥记录。',
    metadata: {
      accountId: key.accountId,
      keyId
    }
  });

  return getManagedAccountDetail(key.accountId, workspaceId);
}

export async function createManagedAccountBindings(
  accountId: number,
  actorId: string,
  workspaceId: string,
  items: AccountBindingPayload[]
) {
  const database = requireDatabase();
  const account = await ensureAccountBelongsToWorkspace(accountId, workspaceId);

  for (const item of items) {
    if (!item.platformId) {
      throw new PlatformMutationError('绑定信息必须选择平台。');
    }

    await ensurePlatformBelongsToWorkspace(item.platformId, workspaceId);
  }

  await database.insert(schema.accountManagementBindings).values(
    items.map((item) => ({
      accountId,
      platformId: item.platformId,
      platformAccount: item.platformAccount.trim()
    }))
  );

  await recordAuditLog({
    workspaceId,
    actorId,
    action: 'account_management.binding.create',
    entityType: 'account_management_account',
    entityId: String(accountId),
    summary: `为账号 ${account.account} 新增了 ${items.length} 条绑定关系。`,
    metadata: {
      accountId,
      count: items.length
    }
  });

  return getManagedAccountDetail(accountId, workspaceId);
}

export async function updateManagedAccountBinding(
  bindingId: number,
  actorId: string,
  workspaceId: string,
  input: AccountBindingPayload
) {
  const database = requireDatabase();
  const [binding] = await database
    .select({
      id: schema.accountManagementBindings.id,
      accountId: schema.accountManagementBindings.accountId
    })
    .from(schema.accountManagementBindings)
    .where(eq(schema.accountManagementBindings.id, bindingId));

  if (!binding) {
    throw new PlatformMutationError('绑定关系不存在。', 404);
  }

  await ensureAccountBelongsToWorkspace(binding.accountId, workspaceId);

  if (!input.platformId) {
    throw new PlatformMutationError('绑定关系必须选择平台。');
  }

  await ensurePlatformBelongsToWorkspace(input.platformId, workspaceId);

  await database
    .update(schema.accountManagementBindings)
    .set({
      platformId: input.platformId,
      platformAccount: input.platformAccount.trim(),
      updatedAt: new Date()
    })
    .where(eq(schema.accountManagementBindings.id, bindingId));

  await recordAuditLog({
    workspaceId,
    actorId,
    action: 'account_management.binding.update',
    entityType: 'account_management_account',
    entityId: String(binding.accountId),
    summary: '更新了一条绑定关系。',
    metadata: {
      accountId: binding.accountId,
      bindingId
    }
  });

  return getManagedAccountDetail(binding.accountId, workspaceId);
}

export async function deleteManagedAccountBinding(
  bindingId: number,
  actorId: string,
  workspaceId: string
) {
  const database = requireDatabase();
  const [binding] = await database
    .select({
      id: schema.accountManagementBindings.id,
      accountId: schema.accountManagementBindings.accountId
    })
    .from(schema.accountManagementBindings)
    .where(eq(schema.accountManagementBindings.id, bindingId));

  if (!binding) {
    throw new PlatformMutationError('绑定关系不存在。', 404);
  }

  await ensureAccountBelongsToWorkspace(binding.accountId, workspaceId);

  await database
    .delete(schema.accountManagementBindings)
    .where(eq(schema.accountManagementBindings.id, bindingId));

  await recordAuditLog({
    workspaceId,
    actorId,
    action: 'account_management.binding.delete',
    entityType: 'account_management_account',
    entityId: String(binding.accountId),
    summary: '删除了一条绑定关系。',
    metadata: {
      accountId: binding.accountId,
      bindingId
    }
  });

  return getManagedAccountDetail(binding.accountId, workspaceId);
}

export async function createManagedAccountSecurity(
  accountId: number,
  actorId: string,
  workspaceId: string,
  input: AccountSecurityPayload
) {
  const database = requireDatabase();
  const account = await ensureAccountBelongsToWorkspace(accountId, workspaceId);

  await database.insert(schema.accountManagementSecurities).values({
    accountId,
    securityType: input.securityType,
    content: input.content.trim()
  });

  await recordAuditLog({
    workspaceId,
    actorId,
    action: 'account_management.security.create',
    entityType: 'account_management_account',
    entityId: String(accountId),
    summary: `为账号 ${account.account} 新增了一条密保信息。`,
    metadata: {
      accountId
    }
  });

  return getManagedAccountDetail(accountId, workspaceId);
}

export async function updateManagedAccountSecurity(
  securityId: number,
  actorId: string,
  workspaceId: string,
  input: AccountSecurityPayload
) {
  const database = requireDatabase();
  const [security] = await database
    .select({
      id: schema.accountManagementSecurities.id,
      accountId: schema.accountManagementSecurities.accountId
    })
    .from(schema.accountManagementSecurities)
    .where(eq(schema.accountManagementSecurities.id, securityId));

  if (!security) {
    throw new PlatformMutationError('密保信息不存在。', 404);
  }

  await ensureAccountBelongsToWorkspace(security.accountId, workspaceId);

  await database
    .update(schema.accountManagementSecurities)
    .set({
      securityType: input.securityType,
      content: input.content.trim(),
      updatedAt: new Date()
    })
    .where(eq(schema.accountManagementSecurities.id, securityId));

  await recordAuditLog({
    workspaceId,
    actorId,
    action: 'account_management.security.update',
    entityType: 'account_management_account',
    entityId: String(security.accountId),
    summary: '更新了一条密保信息。',
    metadata: {
      accountId: security.accountId,
      securityId
    }
  });

  return getManagedAccountDetail(security.accountId, workspaceId);
}

export async function deleteManagedAccountSecurity(
  securityId: number,
  actorId: string,
  workspaceId: string
) {
  const database = requireDatabase();
  const [security] = await database
    .select({
      id: schema.accountManagementSecurities.id,
      accountId: schema.accountManagementSecurities.accountId
    })
    .from(schema.accountManagementSecurities)
    .where(eq(schema.accountManagementSecurities.id, securityId));

  if (!security) {
    throw new PlatformMutationError('密保信息不存在。', 404);
  }

  await ensureAccountBelongsToWorkspace(security.accountId, workspaceId);

  await database
    .delete(schema.accountManagementSecurities)
    .where(eq(schema.accountManagementSecurities.id, securityId));

  await recordAuditLog({
    workspaceId,
    actorId,
    action: 'account_management.security.delete',
    entityType: 'account_management_account',
    entityId: String(security.accountId),
    summary: '删除了一条密保信息。',
    metadata: {
      accountId: security.accountId,
      securityId
    }
  });

  return getManagedAccountDetail(security.accountId, workspaceId);
}
