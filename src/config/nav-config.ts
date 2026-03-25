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
        }
      ]
    },
    {
      title: '站内消息',
      url: '/dashboard/notifications',
      icon: 'notification',
      shortcut: ['n', 'n'],
      isActive: false,
      items: []
    },
    {
      title: '看板',
      url: '/dashboard/kanban',
      icon: 'kanban',
      shortcut: ['k', 'k'],
      isActive: false,
      items: []
    },
    {
      title: '工单系统',
      url: '/dashboard/tickets',
      icon: 'ticket',
      shortcut: ['t', 't'],
      isActive: false,
      items: []
    }
  ];
}
