'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, FolderKanban } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from '@/components/ui/sidebar';
import { hasPermission } from '@/lib/auth/permission';
import { menuPermissionCode } from '@/lib/platform/rbac';

interface WorkspaceOption {
  id: string;
  name: string;
  slug: string;
}

function readWorkspaceCookie(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const target = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('active_workspace_id='));

  return target ? decodeURIComponent(target.split('=')[1]) : null;
}

export function OrgSwitcher() {
  const router = useRouter();
  const { state, isMobile } = useSidebar();
  const { data } = useSession();
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaces() {
      try {
        const response = await fetch('/api/workspaces', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Failed to load workspaces.');
        }

        const payload = (await response.json()) as {
          workspaces: WorkspaceOption[];
        };
        if (cancelled) {
          return;
        }

        setWorkspaces(payload.workspaces);
        const cookieWorkspace = readWorkspaceCookie();
        setActiveWorkspaceId(
          cookieWorkspace ||
            data?.user?.defaultWorkspaceId ||
            payload.workspaces[0]?.id ||
            null
        );
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (data?.user?.id) {
      void loadWorkspaces();
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [data?.user?.defaultWorkspaceId, data?.user?.id]);

  const activeWorkspace = useMemo(() => {
    return (
      workspaces.find((workspace) => workspace.id === activeWorkspaceId) ||
      workspaces[0] ||
      null
    );
  }, [activeWorkspaceId, workspaces]);
  const canManageWorkspaces = useMemo(
    () =>
      hasPermission(
        data?.user,
        menuPermissionCode('dashboard', 'workspaces', 'manage')
      ),
    [data?.user]
  );

  const handleWorkspaceChange = async (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
    await fetch('/api/workspaces/active', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ workspaceId })
    });
    router.refresh();
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size='lg'>
              <div className='bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg'>
                <FolderKanban className='size-4' />
              </div>
              <div
                className={`grid flex-1 text-left text-sm leading-tight transition-all duration-200 ease-in-out ${
                  state === 'collapsed'
                    ? 'invisible max-w-0 overflow-hidden opacity-0'
                    : 'visible max-w-full opacity-100'
                }`}
              >
                <span className='truncate font-medium'>
                  {loading
                    ? '加载工作区...'
                    : activeWorkspace?.name || '未选择工作区'}
                </span>
                <span className='text-muted-foreground truncate text-xs'>
                  {activeWorkspace?.slug || 'workspace'}
                </span>
              </div>
              <ChevronsUpDown
                className={`ml-auto transition-all duration-200 ease-in-out ${
                  state === 'collapsed'
                    ? 'invisible max-w-0 opacity-0'
                    : 'visible max-w-full opacity-100'
                }`}
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg'
            align='start'
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className='text-muted-foreground text-xs'>
              工作区切换
            </DropdownMenuLabel>
            {workspaces.map((workspace) => {
              const isActive = workspace.id === activeWorkspace?.id;

              return (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => handleWorkspaceChange(workspace.id)}
                  className='gap-2 p-2'
                >
                  <div className='flex size-6 items-center justify-center rounded-md border'>
                    <FolderKanban className='size-3.5' />
                  </div>
                  {workspace.name}
                  {isActive && <Check className='ml-auto size-4' />}
                </DropdownMenuItem>
              );
            })}
            {canManageWorkspaces ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push('/dashboard/workspaces')}
                >
                  管理工作区
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
