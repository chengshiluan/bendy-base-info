export type SystemRoleKey = 'super_admin' | 'admin' | 'member';

export type PermissionScope = 'global' | 'workspace';
export type PermissionType = 'menu' | 'action';

export interface PermissionSeed {
  code: string;
  module: string;
  action: string;
  name: string;
  description: string;
  scope: PermissionScope;
  permissionType: PermissionType;
  parentCode: string | null;
  route: string | null;
  sortOrder: number;
  isSystem: boolean;
  pathLabel: string;
}

export interface SystemRoleSeed {
  key: SystemRoleKey;
  name: string;
  description: string;
  permissionCodes: string[];
}

type PermissionActionNode = {
  key: string;
  title: string;
  description: string;
};

type PermissionMenuNode = {
  key: string;
  title: string;
  route: string;
  description: string;
  scope: PermissionScope;
  icon?: string;
  hidden?: boolean;
  actions?: PermissionActionNode[];
  children?: PermissionMenuNode[];
};

export function menuPermissionCode(...segments: string[]) {
  return [...segments, 'menu'].join('.');
}

export function actionPermissionCode(action: string, ...segments: string[]) {
  return [...segments, action].join('.');
}

const permissionTreeNodes: PermissionMenuNode[] = [
  {
    key: 'overview',
    title: '仪表盘',
    route: '/dashboard/overview',
    description: '允许访问系统总览、统计卡片和基础运营看板。',
    scope: 'global',
    icon: 'dashboard'
  },
  {
    key: 'workspaces',
    title: '工作区',
    route: '/dashboard/workspaces',
    description: '允许访问工作区目录和全局工作区入口。',
    scope: 'global',
    icon: 'workspace',
    actions: [
      {
        key: 'create',
        title: '新增工作区',
        description: '允许新增系统工作区。'
      },
      {
        key: 'update',
        title: '编辑工作区',
        description: '允许编辑工作区基础资料。'
      },
      {
        key: 'archive',
        title: '归档工作区',
        description: '允许归档工作区并停止在切换器中显示。'
      }
    ],
    children: [
      {
        key: 'teams',
        title: '团队管理',
        route: '/dashboard/workspaces/teams',
        description: '允许访问团队管理页。',
        scope: 'workspace',
        icon: 'teams',
        actions: [
          {
            key: 'create',
            title: '新增团队',
            description: '允许在当前工作区新增团队。'
          },
          {
            key: 'update',
            title: '编辑团队',
            description: '允许编辑团队基础资料、负责人和成员。'
          },
          {
            key: 'delete',
            title: '删除团队',
            description: '允许删除当前工作区的团队。'
          },
          {
            key: 'import',
            title: '导入团队成员',
            description: '允许从 GitHub 搜索成员并加入当前工作区待选列表。'
          }
        ]
      },
      {
        key: 'users',
        title: '用户管理',
        route: '/dashboard/workspaces/users',
        description: '允许访问工作区用户管理页。',
        scope: 'workspace',
        icon: 'user',
        actions: [
          {
            key: 'create',
            title: '新增用户',
            description: '允许录入新的工作区成员。'
          },
          {
            key: 'update',
            title: '编辑用户',
            description: '允许修改成员资料、状态和角色。'
          },
          {
            key: 'delete',
            title: '删除用户',
            description: '允许删除工作区成员。'
          }
        ]
      },
      {
        key: 'roles',
        title: '角色管理',
        route: '/dashboard/workspaces/roles',
        description: '允许访问工作区角色管理页。',
        scope: 'workspace',
        icon: 'shield',
        actions: [
          {
            key: 'create',
            title: '新增角色',
            description: '允许创建新的工作区角色。'
          },
          {
            key: 'update',
            title: '编辑角色',
            description: '允许调整角色名称、描述和权限集合。'
          },
          {
            key: 'delete',
            title: '删除角色',
            description: '允许删除非系统内置角色。'
          }
        ]
      },
      {
        key: 'permissions',
        title: '权限管理',
        route: '/dashboard/workspaces/permissions',
        description: '允许访问系统权限目录页。',
        scope: 'workspace',
        icon: 'key',
        actions: [
          {
            key: 'create',
            title: '新增权限',
            description: '允许新增自定义权限项。'
          },
          {
            key: 'update',
            title: '编辑权限',
            description: '允许调整权限定义。'
          },
          {
            key: 'delete',
            title: '删除权限',
            description: '允许删除非系统权限项。'
          }
        ]
      },
      {
        key: 'notifications',
        title: '站内消息',
        route: '/dashboard/workspaces/notifications',
        description: '允许访问站内消息管理页。',
        scope: 'workspace',
        icon: 'notification',
        actions: [
          {
            key: 'create',
            title: '新增通知',
            description: '允许发布新的工作区通知。'
          },
          {
            key: 'update',
            title: '编辑通知',
            description: '允许修改通知内容与已读状态。'
          },
          {
            key: 'delete',
            title: '删除通知',
            description: '允许删除工作区通知。'
          },
          {
            key: 'read',
            title: '标记通知已读',
            description: '允许切换工作区通知的已读状态。'
          }
        ]
      },
      {
        key: 'tickets',
        title: '工单系统',
        route: '/dashboard/workspaces/tickets',
        description: '允许访问工单管理页。',
        scope: 'workspace',
        icon: 'ticket',
        actions: [
          {
            key: 'create',
            title: '新建工单',
            description: '允许创建新的工单。'
          },
          {
            key: 'update',
            title: '编辑工单',
            description: '允许修改工单标题、描述、优先级和状态。'
          },
          {
            key: 'delete',
            title: '删除工单',
            description: '允许删除工单及其关联评论。'
          },
          {
            key: 'assign',
            title: '分配工单',
            description: '允许修改工单负责人。'
          },
          {
            key: 'comment',
            title: '评论工单',
            description: '允许在工单下提交评论。'
          },
          {
            key: 'upload',
            title: '上传附件',
            description: '允许为工单和评论上传附件。'
          }
        ]
      },
      {
        key: 'kanban',
        title: '看板',
        route: '/dashboard/workspaces/kanban',
        description: '允许访问工单看板页。',
        scope: 'workspace',
        icon: 'kanban',
        actions: [
          {
            key: 'update',
            title: '更新看板状态',
            description: '允许通过拖拽更新工单状态。'
          }
        ]
      }
    ]
  },
  {
    key: 'ops',
    title: '运维区',
    route: '/dashboard/workspaces/ops',
    description: '允许展开运维区功能目录。',
    scope: 'workspace',
    icon: 'settings',
    children: [
      {
        key: 'system',
        title: '系统管理',
        route: '/dashboard/workspaces/ops/system',
        description: '允许访问系统管理占位页。',
        scope: 'workspace'
      },
      {
        key: 'config',
        title: '配置管理',
        route: '/dashboard/workspaces/ops/config',
        description: '允许访问配置管理占位页。',
        scope: 'workspace'
      },
      {
        key: 'information',
        title: '信息管理',
        route: '/dashboard/workspaces/ops/information',
        description: '允许访问信息管理占位页。',
        scope: 'workspace'
      },
      {
        key: 'data',
        title: '数据管理',
        route: '/dashboard/workspaces/ops/data',
        description: '允许访问数据管理占位页。',
        scope: 'workspace'
      }
    ]
  },
  {
    key: 'dev',
    title: '开发区',
    route: '/dashboard/workspaces/dev',
    description: '允许展开开发区功能目录。',
    scope: 'workspace',
    icon: 'laptop',
    children: [
      {
        key: 'accounts',
        title: '账号管理',
        route: '/dashboard/workspaces/dev/accounts',
        description: '允许访问账号管理占位页。',
        scope: 'workspace'
      },
      {
        key: 'projects',
        title: '项目管理',
        route: '/dashboard/workspaces/dev/projects',
        description: '允许访问项目管理占位页。',
        scope: 'workspace'
      },
      {
        key: 'resources',
        title: '资源管理',
        route: '/dashboard/workspaces/dev/resources',
        description: '允许访问资源管理占位页。',
        scope: 'workspace'
      }
    ]
  },
  {
    key: 'admin',
    title: '行政区',
    route: '/dashboard/workspaces/admin',
    description: '允许展开行政区功能目录。',
    scope: 'workspace',
    icon: 'page',
    children: [
      {
        key: 'hr',
        title: '人力资源',
        route: '/dashboard/workspaces/admin/hr',
        description: '允许访问人力资源占位页。',
        scope: 'workspace'
      },
      {
        key: 'policies',
        title: '规章制度',
        route: '/dashboard/workspaces/admin/policies',
        description: '允许访问规章制度占位页。',
        scope: 'workspace'
      },
      {
        key: 'governance',
        title: '司政中心',
        route: '/dashboard/workspaces/admin/governance',
        description: '允许访问司政中心占位页。',
        scope: 'workspace'
      }
    ]
  },
  {
    key: 'profile',
    title: '账户设置',
    route: '/dashboard/profile',
    description: '允许访问个人资料与账户设置页。',
    scope: 'global',
    hidden: true,
    actions: [
      {
        key: 'update',
        title: '编辑个人资料',
        description: '允许更新个人资料。'
      }
    ]
  }
];

type NavigationNode = {
  title: string;
  url: string;
  icon?: string;
  hidden?: boolean;
  permissionCode: string;
  children: NavigationNode[];
};

function flattenPermissionTree(
  nodes: PermissionMenuNode[],
  parentSegments: string[] = ['dashboard'],
  parentCode: string | null = null,
  parentTitles: string[] = [],
  orderPrefix = 0
): { permissions: PermissionSeed[]; navigation: NavigationNode[] } {
  const permissions: PermissionSeed[] = [];
  const navigation: NavigationNode[] = [];

  nodes.forEach((node, index) => {
    const segments = [...parentSegments, node.key];
    const titles = [...parentTitles, node.title];
    const menuCode = menuPermissionCode(...segments);
    const module = segments.join('.');
    const menuSortOrder = orderPrefix + (index + 1) * 100;

    permissions.push({
      code: menuCode,
      module,
      action: 'menu',
      name: `${node.title}菜单`,
      description: node.description,
      scope: node.scope,
      permissionType: 'menu',
      parentCode,
      route: node.route,
      sortOrder: menuSortOrder,
      isSystem: true,
      pathLabel: titles.join(' / ')
    });

    const actionPermissions = (node.actions ?? []).map(
      (action, actionIndex) => ({
        code: actionPermissionCode(action.key, ...segments),
        module,
        action: action.key,
        name: action.title,
        description: action.description,
        scope: node.scope,
        permissionType: 'action' as const,
        parentCode: menuCode,
        route: node.route,
        sortOrder: menuSortOrder + actionIndex + 1,
        isSystem: true,
        pathLabel: [...titles, action.title].join(' / ')
      })
    );

    permissions.push(...actionPermissions);

    const flattenedChildren = flattenPermissionTree(
      node.children ?? [],
      segments,
      menuCode,
      titles,
      menuSortOrder
    );

    permissions.push(...flattenedChildren.permissions);

    navigation.push({
      title: node.title,
      url: node.route,
      icon: node.icon,
      hidden: node.hidden,
      permissionCode: menuCode,
      children: flattenedChildren.navigation
    });
  });

  return { permissions, navigation };
}

const flattenedPermissionTree = flattenPermissionTree(permissionTreeNodes);

export const permissionSeeds: PermissionSeed[] =
  flattenedPermissionTree.permissions;

export const navigationPermissionTree = flattenedPermissionTree.navigation;

export const permissionSeedByCode = new Map(
  permissionSeeds.map((permission) => [permission.code, permission] as const)
);

export const allPermissionCodes = permissionSeeds.map(
  (permission) => permission.code
);

export const allWorkspacePermissionCodes = permissionSeeds
  .filter((permission) => permission.scope === 'workspace')
  .map((permission) => permission.code);

export const allGlobalPermissionCodes = permissionSeeds
  .filter((permission) => permission.scope === 'global')
  .map((permission) => permission.code);

const memberWorkspacePermissionCodes = [
  menuPermissionCode('dashboard', 'workspaces', 'teams'),
  menuPermissionCode('dashboard', 'workspaces', 'users'),
  menuPermissionCode('dashboard', 'workspaces', 'roles'),
  menuPermissionCode('dashboard', 'workspaces', 'permissions'),
  menuPermissionCode('dashboard', 'workspaces', 'notifications'),
  actionPermissionCode('read', 'dashboard', 'workspaces', 'notifications'),
  menuPermissionCode('dashboard', 'workspaces', 'tickets'),
  actionPermissionCode('comment', 'dashboard', 'workspaces', 'tickets'),
  menuPermissionCode('dashboard', 'workspaces', 'kanban')
];

const adminWorkspacePermissionCodes = allWorkspacePermissionCodes.slice();

const memberGlobalPermissionCodes = [
  menuPermissionCode('dashboard', 'overview'),
  menuPermissionCode('dashboard', 'workspaces'),
  menuPermissionCode('dashboard', 'profile'),
  actionPermissionCode('update', 'dashboard', 'profile')
];

const adminGlobalPermissionCodes = memberGlobalPermissionCodes.slice();

const systemRoleGlobalPermissionCodes: Record<SystemRoleKey, string[]> = {
  super_admin: ['*'],
  admin: adminGlobalPermissionCodes,
  member: memberGlobalPermissionCodes
};

export const systemRoleSeeds: SystemRoleSeed[] = [
  {
    key: 'super_admin',
    name: '超级管理员',
    description: '系统内置角色，拥有当前工作区下全部页面与操作能力。',
    permissionCodes: allWorkspacePermissionCodes
  },
  {
    key: 'admin',
    name: '管理员',
    description: '系统内置角色，负责当前工作区的日常管理与协作配置。',
    permissionCodes: adminWorkspacePermissionCodes
  },
  {
    key: 'member',
    name: '成员',
    description: '系统内置角色，默认提供浏览和基础协作能力。',
    permissionCodes: memberWorkspacePermissionCodes
  }
];

export const systemRoleKeys = systemRoleSeeds.map((role) => role.key);

export function getSystemRolePermissionCodes(role: SystemRoleKey) {
  return (
    systemRoleSeeds.find((item) => item.key === role)?.permissionCodes ?? []
  );
}

export function getSystemRoleGlobalPermissionCodes(role: SystemRoleKey) {
  return systemRoleGlobalPermissionCodes[role] ?? [];
}

export function getPermissionSeed(code: string) {
  return permissionSeedByCode.get(code) ?? null;
}

export function getPermissionScope(code: string): PermissionScope | null {
  return getPermissionSeed(code)?.scope ?? null;
}

export function isWorkspaceScopedPermission(code: string) {
  return getPermissionScope(code) === 'workspace';
}
