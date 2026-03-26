import PageContainer from '@/components/layout/page-container';
import { PermissionsManagementClient } from '@/features/management/components/permissions-management-client';
import { requireSession } from '@/lib/auth/session';
import { listPermissionsPage } from '@/lib/platform/service';

export default async function PermissionsPage() {
  await requireSession();
  const { items, pagination } = await listPermissionsPage();

  return (
    <PageContainer
      pageTitle='权限管理'
      pageDescription='权限粒度已经下沉到按钮级，可直接维护编码、模块和动作。'
    >
      <PermissionsManagementClient
        initialPermissions={items}
        initialPagination={pagination}
      />
    </PageContainer>
  );
}
