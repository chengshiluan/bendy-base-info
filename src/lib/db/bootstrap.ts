import { neon } from '@neondatabase/serverless';
import { eq, inArray } from 'drizzle-orm';
import { env } from '@/lib/env';
import { db, schema } from '@/lib/db';
import {
  permissionSeeds,
  systemRoleKeys,
  systemRoleSeeds,
  type SystemRoleKey
} from '@/lib/platform/rbac';

interface BootstrapResult {
  insertedPermissions: number;
  insertedRoles: number;
  patchedRoles: number;
  insertedRolePermissions: number;
  insertedWorkspaceMemberRoles: number;
}

let initializationPromise: Promise<void> | null = null;

const schemaInitializationStatements = [
  'create extension if not exists pgcrypto',
  `do $$
begin
  create type user_status as enum ('active', 'invited', 'disabled');
exception
  when duplicate_object then null;
end
$$`,
  `do $$
begin
  create type system_role as enum ('super_admin', 'admin', 'member');
exception
  when duplicate_object then null;
end
$$`,
  `do $$
begin
  create type workspace_status as enum ('active', 'archived');
exception
  when duplicate_object then null;
end
$$`,
  `do $$
begin
  create type permission_scope as enum ('global', 'workspace');
exception
  when duplicate_object then null;
end
$$`,
  `do $$
begin
  create type permission_type as enum ('menu', 'action');
exception
  when duplicate_object then null;
end
$$`,
  `do $$
begin
  create type ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
exception
  when duplicate_object then null;
end
$$`,
  `do $$
begin
  create type ticket_priority as enum ('low', 'medium', 'high', 'urgent');
exception
  when duplicate_object then null;
end
$$`,
  `do $$
begin
  create type notification_level as enum ('info', 'success', 'warning', 'error');
exception
  when duplicate_object then null;
end
$$`,
  `do $$
begin
  create type file_entity_type as enum ('ticket', 'ticket_comment', 'workspace', 'general');
exception
  when duplicate_object then null;
end
$$`,
  `create table if not exists users (
    id varchar(32) primary key,
    github_username varchar(39) not null,
    github_user_id varchar(32),
    email varchar(255),
    display_name varchar(120),
    avatar_url text,
    bio text,
    system_role system_role not null default 'member',
    status user_status not null default 'invited',
    email_login_enabled boolean not null default true,
    last_login_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `alter table users
    add column if not exists id varchar(32),
    add column if not exists github_username varchar(39),
    add column if not exists github_user_id varchar(32),
    add column if not exists email varchar(255),
    add column if not exists display_name varchar(120),
    add column if not exists avatar_url text,
    add column if not exists bio text,
    add column if not exists system_role system_role default 'member',
    add column if not exists status user_status default 'invited',
    add column if not exists email_login_enabled boolean default true,
    add column if not exists last_login_at timestamptz,
    add column if not exists metadata jsonb default '{}'::jsonb,
    add column if not exists created_at timestamptz default now(),
    add column if not exists updated_at timestamptz default now()`,
  'create unique index if not exists users_github_username_idx on users (github_username)',
  'create unique index if not exists users_email_idx on users (email)',
  `create table if not exists workspaces (
    id uuid primary key default gen_random_uuid(),
    slug varchar(80) not null,
    name varchar(120) not null,
    description text,
    status workspace_status not null default 'active',
    is_default boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `alter table workspaces
    add column if not exists id uuid default gen_random_uuid(),
    add column if not exists slug varchar(80),
    add column if not exists name varchar(120),
    add column if not exists description text,
    add column if not exists status workspace_status default 'active',
    add column if not exists is_default boolean default false,
    add column if not exists created_at timestamptz default now(),
    add column if not exists updated_at timestamptz default now()`,
  'create unique index if not exists workspaces_slug_idx on workspaces (slug)',
  `create table if not exists workspace_members (
    workspace_id uuid not null references workspaces(id) on delete cascade,
    user_id varchar(32) not null references users(id) on delete cascade,
    is_owner boolean not null default false,
    joined_at timestamptz not null default now(),
    primary key (workspace_id, user_id)
  )`,
  `alter table workspace_members
    add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
    add column if not exists user_id varchar(32) references users(id) on delete cascade,
    add column if not exists is_owner boolean default false,
    add column if not exists joined_at timestamptz default now()`,
  `create table if not exists teams (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    slug varchar(80) not null,
    name varchar(120) not null,
    description text,
    lead_user_id varchar(32) references users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `alter table teams
    add column if not exists id uuid default gen_random_uuid(),
    add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
    add column if not exists slug varchar(80),
    add column if not exists name varchar(120),
    add column if not exists description text,
    add column if not exists lead_user_id varchar(32) references users(id) on delete set null,
    add column if not exists created_at timestamptz default now(),
    add column if not exists updated_at timestamptz default now()`,
  'create unique index if not exists teams_workspace_slug_idx on teams (workspace_id, slug)',
  `create table if not exists roles (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    key varchar(80) not null,
    name varchar(120) not null,
    description text,
    is_system boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `alter table roles
    add column if not exists id uuid default gen_random_uuid(),
    add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
    add column if not exists key varchar(80),
    add column if not exists name varchar(120),
    add column if not exists description text,
    add column if not exists is_system boolean default false,
    add column if not exists created_at timestamptz default now(),
    add column if not exists updated_at timestamptz default now()`,
  'create unique index if not exists roles_workspace_key_idx on roles (workspace_id, key)',
  `create table if not exists permissions (
    id uuid primary key default gen_random_uuid(),
    code varchar(120) not null,
    name varchar(120) not null,
    module varchar(60) not null,
    action varchar(60) not null,
    scope permission_scope not null default 'workspace',
    permission_type permission_type not null default 'action',
    parent_code varchar(120),
    route varchar(255),
    sort_order integer not null default 0,
    is_system boolean not null default false,
    description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `alter table permissions
    add column if not exists id uuid default gen_random_uuid(),
    add column if not exists code varchar(120),
    add column if not exists name varchar(120),
    add column if not exists module varchar(60),
    add column if not exists action varchar(60),
    add column if not exists scope permission_scope default 'workspace',
    add column if not exists permission_type permission_type default 'action',
    add column if not exists parent_code varchar(120),
    add column if not exists route varchar(255),
    add column if not exists sort_order integer default 0,
    add column if not exists is_system boolean default false,
    add column if not exists description text,
    add column if not exists created_at timestamptz default now(),
    add column if not exists updated_at timestamptz default now()`,
  'create unique index if not exists permissions_code_idx on permissions (code)',
  `create table if not exists role_permissions (
    role_id uuid not null references roles(id) on delete cascade,
    permission_id uuid not null references permissions(id) on delete cascade,
    primary key (role_id, permission_id)
  )`,
  `alter table role_permissions
    add column if not exists role_id uuid references roles(id) on delete cascade,
    add column if not exists permission_id uuid references permissions(id) on delete cascade`,
  `create table if not exists workspace_member_roles (
    workspace_id uuid not null references workspaces(id) on delete cascade,
    user_id varchar(32) not null references users(id) on delete cascade,
    role_id uuid not null references roles(id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (workspace_id, user_id, role_id)
  )`,
  `alter table workspace_member_roles
    add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
    add column if not exists user_id varchar(32) references users(id) on delete cascade,
    add column if not exists role_id uuid references roles(id) on delete cascade,
    add column if not exists created_at timestamptz default now(),
    add column if not exists updated_at timestamptz default now()`,
  `create table if not exists team_members (
    team_id uuid not null references teams(id) on delete cascade,
    user_id varchar(32) not null references users(id) on delete cascade,
    role_id uuid references roles(id) on delete set null,
    joined_at timestamptz not null default now(),
    primary key (team_id, user_id)
  )`,
  `alter table team_members
    add column if not exists team_id uuid references teams(id) on delete cascade,
    add column if not exists user_id varchar(32) references users(id) on delete cascade,
    add column if not exists role_id uuid references roles(id) on delete set null,
    add column if not exists joined_at timestamptz default now()`,
  `create table if not exists notifications (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references workspaces(id) on delete cascade,
    user_id varchar(32) references users(id) on delete cascade,
    title varchar(160) not null,
    content text not null,
    level notification_level not null default 'info',
    is_read boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `alter table notifications
    add column if not exists id uuid default gen_random_uuid(),
    add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
    add column if not exists user_id varchar(32) references users(id) on delete cascade,
    add column if not exists title varchar(160),
    add column if not exists content text,
    add column if not exists level notification_level default 'info',
    add column if not exists is_read boolean default false,
    add column if not exists created_at timestamptz default now(),
    add column if not exists updated_at timestamptz default now()`,
  `create table if not exists tickets (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    code varchar(32) not null,
    title varchar(180) not null,
    description text,
    status ticket_status not null default 'open',
    priority ticket_priority not null default 'medium',
    reporter_id varchar(32) references users(id) on delete set null,
    assignee_id varchar(32) references users(id) on delete set null,
    comment_count integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `alter table tickets
    add column if not exists id uuid default gen_random_uuid(),
    add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
    add column if not exists code varchar(32),
    add column if not exists title varchar(180),
    add column if not exists description text,
    add column if not exists status ticket_status default 'open',
    add column if not exists priority ticket_priority default 'medium',
    add column if not exists reporter_id varchar(32) references users(id) on delete set null,
    add column if not exists assignee_id varchar(32) references users(id) on delete set null,
    add column if not exists comment_count integer default 0,
    add column if not exists created_at timestamptz default now(),
    add column if not exists updated_at timestamptz default now()`,
  'create unique index if not exists tickets_code_idx on tickets (code)',
  `create table if not exists ticket_comments (
    id uuid primary key default gen_random_uuid(),
    ticket_id uuid not null references tickets(id) on delete cascade,
    author_id varchar(32) references users(id) on delete set null,
    body text not null,
    attachment_ids jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `alter table ticket_comments
    add column if not exists id uuid default gen_random_uuid(),
    add column if not exists ticket_id uuid references tickets(id) on delete cascade,
    add column if not exists author_id varchar(32) references users(id) on delete set null,
    add column if not exists body text,
    add column if not exists attachment_ids jsonb default '[]'::jsonb,
    add column if not exists created_at timestamptz default now(),
    add column if not exists updated_at timestamptz default now()`,
  `create table if not exists file_assets (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references workspaces(id) on delete cascade,
    entity_type file_entity_type not null default 'general',
    entity_id varchar(120),
    bucket varchar(120),
    object_key text not null,
    file_name varchar(255) not null,
    mime_type varchar(120),
    size integer not null default 0,
    public_url text,
    uploaded_by varchar(32) references users(id) on delete set null,
    created_at timestamptz not null default now()
  )`,
  `alter table file_assets
    add column if not exists id uuid default gen_random_uuid(),
    add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
    add column if not exists entity_type file_entity_type default 'general',
    add column if not exists entity_id varchar(120),
    add column if not exists bucket varchar(120),
    add column if not exists object_key text,
    add column if not exists file_name varchar(255),
    add column if not exists mime_type varchar(120),
    add column if not exists size integer default 0,
    add column if not exists public_url text,
    add column if not exists uploaded_by varchar(32) references users(id) on delete set null,
    add column if not exists created_at timestamptz default now()`,
  `create table if not exists audit_logs (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references workspaces(id) on delete set null,
    actor_id varchar(32) references users(id) on delete set null,
    action varchar(120) not null,
    entity_type varchar(80) not null,
    entity_id varchar(120),
    summary text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  )`,
  `alter table audit_logs
    add column if not exists id uuid default gen_random_uuid(),
    add column if not exists workspace_id uuid references workspaces(id) on delete set null,
    add column if not exists actor_id varchar(32) references users(id) on delete set null,
    add column if not exists action varchar(120),
    add column if not exists entity_type varchar(80),
    add column if not exists entity_id varchar(120),
    add column if not exists summary text,
    add column if not exists metadata jsonb default '{}'::jsonb,
    add column if not exists created_at timestamptz default now()`
] as const;

function formatSqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function formatSqlValue(value: string | number | boolean | null) {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return formatSqlLiteral(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return `${value}`;
}

function formatValuesRow(values: Array<string | number | boolean | null>) {
  return `(${values.map((value) => formatSqlValue(value)).join(', ')})`;
}

function buildDatabaseInitializationSql() {
  const permissionValues = permissionSeeds
    .map((permission) =>
      formatValuesRow([
        permission.code,
        permission.name,
        permission.module,
        permission.action,
        permission.scope,
        permission.permissionType,
        permission.parentCode,
        permission.route,
        permission.sortOrder,
        permission.isSystem,
        permission.description
      ])
    )
    .join(',\n  ');

  const roleValues = systemRoleSeeds
    .map((role) => formatValuesRow([role.key, role.name, role.description]))
    .join(',\n    ');

  const rolePermissionStatements = systemRoleSeeds.map((role) => {
    const codes = role.permissionCodes
      .map((code) => formatSqlLiteral(code))
      .join(', ');
    return `insert into role_permissions (role_id, permission_id)
select seeded_roles.id, seeded_permissions.id
from roles as seeded_roles
join permissions as seeded_permissions
  on seeded_permissions.code in (${codes})
where seeded_roles.key = ${formatSqlLiteral(role.key)}
  and not exists (
    select 1
    from role_permissions as existing_role_permissions
    where existing_role_permissions.role_id = seeded_roles.id
  )
on conflict (role_id, permission_id) do nothing;`;
  });

  return [
    '-- Core schema initialization',
    ...schemaInitializationStatements.map((statement) => `${statement};`),
    '',
    '-- RBAC initialization',
    `insert into permissions (
  code,
  name,
  module,
  action,
  scope,
  permission_type,
  parent_code,
  route,
  sort_order,
  is_system,
  description
)
values
  ${permissionValues}
on conflict (code) do nothing;`,
    `insert into roles (workspace_id, key, name, description, is_system)
select workspaces.id, seeded_roles.key, seeded_roles.name, seeded_roles.description, true
from workspaces
cross join (
  values
    ${roleValues}
) as seeded_roles(key, name, description)
on conflict (workspace_id, key) do update
set
  name = case
    when coalesce(roles.name, '') = '' then excluded.name
    else roles.name
  end,
  description = case
    when coalesce(roles.description, '') = '' then excluded.description
    else roles.description
  end,
  is_system = true,
  updated_at = case
    when roles.is_system is distinct from true
      or coalesce(roles.name, '') = ''
      or coalesce(roles.description, '') = ''
    then now()
    else roles.updated_at
  end;`,
    ...rolePermissionStatements
  ].join('\n\n');
}

export const databaseInitializationSql = buildDatabaseInitializationSql();

const userReferenceColumns = [
  {
    table: 'workspace_members',
    column: 'user_id',
    constraint: 'workspace_members_user_id_users_id_fk',
    onDelete: 'cascade'
  },
  {
    table: 'teams',
    column: 'lead_user_id',
    constraint: 'teams_lead_user_id_users_id_fk',
    onDelete: 'set null'
  },
  {
    table: 'workspace_member_roles',
    column: 'user_id',
    constraint: 'workspace_member_roles_user_id_users_id_fk',
    onDelete: 'cascade'
  },
  {
    table: 'team_members',
    column: 'user_id',
    constraint: 'team_members_user_id_users_id_fk',
    onDelete: 'cascade'
  },
  {
    table: 'notifications',
    column: 'user_id',
    constraint: 'notifications_user_id_users_id_fk',
    onDelete: 'cascade'
  },
  {
    table: 'tickets',
    column: 'reporter_id',
    constraint: 'tickets_reporter_id_users_id_fk',
    onDelete: 'set null'
  },
  {
    table: 'tickets',
    column: 'assignee_id',
    constraint: 'tickets_assignee_id_users_id_fk',
    onDelete: 'set null'
  },
  {
    table: 'ticket_comments',
    column: 'author_id',
    constraint: 'ticket_comments_author_id_users_id_fk',
    onDelete: 'set null'
  },
  {
    table: 'file_assets',
    column: 'uploaded_by',
    constraint: 'file_assets_uploaded_by_users_id_fk',
    onDelete: 'set null'
  },
  {
    table: 'audit_logs',
    column: 'actor_id',
    constraint: 'audit_logs_actor_id_users_id_fk',
    onDelete: 'set null'
  }
] as const;

function quoteSqlIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteQualifiedTableName(value: string) {
  return value
    .split('.')
    .map((segment) => quoteSqlIdentifier(segment))
    .join('.');
}

async function getColumnDataType(
  sql: {
    query: (query: string) => Promise<unknown>;
  },
  tableName: string,
  columnName: string
) {
  const rows = (await sql.query(`
    select data_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = ${formatSqlLiteral(tableName)}
      and column_name = ${formatSqlLiteral(columnName)}
  `)) as Array<{ data_type: string }>;

  return rows[0]?.data_type ?? null;
}

export async function ensureGithubBackedUserIds() {
  if (!env.database.url) {
    return;
  }

  const sql = neon(env.database.url);
  const usersIdType = await getColumnDataType(sql, 'users', 'id');

  if (!usersIdType) {
    return;
  }

  const referenceTypes = await Promise.all(
    userReferenceColumns.map(({ table, column }) =>
      getColumnDataType(sql, table, column)
    )
  );
  const existingUserReferenceColumns = userReferenceColumns.filter(
    (_column, index) => referenceTypes[index] !== null
  );
  const rowsNeedingRealignment = (await sql.query(`
    select count(*)::int as value
    from users
    where github_user_id is not null
      and github_user_id <> id::text
  `)) as Array<{ value: number }>;
  const rowsNeedingGithubUserIdSync = (await sql.query(`
    select count(*)::int as value
    from users
    where id::text ~ '^[0-9]+$'
      and coalesce(github_user_id, '') <> id::text
  `)) as Array<{ value: number }>;

  const needsTypeMigration =
    usersIdType !== 'character varying' ||
    referenceTypes.some(
      (dataType) => dataType !== null && dataType !== 'character varying'
    );
  const needsIdRealignment = (rowsNeedingRealignment[0]?.value ?? 0) > 0;
  const needsGithubUserIdSync =
    (rowsNeedingGithubUserIdSync[0]?.value ?? 0) > 0;

  if (!needsTypeMigration && !needsIdRealignment && !needsGithubUserIdSync) {
    return;
  }

  await sql.query(
    `alter table users add column if not exists legacy_user_id varchar(64)`
  );
  await sql.query(`
    update users
    set
      legacy_user_id = coalesce(legacy_user_id, id::text),
      github_user_id = nullif(trim(github_user_id), '')
  `);

  const foreignKeys = (await sql.query(`
    select
      conrelid::regclass::text as table_name,
      conname
    from pg_constraint
    where contype = 'f'
      and confrelid = 'users'::regclass
  `)) as Array<{ table_name: string; conname: string }>;

  for (const foreignKey of foreignKeys) {
    await sql.query(
      `alter table ${quoteQualifiedTableName(foreignKey.table_name)} drop constraint if exists ${quoteSqlIdentifier(foreignKey.conname)}`
    );
  }

  await sql.query('alter table users alter column id drop default');

  if (usersIdType !== 'character varying') {
    await sql.query(`
      alter table users
      alter column id type varchar(32)
      using coalesce(github_user_id, legacy_user_id, id::text)
    `);
  }

  await sql.query(`
    update users
    set id = coalesce(github_user_id, legacy_user_id, id)
    where id is distinct from coalesce(github_user_id, legacy_user_id, id)
  `);
  await sql.query(`
    update users
    set github_user_id = id::text
    where id::text ~ '^[0-9]+$'
      and coalesce(github_user_id, '') <> id::text
  `);

  for (const { table, column } of existingUserReferenceColumns) {
    const dataType = await getColumnDataType(sql, table, column);

    if (dataType === 'character varying') {
      continue;
    }

    await sql.query(`
      alter table ${quoteSqlIdentifier(table)}
      alter column ${quoteSqlIdentifier(column)} type varchar(32)
      using ${quoteSqlIdentifier(column)}::text
    `);
  }

  for (const { table, column } of existingUserReferenceColumns) {
    await sql.query(`
      update ${quoteSqlIdentifier(table)} as target
      set ${quoteSqlIdentifier(column)} = users.id
      from users
      where target.${quoteSqlIdentifier(column)} = users.legacy_user_id
        and target.${quoteSqlIdentifier(column)} is distinct from users.id
    `);
  }

  for (const {
    table,
    column,
    constraint,
    onDelete
  } of existingUserReferenceColumns) {
    await sql.query(`
      alter table ${quoteSqlIdentifier(table)}
      add constraint ${quoteSqlIdentifier(constraint)}
      foreign key (${quoteSqlIdentifier(column)})
      references users(id)
      on delete ${onDelete}
    `);
  }
}

async function ensureSchemaInitialized() {
  if (!env.database.url) {
    return;
  }

  const sql = neon(env.database.url);

  for (const statement of schemaInitializationStatements) {
    await sql.query(statement);
  }
}

async function ensurePermissionSeeds() {
  if (!db) {
    return {
      insertedPermissions: 0,
      permissionIdByCode: new Map<string, string>()
    };
  }

  const seededCodes = permissionSeeds.map((permission) => permission.code);
  const seededCodeSet = new Set(seededCodes);
  const existingPermissions = seededCodes.length
    ? await db
        .select({
          id: schema.permissions.id,
          code: schema.permissions.code,
          name: schema.permissions.name,
          module: schema.permissions.module,
          action: schema.permissions.action,
          scope: schema.permissions.scope,
          permissionType: schema.permissions.permissionType,
          parentCode: schema.permissions.parentCode,
          route: schema.permissions.route,
          sortOrder: schema.permissions.sortOrder,
          isSystem: schema.permissions.isSystem,
          description: schema.permissions.description
        })
        .from(schema.permissions)
        .where(inArray(schema.permissions.code, seededCodes))
    : [];
  const existingSystemPermissions = await db
    .select({
      id: schema.permissions.id,
      code: schema.permissions.code
    })
    .from(schema.permissions)
    .where(eq(schema.permissions.isSystem, true));

  const existingCodeSet = new Set(
    existingPermissions.map((permission) => permission.code)
  );
  const missingPermissions = permissionSeeds.filter(
    (permission) => !existingCodeSet.has(permission.code)
  );

  if (missingPermissions.length) {
    await db
      .insert(schema.permissions)
      .values(
        missingPermissions.map((permission) => ({
          code: permission.code,
          name: permission.name,
          module: permission.module,
          action: permission.action,
          scope: permission.scope,
          permissionType: permission.permissionType,
          parentCode: permission.parentCode,
          route: permission.route,
          sortOrder: permission.sortOrder,
          isSystem: permission.isSystem,
          description: permission.description
        }))
      )
      .onConflictDoNothing({ target: schema.permissions.code });
  }

  const existingPermissionMap = new Map(
    existingPermissions.map(
      (permission) => [permission.code, permission] as const
    )
  );

  for (const permission of permissionSeeds) {
    const existingPermission = existingPermissionMap.get(permission.code);

    if (!existingPermission) {
      continue;
    }

    const needsPatch =
      existingPermission.name !== permission.name ||
      existingPermission.module !== permission.module ||
      existingPermission.action !== permission.action ||
      existingPermission.scope !== permission.scope ||
      existingPermission.permissionType !== permission.permissionType ||
      (existingPermission.parentCode ?? null) !== permission.parentCode ||
      (existingPermission.route ?? null) !== permission.route ||
      existingPermission.sortOrder !== permission.sortOrder ||
      existingPermission.isSystem !== permission.isSystem ||
      (existingPermission.description ?? null) !== permission.description;

    if (!needsPatch) {
      continue;
    }

    await db
      .update(schema.permissions)
      .set({
        name: permission.name,
        module: permission.module,
        action: permission.action,
        scope: permission.scope,
        permissionType: permission.permissionType,
        parentCode: permission.parentCode,
        route: permission.route,
        sortOrder: permission.sortOrder,
        isSystem: permission.isSystem,
        description: permission.description,
        updatedAt: new Date()
      })
      .where(eq(schema.permissions.code, permission.code));
  }

  const obsoleteSystemPermissionIds = existingSystemPermissions
    .filter((permission) => !seededCodeSet.has(permission.code))
    .map((permission) => permission.id);

  if (obsoleteSystemPermissionIds.length) {
    await db
      .delete(schema.permissions)
      .where(inArray(schema.permissions.id, obsoleteSystemPermissionIds));
  }

  const allPermissions = seededCodes.length
    ? await db
        .select({
          id: schema.permissions.id,
          code: schema.permissions.code
        })
        .from(schema.permissions)
        .where(inArray(schema.permissions.code, seededCodes))
    : [];

  return {
    insertedPermissions: missingPermissions.length,
    permissionIdByCode: new Map(
      allPermissions.map((permission) => [permission.code, permission.id])
    )
  };
}

async function resolveTargetWorkspaceIds(workspaceIds?: string[]) {
  if (!db) {
    return [];
  }

  const normalizedWorkspaceIds = Array.from(
    new Set((workspaceIds ?? []).filter(Boolean))
  );

  if (normalizedWorkspaceIds.length) {
    return normalizedWorkspaceIds;
  }

  const workspaces = await db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces);

  return workspaces.map((workspace) => workspace.id);
}

async function ensureSystemRoles(workspaceIds?: string[]) {
  if (!db) {
    return {
      insertedRoles: 0,
      patchedRoles: 0,
      roles: [] as {
        id: string;
        workspaceId: string;
        key: string;
      }[]
    };
  }

  const targetWorkspaceIds = await resolveTargetWorkspaceIds(workspaceIds);

  if (!targetWorkspaceIds.length) {
    return {
      insertedRoles: 0,
      patchedRoles: 0,
      roles: [] as {
        id: string;
        workspaceId: string;
        key: string;
      }[]
    };
  }

  const existingRoles = await db
    .select({
      id: schema.roles.id,
      workspaceId: schema.roles.workspaceId,
      key: schema.roles.key,
      name: schema.roles.name,
      description: schema.roles.description,
      isSystem: schema.roles.isSystem
    })
    .from(schema.roles)
    .where(inArray(schema.roles.workspaceId, targetWorkspaceIds));

  const roleSeedByKey = new Map(
    systemRoleSeeds.map((role) => [role.key, role] as const)
  );
  const existingRoleMap = new Map(
    existingRoles
      .filter((role) => roleSeedByKey.has(role.key as SystemRoleKey))
      .map((role) => [`${role.workspaceId}:${role.key}`, role])
  );

  const rolesToInsert = targetWorkspaceIds.flatMap((workspaceId) =>
    systemRoleSeeds
      .filter((role) => !existingRoleMap.has(`${workspaceId}:${role.key}`))
      .map((role) => ({
        workspaceId,
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: true
      }))
  );

  if (rolesToInsert.length) {
    await db
      .insert(schema.roles)
      .values(rolesToInsert)
      .onConflictDoNothing({
        target: [schema.roles.workspaceId, schema.roles.key]
      });
  }

  let patchedRoles = 0;

  for (const role of existingRoles) {
    const seed = roleSeedByKey.get(role.key as SystemRoleKey);

    if (!seed || !targetWorkspaceIds.includes(role.workspaceId)) {
      continue;
    }

    const updates: {
      name?: string;
      description?: string;
      isSystem?: boolean;
      updatedAt?: Date;
    } = {};

    if (!role.isSystem) {
      updates.isSystem = true;
    }

    if (!role.name.trim()) {
      updates.name = seed.name;
    }

    if (!role.description?.trim()) {
      updates.description = seed.description;
    }

    if (Object.keys(updates).length) {
      updates.updatedAt = new Date();

      await db
        .update(schema.roles)
        .set(updates)
        .where(eq(schema.roles.id, role.id));

      patchedRoles += 1;
    }
  }

  const roles = await db
    .select({
      id: schema.roles.id,
      workspaceId: schema.roles.workspaceId,
      key: schema.roles.key
    })
    .from(schema.roles)
    .where(inArray(schema.roles.workspaceId, targetWorkspaceIds));

  return {
    insertedRoles: rolesToInsert.length,
    patchedRoles,
    roles: roles.filter((role) =>
      systemRoleKeys.includes(role.key as SystemRoleKey)
    )
  };
}

async function ensureSystemRolePermissions(
  roles: {
    id: string;
    workspaceId: string;
    key: string;
  }[],
  permissionIdByCode: Map<string, string>
) {
  if (!db || !roles.length) {
    return 0;
  }

  const roleIds = roles.map((role) => role.id);
  const existingMappings = await db
    .select({
      roleId: schema.rolePermissions.roleId,
      permissionId: schema.rolePermissions.permissionId
    })
    .from(schema.rolePermissions)
    .where(inArray(schema.rolePermissions.roleId, roleIds));

  const existingMappingSet = new Set(
    existingMappings.map(
      (mapping) => `${mapping.roleId}:${mapping.permissionId}`
    )
  );
  const rolePermissionRows = roles.flatMap((role) => {
    const seed = systemRoleSeeds.find(
      (candidate) => candidate.key === role.key
    );

    if (!seed) {
      return [];
    }

    return seed.permissionCodes
      .map((code) => permissionIdByCode.get(code))
      .filter((permissionId): permissionId is string => Boolean(permissionId))
      .filter(
        (permissionId) => !existingMappingSet.has(`${role.id}:${permissionId}`)
      )
      .map((permissionId) => ({
        roleId: role.id,
        permissionId
      }));
  });

  if (!rolePermissionRows.length) {
    return 0;
  }

  await db
    .insert(schema.rolePermissions)
    .values(rolePermissionRows)
    .onConflictDoNothing({
      target: [
        schema.rolePermissions.roleId,
        schema.rolePermissions.permissionId
      ]
    });
  return rolePermissionRows.length;
}

async function ensureWorkspaceMemberRoleAssignments(
  roles: {
    id: string;
    workspaceId: string;
    key: string;
  }[]
) {
  if (!db || !roles.length) {
    return 0;
  }

  const targetWorkspaceIds = Array.from(
    new Set(roles.map((role) => role.workspaceId))
  );
  const roleIdByWorkspaceAndKey = new Map(
    roles.map((role) => [`${role.workspaceId}:${role.key}`, role.id] as const)
  );
  const workspaceMemberships = await db
    .select({
      workspaceId: schema.workspaceMembers.workspaceId,
      userId: schema.workspaceMembers.userId,
      systemRole: schema.users.systemRole
    })
    .from(schema.workspaceMembers)
    .innerJoin(
      schema.users,
      eq(schema.workspaceMembers.userId, schema.users.id)
    )
    .where(inArray(schema.workspaceMembers.workspaceId, targetWorkspaceIds));

  const existingAssignments = await db
    .select({
      workspaceId: schema.workspaceMemberRoles.workspaceId,
      userId: schema.workspaceMemberRoles.userId
    })
    .from(schema.workspaceMemberRoles)
    .where(
      inArray(schema.workspaceMemberRoles.workspaceId, targetWorkspaceIds)
    );

  const existingAssignmentSet = new Set(
    existingAssignments.map(
      (assignment) => `${assignment.workspaceId}:${assignment.userId}`
    )
  );
  const roleAssignmentsToInsert = workspaceMemberships
    .filter(
      (membership) =>
        !existingAssignmentSet.has(
          `${membership.workspaceId}:${membership.userId}`
        )
    )
    .map((membership) => {
      const roleId = roleIdByWorkspaceAndKey.get(
        `${membership.workspaceId}:${membership.systemRole}`
      );

      if (!roleId) {
        return null;
      }

      return {
        workspaceId: membership.workspaceId,
        userId: membership.userId,
        roleId
      };
    })
    .filter(
      (
        assignment
      ): assignment is {
        workspaceId: string;
        userId: string;
        roleId: string;
      } => Boolean(assignment)
    );

  if (!roleAssignmentsToInsert.length) {
    return 0;
  }

  await db
    .insert(schema.workspaceMemberRoles)
    .values(roleAssignmentsToInsert)
    .onConflictDoNothing({
      target: [
        schema.workspaceMemberRoles.workspaceId,
        schema.workspaceMemberRoles.userId,
        schema.workspaceMemberRoles.roleId
      ]
    });

  return roleAssignmentsToInsert.length;
}

export async function ensureWorkspaceRbacInitialized(workspaceIds?: string[]) {
  if (!db) {
    return {
      insertedPermissions: 0,
      insertedRoles: 0,
      patchedRoles: 0,
      insertedRolePermissions: 0,
      insertedWorkspaceMemberRoles: 0
    } satisfies BootstrapResult;
  }

  const { insertedPermissions, permissionIdByCode } =
    await ensurePermissionSeeds();
  const { insertedRoles, patchedRoles, roles } =
    await ensureSystemRoles(workspaceIds);
  const insertedRolePermissions = await ensureSystemRolePermissions(
    roles,
    permissionIdByCode
  );
  const insertedWorkspaceMemberRoles =
    await ensureWorkspaceMemberRoleAssignments(roles);

  return {
    insertedPermissions,
    insertedRoles,
    patchedRoles,
    insertedRolePermissions,
    insertedWorkspaceMemberRoles
  } satisfies BootstrapResult;
}

export async function ensureDatabaseInitialized() {
  if (!env.database.enabled || !env.database.url) {
    return;
  }

  if (!initializationPromise) {
    initializationPromise = (async () => {
      await ensureSchemaInitialized();
      await ensureGithubBackedUserIds();
      const result = await ensureWorkspaceRbacInitialized();

      if (
        result.insertedPermissions ||
        result.insertedRoles ||
        result.patchedRoles ||
        result.insertedRolePermissions ||
        result.insertedWorkspaceMemberRoles
      ) {
        console.info('[db:init] database bootstrap completed', result);
      }
    })().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  await initializationPromise;
}
