'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type {
  GithubSearchUser,
  ImportedWorkspaceGithubUser
} from '@/lib/platform/types';
import { cn } from '@/lib/utils';
import { getErrorMessage, requestJson } from '../lib/client';

interface TeamGithubMemberPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onImported: (users: ImportedWorkspaceGithubUser[]) => void;
}

function getGithubInitial(username: string) {
  return username.slice(0, 1).toUpperCase();
}

export function TeamGithubMemberPickerDialog({
  open,
  onOpenChange,
  workspaceId,
  onImported
}: TeamGithubMemberPickerDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GithubSearchUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<
    Record<string, GithubSearchUser>
  >({});
  const [searchPending, setSearchPending] = useState(false);
  const [importPending, setImportPending] = useState(false);
  const normalizedQuery = query.trim().replace(/^@/, '');
  const selectedList = useMemo(
    () => Object.values(selectedUsers),
    [selectedUsers]
  );

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSelectedUsers({});
      setSearchPending(false);
      setImportPending(false);
    }
  }, [open]);

  function toggleSelectedUser(user: GithubSearchUser) {
    setSelectedUsers((current) => {
      const next = { ...current };

      if (next[user.githubUsername]) {
        delete next[user.githubUsername];
        return next;
      }

      next[user.githubUsername] = user;
      return next;
    });
  }

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (normalizedQuery.length < 2) {
      toast.error('至少输入 2 个字符再搜索 GitHub 用户。');
      return;
    }

    setSearchPending(true);

    try {
      const data = await requestJson<{ githubUsers: GithubSearchUser[] }>(
        `/api/admin/users/github-search?workspaceId=${workspaceId}&query=${encodeURIComponent(normalizedQuery)}`
      );
      setResults(data.githubUsers);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSearchPending(false);
    }
  }

  async function handleImportSelectedUsers() {
    if (!selectedList.length) {
      toast.error('请先选择要加入团队的 GitHub 用户。');
      return;
    }

    setImportPending(true);

    try {
      const data = await requestJson<{
        importedUsers: ImportedWorkspaceGithubUser[];
      }>('/api/admin/users/github-import', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId,
          githubUsernames: selectedList.map((user) => user.githubUsername)
        })
      });
      onImported(data.importedUsers);
      const alreadyInWorkspaceCount = data.importedUsers.filter(
        (user) => user.alreadyInWorkspace
      ).length;
      const newlyImportedCount =
        data.importedUsers.length - alreadyInWorkspaceCount;

      if (alreadyInWorkspaceCount && newlyImportedCount) {
        toast.success(
          `已补充 ${newlyImportedCount} 位新成员，并把 ${alreadyInWorkspaceCount} 位已有工作区成员加入团队待选列表。`
        );
      } else if (alreadyInWorkspaceCount) {
        toast.success(
          `已将 ${alreadyInWorkspaceCount} 位已有工作区成员加入团队待选列表。`
        );
      } else {
        toast.success(`已从 GitHub 添加 ${newlyImportedCount} 位成员。`);
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setImportPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-3xl'>
        <DialogHeader>
          <DialogTitle>从 GitHub 添加团队成员</DialogTitle>
          <DialogDescription>
            先搜索 GitHub 用户，再批量加入当前工作区，并自动勾选到团队成员里。
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-5'>
          <section className='grid gap-3'>
            <div className='flex items-center justify-between gap-3'>
              <div>
                <h3 className='text-sm font-medium'>GitHub 搜索</h3>
                <p className='text-muted-foreground text-sm'>
                  输入 GitHub 用户名关键字后搜索，支持一次勾选多个结果。
                </p>
              </div>
              <Badge variant='outline'>{results.length} 条结果</Badge>
            </div>

            <form className='flex gap-2' onSubmit={handleSearch}>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder='例如 chengshiluan'
                maxLength={39}
              />
              <Button
                type='submit'
                disabled={searchPending || normalizedQuery.length < 2}
              >
                {searchPending ? (
                  <>
                    <Loader2 className='animate-spin' />
                    搜索中...
                  </>
                ) : (
                  <>
                    <Search />
                    搜索
                  </>
                )}
              </Button>
            </form>

            <ScrollArea className='h-72 rounded-md border'>
              {results.length ? (
                <div className='space-y-2 p-3'>
                  {results.map((user) => {
                    const selected = Boolean(selectedUsers[user.githubUsername]);

                    return (
                      <div
                        key={user.githubUsername}
                        className={cn(
                          'flex items-center justify-between gap-4 rounded-md border px-3 py-3',
                          selected && 'border-primary bg-primary/5'
                        )}
                      >
                        <div className='flex min-w-0 items-center gap-3'>
                          <Avatar className='size-10'>
                            <AvatarImage
                              src={user.avatarUrl ?? undefined}
                              alt={user.githubUsername}
                            />
                            <AvatarFallback>
                              {getGithubInitial(user.githubUsername)}
                            </AvatarFallback>
                          </Avatar>
                          <div className='min-w-0 space-y-1'>
                            <p className='truncate text-sm font-medium'>
                              @{user.githubUsername}
                            </p>
                            <a
                              href={user.profileUrl}
                              target='_blank'
                              rel='noreferrer'
                              className='text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline'
                            >
                              查看 GitHub 主页
                            </a>
                          </div>
                        </div>
                        <Button
                          type='button'
                          variant={selected ? 'secondary' : 'outline'}
                          onClick={() => toggleSelectedUser(user)}
                        >
                          {selected ? '已选择' : '选择'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className='text-muted-foreground flex h-full items-center justify-center px-6 text-center text-sm'>
                  输入 GitHub 用户名关键字后，搜索结果会显示在这里。
                </div>
              )}
            </ScrollArea>
          </section>

          <section className='grid gap-3'>
            <div className='flex items-center justify-between gap-3'>
              <div>
                <h3 className='text-sm font-medium'>待加入团队</h3>
                <p className='text-muted-foreground text-sm'>
                  这里会保留你本次勾选的 GitHub 用户，确认后统一加入。
                </p>
              </div>
              <Badge variant='outline'>{selectedList.length} 人</Badge>
            </div>

            <ScrollArea className='h-44 rounded-md border'>
              {selectedList.length ? (
                <div className='space-y-2 p-3'>
                  {selectedList.map((user) => (
                    <div
                      key={user.githubUsername}
                      className='flex items-center justify-between gap-4 rounded-md border px-3 py-3'
                    >
                      <div className='flex min-w-0 items-center gap-3'>
                        <Avatar className='size-10'>
                          <AvatarImage
                            src={user.avatarUrl ?? undefined}
                            alt={user.githubUsername}
                          />
                          <AvatarFallback>
                            {getGithubInitial(user.githubUsername)}
                          </AvatarFallback>
                        </Avatar>
                        <div className='min-w-0'>
                          <p className='truncate text-sm font-medium'>
                            @{user.githubUsername}
                          </p>
                          <p className='text-muted-foreground text-xs'>
                            将加入当前工作区并勾选到团队成员
                          </p>
                        </div>
                      </div>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        onClick={() => toggleSelectedUser(user)}
                        aria-label={`移除 ${user.githubUsername}`}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='text-muted-foreground flex h-full items-center justify-center px-6 text-center text-sm'>
                  还没有选择任何 GitHub 用户。
                </div>
              )}
            </ScrollArea>
          </section>
        </div>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type='button'
            onClick={handleImportSelectedUsers}
            disabled={importPending || !selectedList.length}
          >
            {importPending ? (
              <>
                <Loader2 className='animate-spin' />
                导入中...
              </>
            ) : (
              <>
                <UserPlus />
                批量加入
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
