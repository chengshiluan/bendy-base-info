-- Example bootstrap for the first admin account.
-- Run this after the core schema / RBAC bootstrap has completed.
-- You can rely on the automatic startup initializer or execute docs/database-init.sql manually.
-- Replace the sample values before using it in a real project.

with upsert_workspace as (
  insert into workspaces (
    slug,
    name,
    description,
    status,
    is_default
  )
  values (
    'your-workspace-slug',
    'Your Workspace',
    'Default workspace for the initial administrator.',
    'active',
    true
  )
  on conflict (slug) do update
    set
      name = excluded.name,
      description = excluded.description,
      status = excluded.status,
      is_default = excluded.is_default,
      updated_at = now()
  returning id
),
upsert_user as (
  insert into users (
    id,
    github_username,
    github_user_id,
    email,
    display_name,
    system_role,
    status,
    email_login_enabled
  )
  values (
    'your_github_user_id',
    'your_github_username',
    'your_github_user_id',
    'admin@example.com',
    'Your Admin',
    'super_admin',
    'active',
    true
  )
  on conflict (id) do update
    set
      github_username = excluded.github_username,
      github_user_id = excluded.github_user_id,
      email = excluded.email,
      display_name = excluded.display_name,
      system_role = excluded.system_role,
      status = excluded.status,
      email_login_enabled = excluded.email_login_enabled,
      updated_at = now()
  returning id
)
insert into workspace_members (workspace_id, user_id, is_owner)
select upsert_workspace.id, upsert_user.id, true
from upsert_workspace
cross join upsert_user
on conflict (workspace_id, user_id) do update
  set is_owner = excluded.is_owner;
