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
    id uuid primary key default gen_random_uuid(),
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
    add column if not exists id uuid default gen_random_uuid(),
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
    user_id uuid not null references users(id) on delete cascade,
    is_owner boolean not null default false,
    joined_at timestamptz not null default now(),
    primary key (workspace_id, user_id)
  )`,
  `alter table workspace_members
    add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
    add column if not exists user_id uuid references users(id) on delete cascade,
    add column if not exists is_owner boolean default false,
    add column if not exists joined_at timestamptz default now()`,
  `create table if not exists teams (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    slug varchar(80) not null,
    name varchar(120) not null,
    description text,
    lead_user_id uuid references users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `alter table teams
    add column if not exists id uuid default gen_random_uuid(),
    add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
    add column if not exists slug varchar(80),
    add column if not exists name varchar(120),
    add column if not exists description text,
    add column if not exists lead_user_id uuid references users(id) on delete set null,
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
  `create table if not exists team_members (
    team_id uuid not null references teams(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    role_id uuid references roles(id) on delete set null,
    joined_at timestamptz not null default now(),
    primary key (team_id, user_id)
  )`,
  `alter table team_members
    add column if not exists team_id uuid references teams(id) on delete cascade,
    add column if not exists user_id uuid references users(id) on delete cascade,
    add column if not exists role_id uuid references roles(id) on delete set null,
    add column if not exists joined_at timestamptz default now()`,
  `create table if not exists notifications (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references workspaces(id) on delete cascade,
    user_id uuid references users(id) on delete cascade,
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
    add column if not exists user_id uuid references users(id) on delete cascade,
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
    reporter_id uuid references users(id) on delete set null,
    assignee_id uuid references users(id) on delete set null,
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
    add column if not exists reporter_id uuid references users(id) on delete set null,
    add column if not exists assignee_id uuid references users(id) on delete set null,
    add column if not exists comment_count integer default 0,
    add column if not exists created_at timestamptz default now(),
    add column if not exists updated_at timestamptz default now()`,
  'create unique index if not exists tickets_code_idx on tickets (code)',
  `create table if not exists ticket_comments (
    id uuid primary key default gen_random_uuid(),
    ticket_id uuid not null references tickets(id) on delete cascade,
    author_id uuid references users(id) on delete set null,
    body text not null,
    attachment_ids jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `alter table ticket_comments
    add column if not exists id uuid default gen_random_uuid(),
    add column if not exists ticket_id uuid references tickets(id) on delete cascade,
    add column if not exists author_id uuid references users(id) on delete set null,
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
    uploaded_by uuid references users(id) on delete set null,
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
    add column if not exists uploaded_by uuid references users(id) on delete set null,
    add column if not exists created_at timestamptz default now()`,
  `create table if not exists audit_logs (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references workspaces(id) on delete set null,
    actor_id uuid references users(id) on delete set null,
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
    add column if not exists actor_id uuid references users(id) on delete set null,
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

function formatValuesRow(values: string[]) {
  return `(${values.map((value) => formatSqlLiteral(value)).join(', ')})`;
}

function buildDatabaseInitializationSql() {
  const permissionValues = permissionSeeds
    .map((permission) =>
      formatValuesRow([
        permission.code,
        permission.name,
        permission.module,
        permission.action,
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
    `insert into permissions (code, name, module, action, description)
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
  const existingPermissions = seededCodes.length
    ? await db
        .select({
          id: schema.permissions.id,
          code: schema.permissions.code
        })
        .from(schema.permissions)
        .where(inArray(schema.permissions.code, seededCodes))
    : [];

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
          description: permission.description
        }))
      )
      .onConflictDoNothing({ target: schema.permissions.code });
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
    .select({ roleId: schema.rolePermissions.roleId })
    .from(schema.rolePermissions)
    .where(inArray(schema.rolePermissions.roleId, roleIds));

  const mappedRoleIds = new Set(
    existingMappings.map((mapping) => mapping.roleId)
  );
  const rolePermissionRows = roles.flatMap((role) => {
    if (mappedRoleIds.has(role.id)) {
      return [];
    }

    const seed = systemRoleSeeds.find(
      (candidate) => candidate.key === role.key
    );

    if (!seed) {
      return [];
    }

    return seed.permissionCodes
      .map((code) => permissionIdByCode.get(code))
      .filter((permissionId): permissionId is string => Boolean(permissionId))
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

export async function ensureWorkspaceRbacInitialized(workspaceIds?: string[]) {
  if (!db) {
    return {
      insertedPermissions: 0,
      insertedRoles: 0,
      patchedRoles: 0,
      insertedRolePermissions: 0
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

  return {
    insertedPermissions,
    insertedRoles,
    patchedRoles,
    insertedRolePermissions
  } satisfies BootstrapResult;
}

export async function ensureDatabaseInitialized() {
  if (!env.database.enabled || !env.database.url) {
    return;
  }

  if (!initializationPromise) {
    initializationPromise = (async () => {
      await ensureSchemaInitialized();
      const result = await ensureWorkspaceRbacInitialized();

      if (
        result.insertedPermissions ||
        result.insertedRoles ||
        result.patchedRoles ||
        result.insertedRolePermissions
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
