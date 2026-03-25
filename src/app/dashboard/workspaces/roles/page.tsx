import PageContainer from '@/components/layout/page-container';
import { RolesManagementClient } from '@/features/management/components/roles-management-client';
import { requireSession } from '@/lib/auth/session';
import { getActiveWorkspaceCookie } from '@/lib/auth/workspace';
import { listPermissionOptions, listRoles } from '@/lib/platform/service';

export default async function RolesPage() {
  const session = await requireSession();
  const activeWorkspaceId =
    (await getActiveWorkspaceCookie()) ||
    session.user.defaultWorkspaceId ||
    undefined;
  const [roles, permissionOptions] = await Promise.all([
    listRoles(activeWorkspaceId),
    listPermissionOptions()
  ]);

  return (
    <PageContainer
      pageTitle='角色管理'
      pageDescription='角色挂在工作区下，并通过权限集合控制页面与按钮访问。'
    >
      <RolesManagementClient
        initialRoles={roles}
        workspaceId={activeWorkspaceId}
        permissionOptions={permissionOptions}
      />
    </PageContainer>
  );
}
