import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';

export const userStatusEnum = pgEnum('user_status', [
  'active',
  'invited',
  'disabled'
]);

export const systemRoleEnum = pgEnum('system_role', [
  'super_admin',
  'admin',
  'member'
]);

export const workspaceStatusEnum = pgEnum('workspace_status', [
  'active',
  'archived'
]);

export const permissionScopeEnum = pgEnum('permission_scope', [
  'global',
  'workspace'
]);

export const permissionTypeEnum = pgEnum('permission_type', ['menu', 'action']);

export const ticketStatusEnum = pgEnum('ticket_status', [
  'open',
  'in_progress',
  'resolved',
  'closed'
]);

export const ticketPriorityEnum = pgEnum('ticket_priority', [
  'low',
  'medium',
  'high',
  'urgent'
]);

export const notificationLevelEnum = pgEnum('notification_level', [
  'info',
  'success',
  'warning',
  'error'
]);

export const accountAttributeEnum = pgEnum('account_attribute', [
  'self_hosted',
  'third_party'
]);

export const accountConfidenceEnum = pgEnum('account_confidence', [
  'very_high',
  'high',
  'medium',
  'low'
]);

export const accountStatusEnum = pgEnum('account_status', [
  'cancelled',
  'available',
  'banned'
]);

export const platformRegionEnum = pgEnum('platform_region', [
  'overseas',
  'mainland',
  'hk_mo_tw'
]);

export const accountSecurityTypeEnum = pgEnum('account_security_type', [
  'question',
  'two_factor',
  'contact',
  'emergency_email'
]);

export const fileEntityTypeEnum = pgEnum('file_entity_type', [
  'ticket',
  'ticket_comment',
  'workspace',
  'general'
]);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
};

export const users = pgTable(
  'users',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    githubUsername: varchar('github_username', { length: 39 }).notNull(),
    githubUserId: varchar('github_user_id', { length: 32 }),
    email: varchar('email', { length: 255 }),
    displayName: varchar('display_name', { length: 120 }),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    systemRole: systemRoleEnum('system_role').default('member').notNull(),
    status: userStatusEnum('status').default('invited').notNull(),
    emailLoginEnabled: boolean('email_login_enabled').default(true).notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    ...timestamps
  },
  (table) => ({
    githubUsernameIdx: uniqueIndex('users_github_username_idx').on(
      table.githubUsername
    ),
    emailIdx: uniqueIndex('users_email_idx').on(table.email)
  })
);

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: varchar('slug', { length: 80 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    status: workspaceStatusEnum('status').default('active').notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    ...timestamps
  },
  (table) => ({
    slugIdx: uniqueIndex('workspaces_slug_idx').on(table.slug)
  })
);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    isOwner: boolean('is_owner').default(false).notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workspaceId, table.userId] })
  })
);

export const teams = pgTable(
  'teams',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 80 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    leadUserId: varchar('lead_user_id', { length: 64 }).references(
      () => users.id,
      {
        onDelete: 'set null'
      }
    ),
    ...timestamps
  },
  (table) => ({
    workspaceSlugIdx: uniqueIndex('teams_workspace_slug_idx').on(
      table.workspaceId,
      table.slug
    )
  })
);

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 80 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    isSystem: boolean('is_system').default(false).notNull(),
    ...timestamps
  },
  (table) => ({
    workspaceKeyIdx: uniqueIndex('roles_workspace_key_idx').on(
      table.workspaceId,
      table.key
    )
  })
);

export const permissions = pgTable(
  'permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 120 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    module: varchar('module', { length: 60 }).notNull(),
    action: varchar('action', { length: 60 }).notNull(),
    scope: permissionScopeEnum('scope').default('workspace').notNull(),
    permissionType: permissionTypeEnum('permission_type')
      .default('action')
      .notNull(),
    parentCode: varchar('parent_code', { length: 120 }),
    route: varchar('route', { length: 255 }),
    sortOrder: integer('sort_order').default(0).notNull(),
    isSystem: boolean('is_system').default(false).notNull(),
    description: text('description'),
    ...timestamps
  },
  (table) => ({
    codeIdx: uniqueIndex('permissions_code_idx').on(table.code)
  })
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.permissionId] })
  })
);

export const workspaceMemberRoles = pgTable(
  'workspace_member_roles',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
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

export const teamMembers = pgTable(
  'team_members',
  {
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id').references(() => roles.id, {
      onDelete: 'set null'
    }),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.teamId, table.userId] })
  })
);

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, {
    onDelete: 'cascade'
  }),
  userId: varchar('user_id', { length: 64 }).references(() => users.id, {
    onDelete: 'cascade'
  }),
  title: varchar('title', { length: 160 }).notNull(),
  content: text('content').notNull(),
  level: notificationLevelEnum('level').default('info').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  ...timestamps
});

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 32 }).notNull(),
    title: varchar('title', { length: 180 }).notNull(),
    description: text('description'),
    status: ticketStatusEnum('status').default('open').notNull(),
    priority: ticketPriorityEnum('priority').default('medium').notNull(),
    reporterId: varchar('reporter_id', { length: 64 }).references(
      () => users.id,
      {
        onDelete: 'set null'
      }
    ),
    assigneeId: varchar('assignee_id', { length: 64 }).references(
      () => users.id,
      {
        onDelete: 'set null'
      }
    ),
    commentCount: integer('comment_count').default(0).notNull(),
    ...timestamps
  },
  (table) => ({
    codeIdx: uniqueIndex('tickets_code_idx').on(table.code)
  })
);

export const ticketComments = pgTable('ticket_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => tickets.id, { onDelete: 'cascade' }),
  authorId: varchar('author_id', { length: 64 }).references(() => users.id, {
    onDelete: 'set null'
  }),
  body: text('body').notNull(),
  attachmentIds: jsonb('attachment_ids')
    .$type<string[]>()
    .default([])
    .notNull(),
  ...timestamps
});

export const fileAssets = pgTable('file_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, {
    onDelete: 'cascade'
  }),
  entityType: fileEntityTypeEnum('entity_type').default('general').notNull(),
  entityId: varchar('entity_id', { length: 120 }),
  bucket: varchar('bucket', { length: 120 }),
  objectKey: text('object_key').notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 120 }),
  size: integer('size').default(0).notNull(),
  publicUrl: text('public_url'),
  uploadedBy: varchar('uploaded_by', { length: 64 }).references(
    () => users.id,
    {
      onDelete: 'set null'
    }
  ),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull()
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, {
    onDelete: 'set null'
  }),
  actorId: varchar('actor_id', { length: 64 }).references(() => users.id, {
    onDelete: 'set null'
  }),
  action: varchar('action', { length: 120 }).notNull(),
  entityType: varchar('entity_type', { length: 80 }).notNull(),
  entityId: varchar('entity_id', { length: 120 }),
  summary: text('summary').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull()
});

export const accountManagementPlatforms = pgTable('account_mang_platforms', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  url: text('url').notNull(),
  iconUrl: text('icon_url').notNull(),
  region: platformRegionEnum('region').default('mainland').notNull(),
  ...timestamps
});

export const accountManagementAccounts = pgTable('account_mang_accounts', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  platformId: integer('platform_id').references(
    () => accountManagementPlatforms.id,
    {
      onDelete: 'set null'
    }
  ),
  account: varchar('account', { length: 255 }).notNull(),
  attribute: accountAttributeEnum('attribute').default('self_hosted').notNull(),
  confidence: accountConfidenceEnum('confidence').default('medium').notNull(),
  passwordHash: varchar('password_hash', { length: 32 }),
  registeredAt: timestamp('registered_at', { withTimezone: true }),
  status: accountStatusEnum('status').default('available').notNull(),
  wealthJson: text('wealth_json'),
  ...timestamps
});

export const accountManagementKeys = pgTable('account_mang_account_keys', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  accountId: integer('account_id')
    .notNull()
    .references(() => accountManagementAccounts.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 120 }).notNull(),
  content: text('content').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  ...timestamps
});

export const accountManagementBindings = pgTable(
  'account_mang_account_bindings',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    accountId: integer('account_id')
      .notNull()
      .references(() => accountManagementAccounts.id, { onDelete: 'cascade' }),
    platformId: integer('platform_id').references(
      () => accountManagementPlatforms.id,
      {
        onDelete: 'set null'
      }
    ),
    platformAccount: varchar('platform_account', { length: 255 }).notNull(),
    ...timestamps
  }
);

export const accountManagementRegistrationSources = pgTable(
  'account_mang_registration_sources',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    code: varchar('code', { length: 120 }).notNull(),
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

export const accountManagementAccountRegistrationSources = pgTable(
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

export const accountManagementSecurities = pgTable(
  'account_mang_account_securities',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    accountId: integer('account_id')
      .notNull()
      .references(() => accountManagementAccounts.id, { onDelete: 'cascade' }),
    securityType: accountSecurityTypeEnum('security_type')
      .default('question')
      .notNull(),
    content: text('content').notNull(),
    ...timestamps
  }
);

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
  accountManagementSecurities
};
