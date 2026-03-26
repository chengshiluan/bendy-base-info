import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getSystemRoleGlobalPermissionCodes } from '@/lib/platform/rbac';

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

export async function findUserByGithubUsername(githubUsername: string) {
  if (!db) {
    return null;
  }

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.githubUsername, githubUsername.toLowerCase()));

  return user ?? null;
}

export async function findUserByEmail(email: string) {
  if (!db) {
    return null;
  }

  const [user] = await db
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
  displayName?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
}) {
  if (!db) {
    return;
  }

  await db
    .update(schema.users)
    .set({
      githubUserId: params.githubUserId ?? undefined,
      displayName: params.displayName ?? undefined,
      avatarUrl: params.avatarUrl ?? undefined,
      email: params.email?.toLowerCase() ?? undefined,
      lastLoginAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(schema.users.id, params.userId));
}

export async function buildAuthUserSnapshot(
  userId: string
): Promise<AuthUserSnapshot | null> {
  if (!db) {
    return null;
  }

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId));

  if (!user) {
    return null;
  }

  const memberships = await db
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
    ? await db
        .select({
          workspaceId: schema.workspaceMemberRoles.workspaceId,
          code: schema.permissions.code
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
            inArray(schema.workspaceMemberRoles.workspaceId, workspaceIds),
            eq(schema.permissions.scope, 'workspace')
          )
        )
    : [];

  const workspacePermissionMap = new Map<string, Set<string>>();
  workspaceIds.forEach((workspaceId) => {
    workspacePermissionMap.set(workspaceId, new Set<string>());
  });

  workspacePermissionRows.forEach((row) => {
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
  const permissions = Array.from(
    new Set([
      ...globalPermissions(user.systemRole),
      ...Object.values(workspacePermissions).flat()
    ])
  );

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
