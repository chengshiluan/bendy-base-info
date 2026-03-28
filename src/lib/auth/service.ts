import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import {
  ensureDatabaseInitialized,
  ensureGithubBackedUserIds
} from '@/lib/db/bootstrap';
import {
  getSystemRoleGlobalPermissionCodes,
  menuPermissionCode
} from '@/lib/platform/rbac';

export interface AuthUserSnapshot {
  id: string;
  name: string;
  email: string | null;
  image: string | null;
  githubUsername: string;
  systemRole: 'super_admin' | 'admin' | 'member';
  permissions: string[];
  workspacePermissions: Record<string, string[]>;
  workspaceIds: string[];
  defaultWorkspaceId: string | null;
}

function globalPermissions(systemRole: AuthUserSnapshot['systemRole']) {
  if (systemRole === 'super_admin') {
    return ['*'];
  }

  return getSystemRoleGlobalPermissionCodes(systemRole);
}

const dashboardOverviewPermissionCode = menuPermissionCode(
  'dashboard',
  'overview'
);

async function ensureAuthDatabaseReady() {
  if (!db) {
    return null;
  }

  await ensureDatabaseInitialized();
  return db;
}

export async function findUserById(userId: string) {
  const database = await ensureAuthDatabaseReady();
  if (!database) {
    return null;
  }

  const [user] = await database
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId));

  return user ?? null;
}

export async function findUserByGithubUsername(githubUsername: string) {
  const database = await ensureAuthDatabaseReady();
  if (!database) {
    return null;
  }

  const [user] = await database
    .select()
    .from(schema.users)
    .where(eq(schema.users.githubUsername, githubUsername.toLowerCase()));

  return user ?? null;
}

export async function findUserByEmail(email: string) {
  const database = await ensureAuthDatabaseReady();
  if (!database) {
    return null;
  }

  const [user] = await database
    .select()
    .from(schema.users)
    .where(
      and(
        eq(schema.users.email, email.toLowerCase()),
        eq(schema.users.emailLoginEnabled, true)
      )
    );

  return user ?? null;
}

export async function syncGithubProfile(params: {
  userId: string;
  githubUserId?: string | null;
  githubUsername?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
}) {
  const database = await ensureAuthDatabaseReady();
  if (!database) {
    return;
  }

  await database
    .update(schema.users)
    .set({
      githubUserId: params.githubUserId ?? undefined,
      githubUsername: params.githubUsername?.toLowerCase() ?? undefined,
      displayName: params.displayName ?? undefined,
      avatarUrl: params.avatarUrl ?? undefined,
      email: params.email?.toLowerCase() ?? undefined,
      lastLoginAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(schema.users.id, params.userId));

  if (params.githubUserId && params.githubUserId !== params.userId) {
    await ensureGithubBackedUserIds();
  }
}

export async function buildAuthUserSnapshot(
  userId: string
): Promise<AuthUserSnapshot | null> {
  const database = await ensureAuthDatabaseReady();
  if (!database) {
    return null;
  }

  const [user] = await database
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId));

  if (!user) {
    return null;
  }

  const memberships = await database
    .select({ workspaceId: schema.workspaceMembers.workspaceId })
    .from(schema.workspaceMembers)
    .where(eq(schema.workspaceMembers.userId, user.id));

  const workspaceIds = memberships.map((membership) => membership.workspaceId);
  const defaultWorkspaceId = workspaceIds[0] ?? null;

  if (user.systemRole === 'super_admin') {
    return {
      id: user.id,
      name: user.displayName || user.githubUsername,
      email: user.email ?? null,
      image: user.avatarUrl ?? null,
      githubUsername: user.githubUsername,
      systemRole: user.systemRole,
      permissions: ['*'],
      workspacePermissions: Object.fromEntries(
        workspaceIds.map((workspaceId) => [workspaceId, ['*']])
      ),
      workspaceIds,
      defaultWorkspaceId
    };
  }

  const workspacePermissionRows = workspaceIds.length
    ? await database
        .select({
          workspaceId: schema.workspaceMemberRoles.workspaceId,
          code: schema.permissions.code,
          scope: schema.permissions.scope
        })
        .from(schema.workspaceMemberRoles)
        .innerJoin(
          schema.rolePermissions,
          eq(schema.workspaceMemberRoles.roleId, schema.rolePermissions.roleId)
        )
        .innerJoin(
          schema.permissions,
          eq(schema.rolePermissions.permissionId, schema.permissions.id)
        )
        .where(
          and(
            eq(schema.workspaceMemberRoles.userId, user.id),
            inArray(schema.workspaceMemberRoles.workspaceId, workspaceIds)
          )
        )
    : [];

  const workspacePermissionMap = new Map<string, Set<string>>();
  workspaceIds.forEach((workspaceId) => {
    workspacePermissionMap.set(workspaceId, new Set<string>());
  });

  workspacePermissionRows.forEach((row) => {
    const canUseInWorkspacePermissionMap =
      row.scope === 'workspace' || row.code === dashboardOverviewPermissionCode;

    if (!canUseInWorkspacePermissionMap) {
      return;
    }

    const current = workspacePermissionMap.get(row.workspaceId);
    if (current) {
      current.add(row.code);
    }
  });

  const workspacePermissions = Object.fromEntries(
    Array.from(workspacePermissionMap.entries()).map(
      ([workspaceId, permissionSet]) => [workspaceId, Array.from(permissionSet)]
    )
  );
  const permissions = Array.from(new Set(globalPermissions(user.systemRole)));

  return {
    id: user.id,
    name: user.displayName || user.githubUsername,
    email: user.email ?? null,
    image: user.avatarUrl ?? null,
    githubUsername: user.githubUsername,
    systemRole: user.systemRole,
    permissions,
    workspacePermissions,
    workspaceIds,
    defaultWorkspaceId
  };
}
