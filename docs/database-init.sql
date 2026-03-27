-- Core schema initialization

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
  create type permission_scope as enum ('global', 'workspace');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type permission_type as enum ('menu', 'action');
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

create unique index if not exists users_github_username_idx on users (github_username);

create unique index if not exists users_email_idx on users (email);

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

create unique index if not exists teams_workspace_slug_idx on teams (workspace_id, slug);

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

create unique index if not exists roles_workspace_key_idx on roles (workspace_id, key);

create table if not exists permissions (
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
  );

alter table permissions
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

create table if not exists workspace_member_roles (
    workspace_id uuid not null references workspaces(id) on delete cascade,
    user_id varchar(64) not null references users(id) on delete cascade,
    role_id uuid not null references roles(id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (workspace_id, user_id, role_id)
  );

alter table workspace_member_roles
    add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
    add column if not exists user_id varchar(64) references users(id) on delete cascade,
    add column if not exists role_id uuid references roles(id) on delete cascade,
    add column if not exists created_at timestamptz default now(),
    add column if not exists updated_at timestamptz default now();

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



-- RBAC initialization

insert into permissions (
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
  ('dashboard.overview.menu', '仪表盘菜单', 'dashboard.overview', 'menu', 'global', 'menu', null, '/dashboard/overview', 100, true, '允许访问系统总览、统计卡片和基础运营看板。'),
  ('dashboard.workspaces.menu', '工作区菜单', 'dashboard.workspaces', 'menu', 'global', 'menu', null, '/dashboard/workspaces', 200, true, '允许访问工作区目录和全局工作区入口。'),
  ('dashboard.workspaces.create', '新增工作区', 'dashboard.workspaces', 'create', 'global', 'action', 'dashboard.workspaces.menu', '/dashboard/workspaces', 201, true, '允许新增系统工作区。'),
  ('dashboard.workspaces.update', '编辑工作区', 'dashboard.workspaces', 'update', 'global', 'action', 'dashboard.workspaces.menu', '/dashboard/workspaces', 202, true, '允许编辑工作区基础资料。'),
  ('dashboard.workspaces.archive', '归档工作区', 'dashboard.workspaces', 'archive', 'global', 'action', 'dashboard.workspaces.menu', '/dashboard/workspaces', 203, true, '允许归档工作区并停止在切换器中显示。'),
  ('dashboard.workspaces.teams.menu', '团队管理菜单', 'dashboard.workspaces.teams', 'menu', 'workspace', 'menu', 'dashboard.workspaces.menu', '/dashboard/workspaces/teams', 300, true, '允许访问团队管理页。'),
  ('dashboard.workspaces.teams.create', '新增团队', 'dashboard.workspaces.teams', 'create', 'workspace', 'action', 'dashboard.workspaces.teams.menu', '/dashboard/workspaces/teams', 301, true, '允许在当前工作区新增团队。'),
  ('dashboard.workspaces.teams.update', '编辑团队', 'dashboard.workspaces.teams', 'update', 'workspace', 'action', 'dashboard.workspaces.teams.menu', '/dashboard/workspaces/teams', 302, true, '允许编辑团队基础资料、负责人和成员。'),
  ('dashboard.workspaces.teams.delete', '删除团队', 'dashboard.workspaces.teams', 'delete', 'workspace', 'action', 'dashboard.workspaces.teams.menu', '/dashboard/workspaces/teams', 303, true, '允许删除当前工作区的团队。'),
  ('dashboard.workspaces.teams.import', '导入团队成员', 'dashboard.workspaces.teams', 'import', 'workspace', 'action', 'dashboard.workspaces.teams.menu', '/dashboard/workspaces/teams', 304, true, '允许从 GitHub 搜索成员并加入当前工作区待选列表。'),
  ('dashboard.workspaces.users.menu', '用户管理菜单', 'dashboard.workspaces.users', 'menu', 'workspace', 'menu', 'dashboard.workspaces.menu', '/dashboard/workspaces/users', 400, true, '允许访问工作区用户管理页。'),
  ('dashboard.workspaces.users.create', '新增用户', 'dashboard.workspaces.users', 'create', 'workspace', 'action', 'dashboard.workspaces.users.menu', '/dashboard/workspaces/users', 401, true, '允许录入新的工作区成员。'),
  ('dashboard.workspaces.users.update', '编辑用户', 'dashboard.workspaces.users', 'update', 'workspace', 'action', 'dashboard.workspaces.users.menu', '/dashboard/workspaces/users', 402, true, '允许修改成员资料、状态和角色。'),
  ('dashboard.workspaces.users.delete', '删除用户', 'dashboard.workspaces.users', 'delete', 'workspace', 'action', 'dashboard.workspaces.users.menu', '/dashboard/workspaces/users', 403, true, '允许删除工作区成员。'),
  ('dashboard.workspaces.roles.menu', '角色管理菜单', 'dashboard.workspaces.roles', 'menu', 'workspace', 'menu', 'dashboard.workspaces.menu', '/dashboard/workspaces/roles', 500, true, '允许访问工作区角色管理页。'),
  ('dashboard.workspaces.roles.create', '新增角色', 'dashboard.workspaces.roles', 'create', 'workspace', 'action', 'dashboard.workspaces.roles.menu', '/dashboard/workspaces/roles', 501, true, '允许创建新的工作区角色。'),
  ('dashboard.workspaces.roles.update', '编辑角色', 'dashboard.workspaces.roles', 'update', 'workspace', 'action', 'dashboard.workspaces.roles.menu', '/dashboard/workspaces/roles', 502, true, '允许调整角色名称、描述和权限集合。'),
  ('dashboard.workspaces.roles.delete', '删除角色', 'dashboard.workspaces.roles', 'delete', 'workspace', 'action', 'dashboard.workspaces.roles.menu', '/dashboard/workspaces/roles', 503, true, '允许删除非系统内置角色。'),
  ('dashboard.workspaces.permissions.menu', '权限管理菜单', 'dashboard.workspaces.permissions', 'menu', 'workspace', 'menu', 'dashboard.workspaces.menu', '/dashboard/workspaces/permissions', 600, true, '允许访问系统权限目录页。'),
  ('dashboard.workspaces.permissions.create', '新增权限', 'dashboard.workspaces.permissions', 'create', 'workspace', 'action', 'dashboard.workspaces.permissions.menu', '/dashboard/workspaces/permissions', 601, true, '允许新增自定义权限项。'),
  ('dashboard.workspaces.permissions.update', '编辑权限', 'dashboard.workspaces.permissions', 'update', 'workspace', 'action', 'dashboard.workspaces.permissions.menu', '/dashboard/workspaces/permissions', 602, true, '允许调整权限定义。'),
  ('dashboard.workspaces.permissions.delete', '删除权限', 'dashboard.workspaces.permissions', 'delete', 'workspace', 'action', 'dashboard.workspaces.permissions.menu', '/dashboard/workspaces/permissions', 603, true, '允许删除非系统权限项。'),
  ('dashboard.workspaces.notifications.menu', '站内消息菜单', 'dashboard.workspaces.notifications', 'menu', 'workspace', 'menu', 'dashboard.workspaces.menu', '/dashboard/workspaces/notifications', 700, true, '允许访问站内消息管理页。'),
  ('dashboard.workspaces.notifications.create', '新增通知', 'dashboard.workspaces.notifications', 'create', 'workspace', 'action', 'dashboard.workspaces.notifications.menu', '/dashboard/workspaces/notifications', 701, true, '允许发布新的工作区通知。'),
  ('dashboard.workspaces.notifications.update', '编辑通知', 'dashboard.workspaces.notifications', 'update', 'workspace', 'action', 'dashboard.workspaces.notifications.menu', '/dashboard/workspaces/notifications', 702, true, '允许修改通知内容与已读状态。'),
  ('dashboard.workspaces.notifications.delete', '删除通知', 'dashboard.workspaces.notifications', 'delete', 'workspace', 'action', 'dashboard.workspaces.notifications.menu', '/dashboard/workspaces/notifications', 703, true, '允许删除工作区通知。'),
  ('dashboard.workspaces.notifications.read', '标记通知已读', 'dashboard.workspaces.notifications', 'read', 'workspace', 'action', 'dashboard.workspaces.notifications.menu', '/dashboard/workspaces/notifications', 704, true, '允许切换工作区通知的已读状态。'),
  ('dashboard.workspaces.tickets.menu', '工单系统菜单', 'dashboard.workspaces.tickets', 'menu', 'workspace', 'menu', 'dashboard.workspaces.menu', '/dashboard/workspaces/tickets', 800, true, '允许访问工单管理页。'),
  ('dashboard.workspaces.tickets.create', '新建工单', 'dashboard.workspaces.tickets', 'create', 'workspace', 'action', 'dashboard.workspaces.tickets.menu', '/dashboard/workspaces/tickets', 801, true, '允许创建新的工单。'),
  ('dashboard.workspaces.tickets.update', '编辑工单', 'dashboard.workspaces.tickets', 'update', 'workspace', 'action', 'dashboard.workspaces.tickets.menu', '/dashboard/workspaces/tickets', 802, true, '允许修改工单标题、描述、优先级和状态。'),
  ('dashboard.workspaces.tickets.delete', '删除工单', 'dashboard.workspaces.tickets', 'delete', 'workspace', 'action', 'dashboard.workspaces.tickets.menu', '/dashboard/workspaces/tickets', 803, true, '允许删除工单及其关联评论。'),
  ('dashboard.workspaces.tickets.assign', '分配工单', 'dashboard.workspaces.tickets', 'assign', 'workspace', 'action', 'dashboard.workspaces.tickets.menu', '/dashboard/workspaces/tickets', 804, true, '允许修改工单负责人。'),
  ('dashboard.workspaces.tickets.comment', '评论工单', 'dashboard.workspaces.tickets', 'comment', 'workspace', 'action', 'dashboard.workspaces.tickets.menu', '/dashboard/workspaces/tickets', 805, true, '允许在工单下提交评论。'),
  ('dashboard.workspaces.tickets.upload', '上传附件', 'dashboard.workspaces.tickets', 'upload', 'workspace', 'action', 'dashboard.workspaces.tickets.menu', '/dashboard/workspaces/tickets', 806, true, '允许为工单和评论上传附件。'),
  ('dashboard.workspaces.kanban.menu', '看板菜单', 'dashboard.workspaces.kanban', 'menu', 'workspace', 'menu', 'dashboard.workspaces.menu', '/dashboard/workspaces/kanban', 900, true, '允许访问工单看板页。'),
  ('dashboard.workspaces.kanban.update', '更新看板状态', 'dashboard.workspaces.kanban', 'update', 'workspace', 'action', 'dashboard.workspaces.kanban.menu', '/dashboard/workspaces/kanban', 901, true, '允许通过拖拽更新工单状态。'),
  ('dashboard.ops.menu', '运维区菜单', 'dashboard.ops', 'menu', 'workspace', 'menu', null, '/dashboard/workspaces/ops', 300, true, '允许展开运维区功能目录。'),
  ('dashboard.ops.system.menu', '系统管理菜单', 'dashboard.ops.system', 'menu', 'workspace', 'menu', 'dashboard.ops.menu', '/dashboard/workspaces/ops/system', 400, true, '允许访问系统管理占位页。'),
  ('dashboard.ops.config.menu', '配置管理菜单', 'dashboard.ops.config', 'menu', 'workspace', 'menu', 'dashboard.ops.menu', '/dashboard/workspaces/ops/config', 500, true, '允许访问配置管理占位页。'),
  ('dashboard.ops.information.menu', '信息管理菜单', 'dashboard.ops.information', 'menu', 'workspace', 'menu', 'dashboard.ops.menu', '/dashboard/workspaces/ops/information', 600, true, '允许访问信息管理占位页。'),
  ('dashboard.ops.data.menu', '数据管理菜单', 'dashboard.ops.data', 'menu', 'workspace', 'menu', 'dashboard.ops.menu', '/dashboard/workspaces/ops/data', 700, true, '允许访问数据管理占位页。'),
  ('dashboard.dev.menu', '开发区菜单', 'dashboard.dev', 'menu', 'workspace', 'menu', null, '/dashboard/workspaces/dev', 400, true, '允许展开开发区功能目录。'),
  ('dashboard.dev.accounts.menu', '账号管理菜单', 'dashboard.dev.accounts', 'menu', 'workspace', 'menu', 'dashboard.dev.menu', '/dashboard/workspaces/dev/accounts', 500, true, '允许访问账号管理占位页。'),
  ('dashboard.dev.projects.menu', '项目管理菜单', 'dashboard.dev.projects', 'menu', 'workspace', 'menu', 'dashboard.dev.menu', '/dashboard/workspaces/dev/projects', 600, true, '允许访问项目管理占位页。'),
  ('dashboard.dev.resources.menu', '资源管理菜单', 'dashboard.dev.resources', 'menu', 'workspace', 'menu', 'dashboard.dev.menu', '/dashboard/workspaces/dev/resources', 700, true, '允许访问资源管理占位页。'),
  ('dashboard.admin.menu', '行政区菜单', 'dashboard.admin', 'menu', 'workspace', 'menu', null, '/dashboard/workspaces/admin', 500, true, '允许展开行政区功能目录。'),
  ('dashboard.admin.hr.menu', '人力资源菜单', 'dashboard.admin.hr', 'menu', 'workspace', 'menu', 'dashboard.admin.menu', '/dashboard/workspaces/admin/hr', 600, true, '允许访问人力资源占位页。'),
  ('dashboard.admin.policies.menu', '规章制度菜单', 'dashboard.admin.policies', 'menu', 'workspace', 'menu', 'dashboard.admin.menu', '/dashboard/workspaces/admin/policies', 700, true, '允许访问规章制度占位页。'),
  ('dashboard.admin.governance.menu', '司政中心菜单', 'dashboard.admin.governance', 'menu', 'workspace', 'menu', 'dashboard.admin.menu', '/dashboard/workspaces/admin/governance', 800, true, '允许访问司政中心占位页。'),
  ('dashboard.profile.menu', '账户设置菜单', 'dashboard.profile', 'menu', 'global', 'menu', null, '/dashboard/profile', 600, true, '允许访问个人资料与账户设置页。'),
  ('dashboard.profile.update', '编辑个人资料', 'dashboard.profile', 'update', 'global', 'action', 'dashboard.profile.menu', '/dashboard/profile', 601, true, '允许更新个人资料。')
on conflict (code) do nothing;

insert into roles (workspace_id, key, name, description, is_system)
select workspaces.id, seeded_roles.key, seeded_roles.name, seeded_roles.description, true
from workspaces
cross join (
  values
    ('super_admin', '超级管理员', '系统内置角色，拥有当前工作区下全部页面与操作能力。'),
    ('admin', '管理员', '系统内置角色，负责当前工作区的日常管理与协作配置。'),
    ('member', '成员', '系统内置角色，默认提供浏览和基础协作能力。')
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

delete from role_permissions as target_role_permissions
using roles as seeded_roles
where seeded_roles.id = target_role_permissions.role_id
  and seeded_roles.key = 'super_admin'
  and target_role_permissions.permission_id not in (
    select seeded_permissions.id
    from permissions as seeded_permissions
    where seeded_permissions.code in ('dashboard.workspaces.teams.menu', 'dashboard.workspaces.teams.create', 'dashboard.workspaces.teams.update', 'dashboard.workspaces.teams.delete', 'dashboard.workspaces.teams.import', 'dashboard.workspaces.users.menu', 'dashboard.workspaces.users.create', 'dashboard.workspaces.users.update', 'dashboard.workspaces.users.delete', 'dashboard.workspaces.roles.menu', 'dashboard.workspaces.roles.create', 'dashboard.workspaces.roles.update', 'dashboard.workspaces.roles.delete', 'dashboard.workspaces.permissions.menu', 'dashboard.workspaces.permissions.create', 'dashboard.workspaces.permissions.update', 'dashboard.workspaces.permissions.delete', 'dashboard.workspaces.notifications.menu', 'dashboard.workspaces.notifications.create', 'dashboard.workspaces.notifications.update', 'dashboard.workspaces.notifications.delete', 'dashboard.workspaces.notifications.read', 'dashboard.workspaces.tickets.menu', 'dashboard.workspaces.tickets.create', 'dashboard.workspaces.tickets.update', 'dashboard.workspaces.tickets.delete', 'dashboard.workspaces.tickets.assign', 'dashboard.workspaces.tickets.comment', 'dashboard.workspaces.tickets.upload', 'dashboard.workspaces.kanban.menu', 'dashboard.workspaces.kanban.update', 'dashboard.ops.menu', 'dashboard.ops.system.menu', 'dashboard.ops.config.menu', 'dashboard.ops.information.menu', 'dashboard.ops.data.menu', 'dashboard.dev.menu', 'dashboard.dev.accounts.menu', 'dashboard.dev.projects.menu', 'dashboard.dev.resources.menu', 'dashboard.admin.menu', 'dashboard.admin.hr.menu', 'dashboard.admin.policies.menu', 'dashboard.admin.governance.menu')
  );

insert into role_permissions (role_id, permission_id)
select seeded_roles.id, seeded_permissions.id
from roles as seeded_roles
join permissions as seeded_permissions
  on seeded_permissions.code in ('dashboard.workspaces.teams.menu', 'dashboard.workspaces.teams.create', 'dashboard.workspaces.teams.update', 'dashboard.workspaces.teams.delete', 'dashboard.workspaces.teams.import', 'dashboard.workspaces.users.menu', 'dashboard.workspaces.users.create', 'dashboard.workspaces.users.update', 'dashboard.workspaces.users.delete', 'dashboard.workspaces.roles.menu', 'dashboard.workspaces.roles.create', 'dashboard.workspaces.roles.update', 'dashboard.workspaces.roles.delete', 'dashboard.workspaces.permissions.menu', 'dashboard.workspaces.permissions.create', 'dashboard.workspaces.permissions.update', 'dashboard.workspaces.permissions.delete', 'dashboard.workspaces.notifications.menu', 'dashboard.workspaces.notifications.create', 'dashboard.workspaces.notifications.update', 'dashboard.workspaces.notifications.delete', 'dashboard.workspaces.notifications.read', 'dashboard.workspaces.tickets.menu', 'dashboard.workspaces.tickets.create', 'dashboard.workspaces.tickets.update', 'dashboard.workspaces.tickets.delete', 'dashboard.workspaces.tickets.assign', 'dashboard.workspaces.tickets.comment', 'dashboard.workspaces.tickets.upload', 'dashboard.workspaces.kanban.menu', 'dashboard.workspaces.kanban.update', 'dashboard.ops.menu', 'dashboard.ops.system.menu', 'dashboard.ops.config.menu', 'dashboard.ops.information.menu', 'dashboard.ops.data.menu', 'dashboard.dev.menu', 'dashboard.dev.accounts.menu', 'dashboard.dev.projects.menu', 'dashboard.dev.resources.menu', 'dashboard.admin.menu', 'dashboard.admin.hr.menu', 'dashboard.admin.policies.menu', 'dashboard.admin.governance.menu')
left join role_permissions as existing_role_permissions
  on existing_role_permissions.role_id = seeded_roles.id
 and existing_role_permissions.permission_id = seeded_permissions.id
where seeded_roles.key = 'super_admin'
  and existing_role_permissions.role_id is null
on conflict (role_id, permission_id) do nothing;

delete from role_permissions as target_role_permissions
using roles as seeded_roles
where seeded_roles.id = target_role_permissions.role_id
  and seeded_roles.key = 'admin'
  and target_role_permissions.permission_id not in (
    select seeded_permissions.id
    from permissions as seeded_permissions
    where seeded_permissions.code in ('dashboard.workspaces.teams.menu', 'dashboard.workspaces.teams.create', 'dashboard.workspaces.teams.update', 'dashboard.workspaces.teams.delete', 'dashboard.workspaces.teams.import', 'dashboard.workspaces.users.menu', 'dashboard.workspaces.users.create', 'dashboard.workspaces.users.update', 'dashboard.workspaces.users.delete', 'dashboard.workspaces.roles.menu', 'dashboard.workspaces.roles.create', 'dashboard.workspaces.roles.update', 'dashboard.workspaces.roles.delete', 'dashboard.workspaces.permissions.menu', 'dashboard.workspaces.permissions.create', 'dashboard.workspaces.permissions.update', 'dashboard.workspaces.permissions.delete', 'dashboard.workspaces.notifications.menu', 'dashboard.workspaces.notifications.create', 'dashboard.workspaces.notifications.update', 'dashboard.workspaces.notifications.delete', 'dashboard.workspaces.notifications.read', 'dashboard.workspaces.tickets.menu', 'dashboard.workspaces.tickets.create', 'dashboard.workspaces.tickets.update', 'dashboard.workspaces.tickets.delete', 'dashboard.workspaces.tickets.assign', 'dashboard.workspaces.tickets.comment', 'dashboard.workspaces.tickets.upload', 'dashboard.workspaces.kanban.menu', 'dashboard.workspaces.kanban.update', 'dashboard.ops.menu', 'dashboard.ops.system.menu', 'dashboard.ops.config.menu', 'dashboard.ops.information.menu', 'dashboard.ops.data.menu', 'dashboard.dev.menu', 'dashboard.dev.accounts.menu', 'dashboard.dev.projects.menu', 'dashboard.dev.resources.menu', 'dashboard.admin.menu', 'dashboard.admin.hr.menu', 'dashboard.admin.policies.menu', 'dashboard.admin.governance.menu')
  );

insert into role_permissions (role_id, permission_id)
select seeded_roles.id, seeded_permissions.id
from roles as seeded_roles
join permissions as seeded_permissions
  on seeded_permissions.code in ('dashboard.workspaces.teams.menu', 'dashboard.workspaces.teams.create', 'dashboard.workspaces.teams.update', 'dashboard.workspaces.teams.delete', 'dashboard.workspaces.teams.import', 'dashboard.workspaces.users.menu', 'dashboard.workspaces.users.create', 'dashboard.workspaces.users.update', 'dashboard.workspaces.users.delete', 'dashboard.workspaces.roles.menu', 'dashboard.workspaces.roles.create', 'dashboard.workspaces.roles.update', 'dashboard.workspaces.roles.delete', 'dashboard.workspaces.permissions.menu', 'dashboard.workspaces.permissions.create', 'dashboard.workspaces.permissions.update', 'dashboard.workspaces.permissions.delete', 'dashboard.workspaces.notifications.menu', 'dashboard.workspaces.notifications.create', 'dashboard.workspaces.notifications.update', 'dashboard.workspaces.notifications.delete', 'dashboard.workspaces.notifications.read', 'dashboard.workspaces.tickets.menu', 'dashboard.workspaces.tickets.create', 'dashboard.workspaces.tickets.update', 'dashboard.workspaces.tickets.delete', 'dashboard.workspaces.tickets.assign', 'dashboard.workspaces.tickets.comment', 'dashboard.workspaces.tickets.upload', 'dashboard.workspaces.kanban.menu', 'dashboard.workspaces.kanban.update', 'dashboard.ops.menu', 'dashboard.ops.system.menu', 'dashboard.ops.config.menu', 'dashboard.ops.information.menu', 'dashboard.ops.data.menu', 'dashboard.dev.menu', 'dashboard.dev.accounts.menu', 'dashboard.dev.projects.menu', 'dashboard.dev.resources.menu', 'dashboard.admin.menu', 'dashboard.admin.hr.menu', 'dashboard.admin.policies.menu', 'dashboard.admin.governance.menu')
left join role_permissions as existing_role_permissions
  on existing_role_permissions.role_id = seeded_roles.id
 and existing_role_permissions.permission_id = seeded_permissions.id
where seeded_roles.key = 'admin'
  and existing_role_permissions.role_id is null
on conflict (role_id, permission_id) do nothing;

delete from role_permissions as target_role_permissions
using roles as seeded_roles
where seeded_roles.id = target_role_permissions.role_id
  and seeded_roles.key = 'member'
  and target_role_permissions.permission_id not in (
    select seeded_permissions.id
    from permissions as seeded_permissions
    where seeded_permissions.code in ('dashboard.workspaces.teams.menu', 'dashboard.workspaces.users.menu', 'dashboard.workspaces.roles.menu', 'dashboard.workspaces.permissions.menu', 'dashboard.workspaces.notifications.menu', 'dashboard.workspaces.notifications.read', 'dashboard.workspaces.tickets.menu', 'dashboard.workspaces.tickets.comment', 'dashboard.workspaces.kanban.menu')
  );

insert into role_permissions (role_id, permission_id)
select seeded_roles.id, seeded_permissions.id
from roles as seeded_roles
join permissions as seeded_permissions
  on seeded_permissions.code in ('dashboard.workspaces.teams.menu', 'dashboard.workspaces.users.menu', 'dashboard.workspaces.roles.menu', 'dashboard.workspaces.permissions.menu', 'dashboard.workspaces.notifications.menu', 'dashboard.workspaces.notifications.read', 'dashboard.workspaces.tickets.menu', 'dashboard.workspaces.tickets.comment', 'dashboard.workspaces.kanban.menu')
left join role_permissions as existing_role_permissions
  on existing_role_permissions.role_id = seeded_roles.id
 and existing_role_permissions.permission_id = seeded_permissions.id
where seeded_roles.key = 'member'
  and existing_role_permissions.role_id is null
on conflict (role_id, permission_id) do nothing;
