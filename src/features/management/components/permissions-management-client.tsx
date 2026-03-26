'use client';

import { useEffect, useState } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useDebounce } from '@/hooks/use-debounce';
import type { PaginationMeta, PermissionSummary } from '@/lib/platform/types';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { ManagementPagination } from './management-pagination';
import {
  buildPathWithQuery,
  getErrorMessage,
  requestJson
} from '../lib/client';

interface PermissionsManagementClientProps {
  initialPermissions: PermissionSummary[];
  initialPagination: PaginationMeta;
  workspaceId?: string;
  access: {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  };
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
  initialPermissions,
  initialPagination,
  workspaceId,
  access
}: PermissionsManagementClientProps) {
  const [permissions, setPermissions] = useState(initialPermissions);
  const [pagination, setPagination] = useState(initialPagination);
  const [page, setPage] = useState(initialPagination.page);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [listPending, setListPending] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [editingPermission, setEditingPermission] =
    useState<PermissionSummary | null>(null);
  const [deletingPermission, setDeletingPermission] =
    useState<PermissionSummary | null>(null);
  const [form, setForm] = useState<PermissionFormState>(createDefaultForm());

  async function refreshPermissions() {
    if (!workspaceId) {
      return;
    }

    const data = await requestJson<{
      permissions: PermissionSummary[];
      pagination: PaginationMeta;
    }>(
      buildPathWithQuery('/api/admin/permissions', {
        workspaceId,
        page,
        search: debouncedSearch
      })
    );
    setPermissions(data.permissions);
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

    async function loadPermissions() {
      setListPending(true);

      try {
        const data = await requestJson<{
          permissions: PermissionSummary[];
          pagination: PaginationMeta;
        }>(
          buildPathWithQuery('/api/admin/permissions', {
            workspaceId,
            page,
            search: debouncedSearch
          })
        );

        if (cancelled) {
          return;
        }

        setPermissions(data.permissions);
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

    void loadPermissions();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, page, workspaceId]);

  function openCreateDialog() {
    if (!access.canCreate) {
      return;
    }

    setEditingPermission(null);
    setForm(createDefaultForm());
    setDialogOpen(true);
  }

  function openEditDialog(permission: PermissionSummary) {
    if (!access.canUpdate || permission.isSystem) {
      return;
    }

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

    if (!workspaceId) {
      toast.error('当前没有可操作的工作区。');
      return;
    }

    setSubmitPending(true);

    try {
      const payload = {
        ...form,
        code: form.code || `${form.module}.${form.action}`
      };

      if (editingPermission) {
        await requestJson(
          `/api/admin/permissions/${editingPermission.id}?workspaceId=${workspaceId}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload)
          }
        );
        toast.success('权限已更新。');
      } else {
        await requestJson(`/api/admin/permissions?workspaceId=${workspaceId}`, {
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
    if (!deletingPermission || !workspaceId) {
      return;
    }

    setDeletePending(true);

    try {
      await requestJson(
        `/api/admin/permissions/${deletingPermission.id}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE'
        }
      );
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

  if (!workspaceId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>权限列表</CardTitle>
          <CardDescription>
            请先选择一个工作区，再查看当前功能目录下的权限树。
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
            <CardTitle>权限列表</CardTitle>
            <CardDescription>
              权限树已经对齐到页面目录与按钮动作，系统内置权限会跟随路由树自动维护。
            </CardDescription>
          </div>
          <div className='flex w-full flex-col gap-3 md:w-auto md:flex-row'>
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder='搜索权限名 / 编码 / 模块 / 动作'
              className='md:w-80'
            />
            {access.canCreate ? (
              <Button onClick={openCreateDialog}>新增权限</Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>权限路径</TableHead>
                <TableHead>权限编码</TableHead>
                <TableHead>范围</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>说明</TableHead>
                {canManageAny ? <TableHead>操作</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((permission) => (
                <TableRow key={permission.id}>
                  <TableCell className='max-w-md whitespace-normal'>
                    <div className='space-y-1'>
                      <div className='font-medium'>{permission.pathLabel}</div>
                      <div className='text-muted-foreground text-xs'>
                        {permission.name}
                      </div>
                      {permission.isSystem ? (
                        <Badge variant='secondary'>系统内置</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{permission.code}</TableCell>
                  <TableCell>
                    <Badge variant='outline'>
                      {permission.scope === 'workspace' ? '工作区' : '全局'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant='outline'>
                      {permission.permissionType === 'menu' ? '菜单' : '动作'}
                    </Badge>
                  </TableCell>
                  <TableCell className='max-w-md whitespace-normal'>
                    {permission.description || '-'}
                  </TableCell>
                  {canManageAny ? (
                    <TableCell>
                      <div className='flex gap-2'>
                        {access.canUpdate && !permission.isSystem ? (
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => openEditDialog(permission)}
                          >
                            编辑
                          </Button>
                        ) : null}
                        {access.canDelete && !permission.isSystem ? (
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
                        ) : null}
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
              {!permissions.length && (
                <TableRow>
                  <TableCell
                    colSpan={canManageAny ? 6 : 5}
                    className='text-muted-foreground py-10 text-center'
                  >
                    当前没有匹配的权限记录。
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

      {access.canCreate || access.canUpdate ? (
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
      ) : null}

      {access.canDelete ? (
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
      ) : null}
    </>
  );
}
