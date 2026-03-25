import { and, asc, count, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import {
  demoAuditLogs,
  demoFileAssets,
  demoNotifications,
  demoPermissions,
  demoRoles,
  demoTeams,
  demoTicketComments,
  demoTickets,
  demoUsers,
  demoWorkspaces
} from './demo-data';
import type {
  AuditLogSummary,
  FileAssetSummary,
  NotificationSummary,
  OptionItem,
  PermissionSummary,
  RoleSummary,
  TeamSummary,
  TicketCommentSummary,
  TicketSummary,
  UserSummary,
  WorkspaceSummary
} from './types';

export type WorkspaceOption = {
  id: string;
  name: string;
  slug: string;
};

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) {
    return '-';
  }

  if (typeof value === 'string') {
    return value;
  }

  return value.toLocaleString('zh-CN');
}

export async function listWorkspaceOptions(
  userId?: string,
  systemRole?: string
) {
  if (!db) {
    let visibleWorkspaces = demoWorkspaces.filter(
      (workspace) => workspace.status === 'active'
    );

    if (systemRole !== 'super_admin' && userId) {
      const currentUser = demoUsers.find((user) => user.id === userId);
      visibleWorkspaces = visibleWorkspaces.filter((workspace) =>
        currentUser?.workspaceIds?.includes(workspace.id)
      );
    }

    return visibleWorkspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug
    }));
  }

  const database = db;

  if (systemRole === 'super_admin') {
    return database
      .select({
        id: schema.workspaces.id,
        name: schema.workspaces.name,
        slug: schema.workspaces.slug
      })
      .from(schema.workspaces)
      .where(eq(schema.workspaces.status, 'active'))
      .orderBy(asc(schema.workspaces.name));
  }

  if (!userId) {
    return [];
  }

  return database
    .select({
      id: schema.workspaces.id,
      name: schema.workspaces.name,
      slug: schema.workspaces.slug
    })
    .from(schema.workspaceMembers)
    .innerJoin(
      schema.workspaces,
      eq(schema.workspaceMembers.workspaceId, schema.workspaces.id)
    )
    .where(
      and(
        eq(schema.workspaceMembers.userId, userId),
        eq(schema.workspaces.status, 'active')
      )
    )
    .orderBy(asc(schema.workspaces.name));
}

export async function listWorkspaceMemberOptions(
  activeWorkspaceId?: string
): Promise<OptionItem[]> {
  const users = await listUsers(activeWorkspaceId);
  return users.map((user) => ({
    label: `${user.displayName || user.githubUsername} (@${user.githubUsername})`,
    value: user.id
  }));
}

export async function listRoleOptions(
  activeWorkspaceId?: string
): Promise<OptionItem[]> {
  const roles = await listRoles(activeWorkspaceId);
  return roles.map((role) => ({
    label: role.name,
    value: role.id
  }));
}

export async function listPermissionOptions(): Promise<OptionItem[]> {
  const permissions = await listPermissions();
  return permissions.map((permission) => ({
    label: `${permission.name} (${permission.code})`,
    value: permission.id
  }));
}

export async function getDashboardMetrics() {
  if (!db) {
    return {
      workspaceCount: demoWorkspaces.length,
      teamCount: demoTeams.length,
      userCount: demoUsers.length,
      ticketCount: demoTickets.length,
      notificationCount: demoNotifications.length,
      auditLogCount: demoAuditLogs.length
    };
  }

  const database = db;

  const [
    workspaceCountRow,
    teamCountRow,
    userCountRow,
    ticketCountRow,
    notificationCountRow,
    auditLogCountRow
  ] = await Promise.all([
    database.select({ value: count() }).from(schema.workspaces),
    database.select({ value: count() }).from(schema.teams),
    database.select({ value: count() }).from(schema.users),
    database.select({ value: count() }).from(schema.tickets),
    database.select({ value: count() }).from(schema.notifications),
    database.select({ value: count() }).from(schema.auditLogs)
  ]);

  return {
    workspaceCount: workspaceCountRow[0]?.value ?? 0,
    teamCount: teamCountRow[0]?.value ?? 0,
    userCount: userCountRow[0]?.value ?? 0,
    ticketCount: ticketCountRow[0]?.value ?? 0,
    notificationCount: notificationCountRow[0]?.value ?? 0,
    auditLogCount: auditLogCountRow[0]?.value ?? 0
  };
}

export async function listWorkspaces(
  userId?: string,
  systemRole?: string
): Promise<WorkspaceSummary[]> {
  if (!db) {
    if (systemRole === 'super_admin' || !userId) {
      return demoWorkspaces;
    }

    const currentUser = demoUsers.find((user) => user.id === userId);

    if (!currentUser) {
      return [];
    }

    return demoWorkspaces.filter((workspace) =>
      currentUser.workspaceIds?.includes(workspace.id)
    );
  }

  const database = db;
  const workspaceQuery = {
    id: schema.workspaces.id,
    slug: schema.workspaces.slug,
    name: schema.workspaces.name,
    description: schema.workspaces.description,
    status: schema.workspaces.status,
    isDefault: schema.workspaces.isDefault
  };

  const rows =
    systemRole === 'super_admin'
      ? await database
          .select(workspaceQuery)
          .from(schema.workspaces)
          .orderBy(asc(schema.workspaces.name))
      : userId
        ? await database
            .select(workspaceQuery)
            .from(schema.workspaceMembers)
            .innerJoin(
              schema.workspaces,
              eq(schema.workspaceMembers.workspaceId, schema.workspaces.id)
            )
            .where(eq(schema.workspaceMembers.userId, userId))
            .orderBy(asc(schema.workspaces.name))
        : [];

  return Promise.all(
    rows.map(async (workspace) => {
      const [teamCountRow] = await database
        .select({ value: count() })
        .from(schema.teams)
        .where(eq(schema.teams.workspaceId, workspace.id));
      const [memberCountRow] = await database
        .select({ value: count() })
        .from(schema.workspaceMembers)
        .where(eq(schema.workspaceMembers.workspaceId, workspace.id));

      return {
        ...workspace,
        description: workspace.description ?? '未填写工作区描述。',
        teamCount: teamCountRow?.value ?? 0,
        memberCount: memberCountRow?.value ?? 0
      };
    })
  );
}

export async function listTeams(
  activeWorkspaceId?: string
): Promise<TeamSummary[]> {
  if (!db) {
    return activeWorkspaceId
      ? demoTeams.filter((team) => team.workspaceId === activeWorkspaceId)
      : demoTeams;
  }

  const database = db;
  const rows = activeWorkspaceId
    ? await database
        .select({
          id: schema.teams.id,
          workspaceId: schema.teams.workspaceId,
          slug: schema.teams.slug,
          name: schema.teams.name,
          description: schema.teams.description,
          leadUserId: schema.teams.leadUserId
        })
        .from(schema.teams)
        .where(eq(schema.teams.workspaceId, activeWorkspaceId))
        .orderBy(asc(schema.teams.name))
    : await database
        .select({
          id: schema.teams.id,
          workspaceId: schema.teams.workspaceId,
          slug: schema.teams.slug,
          name: schema.teams.name,
          description: schema.teams.description,
          leadUserId: schema.teams.leadUserId
        })
        .from(schema.teams)
        .orderBy(asc(schema.teams.name));

  const teamIds = rows.map((team) => team.id);
  const leadIds = rows
    .map((team) => team.leadUserId)
    .filter((value): value is string => Boolean(value));

  const [memberRows, leadRows] = await Promise.all([
    teamIds.length
      ? database
          .select({
            teamId: schema.teamMembers.teamId,
            userId: schema.teamMembers.userId
          })
          .from(schema.teamMembers)
          .where(inArray(schema.teamMembers.teamId, teamIds))
      : Promise.resolve([]),
    leadIds.length
      ? database
          .select({
            id: schema.users.id,
            githubUsername: schema.users.githubUsername,
            displayName: schema.users.displayName
          })
          .from(schema.users)
          .where(inArray(schema.users.id, leadIds))
      : Promise.resolve([])
  ]);

  const membersMap = new Map<string, string[]>();
  for (const row of memberRows) {
    const current = membersMap.get(row.teamId) ?? [];
    current.push(row.userId);
    membersMap.set(row.teamId, current);
  }

  const leadMap = new Map(
    leadRows.map((lead) => [
      lead.id,
      lead.displayName || lead.githubUsername || '待配置'
    ])
  );

  return rows.map((team) => ({
    id: team.id,
    workspaceId: team.workspaceId,
    slug: team.slug,
    name: team.name,
    description: team.description ?? '未填写团队描述。',
    leadUserId: team.leadUserId ?? null,
    lead: team.leadUserId
      ? (leadMap.get(team.leadUserId) ?? '待配置')
      : '待配置',
    memberCount: (membersMap.get(team.id) ?? []).length,
    memberIds: membersMap.get(team.id) ?? []
  }));
}

export async function listUsers(
  activeWorkspaceId?: string
): Promise<UserSummary[]> {
  if (!db) {
    return activeWorkspaceId
      ? demoUsers.filter((user) =>
          user.workspaceIds?.includes(activeWorkspaceId)
        )
      : demoUsers;
  }

  const database = db;
  const rows = activeWorkspaceId
    ? await database
        .select({
          id: schema.users.id,
          githubUsername: schema.users.githubUsername,
          displayName: schema.users.displayName,
          email: schema.users.email,
          systemRole: schema.users.systemRole,
          status: schema.users.status,
          emailLoginEnabled: schema.users.emailLoginEnabled
        })
        .from(schema.workspaceMembers)
        .innerJoin(
          schema.users,
          eq(schema.workspaceMembers.userId, schema.users.id)
        )
        .where(eq(schema.workspaceMembers.workspaceId, activeWorkspaceId))
        .orderBy(asc(schema.users.githubUsername))
    : await database
        .select({
          id: schema.users.id,
          githubUsername: schema.users.githubUsername,
          displayName: schema.users.displayName,
          email: schema.users.email,
          systemRole: schema.users.systemRole,
          status: schema.users.status,
          emailLoginEnabled: schema.users.emailLoginEnabled
        })
        .from(schema.users)
        .orderBy(asc(schema.users.githubUsername));

  const userIds = rows.map((user) => user.id);
  const memberships = userIds.length
    ? await database
        .select({
          userId: schema.workspaceMembers.userId,
          workspaceId: schema.workspaceMembers.workspaceId
        })
        .from(schema.workspaceMembers)
        .where(inArray(schema.workspaceMembers.userId, userIds))
    : [];

  const workspaceMap = new Map<string, string[]>();
  memberships.forEach((membership) => {
    const current = workspaceMap.get(membership.userId) ?? [];
    current.push(membership.workspaceId);
    workspaceMap.set(membership.userId, current);
  });

  return rows.map((user) => ({
    ...user,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    emailLoginEnabled: user.emailLoginEnabled,
    workspaceIds: workspaceMap.get(user.id) ?? []
  }));
}

export async function listRoles(
  activeWorkspaceId?: string
): Promise<RoleSummary[]> {
  if (!db) {
    return activeWorkspaceId
      ? demoRoles.filter((role) => role.workspaceId === activeWorkspaceId)
      : demoRoles;
  }

  const database = db;
  const rows = activeWorkspaceId
    ? await database
        .select({
          id: schema.roles.id,
          workspaceId: schema.roles.workspaceId,
          key: schema.roles.key,
          name: schema.roles.name,
          description: schema.roles.description,
          isSystem: schema.roles.isSystem
        })
        .from(schema.roles)
        .where(eq(schema.roles.workspaceId, activeWorkspaceId))
        .orderBy(asc(schema.roles.name))
    : await database
        .select({
          id: schema.roles.id,
          workspaceId: schema.roles.workspaceId,
          key: schema.roles.key,
          name: schema.roles.name,
          description: schema.roles.description,
          isSystem: schema.roles.isSystem
        })
        .from(schema.roles)
        .orderBy(asc(schema.roles.name));

  const roleIds = rows.map((role) => role.id);
  const mappings = roleIds.length
    ? await database
        .select({
          roleId: schema.rolePermissions.roleId,
          permissionId: schema.rolePermissions.permissionId
        })
        .from(schema.rolePermissions)
        .where(inArray(schema.rolePermissions.roleId, roleIds))
    : [];

  const permissionMap = new Map<string, string[]>();
  for (const mapping of mappings) {
    const current = permissionMap.get(mapping.roleId) ?? [];
    current.push(mapping.permissionId);
    permissionMap.set(mapping.roleId, current);
  }

  return rows.map((role) => ({
    ...role,
    description: role.description ?? '未填写角色描述。',
    permissionCount: (permissionMap.get(role.id) ?? []).length,
    permissionIds: permissionMap.get(role.id) ?? [],
    isSystem: role.isSystem
  }));
}

export async function listPermissions(): Promise<PermissionSummary[]> {
  if (!db) {
    return demoPermissions;
  }

  const database = db;

  return database
    .select({
      id: schema.permissions.id,
      module: schema.permissions.module,
      action: schema.permissions.action,
      code: schema.permissions.code,
      name: schema.permissions.name,
      description: schema.permissions.description
    })
    .from(schema.permissions)
    .orderBy(asc(schema.permissions.module), asc(schema.permissions.action));
}

export async function listAdminNotifications(
  activeWorkspaceId?: string
): Promise<NotificationSummary[]> {
  if (!db) {
    return activeWorkspaceId
      ? demoNotifications.filter(
          (item) =>
            item.workspaceId === activeWorkspaceId || item.workspaceId === null
        )
      : demoNotifications;
  }

  const database = db;
  const rows = activeWorkspaceId
    ? await database
        .select({
          id: schema.notifications.id,
          workspaceId: schema.notifications.workspaceId,
          userId: schema.notifications.userId,
          title: schema.notifications.title,
          content: schema.notifications.content,
          level: schema.notifications.level,
          isRead: schema.notifications.isRead,
          createdAt: schema.notifications.createdAt
        })
        .from(schema.notifications)
        .where(
          or(
            eq(schema.notifications.workspaceId, activeWorkspaceId),
            isNull(schema.notifications.workspaceId)
          )
        )
        .orderBy(desc(schema.notifications.createdAt))
    : await database
        .select({
          id: schema.notifications.id,
          workspaceId: schema.notifications.workspaceId,
          userId: schema.notifications.userId,
          title: schema.notifications.title,
          content: schema.notifications.content,
          level: schema.notifications.level,
          isRead: schema.notifications.isRead,
          createdAt: schema.notifications.createdAt
        })
        .from(schema.notifications)
        .orderBy(desc(schema.notifications.createdAt));

  const userIds = rows
    .map((row) => row.userId)
    .filter((value): value is string => Boolean(value));

  const userRows = userIds.length
    ? await database
        .select({
          id: schema.users.id,
          githubUsername: schema.users.githubUsername,
          displayName: schema.users.displayName
        })
        .from(schema.users)
        .where(inArray(schema.users.id, userIds))
    : [];

  const userMap = new Map(
    userRows.map((user) => [
      user.id,
      `@${user.githubUsername}${user.displayName ? ` / ${user.displayName}` : ''}`
    ])
  );

  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspaceId ?? null,
    userId: row.userId ?? null,
    title: row.title,
    content: row.content,
    level: row.level,
    isRead: row.isRead,
    createdAt: formatDateTime(row.createdAt),
    targetLabel: row.userId
      ? (userMap.get(row.userId) ?? '指定成员')
      : row.workspaceId
        ? '当前工作区'
        : '系统广播'
  }));
}

export async function listNotifications(
  activeWorkspaceId?: string,
  userId?: string
): Promise<NotificationSummary[]> {
  if (!db) {
    return activeWorkspaceId
      ? demoNotifications.filter(
          (item) =>
            item.workspaceId === activeWorkspaceId ||
            (item.userId && item.userId === userId)
        )
      : demoNotifications;
  }

  if (!activeWorkspaceId && !userId) {
    return [];
  }

  const database = db;
  let whereClause;

  if (activeWorkspaceId && userId) {
    whereClause = or(
      and(
        eq(schema.notifications.workspaceId, activeWorkspaceId),
        isNull(schema.notifications.userId)
      ),
      and(
        eq(schema.notifications.workspaceId, activeWorkspaceId),
        eq(schema.notifications.userId, userId)
      ),
      and(
        isNull(schema.notifications.workspaceId),
        eq(schema.notifications.userId, userId)
      )
    );
  } else if (activeWorkspaceId) {
    whereClause = eq(schema.notifications.workspaceId, activeWorkspaceId);
  } else {
    whereClause = eq(schema.notifications.userId, userId!);
  }

  const rows = await database
    .select({
      id: schema.notifications.id,
      workspaceId: schema.notifications.workspaceId,
      userId: schema.notifications.userId,
      title: schema.notifications.title,
      content: schema.notifications.content,
      level: schema.notifications.level,
      isRead: schema.notifications.isRead,
      createdAt: schema.notifications.createdAt
    })
    .from(schema.notifications)
    .where(whereClause)
    .orderBy(desc(schema.notifications.createdAt));

  const userIds = rows
    .map((row) => row.userId)
    .filter((value): value is string => Boolean(value));

  const userRows = userIds.length
    ? await database
        .select({
          id: schema.users.id,
          githubUsername: schema.users.githubUsername,
          displayName: schema.users.displayName
        })
        .from(schema.users)
        .where(inArray(schema.users.id, userIds))
    : [];

  const userMap = new Map(
    userRows.map((user) => [
      user.id,
      `@${user.githubUsername}${user.displayName ? ` / ${user.displayName}` : ''}`
    ])
  );

  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspaceId ?? null,
    userId: row.userId ?? null,
    title: row.title,
    content: row.content,
    level: row.level,
    isRead: row.isRead,
    createdAt: formatDateTime(row.createdAt),
    targetLabel: row.userId
      ? (userMap.get(row.userId) ?? '指定成员')
      : row.workspaceId
        ? '当前工作区'
        : '系统广播'
  }));
}

export async function listTickets(
  activeWorkspaceId?: string
): Promise<TicketSummary[]> {
  if (!db) {
    return activeWorkspaceId
      ? demoTickets.filter((ticket) => ticket.workspaceId === activeWorkspaceId)
      : demoTickets;
  }

  const database = db;
  const rows = activeWorkspaceId
    ? await database
        .select({
          id: schema.tickets.id,
          workspaceId: schema.tickets.workspaceId,
          code: schema.tickets.code,
          title: schema.tickets.title,
          description: schema.tickets.description,
          status: schema.tickets.status,
          priority: schema.tickets.priority,
          assigneeId: schema.tickets.assigneeId,
          reporterId: schema.tickets.reporterId,
          commentCount: schema.tickets.commentCount,
          updatedAt: schema.tickets.updatedAt
        })
        .from(schema.tickets)
        .where(eq(schema.tickets.workspaceId, activeWorkspaceId))
        .orderBy(desc(schema.tickets.updatedAt))
    : await database
        .select({
          id: schema.tickets.id,
          workspaceId: schema.tickets.workspaceId,
          code: schema.tickets.code,
          title: schema.tickets.title,
          description: schema.tickets.description,
          status: schema.tickets.status,
          priority: schema.tickets.priority,
          assigneeId: schema.tickets.assigneeId,
          reporterId: schema.tickets.reporterId,
          commentCount: schema.tickets.commentCount,
          updatedAt: schema.tickets.updatedAt
        })
        .from(schema.tickets)
        .orderBy(desc(schema.tickets.updatedAt));

  const userIds = Array.from(
    new Set(
      rows
        .flatMap((row) => [row.assigneeId, row.reporterId])
        .filter((value): value is string => Boolean(value))
    )
  );

  const userRows = userIds.length
    ? await database
        .select({
          id: schema.users.id,
          githubUsername: schema.users.githubUsername,
          displayName: schema.users.displayName
        })
        .from(schema.users)
        .where(inArray(schema.users.id, userIds))
    : [];

  const userMap = new Map(
    userRows.map((user) => [user.id, user.displayName || user.githubUsername])
  );

  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspaceId,
    code: row.code,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    priority: row.priority,
    assignee: row.assigneeId
      ? (userMap.get(row.assigneeId) ?? '未分配')
      : '未分配',
    assigneeId: row.assigneeId ?? null,
    reporterId: row.reporterId ?? null,
    reporter: row.reporterId ? (userMap.get(row.reporterId) ?? '未知') : '未知',
    commentCount: row.commentCount,
    updatedAt: formatDateTime(row.updatedAt)
  }));
}

export async function listTicketComments(
  ticketId: string
): Promise<TicketCommentSummary[]> {
  if (!db) {
    return demoTicketComments.filter(
      (comment) => comment.ticketId === ticketId
    );
  }

  const database = db;
  const rows = await database
    .select({
      id: schema.ticketComments.id,
      ticketId: schema.ticketComments.ticketId,
      authorId: schema.ticketComments.authorId,
      body: schema.ticketComments.body,
      attachmentIds: schema.ticketComments.attachmentIds,
      createdAt: schema.ticketComments.createdAt
    })
    .from(schema.ticketComments)
    .where(eq(schema.ticketComments.ticketId, ticketId))
    .orderBy(asc(schema.ticketComments.createdAt));

  const userIds = rows
    .map((row) => row.authorId)
    .filter((value): value is string => Boolean(value));

  const userRows = userIds.length
    ? await database
        .select({
          id: schema.users.id,
          githubUsername: schema.users.githubUsername,
          displayName: schema.users.displayName
        })
        .from(schema.users)
        .where(inArray(schema.users.id, userIds))
    : [];

  const userMap = new Map(
    userRows.map((user) => [user.id, user.displayName || user.githubUsername])
  );

  return rows.map((row) => ({
    id: row.id,
    ticketId: row.ticketId,
    authorId: row.authorId ?? null,
    author: row.authorId ? (userMap.get(row.authorId) ?? '未知成员') : '系统',
    body: row.body,
    attachmentIds: row.attachmentIds ?? [],
    createdAt: formatDateTime(row.createdAt)
  }));
}

export async function listFilesByEntity(
  entityType: FileAssetSummary['entityType'],
  entityId: string
): Promise<FileAssetSummary[]> {
  if (!db) {
    return demoFileAssets.filter(
      (file) => file.entityType === entityType && file.entityId === entityId
    );
  }

  const database = db;
  const rows = await database
    .select({
      id: schema.fileAssets.id,
      workspaceId: schema.fileAssets.workspaceId,
      entityType: schema.fileAssets.entityType,
      entityId: schema.fileAssets.entityId,
      fileName: schema.fileAssets.fileName,
      mimeType: schema.fileAssets.mimeType,
      size: schema.fileAssets.size,
      publicUrl: schema.fileAssets.publicUrl,
      uploadedBy: schema.fileAssets.uploadedBy,
      createdAt: schema.fileAssets.createdAt
    })
    .from(schema.fileAssets)
    .where(
      and(
        eq(schema.fileAssets.entityType, entityType),
        eq(schema.fileAssets.entityId, entityId)
      )
    )
    .orderBy(desc(schema.fileAssets.createdAt));

  const userIds = rows
    .map((row) => row.uploadedBy)
    .filter((value): value is string => Boolean(value));

  const userRows = userIds.length
    ? await database
        .select({
          id: schema.users.id,
          githubUsername: schema.users.githubUsername,
          displayName: schema.users.displayName
        })
        .from(schema.users)
        .where(inArray(schema.users.id, userIds))
    : [];

  const userMap = new Map(
    userRows.map((user) => [user.id, user.displayName || user.githubUsername])
  );

  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspaceId ?? null,
    entityType: row.entityType,
    entityId: row.entityId ?? null,
    fileName: row.fileName,
    mimeType: row.mimeType ?? null,
    size: row.size,
    publicUrl: row.publicUrl ?? null,
    uploadedBy: row.uploadedBy ?? null,
    uploadedByName: row.uploadedBy
      ? (userMap.get(row.uploadedBy) ?? '未知成员')
      : '系统',
    createdAt: formatDateTime(row.createdAt)
  }));
}

export async function listAuditLogs(
  activeWorkspaceId?: string,
  limit = 10
): Promise<AuditLogSummary[]> {
  if (!db) {
    return (
      activeWorkspaceId
        ? demoAuditLogs.filter((log) => log.workspaceId === activeWorkspaceId)
        : demoAuditLogs
    ).slice(0, limit);
  }

  const database = db;
  const rows = activeWorkspaceId
    ? await database
        .select({
          id: schema.auditLogs.id,
          workspaceId: schema.auditLogs.workspaceId,
          actorId: schema.auditLogs.actorId,
          action: schema.auditLogs.action,
          entityType: schema.auditLogs.entityType,
          entityId: schema.auditLogs.entityId,
          summary: schema.auditLogs.summary,
          createdAt: schema.auditLogs.createdAt
        })
        .from(schema.auditLogs)
        .where(eq(schema.auditLogs.workspaceId, activeWorkspaceId))
        .orderBy(desc(schema.auditLogs.createdAt))
        .limit(limit)
    : await database
        .select({
          id: schema.auditLogs.id,
          workspaceId: schema.auditLogs.workspaceId,
          actorId: schema.auditLogs.actorId,
          action: schema.auditLogs.action,
          entityType: schema.auditLogs.entityType,
          entityId: schema.auditLogs.entityId,
          summary: schema.auditLogs.summary,
          createdAt: schema.auditLogs.createdAt
        })
        .from(schema.auditLogs)
        .orderBy(desc(schema.auditLogs.createdAt))
        .limit(limit);

  const actorIds = rows
    .map((row) => row.actorId)
    .filter((value): value is string => Boolean(value));

  const actorRows = actorIds.length
    ? await database
        .select({
          id: schema.users.id,
          githubUsername: schema.users.githubUsername,
          displayName: schema.users.displayName
        })
        .from(schema.users)
        .where(inArray(schema.users.id, actorIds))
    : [];

  const actorMap = new Map(
    actorRows.map((actor) => [
      actor.id,
      actor.displayName || actor.githubUsername
    ])
  );

  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspaceId ?? null,
    actorId: row.actorId ?? null,
    actor: row.actorId ? (actorMap.get(row.actorId) ?? '未知成员') : '系统',
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId ?? null,
    summary: row.summary,
    createdAt: formatDateTime(row.createdAt)
  }));
}
