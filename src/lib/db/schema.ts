import { sql } from 'drizzle-orm';
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core';

// --- enums (sqlite has no native enums; we use text columns with TS-level enum constraint) ---

export const userStatusValues = ['active', 'invited', 'disabled'] as const;
export const systemRoleValues = ['super_admin', 'admin', 'member'] as const;
export const workspaceStatusValues = ['active', 'archived'] as const;
export const permissionScopeValues = ['global', 'workspace'] as const;
export const permissionTypeValues = ['menu', 'action'] as const;
export const ticketStatusValues = [
  'open',
  'in_progress',
  'resolved',
  'closed'
] as const;
export const ticketPriorityValues = [
  'low',
  'medium',
  'high',
  'urgent'
] as const;
export const notificationLevelValues = [
  'info',
  'success',
  'warning',
  'error'
] as const;
export const accountAttributeValues = ['self_hosted', 'third_party'] as const;
export const accountConfidenceValues = [
  'very_high',
  'high',
  'medium',
  'low'
] as const;
export const accountStatusValues = [
  'cancelled',
  'available',
  'banned'
] as const;
export const platformRegionValues = [
  'overseas',
  'mainland',
  'hk_mo_tw'
] as const;
export const accountSecurityTypeValues = [
  'question',
  'two_factor',
  'contact',
  'emergency_email'
] as const;
export const fileEntityTypeValues = [
  'ticket',
  'ticket_comment',
  'workspace',
  'general'
] as const;
export const opsServerStatusValues = [
  'pending',
  'collecting',
  'healthy',
  'unreachable',
  'disabled'
] as const;
export const opsServerAuthTypeValues = ['password', 'private_key'] as const;

// --- helpers ---

const uuidPk = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const uuidCol = (name: string) => text(name);

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
};

// --- tables ---

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    githubUsername: text('github_username').notNull(),
    githubUserId: text('github_user_id'),
    email: text('email'),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    systemRole: text('system_role', { enum: systemRoleValues })
      .default('member')
      .notNull(),
    status: text('status', { enum: userStatusValues })
      .default('invited')
      .notNull(),
    emailLoginEnabled: integer('email_login_enabled', { mode: 'boolean' })
      .default(true)
      .notNull(),
    lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
    metadata: text('metadata', { mode: 'json' })
      .$type<Record<string, unknown>>()
      .default({}),
    ...timestamps
  },
  (table) => ({
    githubUsernameIdx: uniqueIndex('users_github_username_idx').on(
      table.githubUsername
    ),
    emailIdx: uniqueIndex('users_email_idx').on(table.email)
  })
);

export const workspaces = sqliteTable(
  'workspaces',
  {
    id: uuidPk(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status', { enum: workspaceStatusValues })
      .default('active')
      .notNull(),
    isDefault: integer('is_default', { mode: 'boolean' })
      .default(false)
      .notNull(),
    ...timestamps
  },
  (table) => ({
    slugIdx: uniqueIndex('workspaces_slug_idx').on(table.slug)
  })
);

export const workspaceMembers = sqliteTable(
  'workspace_members',
  {
    workspaceId: uuidCol('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    isOwner: integer('is_owner', { mode: 'boolean' }).default(false).notNull(),
    joinedAt: integer('joined_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workspaceId, table.userId] })
  })
);

export const teams = sqliteTable(
  'teams',
  {
    id: uuidPk(),
    workspaceId: uuidCol('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    leadUserId: text('lead_user_id').references(() => users.id, {
      onDelete: 'set null'
    }),
    ...timestamps
  },
  (table) => ({
    workspaceSlugIdx: uniqueIndex('teams_workspace_slug_idx').on(
      table.workspaceId,
      table.slug
    )
  })
);

export const roles = sqliteTable(
  'roles',
  {
    id: uuidPk(),
    workspaceId: uuidCol('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    isSystem: integer('is_system', { mode: 'boolean' })
      .default(false)
      .notNull(),
    ...timestamps
  },
  (table) => ({
    workspaceKeyIdx: uniqueIndex('roles_workspace_key_idx').on(
      table.workspaceId,
      table.key
    )
  })
);

export const permissions = sqliteTable(
  'permissions',
  {
    id: uuidPk(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    module: text('module').notNull(),
    action: text('action').notNull(),
    scope: text('scope', { enum: permissionScopeValues })
      .default('workspace')
      .notNull(),
    permissionType: text('permission_type', { enum: permissionTypeValues })
      .default('action')
      .notNull(),
    parentCode: text('parent_code'),
    route: text('route'),
    sortOrder: integer('sort_order').default(0).notNull(),
    isSystem: integer('is_system', { mode: 'boolean' })
      .default(false)
      .notNull(),
    description: text('description'),
    ...timestamps
  },
  (table) => ({
    codeIdx: uniqueIndex('permissions_code_idx').on(table.code)
  })
);

export const rolePermissions = sqliteTable(
  'role_permissions',
  {
    roleId: uuidCol('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuidCol('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.permissionId] })
  })
);

export const workspaceMemberRoles = sqliteTable(
  'workspace_member_roles',
  {
    workspaceId: uuidCol('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuidCol('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    ...timestamps
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.workspaceId, table.userId, table.roleId]
    })
  })
);

export const teamMembers = sqliteTable(
  'team_members',
  {
    teamId: uuidCol('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuidCol('role_id').references(() => roles.id, {
      onDelete: 'set null'
    }),
    joinedAt: integer('joined_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (table) => ({
    pk: primaryKey({ columns: [table.teamId, table.userId] })
  })
);

export const notifications = sqliteTable('notifications', {
  id: uuidPk(),
  workspaceId: uuidCol('workspace_id').references(() => workspaces.id, {
    onDelete: 'cascade'
  }),
  userId: text('user_id').references(() => users.id, {
    onDelete: 'cascade'
  }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  level: text('level', { enum: notificationLevelValues })
    .default('info')
    .notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).default(false).notNull(),
  ...timestamps
});

export const tickets = sqliteTable(
  'tickets',
  {
    id: uuidPk(),
    workspaceId: uuidCol('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status', { enum: ticketStatusValues })
      .default('open')
      .notNull(),
    priority: text('priority', { enum: ticketPriorityValues })
      .default('medium')
      .notNull(),
    reporterId: text('reporter_id').references(() => users.id, {
      onDelete: 'set null'
    }),
    assigneeId: text('assignee_id').references(() => users.id, {
      onDelete: 'set null'
    }),
    commentCount: integer('comment_count').default(0).notNull(),
    ...timestamps
  },
  (table) => ({
    codeIdx: uniqueIndex('tickets_code_idx').on(table.code)
  })
);

export const ticketComments = sqliteTable('ticket_comments', {
  id: uuidPk(),
  ticketId: uuidCol('ticket_id')
    .notNull()
    .references(() => tickets.id, { onDelete: 'cascade' }),
  authorId: text('author_id').references(() => users.id, {
    onDelete: 'set null'
  }),
  body: text('body').notNull(),
  attachmentIds: text('attachment_ids', { mode: 'json' })
    .$type<string[]>()
    .default([])
    .notNull(),
  ...timestamps
});

export const fileAssets = sqliteTable('file_assets', {
  id: uuidPk(),
  workspaceId: uuidCol('workspace_id').references(() => workspaces.id, {
    onDelete: 'cascade'
  }),
  entityType: text('entity_type', { enum: fileEntityTypeValues })
    .default('general')
    .notNull(),
  entityId: text('entity_id'),
  bucket: text('bucket'),
  objectKey: text('object_key').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type'),
  size: integer('size').default(0).notNull(),
  publicUrl: text('public_url'),
  uploadedBy: text('uploaded_by').references(() => users.id, {
    onDelete: 'set null'
  }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
});

export const auditLogs = sqliteTable('audit_logs', {
  id: uuidPk(),
  workspaceId: uuidCol('workspace_id').references(() => workspaces.id, {
    onDelete: 'set null'
  }),
  actorId: text('actor_id').references(() => users.id, {
    onDelete: 'set null'
  }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  summary: text('summary').notNull(),
  metadata: text('metadata', { mode: 'json' })
    .$type<Record<string, unknown>>()
    .default({}),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
});

export const accountManagementPlatforms = sqliteTable(
  'account_mang_platforms',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    workspaceId: uuidCol('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    url: text('url').notNull(),
    iconUrl: text('icon_url').notNull(),
    region: text('region', { enum: platformRegionValues })
      .default('mainland')
      .notNull(),
    ...timestamps
  }
);

export const accountManagementAccounts = sqliteTable('account_mang_accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: uuidCol('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  platformId: integer('platform_id').references(
    () => accountManagementPlatforms.id,
    {
      onDelete: 'set null'
    }
  ),
  account: text('account').notNull(),
  attribute: text('attribute', { enum: accountAttributeValues })
    .default('self_hosted')
    .notNull(),
  confidence: text('confidence', { enum: accountConfidenceValues })
    .default('medium')
    .notNull(),
  passwordHash: text('password_hash'),
  registeredAt: integer('registered_at', { mode: 'timestamp' }),
  status: text('status', { enum: accountStatusValues })
    .default('available')
    .notNull(),
  wealthJson: text('wealth_json'),
  ...timestamps
});

export const accountManagementKeys = sqliteTable('account_mang_account_keys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accountId: integer('account_id')
    .notNull()
    .references(() => accountManagementAccounts.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  ...timestamps
});

export const accountManagementBindings = sqliteTable(
  'account_mang_account_bindings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    accountId: integer('account_id')
      .notNull()
      .references(() => accountManagementAccounts.id, { onDelete: 'cascade' }),
    platformId: integer('platform_id').references(
      () => accountManagementPlatforms.id,
      {
        onDelete: 'set null'
      }
    ),
    platformAccount: text('platform_account').notNull(),
    ...timestamps
  }
);

export const accountManagementRegistrationSources = sqliteTable(
  'account_mang_registration_sources',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    workspaceId: uuidCol('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    website: text('website'),
    remark: text('remark'),
    ...timestamps
  },
  (table) => ({
    workspaceCodeIdx: uniqueIndex(
      'account_mang_registration_sources_workspace_code_idx'
    ).on(table.workspaceId, table.code)
  })
);

export const accountManagementAccountRegistrationSources = sqliteTable(
  'account_mang_account_registration_sources',
  {
    accountId: integer('account_id')
      .notNull()
      .references(() => accountManagementAccounts.id, { onDelete: 'cascade' }),
    sourceId: integer('source_id')
      .notNull()
      .references(() => accountManagementRegistrationSources.id, {
        onDelete: 'cascade'
      }),
    ...timestamps
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.accountId, table.sourceId]
    })
  })
);

export const accountManagementSecurities = sqliteTable(
  'account_mang_account_securities',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    accountId: integer('account_id')
      .notNull()
      .references(() => accountManagementAccounts.id, { onDelete: 'cascade' }),
    securityType: text('security_type', { enum: accountSecurityTypeValues })
      .default('question')
      .notNull(),
    content: text('content').notNull(),
    ...timestamps
  }
);

export const opsServers = sqliteTable(
  'ops_servers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    workspaceId: uuidCol('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    hostname: text('hostname'),
    ip: text('ip').notNull(),
    sshPort: integer('ssh_port').default(22).notNull(),
    sshUser: text('ssh_user').notNull(),
    authType: text('auth_type', { enum: opsServerAuthTypeValues })
      .default('password')
      .notNull(),
    secretCipher: text('secret_cipher'),
    secretPassphraseCipher: text('secret_passphrase_cipher'),
    status: text('status', { enum: opsServerStatusValues })
      .default('pending')
      .notNull(),
    lastCollectedAt: integer('last_collected_at', { mode: 'timestamp' }),
    lastFactsId: integer('last_facts_id'),
    collectError: text('collect_error'),
    remark: text('remark'),
    ...timestamps
  },
  (table) => ({
    workspaceNameIdx: uniqueIndex('ops_servers_workspace_name_idx').on(
      table.workspaceId,
      table.name
    ),
    workspaceEndpointIdx: uniqueIndex('ops_servers_workspace_endpoint_idx').on(
      table.workspaceId,
      table.ip,
      table.sshPort
    )
  })
);

export const opsServerFacts = sqliteTable('ops_server_facts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  serverId: integer('server_id')
    .notNull()
    .references(() => opsServers.id, { onDelete: 'cascade' }),
  collectedAt: integer('collected_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  osName: text('os_name'),
  osVersion: text('os_version'),
  kernel: text('kernel'),
  arch: text('arch'),
  cpuModel: text('cpu_model'),
  cpuCores: integer('cpu_cores'),
  memoryTotalMb: integer('memory_total_mb'),
  memoryUsedMb: integer('memory_used_mb'),
  diskJson: text('disk_json', { mode: 'json' })
    .$type<unknown[]>()
    .default([]),
  networkJson: text('network_json', { mode: 'json' })
    .$type<unknown[]>()
    .default([]),
  servicesJson: text('services_json', { mode: 'json' })
    .$type<unknown[]>()
    .default([]),
  uptimeSeconds: integer('uptime_seconds'),
  rawJson: text('raw_json', { mode: 'json' })
    .$type<Record<string, unknown>>()
    .default({}),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
});

export const schema = {
  users,
  workspaces,
  workspaceMembers,
  workspaceMemberRoles,
  teams,
  teamMembers,
  roles,
  permissions,
  rolePermissions,
  notifications,
  tickets,
  ticketComments,
  fileAssets,
  auditLogs,
  accountManagementPlatforms,
  accountManagementAccounts,
  accountManagementKeys,
  accountManagementBindings,
  accountManagementRegistrationSources,
  accountManagementAccountRegistrationSources,
  accountManagementSecurities,
  opsServers,
  opsServerFacts
};
