export interface WorkspaceSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
  isDefault: boolean;
  teamCount: number;
  memberCount: number;
}

export interface TeamSummary {
  id: string;
  workspaceId: string;
  slug?: string;
  name: string;
  description: string;
  lead: string;
  leadUserId: string | null;
  memberCount: number;
  memberIds?: string[];
}

export interface UserSummary {
  id: string;
  githubUsername: string;
  displayName: string | null;
  email: string | null;
  systemRole: 'super_admin' | 'admin' | 'member';
  status: 'active' | 'invited' | 'disabled';
  emailLoginEnabled?: boolean;
  workspaceIds?: string[];
  roleIds?: string[];
  roleNames?: string[];
}

export interface RoleSummary {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string;
  permissionCount: number;
  permissionIds?: string[];
  isSystem?: boolean;
}

export interface PermissionSummary {
  id: string;
  module: string;
  action: string;
  code: string;
  name: string;
  scope: 'global' | 'workspace';
  permissionType: 'menu' | 'action';
  parentCode?: string | null;
  route?: string | null;
  sortOrder: number;
  isSystem: boolean;
  isVirtual?: boolean;
  pathLabel: string;
  description?: string | null;
}

export interface PermissionTreeNode extends PermissionSummary {
  children: PermissionTreeNode[];
}

export interface PermissionMenuOption {
  value: string;
  label: string;
  depth: number;
  scope: PermissionSummary['scope'];
  route?: string | null;
}

export interface NotificationSummary {
  id: string;
  workspaceId: string | null;
  userId: string | null;
  title: string;
  content: string;
  level: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: string;
  targetLabel?: string;
}

export interface TicketSummary {
  id: string;
  workspaceId?: string;
  code: string;
  title: string;
  description?: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee: string;
  assigneeId?: string | null;
  reporterId?: string | null;
  reporter?: string;
  commentCount?: number;
  updatedAt: string;
}

export interface TicketCommentSummary {
  id: string;
  ticketId: string;
  authorId: string | null;
  author: string;
  body: string;
  attachmentIds: string[];
  createdAt: string;
}

export interface FileAssetSummary {
  id: string;
  workspaceId: string | null;
  entityType: 'ticket' | 'ticket_comment' | 'workspace' | 'general';
  entityId: string | null;
  fileName: string;
  mimeType: string | null;
  size: number;
  publicUrl: string | null;
  uploadedBy: string | null;
  uploadedByName?: string;
  createdAt: string;
}

export interface AuditLogSummary {
  id: string;
  workspaceId: string | null;
  actorId: string | null;
  actor: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
}

export interface OptionItem {
  label: string;
  value: string;
}

export interface GithubSearchUser {
  githubUsername: string;
  githubUserId: string;
  avatarUrl: string | null;
  profileUrl: string;
}

export interface ImportedWorkspaceGithubUser {
  id: string;
  githubUsername: string;
  displayName: string | null;
  avatarUrl: string | null;
  alreadyInWorkspace: boolean;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface ManagedPlatformSummary {
  id: number;
  workspaceId: string;
  name: string;
  url: string;
  iconUrl: string;
  region: 'overseas' | 'mainland' | 'hk_mo_tw';
  createdAt?: string;
  updatedAt?: string;
}

export interface ManagedRegistrationSourceSummary {
  id: number;
  workspaceId: string;
  name: string;
  code: string;
  website: string | null;
  remark: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ManagedAccountKeySummary {
  id: number;
  title: string;
  content: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedAccountBindingSummary {
  id: number;
  platformId: number | null;
  platformName: string | null;
  platformIconUrl: string | null;
  platformUrl: string | null;
  platformAccount: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedAccountSecuritySummary {
  id: number;
  securityType: 'question' | 'two_factor' | 'contact' | 'emergency_email';
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedWealthEntry {
  key: string;
  value: string;
}

export interface ManagedAccountSummary {
  id: number;
  workspaceId: string;
  platformId: number | null;
  platformName: string | null;
  platformIconUrl: string | null;
  platformUrl: string | null;
  account: string;
  attribute: 'self_hosted' | 'third_party';
  confidence: 'very_high' | 'high' | 'medium' | 'low';
  keyCount: number;
  bindingCount: number;
  registrationSources: ManagedRegistrationSourceSummary[];
  hasPassword: boolean;
  securityCount: number;
  registeredAt: string | null;
  status: 'cancelled' | 'available' | 'banned';
  wealthEntries: ManagedWealthEntry[];
}

export interface ManagedAccountDetail extends ManagedAccountSummary {
  keys: ManagedAccountKeySummary[];
  bindings: ManagedAccountBindingSummary[];
  securities: ManagedAccountSecuritySummary[];
  registrationSourceIds: number[];
  passwordMode: 'none' | 'encrypted' | 'legacy_hash' | 'unavailable';
  passwordPlaintext: string | null;
}
