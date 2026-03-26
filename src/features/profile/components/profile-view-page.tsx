'use client';

import { ThemeSelector } from '@/components/themes/theme-selector';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { UserAvatarProfile } from '@/components/user-avatar-profile';
import { useSession } from 'next-auth/react';
import { getSystemRoleLabel } from '@/features/management/lib/display';

export default function ProfileViewPage() {
  const { data } = useSession();
  const user = data?.user;

  if (!user) {
    return null;
  }

  return (
    <div className='flex w-full flex-col gap-4 p-4'>
      <Card>
        <CardHeader>
          <CardTitle>当前账户</CardTitle>
          <CardDescription>
            系统用户以 GitHub 用户名为主标识，邮箱作为可选登录通道。
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
          <UserAvatarProfile className='h-16 w-16' showInfo user={user} />
          <div className='flex flex-wrap gap-2'>
            <Badge variant='outline'>
              {getSystemRoleLabel(user.systemRole)}
            </Badge>
            {user.defaultWorkspaceId && (
              <Badge variant='secondary'>默认工作区已设置</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>偏好设置</CardTitle>
          <CardDescription>
            当前先保留主题切换，后续可继续补充个人偏好项。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSelector />
        </CardContent>
      </Card>
    </div>
  );
}
