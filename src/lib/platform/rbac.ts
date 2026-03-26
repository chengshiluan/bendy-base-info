export type SystemRoleKey = 'super_admin' | 'admin' | 'member';

export interface PermissionSeed {
  code: string;
  module: string;
  action: string;
  name: string;
  description: string;
}

export interface SystemRoleSeed {
  key: SystemRoleKey;
  name: string;
  description: string;
  permissionCodes: string[];
}

export const permissionSeeds: PermissionSeed[] = [
  {
    code: 'dashboard.view',
    module: 'dashboard',
    action: 'view',
    name: '查看仪表盘',
    description: '允许查看系统概览、统计卡片和整体运营数据。'
  },
  {
    code: 'workspaces.view',
    module: 'workspaces',
    action: 'view',
    name: '查看工作区',
    description: '允许查看工作区列表、状态和成员规模。'
  },
  {
    code: 'workspaces.manage',
    module: 'workspaces',
    action: 'manage',
    name: '维护工作区',
    description: '允许创建、编辑和归档工作区。'
  },
  {
    code: 'workspaces.switch',
    module: 'workspaces',
    action: 'switch',
    name: '切换工作区',
    description: '允许切换当前活跃工作区。'
  },
  {
    code: 'teams.view',
    module: 'teams',
    action: 'view',
    name: '查看团队',
    description: '允许查看当前工作区下的团队列表和负责人信息。'
  },
  {
    code: 'teams.manage',
    module: 'teams',
    action: 'manage',
    name: '维护团队',
    description: '允许创建、编辑和删除团队及其成员配置。'
  },
  {
    code: 'users.view',
    module: 'users',
    action: 'view',
    name: '查看用户',
    description: '允许查看工作区成员、系统角色和登录状态。'
  },
  {
    code: 'users.manage',
    module: 'users',
    action: 'manage',
    name: '维护用户',
    description: '允许新增、编辑和删除工作区成员。'
  },
  {
    code: 'users.import',
    module: 'users',
    action: 'import',
    name: '导入 GitHub 用户',
    description: '允许通过 GitHub 用户名搜索并导入成员。'
  },
  {
    code: 'roles.view',
    module: 'roles',
    action: 'view',
    name: '查看角色',
    description: '允许查看当前工作区下的角色和权限绑定关系。'
  },
  {
    code: 'roles.manage',
    module: 'roles',
    action: 'manage',
    name: '维护角色',
    description: '允许创建、编辑和删除角色。'
  },
  {
    code: 'permissions.view',
    module: 'permissions',
    action: 'view',
    name: '查看权限',
    description: '允许查看系统内维护的权限编码与模块划分。'
  },
  {
    code: 'permissions.manage',
    module: 'permissions',
    action: 'manage',
    name: '维护权限',
    description: '允许创建、编辑和删除权限项。'
  },
  {
    code: 'notifications.view',
    module: 'notifications',
    action: 'view',
    name: '查看消息',
    description: '允许查看站内消息和运维提醒。'
  },
  {
    code: 'notifications.manage',
    module: 'notifications',
    action: 'manage',
    name: '维护消息',
    description: '允许新增、编辑和删除站内消息。'
  },
  {
    code: 'notifications.publish',
    module: 'notifications',
    action: 'publish',
    name: '发布消息',
    description: '允许向工作区成员发布公告和提醒。'
  },
  {
    code: 'tickets.view',
    module: 'tickets',
    action: 'view',
    name: '查看工单',
    description: '允许查看工单列表、状态和协作详情。'
  },
  {
    code: 'tickets.manage',
    module: 'tickets',
    action: 'manage',
    name: '维护工单',
    description: '允许创建、编辑和删除工单。'
  },
  {
    code: 'tickets.assign',
    module: 'tickets',
    action: 'assign',
    name: '分配工单',
    description: '允许修改工单负责人和状态流转。'
  },
  {
    code: 'tickets.comment',
    module: 'tickets',
    action: 'comment',
    name: '评论工单',
    description: '允许为工单追加评论和协作记录。'
  },
  {
    code: 'kanban.view',
    module: 'kanban',
    action: 'view',
    name: '查看看板',
    description: '允许查看基于工单的看板视图。'
  },
  {
    code: 'kanban.manage',
    module: 'kanban',
    action: 'manage',
    name: '维护看板',
    description: '允许拖拽更新看板状态并参与流程推进。'
  },
  {
    code: 'audit_logs.view',
    module: 'audit_logs',
    action: 'view',
    name: '查看审计日志',
    description: '允许查看管理端关键操作的审计记录。'
  },
  {
    code: 'files.view',
    module: 'files',
    action: 'view',
    name: '查看文件',
    description: '允许查看系统内的文件资产记录。'
  },
  {
    code: 'files.upload',
    module: 'files',
    action: 'upload',
    name: '上传文件',
    description: '允许上传附件并登记到文件资产表。'
  },
  {
    code: 'profile.view',
    module: 'profile',
    action: 'view',
    name: '查看个人资料',
    description: '允许查看个人资料页面。'
  },
  {
    code: 'profile.update',
    module: 'profile',
    action: 'update',
    name: '更新个人资料',
    description: '允许更新个人资料信息。'
  }
];

export const allPermissionCodes = permissionSeeds.map(
  (permission) => permission.code
);

export const memberPermissionCodes = [
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
];

export const adminPermissionCodes = allPermissionCodes.filter(
  (code) => code !== 'workspaces.manage'
);

export const systemRoleSeeds: SystemRoleSeed[] = [
  {
    key: 'super_admin',
    name: '超级管理员',
    description: '系统内置角色，拥有当前工作区下全部页面与操作能力。',
    permissionCodes: allPermissionCodes
  },
  {
    key: 'admin',
    name: '管理员',
    description: '系统内置角色，负责当前工作区的日常管理与协作配置。',
    permissionCodes: adminPermissionCodes
  },
  {
    key: 'member',
    name: '成员',
    description: '系统内置角色，默认提供只读浏览与基础协作能力。',
    permissionCodes: memberPermissionCodes
  }
];

export const systemRoleKeys = systemRoleSeeds.map((role) => role.key);

export function getSystemRolePermissionCodes(role: SystemRoleKey) {
  return (
    systemRoleSeeds.find((item) => item.key === role)?.permissionCodes ?? []
  );
}
