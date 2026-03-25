import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export interface AuthUserSnapshot {
  id: string;
  name: string;
  email: string | null;
  image: string | null;
  githubUsername: string;
  systemRole: 'super_admin' | 'admin' | 'member';
  permissions: string[];
  workspaceIds: string[];
  defaultWorkspaceId: string | null;
}

function wildcardPermissions(systemRole: AuthUserSnapshot['systemRole']) {
  if (systemRole === 'super_admin') {
    return ['*'];
  }

  if (systemRole === 'admin') {
    return [
      'dashboard.view',
      'workspaces.view',
      'teams.view',
      'users.view',
      'roles.view',
      'permissions.view',
      'notifications.view',
      'tickets.view'
    ];
  }

  return ['dashboard.view'];
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

  return {
    id: user.id,
    name: user.displayName || user.githubUsername,
    email: user.email ?? null,
    image: user.avatarUrl ?? null,
    githubUsername: user.githubUsername,
    systemRole: user.systemRole,
    permissions: wildcardPermissions(user.systemRole),
    workspaceIds,
    defaultWorkspaceId: workspaceIds[0] ?? null
  };
}
