import type {
  NotificationSummary,
  TicketSummary,
  UserSummary
} from '@/lib/platform/types';

export function getSystemRoleLabel(role: UserSummary['systemRole']) {
  switch (role) {
    case 'super_admin':
      return '超级管理员';
    case 'admin':
      return '管理员';
    case 'member':
      return '成员';
    default:
      return role;
  }
}

export function getUserStatusLabel(status: UserSummary['status']) {
  switch (status) {
    case 'active':
      return '启用中';
    case 'invited':
      return '待激活';
    case 'disabled':
      return '已停用';
    default:
      return status;
  }
}

export function getNotificationLevelLabel(level: NotificationSummary['level']) {
  switch (level) {
    case 'info':
      return '普通';
    case 'success':
      return '成功';
    case 'warning':
      return '警告';
    case 'error':
      return '紧急';
    default:
      return level;
  }
}

export function getTicketStatusLabel(status: TicketSummary['status']) {
  switch (status) {
    case 'open':
      return '待处理';
    case 'in_progress':
      return '处理中';
    case 'resolved':
      return '已解决';
    case 'closed':
      return '已关闭';
    default:
      return status;
  }
}

export function getTicketPriorityLabel(priority: TicketSummary['priority']) {
  switch (priority) {
    case 'low':
      return '低';
    case 'medium':
      return '中';
    case 'high':
      return '高';
    case 'urgent':
      return '紧急';
    default:
      return priority;
  }
}
