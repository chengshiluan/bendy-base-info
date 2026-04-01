import type {
  ManagedAccountDetail,
  ManagedAccountSecuritySummary,
  ManagedAccountSummary,
  ManagedPlatformSummary,
  ManagedRegistrationSourceSummary,
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

export function getAccountAttributeLabel(
  attribute: ManagedAccountSummary['attribute']
) {
  switch (attribute) {
    case 'self_hosted':
      return '自托管';
    case 'third_party':
      return '三方';
    default:
      return attribute;
  }
}

export function getAccountConfidenceLabel(
  confidence: ManagedAccountSummary['confidence']
) {
  switch (confidence) {
    case 'very_high':
      return '极高';
    case 'high':
      return '高';
    case 'medium':
      return '中';
    case 'low':
      return '低';
    default:
      return confidence;
  }
}

export function getAccountStatusLabel(status: ManagedAccountSummary['status']) {
  switch (status) {
    case 'cancelled':
      return '已注销';
    case 'available':
      return '可用';
    case 'banned':
      return '封禁';
    default:
      return status;
  }
}

export function getPlatformRegionLabel(
  region: ManagedPlatformSummary['region']
) {
  switch (region) {
    case 'overseas':
      return '海外';
    case 'mainland':
      return '内地';
    case 'hk_mo_tw':
      return '港澳台';
    default:
      return region;
  }
}

export function getSecurityTypeLabel(
  securityType:
    | ManagedAccountSecuritySummary['securityType']
    | ManagedAccountDetail['securities'][number]['securityType']
) {
  switch (securityType) {
    case 'question':
      return '问题验证';
    case 'two_factor':
      return '2FA验证';
    case 'contact':
      return '联系人';
    case 'emergency_email':
      return '紧急邮箱';
    default:
      return securityType;
  }
}

export function getRegistrationSourceLabel(
  source: ManagedRegistrationSourceSummary
) {
  return source.name;
}
