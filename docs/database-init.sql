-- Bendywork Base database initialization
-- Mirrors the bootstrap logic in src/lib/db/bootstrap.ts
-- Safe to run repeatedly: existing tables, columns, indexes and seed data
-- will be reused, and missing RBAC records will be backfilled.

create extension if not exists pgcrypto;

do $$
begin
  create type user_status as enum ('active', 'invited', 'disabled');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type system_role as enum ('super_admin', 'admin', 'member');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type workspace_status as enum ('active', 'archived');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type ticket_priority as enum ('low', 'medium', 'high', 'urgent');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type notification_level as enum ('info', 'success', 'warning', 'error');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type file_entity_type as enum ('ticket', 'ticket_comment', 'workspace', 'general');
exception
  when duplicate_object then null;
end
$$;

create table if not exists users (
  id varchar(64) primary key,
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
);

alter table users
  add column if not exists id varchar(64),
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
  add column if not exists updated_at timestamptz default now();

create unique index if not exists users_github_username_idx
  on users (github_username);
create unique index if not exists users_email_idx on users (email);

-- Legacy databases that still use UUID-based user ids should rely on the
-- runtime bootstrap in src/lib/db/bootstrap.ts to realign ids and foreign keys
-- to the GitHub user id.

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  slug varchar(80) not null,
  name varchar(120) not null,
  description text,
  status workspace_status not null default 'active',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table workspaces
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists slug varchar(80),
  add column if not exists name varchar(120),
  add column if not exists description text,
  add column if not exists status workspace_status default 'active',
  add column if not exists is_default boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists workspaces_slug_idx on workspaces (slug);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id varchar(64) not null references users(id) on delete cascade,
  is_owner boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table workspace_members
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
  add column if not exists user_id varchar(64) references users(id) on delete cascade,
  add column if not exists is_owner boolean default false,
  add column if not exists joined_at timestamptz default now();

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  slug varchar(80) not null,
  name varchar(120) not null,
  description text,
  lead_user_id varchar(64) references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table teams
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
  add column if not exists slug varchar(80),
  add column if not exists name varchar(120),
  add column if not exists description text,
  add column if not exists lead_user_id varchar(64) references users(id) on delete set null,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists teams_workspace_slug_idx
  on teams (workspace_id, slug);

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  key varchar(80) not null,
  name varchar(120) not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table roles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
  add column if not exists key varchar(80),
  add column if not exists name varchar(120),
  add column if not exists description text,
  add column if not exists is_system boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists roles_workspace_key_idx
  on roles (workspace_id, key);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  code varchar(120) not null,
  name varchar(120) not null,
  module varchar(60) not null,
  action varchar(60) not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table permissions
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists code varchar(120),
  add column if not exists name varchar(120),
  add column if not exists module varchar(60),
  add column if not exists action varchar(60),
  add column if not exists description text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists permissions_code_idx on permissions (code);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

alter table role_permissions
  add column if not exists role_id uuid references roles(id) on delete cascade,
  add column if not exists permission_id uuid references permissions(id) on delete cascade;

create table if not exists team_members (
  team_id uuid not null references teams(id) on delete cascade,
  user_id varchar(64) not null references users(id) on delete cascade,
  role_id uuid references roles(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

alter table team_members
  add column if not exists team_id uuid references teams(id) on delete cascade,
  add column if not exists user_id varchar(64) references users(id) on delete cascade,
  add column if not exists role_id uuid references roles(id) on delete set null,
  add column if not exists joined_at timestamptz default now();

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id varchar(64) references users(id) on delete cascade,
  title varchar(160) not null,
  content text not null,
  level notification_level not null default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table notifications
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
  add column if not exists user_id varchar(64) references users(id) on delete cascade,
  add column if not exists title varchar(160),
  add column if not exists content text,
  add column if not exists level notification_level default 'info',
  add column if not exists is_read boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  code varchar(32) not null,
  title varchar(180) not null,
  description text,
  status ticket_status not null default 'open',
  priority ticket_priority not null default 'medium',
  reporter_id varchar(64) references users(id) on delete set null,
  assignee_id varchar(64) references users(id) on delete set null,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tickets
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
  add column if not exists code varchar(32),
  add column if not exists title varchar(180),
  add column if not exists description text,
  add column if not exists status ticket_status default 'open',
  add column if not exists priority ticket_priority default 'medium',
  add column if not exists reporter_id varchar(64) references users(id) on delete set null,
  add column if not exists assignee_id varchar(64) references users(id) on delete set null,
  add column if not exists comment_count integer default 0,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists tickets_code_idx on tickets (code);

create table if not exists ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  author_id varchar(64) references users(id) on delete set null,
  body text not null,
  attachment_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ticket_comments
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists ticket_id uuid references tickets(id) on delete cascade,
  add column if not exists author_id varchar(64) references users(id) on delete set null,
  add column if not exists body text,
  add column if not exists attachment_ids jsonb default '[]'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create table if not exists file_assets (
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
  uploaded_by varchar(64) references users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table file_assets
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
  add column if not exists uploaded_by varchar(64) references users(id) on delete set null,
  add column if not exists created_at timestamptz default now();

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete set null,
  actor_id varchar(64) references users(id) on delete set null,
  action varchar(120) not null,
  entity_type varchar(80) not null,
  entity_id varchar(120),
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table audit_logs
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists workspace_id uuid references workspaces(id) on delete set null,
  add column if not exists actor_id varchar(64) references users(id) on delete set null,
  add column if not exists action varchar(120),
  add column if not exists entity_type varchar(80),
  add column if not exists entity_id varchar(120),
  add column if not exists summary text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now();

insert into permissions (code, name, module, action, description)
values
  ('dashboard.view', '查看仪表盘', 'dashboard', 'view', '允许查看系统概览、统计卡片和整体运营数据。'),
  ('workspaces.view', '查看工作区', 'workspaces', 'view', '允许查看工作区列表、状态和成员规模。'),
  ('workspaces.manage', '维护工作区', 'workspaces', 'manage', '允许创建、编辑和归档工作区。'),
  ('workspaces.switch', '切换工作区', 'workspaces', 'switch', '允许切换当前活跃工作区。'),
  ('teams.view', '查看团队', 'teams', 'view', '允许查看当前工作区下的团队列表和负责人信息。'),
  ('teams.manage', '维护团队', 'teams', 'manage', '允许创建、编辑和删除团队及其成员配置。'),
  ('users.view', '查看用户', 'users', 'view', '允许查看工作区成员、系统角色和登录状态。'),
  ('users.manage', '维护用户', 'users', 'manage', '允许新增、编辑和删除工作区成员。'),
  ('users.import', '导入 GitHub 用户', 'users', 'import', '允许通过 GitHub 用户名搜索并导入成员。'),
  ('roles.view', '查看角色', 'roles', 'view', '允许查看当前工作区下的角色和权限绑定关系。'),
  ('roles.manage', '维护角色', 'roles', 'manage', '允许创建、编辑和删除角色。'),
  ('permissions.view', '查看权限', 'permissions', 'view', '允许查看系统内维护的权限编码与模块划分。'),
  ('permissions.manage', '维护权限', 'permissions', 'manage', '允许创建、编辑和删除权限项。'),
  ('notifications.view', '查看消息', 'notifications', 'view', '允许查看站内消息和运维提醒。'),
  ('notifications.manage', '维护消息', 'notifications', 'manage', '允许新增、编辑和删除站内消息。'),
  ('notifications.publish', '发布消息', 'notifications', 'publish', '允许向工作区成员发布公告和提醒。'),
  ('tickets.view', '查看工单', 'tickets', 'view', '允许查看工单列表、状态和协作详情。'),
  ('tickets.manage', '维护工单', 'tickets', 'manage', '允许创建、编辑和删除工单。'),
  ('tickets.assign', '分配工单', 'tickets', 'assign', '允许修改工单负责人和状态流转。'),
  ('tickets.comment', '评论工单', 'tickets', 'comment', '允许为工单追加评论和协作记录。'),
  ('kanban.view', '查看看板', 'kanban', 'view', '允许查看基于工单的看板视图。'),
  ('kanban.manage', '维护看板', 'kanban', 'manage', '允许拖拽更新看板状态并参与流程推进。'),
  ('audit_logs.view', '查看审计日志', 'audit_logs', 'view', '允许查看管理端关键操作的审计记录。'),
  ('files.view', '查看文件', 'files', 'view', '允许查看系统内的文件资产记录。'),
  ('files.upload', '上传文件', 'files', 'upload', '允许上传附件并登记到文件资产表。'),
  ('profile.view', '查看个人资料', 'profile', 'view', '允许查看个人资料页面。'),
  ('profile.update', '更新个人资料', 'profile', 'update', '允许更新个人资料信息。')
on conflict (code) do nothing;

insert into roles (workspace_id, key, name, description, is_system)
select workspaces.id, seeded_roles.key, seeded_roles.name, seeded_roles.description, true
from workspaces
cross join (
  values
    ('super_admin', '超级管理员', '系统内置角色，拥有当前工作区下全部页面与操作能力。'),
    ('admin', '管理员', '系统内置角色，负责当前工作区的日常管理与协作配置。'),
    ('member', '成员', '系统内置角色，默认提供只读浏览与基础协作能力。')
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
  end;

insert into role_permissions (role_id, permission_id)
select seeded_roles.id, seeded_permissions.id
from roles as seeded_roles
join permissions as seeded_permissions
  on seeded_permissions.code in (
    'dashboard.view',
    'workspaces.view',
    'workspaces.manage',
    'workspaces.switch',
    'teams.view',
    'teams.manage',
    'users.view',
    'users.manage',
    'users.import',
    'roles.view',
    'roles.manage',
    'permissions.view',
    'permissions.manage',
    'notifications.view',
    'notifications.manage',
    'notifications.publish',
    'tickets.view',
    'tickets.manage',
    'tickets.assign',
    'tickets.comment',
    'kanban.view',
    'kanban.manage',
    'audit_logs.view',
    'files.view',
    'files.upload',
    'profile.view',
    'profile.update'
  )
where seeded_roles.key = 'super_admin'
  and not exists (
    select 1
    from role_permissions as existing_role_permissions
    where existing_role_permissions.role_id = seeded_roles.id
  )
on conflict (role_id, permission_id) do nothing;

insert into role_permissions (role_id, permission_id)
select seeded_roles.id, seeded_permissions.id
from roles as seeded_roles
join permissions as seeded_permissions
  on seeded_permissions.code in (
    'dashboard.view',
    'workspaces.view',
    'workspaces.switch',
    'teams.view',
    'teams.manage',
    'users.view',
    'users.manage',
    'users.import',
    'roles.view',
    'roles.manage',
    'permissions.view',
    'permissions.manage',
    'notifications.view',
    'notifications.manage',
    'notifications.publish',
    'tickets.view',
    'tickets.manage',
    'tickets.assign',
    'tickets.comment',
    'kanban.view',
    'kanban.manage',
    'audit_logs.view',
    'files.view',
    'files.upload',
    'profile.view',
    'profile.update'
  )
where seeded_roles.key = 'admin'
  and not exists (
    select 1
    from role_permissions as existing_role_permissions
    where existing_role_permissions.role_id = seeded_roles.id
  )
on conflict (role_id, permission_id) do nothing;

insert into role_permissions (role_id, permission_id)
select seeded_roles.id, seeded_permissions.id
from roles as seeded_roles
join permissions as seeded_permissions
  on seeded_permissions.code in (
    'dashboard.view',
    'workspaces.view',
    'workspaces.switch',
    'teams.view',
    'users.view',
    'roles.view',
    'permissions.view',
    'notifications.view',
    'tickets.view',
    'tickets.comment',
    'kanban.view',
    'files.view',
    'profile.view',
    'profile.update'
  )
where seeded_roles.key = 'member'
  and not exists (
    select 1
    from role_permissions as existing_role_permissions
    where existing_role_permissions.role_id = seeded_roles.id
  )
on conflict (role_id, permission_id) do nothing;
