import { and, asc, count, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getPermissionSeed } from './rbac';
import {
  buildPermissionMenuOptions,
  buildPermissionTree
} from './permission-tree';
import { paginateItems } from './pagination';
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
  PaginatedResult,
  PermissionMenuOption,
  PermissionSummary,
  PermissionTreeNode,
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

type PageQuery = {
  page?: number;
  pageSize?: number;
};

type SearchPageQuery = PageQuery & {
  search?: string;
};

type NotificationPageQuery = SearchPageQuery & {
  workspaceId?: string;
  filter?: 'all' | 'unread' | 'read';
};

type TicketPageQuery = SearchPageQuery & {
  workspaceId?: string;
  filter?: 'all' | TicketSummary['status'];
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

function normalizeKeyword(value?: string) {
  return value?.trim().toLowerCase() ?? '';
}

function matchesKeyword(
  keyword: string,
  values: Array<string | null | undefined>
) {
  if (!keyword) {
    return true;
  }

  return values
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(keyword));
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

export async function listPermissionOptions(
  scope: PermissionSummary['scope'] | 'all' = 'workspace'
): Promise<OptionItem[]> {
  const permissions = await listPermissions();
  return permissions
    .filter((permission) => scope === 'all' || permission.scope === scope)
    .map((permission) => ({
      label: `${permission.pathLabel} (${permission.code})`,
      value: permission.id
    }));
}

export async function listPermissionTree(
  scope: PermissionSummary['scope'] | 'all' = 'all'
): Promise<PermissionTreeNode[]> {
  const permissions = await listPermissions();
  const visiblePermissions = permissions.filter(
    (permission) => scope === 'all' || permission.scope === scope
  );

  return buildPermissionTree(visiblePermissions);
}

export async function listPermissionMenuOptions(
  scope: PermissionSummary['scope'] | 'all' = 'all'
): Promise<PermissionMenuOption[]> {
  const permissionTree = await listPermissionTree(scope);
  return buildPermissionMenuOptions(permissionTree);
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

export async function listWorkspacesPage(
  query: SearchPageQuery & {
    userId?: string;
    systemRole?: string;
  }
): Promise<PaginatedResult<WorkspaceSummary>> {
  const workspaces = await listWorkspaces(query.userId, query.systemRole);
  const keyword = normalizeKeyword(query.search);
  const filtered = workspaces.filter((workspace) =>
    matchesKeyword(keyword, [
      workspace.name,
      workspace.slug,
      workspace.description
    ])
  );

  return paginateItems(filtered, query.page, query.pageSize);
}

export async function getWorkspaceSummaryMetrics(
  userId?: string,
  systemRole?: string
) {
  const workspaces = await listWorkspaces(userId, systemRole);

  return {
    total: workspaces.length,
    active: workspaces.filter((workspace) => workspace.status === 'active')
      .length,
    archived: workspaces.filter((workspace) => workspace.status === 'archived')
      .length
  };
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

export async function listTeamsPage(
  query: SearchPageQuery & {
    workspaceId?: string;
  }
): Promise<PaginatedResult<TeamSummary>> {
  const teams = await listTeams(query.workspaceId);
  const keyword = normalizeKeyword(query.search);
  const filtered = teams.filter((team) =>
    matchesKeyword(keyword, [team.name, team.slug, team.description, team.lead])
  );

  return paginateItems(filtered, query.page, query.pageSize);
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

  const roleRows =
    activeWorkspaceId && userIds.length
      ? await database
          .select({
            userId: schema.workspaceMemberRoles.userId,
            roleId: schema.workspaceMemberRoles.roleId,
            roleName: schema.roles.name
          })
          .from(schema.workspaceMemberRoles)
          .innerJoin(
            schema.roles,
            eq(schema.workspaceMemberRoles.roleId, schema.roles.id)
          )
          .where(
            and(
              eq(schema.workspaceMemberRoles.workspaceId, activeWorkspaceId),
              inArray(schema.workspaceMemberRoles.userId, userIds)
            )
          )
      : [];

  const roleIdMap = new Map<string, string[]>();
  const roleNameMap = new Map<string, string[]>();
  roleRows.forEach((roleRow) => {
    const currentRoleIds = roleIdMap.get(roleRow.userId) ?? [];
    currentRoleIds.push(roleRow.roleId);
    roleIdMap.set(roleRow.userId, currentRoleIds);

    const currentRoleNames = roleNameMap.get(roleRow.userId) ?? [];
    currentRoleNames.push(roleRow.roleName);
    roleNameMap.set(roleRow.userId, currentRoleNames);
  });

  return rows.map((user) => ({
    ...user,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    emailLoginEnabled: user.emailLoginEnabled,
    workspaceIds: workspaceMap.get(user.id) ?? [],
    roleIds: roleIdMap.get(user.id) ?? [],
    roleNames: roleNameMap.get(user.id) ?? []
  }));
}

export async function listUsersPage(
  query: SearchPageQuery & {
    workspaceId?: string;
  }
): Promise<PaginatedResult<UserSummary>> {
  const users = await listUsers(query.workspaceId);
  const keyword = normalizeKeyword(query.search);
  const filtered = users.filter((user) =>
    matchesKeyword(keyword, [user.githubUsername, user.displayName, user.email])
  );

  return paginateItems(filtered, query.page, query.pageSize);
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

export async function listRolesPage(
  query: SearchPageQuery & {
    workspaceId?: string;
  }
): Promise<PaginatedResult<RoleSummary>> {
  const roles = await listRoles(query.workspaceId);
  const keyword = normalizeKeyword(query.search);
  const filtered = roles.filter((role) =>
    matchesKeyword(keyword, [role.key, role.name, role.description])
  );

  return paginateItems(filtered, query.page, query.pageSize);
}

export async function listPermissions(): Promise<PermissionSummary[]> {
  if (!db) {
    return demoPermissions;
  }

  const database = db;
  const rows = await database
    .select({
      id: schema.permissions.id,
      module: schema.permissions.module,
      action: schema.permissions.action,
      code: schema.permissions.code,
      name: schema.permissions.name,
      scope: schema.permissions.scope,
      permissionType: schema.permissions.permissionType,
      parentCode: schema.permissions.parentCode,
      route: schema.permissions.route,
      sortOrder: schema.permissions.sortOrder,
      isSystem: schema.permissions.isSystem,
      description: schema.permissions.description
    })
    .from(schema.permissions);

  const rowMap = new Map(rows.map((row) => [row.code, row] as const));
  const pathCache = new Map<string, string>();

  const buildPathLabel = (code: string): string => {
    const cached = pathCache.get(code);
    if (cached) {
      return cached;
    }

    const seededPermission = getPermissionSeed(code);
    if (seededPermission) {
      pathCache.set(code, seededPermission.pathLabel);
      return seededPermission.pathLabel;
    }

    const row = rowMap.get(code);
    if (!row) {
      pathCache.set(code, code);
      return code;
    }

    const currentLabel =
      row.permissionType === 'menu' ? row.name.replace(/菜单$/, '') : row.name;

    if (!row.parentCode) {
      pathCache.set(code, currentLabel);
      return currentLabel;
    }

    const label = `${buildPathLabel(row.parentCode)} / ${currentLabel}`;
    pathCache.set(code, label);
    return label;
  };

  return rows
    .map((row) => ({
      ...row,
      description: row.description ?? null,
      pathLabel: buildPathLabel(row.code)
    }))
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.pathLabel.localeCompare(right.pathLabel, 'zh-CN');
    });
}

export async function listPermissionsPage(
  query: SearchPageQuery = {}
): Promise<PaginatedResult<PermissionSummary>> {
  const permissions = await listPermissions();
  const keyword = normalizeKeyword(query.search);
  const filtered = permissions.filter((permission) =>
    matchesKeyword(keyword, [
      permission.name,
      permission.code,
      permission.pathLabel,
      permission.module,
      permission.action
    ])
  );

  return paginateItems(filtered, query.page, query.pageSize);
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

export async function listAdminNotificationsPage(
  query: NotificationPageQuery
): Promise<PaginatedResult<NotificationSummary>> {
  const notifications = await listAdminNotifications(query.workspaceId);
  const keyword = normalizeKeyword(query.search);
  const filtered = notifications.filter((notification) => {
    const matchesFilter =
      query.filter === 'read'
        ? notification.isRead
        : query.filter === 'unread'
          ? !notification.isRead
          : true;

    return (
      matchesFilter &&
      matchesKeyword(keyword, [
        notification.title,
        notification.content,
        notification.targetLabel
      ])
    );
  });

  return paginateItems(filtered, query.page, query.pageSize);
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

export async function listTicketsPage(
  query: TicketPageQuery
): Promise<PaginatedResult<TicketSummary>> {
  const tickets = await listTickets(query.workspaceId);
  const keyword = normalizeKeyword(query.search);
  const filtered = tickets.filter((ticket) => {
    const matchesFilter =
      query.filter && query.filter !== 'all'
        ? ticket.status === query.filter
        : true;

    return (
      matchesFilter &&
      matchesKeyword(keyword, [
        ticket.code,
        ticket.title,
        ticket.description,
        ticket.assignee,
        ticket.reporter
      ])
    );
  });

  return paginateItems(filtered, query.page, query.pageSize);
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
