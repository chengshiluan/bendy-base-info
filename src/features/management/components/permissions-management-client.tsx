'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { PermissionSummary } from '@/lib/platform/types';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { getErrorMessage, requestJson } from '../lib/client';

interface PermissionsManagementClientProps {
  initialPermissions: PermissionSummary[];
}

type PermissionFormState = {
  name: string;
  code: string;
  module: string;
  action: string;
  description: string;
};

function createDefaultForm(): PermissionFormState {
  return {
    name: '',
    code: '',
    module: '',
    action: '',
    description: ''
  };
}

export function PermissionsManagementClient({
  initialPermissions
}: PermissionsManagementClientProps) {
  const [permissions, setPermissions] = useState(initialPermissions);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [editingPermission, setEditingPermission] =
    useState<PermissionSummary | null>(null);
  const [deletingPermission, setDeletingPermission] =
    useState<PermissionSummary | null>(null);
  const [form, setForm] = useState<PermissionFormState>(createDefaultForm());

  const filteredPermissions = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return permissions;
    }

    return permissions.filter((permission) =>
      [permission.name, permission.code, permission.module, permission.action]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword))
    );
  }, [permissions, search]);

  async function refreshPermissions() {
    const data = await requestJson<{ permissions: PermissionSummary[] }>(
      '/api/admin/permissions'
    );
    setPermissions(data.permissions);
  }

  function openCreateDialog() {
    setEditingPermission(null);
    setForm(createDefaultForm());
    setDialogOpen(true);
  }

  function openEditDialog(permission: PermissionSummary) {
    setEditingPermission(permission);
    setForm({
      name: permission.name,
      code: permission.code,
      module: permission.module,
      action: permission.action,
      description: permission.description ?? ''
    });
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitPending(true);

    try {
      const payload = {
        ...form,
        code: form.code || `${form.module}.${form.action}`
      };

      if (editingPermission) {
        await requestJson(`/api/admin/permissions/${editingPermission.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        toast.success('权限已更新。');
      } else {
        await requestJson('/api/admin/permissions', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        toast.success('权限已创建。');
      }

      await refreshPermissions();
      setDialogOpen(false);
      setForm(createDefaultForm());
      setEditingPermission(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitPending(false);
    }
  }

  async function handleDelete() {
    if (!deletingPermission) {
      return;
    }

    setDeletePending(true);

    try {
      await requestJson(`/api/admin/permissions/${deletingPermission.id}`, {
        method: 'DELETE'
      });
      toast.success('权限已删除。');
      await refreshPermissions();
      setDeleteOpen(false);
      setDeletingPermission(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
          <div>
            <CardTitle>权限列表</CardTitle>
            <CardDescription>
              权限建议统一使用 `module.action`
              结构，便于前后端共享与按钮级控制。
            </CardDescription>
          </div>
          <div className='flex w-full flex-col gap-3 md:w-auto md:flex-row'>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder='搜索权限名 / 编码 / 模块 / 动作'
              className='md:w-72'
            />
            <Button onClick={openCreateDialog}>新增权限</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>权限名称</TableHead>
                <TableHead>权限编码</TableHead>
                <TableHead>模块</TableHead>
                <TableHead>动作</TableHead>
                <TableHead>说明</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPermissions.map((permission) => (
                <TableRow key={permission.id}>
                  <TableCell className='font-medium'>
                    {permission.name}
                  </TableCell>
                  <TableCell>{permission.code}</TableCell>
                  <TableCell>{permission.module}</TableCell>
                  <TableCell>{permission.action}</TableCell>
                  <TableCell className='max-w-md whitespace-normal'>
                    {permission.description || '-'}
                  </TableCell>
                  <TableCell>
                    <div className='flex gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => openEditDialog(permission)}
                      >
                        编辑
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          setDeletingPermission(permission);
                          setDeleteOpen(true);
                        }}
                      >
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!filteredPermissions.length && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className='text-muted-foreground py-10 text-center'
                  >
                    当前没有匹配的权限记录。
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
            setEditingPermission(null);
            setForm(createDefaultForm());
          }
        }}
      >
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>
              {editingPermission ? '编辑权限' : '新增权限'}
            </DialogTitle>
            <DialogDescription>
              建议先明确模块和动作，再补齐展示名称与说明，方便后续细粒度授权。
            </DialogDescription>
          </DialogHeader>
          <form className='space-y-4' onSubmit={handleSubmit}>
            <div className='grid gap-2 md:grid-cols-2'>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>权限名称</label>
                <Input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                  placeholder='例如 查看用户列表'
                  required
                />
              </div>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>权限编码</label>
                <Input
                  value={form.code}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      code: event.target.value
                    }))
                  }
                  placeholder='留空时将自动使用 module.action'
                />
              </div>
            </div>
            <div className='grid gap-2 md:grid-cols-2'>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>模块</label>
                <Input
                  value={form.module}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      module: event.target.value
                    }))
                  }
                  placeholder='例如 users'
                  required
                />
              </div>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>动作</label>
                <Input
                  value={form.action}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      action: event.target.value
                    }))
                  }
                  placeholder='例如 manage'
                  required
                />
              </div>
            </div>
            <div className='grid gap-2'>
              <label className='text-sm font-medium'>说明</label>
              <Textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value
                  }))
                }
                placeholder='说明这个权限控制的具体能力'
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
                  : editingPermission
                    ? '保存修改'
                    : '创建权限'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title='删除权限'
        description={
          deletingPermission
            ? `将删除权限 ${deletingPermission.code}，相关角色绑定也会同步清理。`
            : '删除后不可恢复。'
        }
        confirmLabel='确认删除'
        pending={deletePending}
        onConfirm={handleDelete}
      />
    </>
  );
}
