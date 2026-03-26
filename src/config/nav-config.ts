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
    }
  ];
}
