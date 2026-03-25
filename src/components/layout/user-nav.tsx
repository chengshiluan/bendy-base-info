'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { UserAvatarProfile } from '@/components/user-avatar-profile';
import { APP_VERSION_LABEL } from '@/lib/app-info';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

export function UserNav() {
  const router = useRouter();
  const { data } = useSession();
  const user = data?.user;

  if (!user) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
          <UserAvatarProfile user={user} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className='w-56'
        align='end'
        sideOffset={10}
        forceMount
      >
        <DropdownMenuLabel className='font-normal'>
          <div className='flex flex-col space-y-1'>
            <p className='text-sm leading-none font-medium'>
              {user.name || user.githubUsername}
            </p>
            <p className='text-muted-foreground text-xs leading-none'>
              {user.email || `@${user.githubUsername}`}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>
            账户设置
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: '/auth/sign-in' })}
        >
          退出登录
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className='text-muted-foreground px-2 py-1.5 text-center text-xs'>
          当前版本 {APP_VERSION_LABEL}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
