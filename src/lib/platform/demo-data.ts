import type {
  AuditLogSummary,
  FileAssetSummary,
  NotificationSummary,
  PermissionSummary,
  RoleSummary,
  TeamSummary,
  TicketCommentSummary,
  TicketSummary,
  UserSummary,
  WorkspaceSummary
} from './types';
import { permissionSeeds, systemRoleSeeds } from './rbac';

export const demoWorkspaces: WorkspaceSummary[] = [
  {
    id: 'ws_core',
    slug: 'core-ops',
    name: 'Core Ops',
    description: '主工作区，负责基础管理与系统运营。',
    status: 'active',
    isDefault: true,
    teamCount: 4,
    memberCount: 12
  },
  {
    id: 'ws_delivery',
    slug: 'delivery',
    name: 'Delivery',
    description: '交付工作区，负责工单、需求与项目推进。',
    status: 'active',
    isDefault: false,
    teamCount: 3,
    memberCount: 7
  }
];

export const demoTeams: TeamSummary[] = [
  {
    id: 'team_admin',
    workspaceId: 'ws_core',
    slug: 'platform-admin',
    name: '平台管理组',
    lead: 'juzi',
    leadUserId: 'user_juzi',
    memberCount: 5,
    memberIds: ['user_juzi', 'user_lin'],
    description: '负责平台配置、权限控制与资产治理。'
  },
  {
    id: 'team_support',
    workspaceId: 'ws_delivery',
    slug: 'ticket-support',
    name: '工单支持组',
    lead: 'lin',
    leadUserId: 'user_lin',
    memberCount: 4,
    memberIds: ['user_lin', 'user_zhou'],
    description: '负责工单流转、客户反馈与问题升级。'
  }
];

export const demoUsers: UserSummary[] = [
  {
    id: 'user_juzi',
    githubUsername: 'juzi',
    displayName: '橘色',
    email: 'juzi@example.com',
    systemRole: 'super_admin',
    status: 'active',
    emailLoginEnabled: true,
    workspaceIds: ['ws_core', 'ws_delivery'],
    roleIds: ['role_super_admin'],
    roleNames: ['超级管理员']
  },
  {
    id: 'user_lin',
    githubUsername: 'lin',
    displayName: '林一',
    email: 'lin@example.com',
    systemRole: 'admin',
    status: 'active',
    emailLoginEnabled: true,
    workspaceIds: ['ws_core', 'ws_delivery'],
    roleIds: ['role_admin'],
    roleNames: ['管理员']
  },
  {
    id: 'user_zhou',
    githubUsername: 'zhou',
    displayName: '周舟',
    email: 'zhou@example.com',
    systemRole: 'member',
    status: 'invited',
    emailLoginEnabled: false,
    workspaceIds: ['ws_delivery'],
    roleIds: ['role_member'],
    roleNames: ['成员']
  }
];

export const demoRoles: RoleSummary[] = systemRoleSeeds.map((role) => ({
  id: `role_${role.key}`,
  workspaceId: 'ws_core',
  key: role.key,
  name: role.name,
  description: role.description,
  permissionCount: role.permissionCodes.length,
  permissionIds: role.permissionCodes,
  isSystem: true
}));

export const demoPermissions: PermissionSummary[] = permissionSeeds.map(
  (permission) => ({
    id: permission.code,
    module: permission.module,
    action: permission.action,
    code: permission.code,
    name: permission.name,
    scope: permission.scope,
    permissionType: permission.permissionType,
    parentCode: permission.parentCode,
    route: permission.route,
    sortOrder: permission.sortOrder,
    isSystem: permission.isSystem,
    pathLabel: permission.pathLabel,
    description: permission.description
  })
);

export const demoNotifications: NotificationSummary[] = [
  {
    id: 'notice_1',
    workspaceId: 'ws_core',
    userId: null,
    title: '系统维护窗口',
    content: '本周五 23:00 - 23:30 将执行数据库维护，请提前保存操作。',
    level: 'warning',
    isRead: false,
    createdAt: '2026-03-24 09:00',
    targetLabel: 'Core Ops 全员'
  },
  {
    id: 'notice_2',
    workspaceId: 'ws_delivery',
    userId: 'user_lin',
    title: '工单升级提醒',
    content: '工单 TK-1002 已超过 12 小时未闭环，请尽快处理。',
    level: 'info',
    isRead: true,
    createdAt: '2026-03-24 08:30',
    targetLabel: '@lin'
  }
];

export const demoTickets: TicketSummary[] = [
  {
    id: 'ticket_1',
    workspaceId: 'ws_core',
    code: 'TK-1001',
    title: '后台用户页需要支持按 GitHub 用户名搜索',
    description:
      '当前用户页还没有基于 GitHub 用户名的检索体验，需要补一个快速筛选。',
    status: 'open',
    priority: 'high',
    assignee: 'juzi',
    assigneeId: 'user_juzi',
    reporterId: 'user_lin',
    reporter: 'lin',
    commentCount: 2,
    updatedAt: '2026-03-24 10:10'
  },
  {
    id: 'ticket_2',
    workspaceId: 'ws_delivery',
    code: 'TK-1002',
    title: '通知中心增加已读筛选',
    description: '通知中心需要一个已读/未读切换，方便管理员快速定位未处理项。',
    status: 'in_progress',
    priority: 'medium',
    assignee: 'lin',
    assigneeId: 'user_lin',
    reporterId: 'user_juzi',
    reporter: 'juzi',
    commentCount: 1,
    updatedAt: '2026-03-24 09:20'
  }
];

export const demoTicketComments: TicketCommentSummary[] = [
  {
    id: 'comment_1',
    ticketId: 'ticket_1',
    authorId: 'user_lin',
    author: 'lin',
    body: '搜索最好默认支持 GitHub 用户名和显示名双字段。',
    attachmentIds: [],
    createdAt: '2026-03-24 10:30'
  },
  {
    id: 'comment_2',
    ticketId: 'ticket_1',
    authorId: 'user_juzi',
    author: 'juzi',
    body: '先按 GitHub 用户名做，显示名作为下一轮增强。',
    attachmentIds: [],
    createdAt: '2026-03-24 10:42'
  },
  {
    id: 'comment_3',
    ticketId: 'ticket_2',
    authorId: 'user_lin',
    author: 'lin',
    body: '筛选项可以直接放在消息列表顶部。',
    attachmentIds: [],
    createdAt: '2026-03-24 09:33'
  }
];

export const demoFileAssets: FileAssetSummary[] = [
  {
    id: 'file_1',
    workspaceId: 'ws_core',
    entityType: 'ticket',
    entityId: 'ticket_1',
    fileName: 'github-user-search-note.md',
    mimeType: 'text/markdown',
    size: 2048,
    publicUrl: null,
    uploadedBy: 'user_juzi',
    uploadedByName: 'juzi',
    createdAt: '2026-03-24 10:55'
  }
];

export const demoAuditLogs: AuditLogSummary[] = [
  {
    id: 'audit_1',
    workspaceId: 'ws_core',
    actorId: 'user_juzi',
    actor: 'juzi',
    action: 'user.create',
    entityType: 'user',
    entityId: 'user_zhou',
    summary: '录入了新的 GitHub 用户 @zhou。',
    createdAt: '2026-03-24 08:15'
  },
  {
    id: 'audit_2',
    workspaceId: 'ws_delivery',
    actorId: 'user_lin',
    actor: 'lin',
    action: 'ticket.update',
    entityType: 'ticket',
    entityId: 'ticket_2',
    summary: '将工单 TK-1002 更新为处理中。',
    createdAt: '2026-03-24 09:18'
  },
  {
    id: 'audit_3',
    workspaceId: 'ws_core',
    actorId: 'user_juzi',
    actor: 'juzi',
    action: 'auth.migrate',
    entityType: 'system',
    entityId: null,
    summary: '旧认证体系已完成退场，新登录体系与基础设施骨架已经落地。',
    createdAt: '2026-03-24 07:50'
  }
];
