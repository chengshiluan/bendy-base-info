'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
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
import type { UserSummary } from '@/lib/platform/types';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { getErrorMessage, requestJson } from '../lib/client';

interface UsersManagementClientProps {
  initialUsers: UserSummary[];
  workspaceId?: string;
}

type UserFormState = {
  githubUsername: string;
  displayName: string;
  email: string;
  systemRole: 'super_admin' | 'admin' | 'member';
  status: 'active' | 'invited' | 'disabled';
  emailLoginEnabled: boolean;
};

function createDefaultForm(): UserFormState {
  return {
    githubUsername: '',
    displayName: '',
    email: '',
    systemRole: 'member',
    status: 'active',
    emailLoginEnabled: true
  };
}

function getStatusLabel(status: UserSummary['status']) {
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

export function UsersManagementClient({
  initialUsers,
  workspaceId
}: UsersManagementClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserSummary | null>(null);
  const [form, setForm] = useState<UserFormState>(createDefaultForm());

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return users;
    }

    return users.filter((user) =>
      [user.githubUsername, user.displayName, user.email]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(keyword))
    );
  }, [search, users]);

  async function refreshUsers() {
    if (!workspaceId) {
      return;
    }

    const data = await requestJson<{ users: UserSummary[] }>(
      `/api/admin/users?workspaceId=${workspaceId}`
    );
    setUsers(data.users);
  }

  function openCreateDialog() {
    setEditingUser(null);
    setForm(createDefaultForm());
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
      emailLoginEnabled: Boolean(user.emailLoginEnabled)
    });
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
      setDialogOpen(false);
      setForm(createDefaultForm());
      setEditingUser(null);
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
              onChange={(event) => setSearch(event.target.value)}
              placeholder='搜索 GitHub 用户名 / 显示名 / 邮箱'
              className='md:w-72'
            />
            <Button onClick={openCreateDialog}>新增用户</Button>
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
                <TableHead>状态</TableHead>
                <TableHead>邮箱登录</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className='font-medium'>
                    @{user.githubUsername}
                  </TableCell>
                  <TableCell>{user.displayName || '-'}</TableCell>
                  <TableCell>{user.email || '-'}</TableCell>
                  <TableCell>
                    <Badge variant='outline'>{user.systemRole}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant='outline'>
                      {getStatusLabel(user.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.emailLoginEnabled ? 'default' : 'secondary'}
                    >
                      {user.emailLoginEnabled ? '已开启' : '已关闭'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className='flex gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => openEditDialog(user)}
                      >
                        编辑
                      </Button>
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!filteredUsers.length && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className='text-muted-foreground py-10 text-center'
                  >
                    当前没有匹配的用户记录。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingUser(null);
            setForm(createDefaultForm());
          }
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
                    <SelectItem value='super_admin'>super_admin</SelectItem>
                    <SelectItem value='admin'>admin</SelectItem>
                    <SelectItem value='member'>member</SelectItem>
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
                    <SelectItem value='active'>active</SelectItem>
                    <SelectItem value='invited'>invited</SelectItem>
                    <SelectItem value='disabled'>disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
              <Button
                type='button'
                variant='outline'
                onClick={() => setDialogOpen(false)}
              >
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
