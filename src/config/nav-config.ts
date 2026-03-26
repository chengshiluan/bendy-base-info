import { NavItem } from '@/types';

export function getNavItems(_translate: (key: string) => string): NavItem[] {
  return [
    {
      title: '仪表盘',
      url: '/dashboard/overview',
      icon: 'dashboard',
      shortcut: ['d', 'd'],
      isActive: false,
      items: []
    },
    {
      title: '工作区',
      url: '/dashboard/workspaces',
      icon: 'workspace',
      isActive: false,
      access: { requireWorkspace: true },
      items: [
        {
          title: '团队管理',
          url: '/dashboard/workspaces/teams',
          icon: 'teams',
          access: { requireWorkspace: true }
        },
        {
          title: '用户管理',
          url: '/dashboard/workspaces/users',
          icon: 'user',
          access: { requireWorkspace: true }
        },
        {
          title: '角色管理',
          url: '/dashboard/workspaces/roles',
          icon: 'shield',
          access: { requireWorkspace: true }
        },
        {
          title: '权限管理',
          url: '/dashboard/workspaces/permissions',
          icon: 'key',
          access: { requireWorkspace: true }
        },
        {
          title: '站内消息',
          url: '/dashboard/workspaces/notifications',
          icon: 'notification',
          access: { requireWorkspace: true }
        },
        {
          title: '工单系统',
          url: '/dashboard/workspaces/tickets',
          icon: 'ticket',
          access: { requireWorkspace: true }
        },
        {
          title: '看板',
          url: '/dashboard/workspaces/kanban',
          icon: 'kanban',
          access: { requireWorkspace: true }
        }
      ]
    },
    {
      title: '运维区',
      url: '/dashboard/workspaces/ops',
      icon: 'settings',
      isActive: false,
      access: { requireWorkspace: true },
      items: [
        {
          title: '系统管理',
          url: '/dashboard/workspaces/ops/system',
          access: { requireWorkspace: true }
        },
        {
          title: '配置管理',
          url: '/dashboard/workspaces/ops/config',
          access: { requireWorkspace: true }
        },
        {
          title: '信息管理',
          url: '/dashboard/workspaces/ops/information',
          access: { requireWorkspace: true }
        },
        {
          title: '数据管理',
          url: '/dashboard/workspaces/ops/data',
          access: { requireWorkspace: true }
        }
      ]
    },
    {
      title: '开发区',
      url: '/dashboard/workspaces/dev',
      icon: 'laptop',
      isActive: false,
      access: { requireWorkspace: true },
      items: [
        {
          title: '账号管理',
          url: '/dashboard/workspaces/dev/accounts',
          access: { requireWorkspace: true }
        },
        {
          title: '项目管理',
          url: '/dashboard/workspaces/dev/projects',
          access: { requireWorkspace: true }
        },
        {
          title: '资源管理',
          url: '/dashboard/workspaces/dev/resources',
          access: { requireWorkspace: true }
        }
      ]
    },
    {
      title: '行政区',
      url: '/dashboard/workspaces/admin',
      icon: 'page',
      isActive: false,
      access: { requireWorkspace: true },
      items: [
        {
          title: '人力资源',
          url: '/dashboard/workspaces/admin/hr',
          access: { requireWorkspace: true }
        },
        {
          title: '规章制度',
          url: '/dashboard/workspaces/admin/policies',
          access: { requireWorkspace: true }
        },
        {
          title: '司政中心',
          url: '/dashboard/workspaces/admin/governance',
          access: { requireWorkspace: true }
        }
      ]
    }
  ];
}
