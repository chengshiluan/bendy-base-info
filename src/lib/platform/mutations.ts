import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { slugify } from '@/lib/utils';
import { recordAuditLog } from './audit';
import { getGithubUserByUsername, GithubApiError } from './github';
import {
  listAdminNotifications,
  listAuditLogs,
  listFilesByEntity,
  listPermissions,
  listRoles,
  listTeams,
  listTickets,
  listUsers
} from './service';
import type {
  FileAssetSummary,
  ImportedWorkspaceGithubUser,
  WorkspaceSummary
} from './types';

export class PlatformMutationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'PlatformMutationError';
    this.status = status;
  }
}

function requireDatabase() {
  if (!db) {
    throw new PlatformMutationError(
      '数据库尚未配置，当前无法执行写入操作。',
      503
    );
  }

  return db;
}

function normalizeNullable(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function uniqueValues(values: string[] = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function getWorkspaceRecord(workspaceId: string) {
  const database = requireDatabase();
  const [workspace] = await database
    .select({
      id: schema.workspaces.id,
      name: schema.workspaces.name,
      status: schema.workspaces.status,
      isDefault: schema.workspaces.isDefault
    })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId));

  if (!workspace) {
    throw new PlatformMutationError('工作区不存在。', 404);
  }

  return workspace;
}

async function getWorkspaceName(workspaceId: string) {
  const workspace = await getWorkspaceRecord(workspaceId);
  return workspace.name;
}

async function getWorkspaceSummaryById(
  workspaceId: string
): Promise<WorkspaceSummary> {
  const database = requireDatabase();
  const [workspace] = await database
    .select({
      id: schema.workspaces.id,
      slug: schema.workspaces.slug,
      name: schema.workspaces.name,
      description: schema.workspaces.description,
      status: schema.workspaces.status,
      isDefault: schema.workspaces.isDefault
    })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId));

  if (!workspace) {
    throw new PlatformMutationError('工作区不存在。', 404);
  }

  const [teamCountRow] = await database
    .select({ value: count() })
    .from(schema.teams)
    .where(eq(schema.teams.workspaceId, workspaceId));
  const [memberCountRow] = await database
    .select({ value: count() })
    .from(schema.workspaceMembers)
    .where(eq(schema.workspaceMembers.workspaceId, workspaceId));

  return {
    ...workspace,
    description: workspace.description ?? '未填写工作区描述。',
    teamCount: teamCountRow?.value ?? 0,
    memberCount: memberCountRow?.value ?? 0
  };
}

async function ensureWorkspaceSlugAvailable(slug: string, excludeId?: string) {
  const database = requireDatabase();
  const [existingWorkspace] = await database
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.slug, slug));

  if (existingWorkspace && existingWorkspace.id !== excludeId) {
    throw new PlatformMutationError('该工作区标识已经存在。', 409);
  }
}

async function ensureUserEmailAvailable(
  email?: string | null,
  excludeId?: string
) {
  if (!email) {
    return;
  }

  const database = requireDatabase();
  const [existingUser] = await database
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email));

  if (existingUser && existingUser.id !== excludeId) {
    throw new PlatformMutationError('该邮箱已经被其他用户使用。', 409);
  }
}

async function ensureRoleKeyAvailable(
  workspaceId: string,
  key: string,
  excludeId?: string
) {
  const database = requireDatabase();
  const [existingRole] = await database
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(
      and(eq(schema.roles.workspaceId, workspaceId), eq(schema.roles.key, key))
    );

  if (existingRole && existingRole.id !== excludeId) {
    throw new PlatformMutationError('该角色键已经存在。', 409);
  }
}

async function ensurePermissionCodeAvailable(code: string, excludeId?: string) {
  const database = requireDatabase();
  const [existingPermission] = await database
    .select({ id: schema.permissions.id })
    .from(schema.permissions)
    .where(eq(schema.permissions.code, code));

  if (existingPermission && existingPermission.id !== excludeId) {
    throw new PlatformMutationError('该权限编码已经存在。', 409);
  }
}

async function ensureTeamSlugAvailable(
  workspaceId: string,
  slug: string,
  excludeId?: string
) {
  const database = requireDatabase();
  const [existingTeam] = await database
    .select({ id: schema.teams.id })
    .from(schema.teams)
    .where(
      and(
        eq(schema.teams.workspaceId, workspaceId),
        eq(schema.teams.slug, slug)
      )
    );

  if (existingTeam && existingTeam.id !== excludeId) {
    throw new PlatformMutationError('该团队标识已经存在。', 409);
  }
}

async function ensureUsersExist(userIds: string[], entityLabel: string) {
  const normalizedUserIds = uniqueValues(userIds);

  if (!normalizedUserIds.length) {
    return;
  }

  const database = requireDatabase();
  const rows = await database
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(inArray(schema.users.id, normalizedUserIds));

  if (rows.length !== normalizedUserIds.length) {
    throw new PlatformMutationError(`${entityLabel}不存在或已被删除。`, 404);
  }
}

async function ensureUsersBelongToWorkspace(
  workspaceId: string,
  userIds: string[],
  entityLabel: string
) {
  const normalizedUserIds = uniqueValues(userIds);

  if (!normalizedUserIds.length) {
    return;
  }

  await ensureUsersExist(normalizedUserIds, entityLabel);

  const database = requireDatabase();
  const rows = await database
    .select({ userId: schema.workspaceMembers.userId })
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, workspaceId),
        inArray(schema.workspaceMembers.userId, normalizedUserIds)
      )
    );

  if (rows.length !== normalizedUserIds.length) {
    throw new PlatformMutationError(`${entityLabel}不属于当前工作区。`, 400);
  }
}

async function ensurePermissionIdsExist(permissionIds: string[]) {
  const normalizedPermissionIds = uniqueValues(permissionIds);

  if (!normalizedPermissionIds.length) {
    return;
  }

  const database = requireDatabase();
  const rows = await database
    .select({ id: schema.permissions.id })
    .from(schema.permissions)
    .where(inArray(schema.permissions.id, normalizedPermissionIds));

  if (rows.length !== normalizedPermissionIds.length) {
    throw new PlatformMutationError('选择的权限里包含无效项。', 400);
  }
}

async function ensureNotificationTarget(
  workspaceId?: string | null,
  userId?: string | null
) {
  const normalizedWorkspaceId = normalizeNullable(workspaceId);
  const normalizedUserId = normalizeNullable(userId);

  if (normalizedWorkspaceId) {
    await getWorkspaceRecord(normalizedWorkspaceId);
  }

  if (normalizedWorkspaceId && normalizedUserId) {
    await ensureUsersBelongToWorkspace(
      normalizedWorkspaceId,
      [normalizedUserId],
      '通知接收人'
    );
    return;
  }

  if (normalizedUserId) {
    await ensureUsersExist([normalizedUserId], '通知接收人');
  }
}

async function ensureTicketAssignee(
  workspaceId: string,
  assigneeId?: string | null
) {
  await getWorkspaceRecord(workspaceId);

  const normalizedAssigneeId = normalizeNullable(assigneeId);

  if (!normalizedAssigneeId) {
    return null;
  }

  await ensureUsersBelongToWorkspace(
    workspaceId,
    [normalizedAssigneeId],
    '工单负责人'
  );

  return normalizedAssigneeId;
}

async function ensureWorkspaceMember(workspaceId: string, userId: string) {
  const database = requireDatabase();
  const [membership] = await database
    .select({ userId: schema.workspaceMembers.userId })
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, workspaceId),
        eq(schema.workspaceMembers.userId, userId)
      )
    );

  if (!membership) {
    await database.insert(schema.workspaceMembers).values({
      workspaceId,
      userId
    });
  }
}

async function syncRolePermissions(roleId: string, permissionIds: string[]) {
  const database = requireDatabase();

  await database
    .delete(schema.rolePermissions)
    .where(eq(schema.rolePermissions.roleId, roleId));

  const uniquePermissionIds = uniqueValues(permissionIds);

  if (!uniquePermissionIds.length) {
    return;
  }

  await database.insert(schema.rolePermissions).values(
    uniquePermissionIds.map((permissionId) => ({
      roleId,
      permissionId
    }))
  );
}

async function syncTeamMembers(teamId: string, memberIds: string[]) {
  const database = requireDatabase();

  await database
    .delete(schema.teamMembers)
    .where(eq(schema.teamMembers.teamId, teamId));

  const uniqueMemberIds = uniqueValues(memberIds);

  if (!uniqueMemberIds.length) {
    return;
  }

  await database.insert(schema.teamMembers).values(
    uniqueMemberIds.map((userId) => ({
      teamId,
      userId
    }))
  );
}

async function getUserSummaryById(userId: string, workspaceId?: string) {
  const candidates = workspaceId
    ? await listUsers(workspaceId)
    : await listUsers();
  const matched = candidates.find((user) => user.id === userId);

  if (matched) {
    return matched;
  }

  const fallback = workspaceId ? await listUsers() : candidates;
  const globalMatched = fallback.find((user) => user.id === userId);

  if (!globalMatched) {
    throw new PlatformMutationError('用户不存在。', 404);
  }

  return globalMatched;
}

async function getRoleSummaryById(roleId: string, workspaceId?: string) {
  const roles = await listRoles(workspaceId);
  const matched = roles.find((role) => role.id === roleId);

  if (!matched) {
    throw new PlatformMutationError('角色不存在。', 404);
  }

  return matched;
}

async function getPermissionSummaryById(permissionId: string) {
  const permissions = await listPermissions();
  const matched = permissions.find(
    (permission) => permission.id === permissionId
  );

  if (!matched) {
    throw new PlatformMutationError('权限不存在。', 404);
  }

  return matched;
}

async function getTeamSummaryById(teamId: string, workspaceId?: string) {
  const teams = await listTeams(workspaceId);
  const matched = teams.find((team) => team.id === teamId);

  if (!matched) {
    throw new PlatformMutationError('团队不存在。', 404);
  }

  return matched;
}

async function getNotificationSummaryById(
  notificationId: string,
  workspaceId?: string
) {
  const notifications = await listAdminNotifications(workspaceId);
  const matched = notifications.find(
    (notification) => notification.id === notificationId
  );

  if (!matched) {
    throw new PlatformMutationError('通知不存在。', 404);
  }

  return matched;
}

async function getTicketSummaryById(ticketId: string, workspaceId?: string) {
  const tickets = await listTickets(workspaceId);
  const matched = tickets.find((ticket) => ticket.id === ticketId);

  if (!matched) {
    throw new PlatformMutationError('工单不存在。', 404);
  }

  return matched;
}

async function getLatestTicketCode() {
  const database = requireDatabase();
  const [ticket] = await database
    .select({ code: schema.tickets.code })
    .from(schema.tickets)
    .orderBy(desc(schema.tickets.code))
    .limit(1);

  if (!ticket?.code) {
    return 'TK-1001';
  }

  const current = Number(ticket.code.replace(/[^0-9]/g, ''));
  const next = Number.isFinite(current) && current > 0 ? current + 1 : 1001;
  return `TK-${String(next).padStart(4, '0')}`;
}

export async function createWorkspace(
  actorId: string,
  input: {
    name: string;
    slug?: string | null;
    description?: string | null;
    status: 'active' | 'archived';
  }
) {
  const database = requireDatabase();
  const workspaceSlug = normalizeNullable(input.slug) ?? slugify(input.name);

  if (!workspaceSlug) {
    throw new PlatformMutationError('工作区标识不能为空。');
  }

  await ensureWorkspaceSlugAvailable(workspaceSlug);

  const [createdWorkspace] = await database
    .insert(schema.workspaces)
    .values({
      slug: workspaceSlug,
      name: input.name.trim(),
      description: normalizeNullable(input.description),
      status: input.status
    })
    .returning({ id: schema.workspaces.id });

  await database.insert(schema.workspaceMembers).values({
    workspaceId: createdWorkspace.id,
    userId: actorId,
    isOwner: true
  });

  await recordAuditLog({
    workspaceId: createdWorkspace.id,
    actorId,
    action: 'workspace.create',
    entityType: 'workspace',
    entityId: createdWorkspace.id,
    summary: `创建了工作区 ${input.name.trim()}。`,
    metadata: {
      slug: workspaceSlug,
      status: input.status
    }
  });

  return getWorkspaceSummaryById(createdWorkspace.id);
}

export async function updateWorkspace(
  workspaceId: string,
  actorId: string,
  input: {
    name: string;
    slug?: string | null;
    description?: string | null;
    status: 'active' | 'archived';
  }
) {
  const database = requireDatabase();
  const workspace = await getWorkspaceSummaryById(workspaceId);
  const workspaceSlug = normalizeNullable(input.slug) ?? slugify(input.name);

  if (!workspaceSlug) {
    throw new PlatformMutationError('工作区标识不能为空。');
  }

  if (workspace.isDefault && input.status === 'archived') {
    throw new PlatformMutationError('默认工作区不允许归档。');
  }

  await ensureWorkspaceSlugAvailable(workspaceSlug, workspaceId);

  await database
    .update(schema.workspaces)
    .set({
      slug: workspaceSlug,
      name: input.name.trim(),
      description: normalizeNullable(input.description),
      status: input.status,
      updatedAt: new Date()
    })
    .where(eq(schema.workspaces.id, workspaceId));

  await recordAuditLog({
    workspaceId,
    actorId,
    action: 'workspace.update',
    entityType: 'workspace',
    entityId: workspaceId,
    summary: `更新了工作区 ${workspace.name}。`,
    metadata: {
      slug: workspaceSlug,
      status: input.status
    }
  });

  return getWorkspaceSummaryById(workspaceId);
}

export async function archiveWorkspace(workspaceId: string, actorId: string) {
  const database = requireDatabase();
  const workspace = await getWorkspaceSummaryById(workspaceId);

  if (workspace.isDefault) {
    throw new PlatformMutationError('默认工作区不允许归档。');
  }

  if (workspace.status !== 'archived') {
    await database
      .update(schema.workspaces)
      .set({
        status: 'archived',
        updatedAt: new Date()
      })
      .where(eq(schema.workspaces.id, workspaceId));

    await recordAuditLog({
      workspaceId,
      actorId,
      action: 'workspace.archive',
      entityType: 'workspace',
      entityId: workspaceId,
      summary: `归档了工作区 ${workspace.name}。`,
      metadata: {
        slug: workspace.slug
      }
    });
  }

  return getWorkspaceSummaryById(workspaceId);
}

export async function createUser(
  actorId: string,
  input: {
    workspaceId: string;
    githubUsername: string;
    displayName?: string | null;
    email?: string | null;
    systemRole: 'super_admin' | 'admin' | 'member';
    status: 'active' | 'invited' | 'disabled';
    emailLoginEnabled: boolean;
  }
) {
  const database = requireDatabase();
  const githubUsername = input.githubUsername.trim().toLowerCase();
  const email = normalizeNullable(input.email)?.toLowerCase();

  if (!githubUsername) {
    throw new PlatformMutationError('GitHub 用户名不能为空。');
  }

  const [existingUser] = await database
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.githubUsername, githubUsername));

  let userId = existingUser?.id;
  const workspaceName = await getWorkspaceName(input.workspaceId);
  await ensureUserEmailAvailable(email, existingUser?.id);

  if (!existingUser) {
    const [createdUser] = await database
      .insert(schema.users)
      .values({
        githubUsername,
        email,
        displayName: normalizeNullable(input.displayName),
        systemRole: input.systemRole,
        status: input.status,
        emailLoginEnabled: input.emailLoginEnabled
      })
      .returning({ id: schema.users.id });

    userId = createdUser.id;
  } else {
    await database
      .update(schema.users)
      .set({
        email,
        displayName: normalizeNullable(input.displayName),
        systemRole: input.systemRole,
        status: input.status,
        emailLoginEnabled: input.emailLoginEnabled,
        updatedAt: new Date()
      })
      .where(eq(schema.users.id, existingUser.id));
  }

  if (!userId) {
    throw new PlatformMutationError('用户创建失败，请稍后重试。', 500);
  }

  await ensureWorkspaceMember(input.workspaceId, userId);

  await recordAuditLog({
    workspaceId: input.workspaceId,
    actorId,
    action: existingUser ? 'user.attach' : 'user.create',
    entityType: 'user',
    entityId: userId,
    summary: existingUser
      ? `将 GitHub 用户 @${githubUsername} 绑定到工作区 ${workspaceName}。`
      : `在工作区 ${workspaceName} 中录入了 GitHub 用户 @${githubUsername}。`,
    metadata: {
      githubUsername,
      workspaceId: input.workspaceId
    }
  });

  return getUserSummaryById(userId, input.workspaceId);
}

export async function importGithubUsersToWorkspace(
  actorId: string,
  input: {
    workspaceId: string;
    githubUsernames: string[];
  }
): Promise<ImportedWorkspaceGithubUser[]> {
  const database = requireDatabase();
  const workspace = await getWorkspaceRecord(input.workspaceId);
  const githubUsernames = uniqueValues(
    input.githubUsernames.map((value) =>
      value.trim().replace(/^@/, '').toLowerCase()
    )
  );

  if (!githubUsernames.length) {
    throw new PlatformMutationError('至少选择一个 GitHub 用户。');
  }

  if (githubUsernames.length > 20) {
    throw new PlatformMutationError('一次最多添加 20 个 GitHub 用户。');
  }

  const importedUsers: ImportedWorkspaceGithubUser[] = [];

  for (const githubUsername of githubUsernames) {
    let githubUser;

    try {
      githubUser = await getGithubUserByUsername(githubUsername);
    } catch (error) {
      if (error instanceof GithubApiError) {
        throw new PlatformMutationError(
          error.status === 404
            ? `GitHub 用户 @${githubUsername} 不存在。`
            : error.message,
          error.status === 404 ? 404 : 502
        );
      }

      throw error;
    }

    const [existingUser] = await database
      .select({
        id: schema.users.id,
        githubUserId: schema.users.githubUserId,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
        bio: schema.users.bio
      })
      .from(schema.users)
      .where(eq(schema.users.githubUsername, githubUser.githubUsername));

    let userId = existingUser?.id;

    if (!existingUser) {
      const [createdUser] = await database
        .insert(schema.users)
        .values({
          githubUsername: githubUser.githubUsername,
          githubUserId: githubUser.githubUserId,
          displayName: normalizeNullable(githubUser.displayName),
          avatarUrl: normalizeNullable(githubUser.avatarUrl),
          bio: normalizeNullable(githubUser.bio),
          systemRole: 'member',
          status: 'active',
          emailLoginEnabled: false
        })
        .returning({ id: schema.users.id });

      userId = createdUser.id;
    } else {
      const updates: {
        githubUserId?: string;
        displayName?: string | null;
        avatarUrl?: string | null;
        bio?: string | null;
        updatedAt?: Date;
      } = {};

      if (!existingUser.githubUserId && githubUser.githubUserId) {
        updates.githubUserId = githubUser.githubUserId;
      }

      if (!existingUser.displayName && githubUser.displayName) {
        updates.displayName = githubUser.displayName;
      }

      if (!existingUser.avatarUrl && githubUser.avatarUrl) {
        updates.avatarUrl = githubUser.avatarUrl;
      }

      if (!existingUser.bio && githubUser.bio) {
        updates.bio = githubUser.bio;
      }

      if (Object.keys(updates).length) {
        updates.updatedAt = new Date();

        await database
          .update(schema.users)
          .set(updates)
          .where(eq(schema.users.id, existingUser.id));
      }
    }

    if (!userId) {
      throw new PlatformMutationError('GitHub 用户导入失败，请稍后重试。', 500);
    }

    const [membership] = await database
      .select({ userId: schema.workspaceMembers.userId })
      .from(schema.workspaceMembers)
      .where(
        and(
          eq(schema.workspaceMembers.workspaceId, input.workspaceId),
          eq(schema.workspaceMembers.userId, userId)
        )
      );
    const alreadyInWorkspace = Boolean(membership);

    if (!membership) {
      await ensureWorkspaceMember(input.workspaceId, userId);
    }

    importedUsers.push({
      id: userId,
      githubUsername: githubUser.githubUsername,
      displayName: existingUser?.displayName || githubUser.displayName || null,
      avatarUrl: existingUser?.avatarUrl || githubUser.avatarUrl || null,
      alreadyInWorkspace
    });
  }

  await recordAuditLog({
    workspaceId: input.workspaceId,
    actorId,
    action: 'user.github_import',
    entityType: 'user',
    entityId: null,
    summary: `从 GitHub 向工作区 ${workspace.name} 添加了 ${importedUsers.length} 位成员。`,
    metadata: {
      githubUsernames,
      importedUserIds: importedUsers.map((user) => user.id)
    }
  });

  return importedUsers;
}

export async function updateUser(
  userId: string,
  actorId: string,
  input: {
    workspaceId: string;
    githubUsername: string;
    displayName?: string | null;
    email?: string | null;
    systemRole: 'super_admin' | 'admin' | 'member';
    status: 'active' | 'invited' | 'disabled';
    emailLoginEnabled: boolean;
  }
) {
  const database = requireDatabase();
  const githubUsername = input.githubUsername.trim().toLowerCase();
  const email = normalizeNullable(input.email)?.toLowerCase();

  const [user] = await database
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, userId));

  if (!user) {
    throw new PlatformMutationError('用户不存在。', 404);
  }

  const [duplicate] = await database
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.githubUsername, githubUsername));

  if (duplicate && duplicate.id !== userId) {
    throw new PlatformMutationError('该 GitHub 用户名已经存在。', 409);
  }

  await ensureUserEmailAvailable(email, userId);

  await database
    .update(schema.users)
    .set({
      githubUsername,
      email,
      displayName: normalizeNullable(input.displayName),
      systemRole: input.systemRole,
      status: input.status,
      emailLoginEnabled: input.emailLoginEnabled,
      updatedAt: new Date()
    })
    .where(eq(schema.users.id, userId));

  await ensureWorkspaceMember(input.workspaceId, userId);

  await recordAuditLog({
    workspaceId: input.workspaceId,
    actorId,
    action: 'user.update',
    entityType: 'user',
    entityId: userId,
    summary: `更新了 GitHub 用户 @${githubUsername} 的资料与登录状态。`,
    metadata: {
      githubUsername,
      workspaceId: input.workspaceId
    }
  });

  return getUserSummaryById(userId, input.workspaceId);
}

export async function deleteUser(
  userId: string,
  actorId: string,
  workspaceId?: string
) {
  const database = requireDatabase();
  const user = await getUserSummaryById(userId, workspaceId);

  await database.delete(schema.users).where(eq(schema.users.id, userId));

  await recordAuditLog({
    workspaceId: workspaceId ?? user.workspaceIds?.[0] ?? null,
    actorId,
    action: 'user.delete',
    entityType: 'user',
    entityId: userId,
    summary: `删除了 GitHub 用户 @${user.githubUsername}。`,
    metadata: {
      githubUsername: user.githubUsername,
      workspaceId: workspaceId ?? null
    }
  });

  return user;
}

export async function createRole(
  actorId: string,
  input: {
    workspaceId: string;
    key: string;
    name: string;
    description?: string | null;
    permissionIds: string[];
  }
) {
  const database = requireDatabase();
  const key = slugify(input.key).replace(/-/g, '_');
  const permissionIds = uniqueValues(input.permissionIds);

  await getWorkspaceRecord(input.workspaceId);
  await ensureRoleKeyAvailable(input.workspaceId, key);
  await ensurePermissionIdsExist(permissionIds);

  const [createdRole] = await database
    .insert(schema.roles)
    .values({
      workspaceId: input.workspaceId,
      key,
      name: input.name.trim(),
      description: normalizeNullable(input.description)
    })
    .returning({ id: schema.roles.id });

  await syncRolePermissions(createdRole.id, permissionIds);

  await recordAuditLog({
    workspaceId: input.workspaceId,
    actorId,
    action: 'role.create',
    entityType: 'role',
    entityId: createdRole.id,
    summary: `创建了角色 ${input.name.trim()}。`,
    metadata: {
      key,
      permissionIds
    }
  });

  return getRoleSummaryById(createdRole.id, input.workspaceId);
}

export async function updateRole(
  roleId: string,
  actorId: string,
  input: {
    workspaceId: string;
    key: string;
    name: string;
    description?: string | null;
    permissionIds: string[];
  }
) {
  const database = requireDatabase();
  const role = await getRoleSummaryById(roleId, input.workspaceId);
  const key = slugify(input.key).replace(/-/g, '_');
  const permissionIds = uniqueValues(input.permissionIds);

  await getWorkspaceRecord(input.workspaceId);
  await ensureRoleKeyAvailable(input.workspaceId, key, roleId);
  await ensurePermissionIdsExist(permissionIds);

  await database
    .update(schema.roles)
    .set({
      key,
      name: input.name.trim(),
      description: normalizeNullable(input.description),
      updatedAt: new Date()
    })
    .where(eq(schema.roles.id, roleId));

  await syncRolePermissions(roleId, permissionIds);

  await recordAuditLog({
    workspaceId: input.workspaceId,
    actorId,
    action: 'role.update',
    entityType: 'role',
    entityId: roleId,
    summary: `更新了角色 ${role.name} 的配置。`,
    metadata: {
      key,
      permissionIds
    }
  });

  return getRoleSummaryById(roleId, input.workspaceId);
}

export async function deleteRole(
  roleId: string,
  actorId: string,
  workspaceId?: string
) {
  const database = requireDatabase();
  const role = await getRoleSummaryById(roleId, workspaceId);

  if (role.isSystem) {
    throw new PlatformMutationError('系统角色不允许删除。', 400);
  }

  await database.delete(schema.roles).where(eq(schema.roles.id, roleId));

  await recordAuditLog({
    workspaceId: workspaceId ?? role.workspaceId,
    actorId,
    action: 'role.delete',
    entityType: 'role',
    entityId: roleId,
    summary: `删除了角色 ${role.name}。`,
    metadata: {
      key: role.key
    }
  });

  return role;
}

export async function createPermission(
  actorId: string,
  input: {
    code: string;
    name: string;
    module: string;
    action: string;
    description?: string | null;
  }
) {
  const database = requireDatabase();
  const moduleName = slugify(input.module).replace(/-/g, '_');
  const actionName = slugify(input.action).replace(/-/g, '_');
  const code =
    normalizeNullable(input.code)?.toLowerCase() ??
    `${moduleName}.${actionName}`;

  await ensurePermissionCodeAvailable(code);

  const [createdPermission] = await database
    .insert(schema.permissions)
    .values({
      code,
      name: input.name.trim(),
      module: moduleName,
      action: actionName,
      description: normalizeNullable(input.description)
    })
    .returning({ id: schema.permissions.id });

  await recordAuditLog({
    actorId,
    action: 'permission.create',
    entityType: 'permission',
    entityId: createdPermission.id,
    summary: `创建了权限 ${code}。`,
    metadata: {
      code,
      module: moduleName,
      action: actionName
    }
  });

  return getPermissionSummaryById(createdPermission.id);
}

export async function updatePermission(
  permissionId: string,
  actorId: string,
  input: {
    code: string;
    name: string;
    module: string;
    action: string;
    description?: string | null;
  }
) {
  const database = requireDatabase();
  const permission = await getPermissionSummaryById(permissionId);
  const moduleName = slugify(input.module).replace(/-/g, '_');
  const actionName = slugify(input.action).replace(/-/g, '_');
  const code =
    normalizeNullable(input.code)?.toLowerCase() ??
    `${moduleName}.${actionName}`;

  await ensurePermissionCodeAvailable(code, permissionId);

  await database
    .update(schema.permissions)
    .set({
      code,
      name: input.name.trim(),
      module: moduleName,
      action: actionName,
      description: normalizeNullable(input.description),
      updatedAt: new Date()
    })
    .where(eq(schema.permissions.id, permissionId));

  await recordAuditLog({
    actorId,
    action: 'permission.update',
    entityType: 'permission',
    entityId: permissionId,
    summary: `更新了权限 ${permission.code}。`,
    metadata: {
      code,
      module: moduleName,
      action: actionName
    }
  });

  return getPermissionSummaryById(permissionId);
}

export async function deletePermission(permissionId: string, actorId: string) {
  const database = requireDatabase();
  const permission = await getPermissionSummaryById(permissionId);

  await database
    .delete(schema.permissions)
    .where(eq(schema.permissions.id, permissionId));

  await recordAuditLog({
    actorId,
    action: 'permission.delete',
    entityType: 'permission',
    entityId: permissionId,
    summary: `删除了权限 ${permission.code}。`,
    metadata: {
      code: permission.code
    }
  });

  return permission;
}

export async function createTeam(
  actorId: string,
  input: {
    workspaceId: string;
    name: string;
    slug?: string | null;
    description?: string | null;
    leadUserId?: string | null;
    memberIds: string[];
  }
) {
  const database = requireDatabase();
  const teamSlug = normalizeNullable(input.slug) ?? slugify(input.name);
  const leadUserId = normalizeNullable(input.leadUserId);
  const memberIds = uniqueValues(
    leadUserId ? [...input.memberIds, leadUserId] : input.memberIds
  );

  if (!teamSlug) {
    throw new PlatformMutationError('团队标识不能为空。');
  }

  await getWorkspaceRecord(input.workspaceId);
  await ensureTeamSlugAvailable(input.workspaceId, teamSlug);
  await ensureUsersBelongToWorkspace(input.workspaceId, memberIds, '团队成员');

  const [createdTeam] = await database
    .insert(schema.teams)
    .values({
      workspaceId: input.workspaceId,
      slug: teamSlug,
      name: input.name.trim(),
      description: normalizeNullable(input.description),
      leadUserId
    })
    .returning({ id: schema.teams.id });

  await syncTeamMembers(createdTeam.id, memberIds);

  await recordAuditLog({
    workspaceId: input.workspaceId,
    actorId,
    action: 'team.create',
    entityType: 'team',
    entityId: createdTeam.id,
    summary: `创建了团队 ${input.name.trim()}。`,
    metadata: {
      slug: teamSlug,
      leadUserId,
      memberIds
    }
  });

  return getTeamSummaryById(createdTeam.id, input.workspaceId);
}

export async function updateTeam(
  teamId: string,
  actorId: string,
  input: {
    workspaceId: string;
    name: string;
    slug?: string | null;
    description?: string | null;
    leadUserId?: string | null;
    memberIds: string[];
  }
) {
  const database = requireDatabase();
  const team = await getTeamSummaryById(teamId, input.workspaceId);
  const teamSlug = normalizeNullable(input.slug) ?? slugify(input.name);
  const leadUserId = normalizeNullable(input.leadUserId);
  const memberIds = uniqueValues(
    leadUserId ? [...input.memberIds, leadUserId] : input.memberIds
  );

  if (!teamSlug) {
    throw new PlatformMutationError('团队标识不能为空。');
  }

  await getWorkspaceRecord(input.workspaceId);
  await ensureTeamSlugAvailable(input.workspaceId, teamSlug, teamId);
  await ensureUsersBelongToWorkspace(input.workspaceId, memberIds, '团队成员');

  await database
    .update(schema.teams)
    .set({
      slug: teamSlug,
      name: input.name.trim(),
      description: normalizeNullable(input.description),
      leadUserId,
      updatedAt: new Date()
    })
    .where(eq(schema.teams.id, teamId));

  await syncTeamMembers(teamId, memberIds);

  await recordAuditLog({
    workspaceId: input.workspaceId,
    actorId,
    action: 'team.update',
    entityType: 'team',
    entityId: teamId,
    summary: `更新了团队 ${team.name}。`,
    metadata: {
      slug: teamSlug,
      leadUserId,
      memberIds
    }
  });

  return getTeamSummaryById(teamId, input.workspaceId);
}

export async function deleteTeam(
  teamId: string,
  actorId: string,
  workspaceId?: string
) {
  const database = requireDatabase();
  const team = await getTeamSummaryById(teamId, workspaceId);

  await database.delete(schema.teams).where(eq(schema.teams.id, teamId));

  await recordAuditLog({
    workspaceId: workspaceId ?? team.workspaceId,
    actorId,
    action: 'team.delete',
    entityType: 'team',
    entityId: teamId,
    summary: `删除了团队 ${team.name}。`,
    metadata: {
      slug: team.slug ?? null
    }
  });

  return team;
}

export async function createNotification(
  actorId: string,
  input: {
    workspaceId?: string | null;
    userId?: string | null;
    title: string;
    content: string;
    level: 'info' | 'success' | 'warning' | 'error';
    isRead?: boolean;
  }
) {
  const database = requireDatabase();
  const workspaceId = normalizeNullable(input.workspaceId);
  const userId = normalizeNullable(input.userId);

  await ensureNotificationTarget(workspaceId, userId);

  const [createdNotification] = await database
    .insert(schema.notifications)
    .values({
      workspaceId,
      userId,
      title: input.title.trim(),
      content: input.content.trim(),
      level: input.level,
      isRead: input.isRead ?? false,
      updatedAt: new Date()
    })
    .returning({ id: schema.notifications.id });

  await recordAuditLog({
    workspaceId,
    actorId,
    action: 'notification.create',
    entityType: 'notification',
    entityId: createdNotification.id,
    summary: `发布了站内消息《${input.title.trim()}》。`,
    metadata: {
      userId,
      level: input.level
    }
  });

  return getNotificationSummaryById(
    createdNotification.id,
    workspaceId ?? undefined
  );
}

export async function updateNotification(
  notificationId: string,
  actorId: string,
  input: {
    workspaceId?: string | null;
    userId?: string | null;
    title: string;
    content: string;
    level: 'info' | 'success' | 'warning' | 'error';
    isRead?: boolean;
  }
) {
  const database = requireDatabase();
  const workspaceId = normalizeNullable(input.workspaceId);
  const userId = normalizeNullable(input.userId);
  const notification = await getNotificationSummaryById(notificationId);

  await ensureNotificationTarget(workspaceId, userId);

  await database
    .update(schema.notifications)
    .set({
      workspaceId,
      userId,
      title: input.title.trim(),
      content: input.content.trim(),
      level: input.level,
      isRead: input.isRead ?? notification.isRead,
      updatedAt: new Date()
    })
    .where(eq(schema.notifications.id, notificationId));

  await recordAuditLog({
    workspaceId,
    actorId,
    action: 'notification.update',
    entityType: 'notification',
    entityId: notificationId,
    summary: `更新了站内消息《${notification.title}》。`,
    metadata: {
      userId,
      level: input.level
    }
  });

  return getNotificationSummaryById(notificationId, workspaceId ?? undefined);
}

export async function setNotificationReadState(
  notificationId: string,
  actorId: string,
  isRead: boolean,
  workspaceId?: string
) {
  const database = requireDatabase();
  const notification = await getNotificationSummaryById(
    notificationId,
    workspaceId
  );

  await database
    .update(schema.notifications)
    .set({
      isRead,
      updatedAt: new Date()
    })
    .where(eq(schema.notifications.id, notificationId));

  await recordAuditLog({
    workspaceId: notification.workspaceId,
    actorId,
    action: isRead ? 'notification.read' : 'notification.unread',
    entityType: 'notification',
    entityId: notificationId,
    summary: `${isRead ? '标记已读' : '恢复未读'}消息《${notification.title}》。`,
    metadata: {
      isRead
    }
  });

  return getNotificationSummaryById(notificationId, workspaceId);
}

export async function deleteNotification(
  notificationId: string,
  actorId: string,
  workspaceId?: string
) {
  const database = requireDatabase();
  const notification = await getNotificationSummaryById(
    notificationId,
    workspaceId
  );

  await database
    .delete(schema.notifications)
    .where(eq(schema.notifications.id, notificationId));

  await recordAuditLog({
    workspaceId: notification.workspaceId,
    actorId,
    action: 'notification.delete',
    entityType: 'notification',
    entityId: notificationId,
    summary: `删除了站内消息《${notification.title}》。`,
    metadata: {
      level: notification.level
    }
  });

  return notification;
}

export async function createTicket(
  actorId: string,
  input: {
    workspaceId: string;
    title: string;
    description?: string | null;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    assigneeId?: string | null;
  }
) {
  const database = requireDatabase();
  const code = await getLatestTicketCode();
  const assigneeId = await ensureTicketAssignee(
    input.workspaceId,
    input.assigneeId
  );

  const [createdTicket] = await database
    .insert(schema.tickets)
    .values({
      workspaceId: input.workspaceId,
      code,
      title: input.title.trim(),
      description: normalizeNullable(input.description),
      priority: input.priority,
      status: input.status,
      reporterId: actorId,
      assigneeId
    })
    .returning({ id: schema.tickets.id });

  await recordAuditLog({
    workspaceId: input.workspaceId,
    actorId,
    action: 'ticket.create',
    entityType: 'ticket',
    entityId: createdTicket.id,
    summary: `创建了工单 ${code}。`,
    metadata: {
      code,
      status: input.status,
      priority: input.priority,
      assigneeId
    }
  });

  return getTicketSummaryById(createdTicket.id, input.workspaceId);
}

export async function updateTicket(
  ticketId: string,
  actorId: string,
  input: {
    workspaceId: string;
    title: string;
    description?: string | null;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    assigneeId?: string | null;
  }
) {
  const database = requireDatabase();
  const ticket = await getTicketSummaryById(ticketId, input.workspaceId);
  const assigneeId = await ensureTicketAssignee(
    input.workspaceId,
    input.assigneeId
  );

  await database
    .update(schema.tickets)
    .set({
      title: input.title.trim(),
      description: normalizeNullable(input.description),
      priority: input.priority,
      status: input.status,
      assigneeId,
      updatedAt: new Date()
    })
    .where(eq(schema.tickets.id, ticketId));

  await recordAuditLog({
    workspaceId: input.workspaceId,
    actorId,
    action: 'ticket.update',
    entityType: 'ticket',
    entityId: ticketId,
    summary: `更新了工单 ${ticket.code}。`,
    metadata: {
      status: input.status,
      priority: input.priority,
      assigneeId
    }
  });

  return getTicketSummaryById(ticketId, input.workspaceId);
}

export async function deleteTicket(
  ticketId: string,
  actorId: string,
  workspaceId?: string
) {
  const database = requireDatabase();
  const ticket = await getTicketSummaryById(ticketId, workspaceId);

  await database.delete(schema.tickets).where(eq(schema.tickets.id, ticketId));

  await recordAuditLog({
    workspaceId: ticket.workspaceId ?? workspaceId ?? null,
    actorId,
    action: 'ticket.delete',
    entityType: 'ticket',
    entityId: ticketId,
    summary: `删除了工单 ${ticket.code}。`,
    metadata: {
      title: ticket.title
    }
  });

  return ticket;
}

export async function addTicketComment(
  ticketId: string,
  actorId: string,
  input: {
    body: string;
    attachmentIds: string[];
  },
  workspaceId?: string
) {
  const database = requireDatabase();
  const ticket = await getTicketSummaryById(ticketId, workspaceId);

  const [comment] = await database
    .insert(schema.ticketComments)
    .values({
      ticketId,
      authorId: actorId,
      body: input.body.trim(),
      attachmentIds: uniqueValues(input.attachmentIds)
    })
    .returning({ id: schema.ticketComments.id });

  const comments = await database
    .select({ id: schema.ticketComments.id })
    .from(schema.ticketComments)
    .where(eq(schema.ticketComments.ticketId, ticketId));

  await database
    .update(schema.tickets)
    .set({
      commentCount: comments.length,
      updatedAt: new Date()
    })
    .where(eq(schema.tickets.id, ticketId));

  await recordAuditLog({
    workspaceId: ticket.workspaceId ?? workspaceId ?? null,
    actorId,
    action: 'ticket.comment.create',
    entityType: 'ticket_comment',
    entityId: comment.id,
    summary: `在工单 ${ticket.code} 下新增了一条评论。`,
    metadata: {
      ticketId,
      attachmentIds: uniqueValues(input.attachmentIds)
    }
  });

  return comment.id;
}

export async function saveFileAsset(
  actorId: string,
  input: {
    workspaceId?: string | null;
    entityType: FileAssetSummary['entityType'];
    entityId?: string | null;
    bucket?: string | null;
    objectKey: string;
    fileName: string;
    mimeType?: string | null;
    size: number;
    publicUrl?: string | null;
  }
) {
  const database = requireDatabase();
  const [createdFile] = await database
    .insert(schema.fileAssets)
    .values({
      workspaceId: normalizeNullable(input.workspaceId),
      entityType: input.entityType,
      entityId: normalizeNullable(input.entityId),
      bucket: normalizeNullable(input.bucket),
      objectKey: input.objectKey,
      fileName: input.fileName,
      mimeType: normalizeNullable(input.mimeType),
      size: input.size,
      publicUrl: normalizeNullable(input.publicUrl),
      uploadedBy: actorId
    })
    .returning({ id: schema.fileAssets.id });

  await recordAuditLog({
    workspaceId: normalizeNullable(input.workspaceId),
    actorId,
    action: 'file.upload',
    entityType: 'file_asset',
    entityId: createdFile.id,
    summary: `上传了文件 ${input.fileName}。`,
    metadata: {
      entityType: input.entityType,
      entityId: normalizeNullable(input.entityId),
      objectKey: input.objectKey,
      size: input.size
    }
  });

  if (input.entityId) {
    const files = await listFilesByEntity(input.entityType, input.entityId);
    const matched = files.find((file) => file.id === createdFile.id);
    if (matched) {
      return matched;
    }
  }

  const [actor] = await database
    .select({
      githubUsername: schema.users.githubUsername,
      displayName: schema.users.displayName
    })
    .from(schema.users)
    .where(eq(schema.users.id, actorId));

  return {
    id: createdFile.id,
    workspaceId: normalizeNullable(input.workspaceId),
    entityType: input.entityType,
    entityId: normalizeNullable(input.entityId),
    fileName: input.fileName,
    mimeType: normalizeNullable(input.mimeType),
    size: input.size,
    publicUrl: normalizeNullable(input.publicUrl),
    uploadedBy: actorId,
    uploadedByName: actor?.displayName || actor?.githubUsername || '未知成员',
    createdAt: new Date().toLocaleString('zh-CN')
  } satisfies FileAssetSummary;
}

export async function listRecentAuditLogs(
  workspaceId?: string,
  limit?: number
) {
  return listAuditLogs(workspaceId, limit ?? 10);
}
