'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { useDebounce } from '@/hooks/use-debounce';
import type {
  GithubSearchUser,
  OptionItem,
  PaginationMeta,
  UserSummary
} from '@/lib/platform/types';
import { cn } from '@/lib/utils';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { ManagementPagination } from './management-pagination';
import { OptionCheckboxGroup } from './option-checkbox-group';
import {
  buildPathWithQuery,
  getErrorMessage,
  requestJson
} from '../lib/client';
import { getSystemRoleLabel, getUserStatusLabel } from '../lib/display';

interface UsersManagementClientProps {
  initialUsers: UserSummary[];
  initialPagination: PaginationMeta;
  workspaceId?: string;
  roleOptions: OptionItem[];
  access: {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  };
}

type UserFormState = {
  githubUsername: string;
  displayName: string;
  email: string;
  systemRole: 'super_admin' | 'admin' | 'member';
  status: 'active' | 'invited' | 'disabled';
  emailLoginEnabled: boolean;
  roleIds: string[];
};

function createDefaultForm(): UserFormState {
  return {
    githubUsername: '',
    displayName: '',
    email: '',
    systemRole: 'member',
    status: 'active',
    emailLoginEnabled: true,
    roleIds: []
  };
}

function normalizeGithubUsername(value: string) {
  return value.trim().replace(/^@/, '').toLowerCase();
}

function getGithubInitial(username: string) {
  return username.slice(0, 1).toUpperCase();
}

export function UsersManagementClient({
  initialUsers,
  initialPagination,
  workspaceId,
  roleOptions,
  access
}: UsersManagementClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [pagination, setPagination] = useState(initialPagination);
  const [page, setPage] = useState(initialPagination.page);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [listPending, setListPending] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserSummary | null>(null);
  const [form, setForm] = useState<UserFormState>(createDefaultForm());
  const [githubSearchResults, setGithubSearchResults] = useState<
    GithubSearchUser[]
  >([]);
  const [githubSearchPending, setGithubSearchPending] = useState(false);
  const [githubSearchError, setGithubSearchError] = useState<string | null>(
    null
  );
  const normalizedGithubUsername = normalizeGithubUsername(form.githubUsername);
  const editingGithubUsername = normalizeGithubUsername(
    editingUser?.githubUsername ?? ''
  );
  const shouldSearchGithub =
    dialogOpen &&
    normalizedGithubUsername.length >= 2 &&
    (!editingUser || normalizedGithubUsername !== editingGithubUsername);
  const debouncedGithubSearchQuery = useDebounce(
    shouldSearchGithub ? normalizedGithubUsername : '',
    350
  );
  const exactGithubSearchUser =
    githubSearchResults.find(
      (user) => user.githubUsername === normalizedGithubUsername
    ) ?? null;

  function resetGithubSearchState() {
    setGithubSearchResults([]);
    setGithubSearchPending(false);
    setGithubSearchError(null);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingUser(null);
    setForm(createDefaultForm());
    resetGithubSearchState();
  }

  async function refreshUsers() {
    if (!workspaceId) {
      return;
    }

    const data = await requestJson<{
      users: UserSummary[];
      pagination: PaginationMeta;
    }>(
      buildPathWithQuery('/api/admin/users', {
        workspaceId,
        page,
        search: debouncedSearch
      })
    );
    setUsers(data.users);
    setPagination(data.pagination);
    if (data.pagination.page !== page) {
      setPage(data.pagination.page);
    }
  }

  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    let cancelled = false;

    async function loadUsers() {
      setListPending(true);

      try {
        const data = await requestJson<{
          users: UserSummary[];
          pagination: PaginationMeta;
        }>(
          buildPathWithQuery('/api/admin/users', {
            workspaceId,
            page,
            search: debouncedSearch
          })
        );

        if (cancelled) {
          return;
        }

        setUsers(data.users);
        setPagination(data.pagination);
        if (data.pagination.page !== page) {
          setPage(data.pagination.page);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setListPending(false);
        }
      }
    }

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, page, workspaceId]);

  useEffect(() => {
    if (
      !workspaceId ||
      !shouldSearchGithub ||
      debouncedGithubSearchQuery.length < 2
    ) {
      setGithubSearchPending(false);
      setGithubSearchError(null);
      setGithubSearchResults([]);
      return;
    }

    let cancelled = false;

    async function loadGithubUsers() {
      setGithubSearchPending(true);
      setGithubSearchError(null);

      try {
        const data = await requestJson<{ githubUsers: GithubSearchUser[] }>(
          buildPathWithQuery('/api/admin/users/github-search', {
            workspaceId,
            query: debouncedGithubSearchQuery
          })
        );

        if (cancelled) {
          return;
        }

        setGithubSearchResults(data.githubUsers);
      } catch (error) {
        if (!cancelled) {
          setGithubSearchResults([]);
          setGithubSearchError(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setGithubSearchPending(false);
        }
      }
    }

    void loadGithubUsers();

    return () => {
      cancelled = true;
    };
  }, [debouncedGithubSearchQuery, shouldSearchGithub, workspaceId]);

  function openCreateDialog() {
    setEditingUser(null);
    setForm(createDefaultForm());
    resetGithubSearchState();
    setDialogOpen(true);
  }

  function openEditDialog(user: UserSummary) {
    setEditingUser(user);
    setForm({
      githubUsername: user.githubUsername,
      displayName: user.displayName ?? '',
      email: user.email ?? '',
      systemRole: user.systemRole,
      status: user.status,
      emailLoginEnabled: Boolean(user.emailLoginEnabled),
      roleIds: user.roleIds ?? []
    });
    resetGithubSearchState();
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceId) {
      toast.error('当前没有可操作的工作区。');
      return;
    }

    setSubmitPending(true);

    try {
      const payload = {
        workspaceId,
        ...form
      };

      if (editingUser) {
        await requestJson(`/api/admin/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        toast.success('用户已更新。');
      } else {
        await requestJson('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        toast.success('用户已创建。');
      }

      await refreshUsers();
      closeDialog();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitPending(false);
    }
  }

  async function handleDelete() {
    if (!deletingUser || !workspaceId) {
      return;
    }

    setDeletePending(true);

    try {
      await requestJson(
        `/api/admin/users/${deletingUser.id}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE'
        }
      );
      toast.success('用户已删除。');
      await refreshUsers();
      setDeleteOpen(false);
      setDeletingUser(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletePending(false);
    }
  }

  if (!workspaceId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
          <CardDescription>
            请先选择一个工作区，再进行用户维护。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const canManageAny = access.canUpdate || access.canDelete;

  return (
    <>
      <Card>
        <CardHeader className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
          <div>
            <CardTitle>用户列表</CardTitle>
            <CardDescription>
              当前工作区下的用户以 GitHub 用户名作为唯一业务身份。
            </CardDescription>
          </div>
          <div className='flex w-full flex-col gap-3 md:w-auto md:flex-row'>
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder='搜索 GitHub 用户名 / 显示名 / 邮箱'
              className='md:w-80'
            />
            {access.canCreate ? (
              <Button onClick={openCreateDialog}>新增用户</Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GitHub 用户名</TableHead>
                <TableHead>显示名称</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>系统角色</TableHead>
                <TableHead>工作区角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>邮箱登录</TableHead>
                {canManageAny ? <TableHead>操作</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className='font-medium'>
                    @{user.githubUsername}
                  </TableCell>
                  <TableCell>{user.displayName || '-'}</TableCell>
                  <TableCell>{user.email || '-'}</TableCell>
                  <TableCell>
                    <Badge variant='outline'>
                      {getSystemRoleLabel(user.systemRole)}
                    </Badge>
                  </TableCell>
                  <TableCell className='max-w-sm whitespace-normal'>
                    {user.roleNames?.length ? user.roleNames.join(' / ') : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant='outline'>
                      {getUserStatusLabel(user.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.emailLoginEnabled ? 'default' : 'secondary'}
                    >
                      {user.emailLoginEnabled ? '已开启' : '已关闭'}
                    </Badge>
                  </TableCell>
                  {canManageAny ? (
                    <TableCell>
                      <div className='flex gap-2'>
                        {access.canUpdate ? (
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => openEditDialog(user)}
                          >
                            编辑
                          </Button>
                        ) : null}
                        {access.canDelete ? (
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => {
                              setDeletingUser(user);
                              setDeleteOpen(true);
                            }}
                          >
                            删除
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
              {!users.length && (
                <TableRow>
                  <TableCell
                    colSpan={canManageAny ? 8 : 7}
                    className='text-muted-foreground py-10 text-center'
                  >
                    当前没有匹配的用户记录。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className='mt-4'>
            <ManagementPagination
              pagination={pagination}
              pending={listPending}
              onPageChange={setPage}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog();
            return;
          }

          setDialogOpen(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? '编辑用户' : '新增用户'}</DialogTitle>
            <DialogDescription>
              新增时只需要录入 GitHub 用户名，邮箱作为验证码登录的辅助入口。
            </DialogDescription>
          </DialogHeader>
          <form className='space-y-4' onSubmit={handleSubmit}>
            <div className='grid gap-2'>
              <label className='text-sm font-medium'>GitHub 用户名</label>
              <Input
                value={form.githubUsername}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    githubUsername: event.target.value.toLowerCase()
                  }))
                }
                placeholder='例如 juzi'
                required
                maxLength={39}
              />
              <p className='text-muted-foreground text-xs'>
                输入至少 2 个字符后会自动搜索 GitHub 用户。保存时会以 GitHub
                实时资料同步用户名、头像和昵称。
              </p>
              {shouldSearchGithub ? (
                <div className='rounded-md border'>
                  <div className='flex items-center justify-between gap-3 border-b px-3 py-2'>
                    <div>
                      <p className='text-sm font-medium'>GitHub 自动搜索</p>
                      <p className='text-muted-foreground text-xs'>
                        点击候选结果可快速确认当前录入的 GitHub 用户。
                      </p>
                    </div>
                    <Badge variant='outline'>
                      {githubSearchResults.length} 条结果
                    </Badge>
                  </div>
                  {exactGithubSearchUser ? (
                    <div className='border-b px-3 py-3'>
                      <div className='bg-primary/5 flex items-center gap-3 rounded-md border px-3 py-3'>
                        <Avatar className='size-10'>
                          <AvatarImage
                            src={exactGithubSearchUser.avatarUrl ?? undefined}
                            alt={exactGithubSearchUser.githubUsername}
                          />
                          <AvatarFallback>
                            {getGithubInitial(
                              exactGithubSearchUser.githubUsername
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div className='min-w-0 flex-1'>
                          <p className='truncate text-sm font-medium'>
                            已匹配 GitHub 用户 @
                            {exactGithubSearchUser.githubUsername}
                          </p>
                          <a
                            href={exactGithubSearchUser.profileUrl}
                            target='_blank'
                            rel='noreferrer'
                            className='text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline'
                          >
                            打开 GitHub 主页确认
                          </a>
                        </div>
                        <Badge>完全匹配</Badge>
                      </div>
                    </div>
                  ) : null}
                  <div className='max-h-56 overflow-y-auto p-3'>
                    {githubSearchPending ? (
                      <div className='text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm'>
                        <Loader2 className='size-4 animate-spin' />
                        正在搜索 GitHub 用户...
                      </div>
                    ) : githubSearchError ? (
                      <div className='text-destructive py-3 text-sm'>
                        {githubSearchError}
                      </div>
                    ) : githubSearchResults.length ? (
                      <div className='space-y-2'>
                        {githubSearchResults.map((user) => {
                          const matched =
                            user.githubUsername === normalizedGithubUsername;

                          return (
                            <button
                              key={user.githubUserId}
                              type='button'
                              className={cn(
                                'hover:bg-muted/70 flex w-full items-center justify-between gap-3 rounded-md border px-3 py-3 text-left transition-colors',
                                matched && 'border-primary bg-primary/5'
                              )}
                              onClick={() =>
                                setForm((current) => ({
                                  ...current,
                                  githubUsername: user.githubUsername
                                }))
                              }
                            >
                              <div className='flex min-w-0 items-center gap-3'>
                                <Avatar className='size-9'>
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
                                    GitHub 用户 ID {user.githubUserId}
                                  </p>
                                </div>
                              </div>
                              <div className='flex items-center gap-2'>
                                {matched ? (
                                  <Badge>当前输入</Badge>
                                ) : (
                                  <Badge variant='outline'>使用此用户</Badge>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className='text-muted-foreground py-3 text-sm'>
                        暂未搜索到匹配的 GitHub
                        用户，你也可以继续手动输入，保存时会再次校验。
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className='grid gap-2 md:grid-cols-2'>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>显示名称</label>
                <Input
                  value={form.displayName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      displayName: event.target.value
                    }))
                  }
                  placeholder='可选'
                />
              </div>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>邮箱</label>
                <Input
                  type='email'
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value
                    }))
                  }
                  placeholder='可选，用于邮箱验证码登录'
                />
              </div>
            </div>
            <div className='grid gap-2 md:grid-cols-2'>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>系统角色</label>
                <Select
                  value={form.systemRole}
                  onValueChange={(value: UserFormState['systemRole']) =>
                    setForm((current) => ({ ...current, systemRole: value }))
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='super_admin'>超级管理员</SelectItem>
                    <SelectItem value='admin'>管理员</SelectItem>
                    <SelectItem value='member'>成员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>状态</label>
                <Select
                  value={form.status}
                  onValueChange={(value: UserFormState['status']) =>
                    setForm((current) => ({ ...current, status: value }))
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='active'>启用中</SelectItem>
                    <SelectItem value='invited'>待激活</SelectItem>
                    <SelectItem value='disabled'>已停用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className='grid gap-2'>
              <label className='text-sm font-medium'>工作区角色</label>
              <OptionCheckboxGroup
                options={roleOptions}
                value={form.roleIds}
                onChange={(roleIds) =>
                  setForm((current) => ({ ...current, roleIds }))
                }
                emptyLabel='当前工作区还没有可分配的角色。'
              />
            </div>
            <div className='flex items-center justify-between rounded-md border p-3'>
              <div>
                <p className='text-sm font-medium'>邮箱验证码登录</p>
                <p className='text-muted-foreground text-sm'>
                  关闭后，该用户将不能使用邮箱验证码登录。
                </p>
              </div>
              <Switch
                checked={form.emailLoginEnabled}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    emailLoginEnabled: checked
                  }))
                }
              />
            </div>
            <DialogFooter>
              <Button type='button' variant='outline' onClick={closeDialog}>
                取消
              </Button>
              <Button type='submit' disabled={submitPending}>
                {submitPending
                  ? '保存中...'
                  : editingUser
                    ? '保存修改'
                    : '创建用户'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title='删除用户'
        description={
          deletingUser
            ? `将删除 @${deletingUser.githubUsername} 及其工作区关联，删除后不可恢复。`
            : '删除后不可恢复。'
        }
        confirmLabel='确认删除'
        pending={deletePending}
        onConfirm={handleDelete}
      />
    </>
  );
}
