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
import type {
  PaginationMeta,
  PermissionTreeNode,
  RoleSummary
} from '@/lib/platform/types';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { ManagementPagination } from './management-pagination';
import { PermissionTreeSelector } from './permission-tree-selector';
import {
  buildPathWithQuery,
  getErrorMessage,
  requestJson
} from '../lib/client';

interface RolesManagementClientProps {
  initialRoles: RoleSummary[];
  initialPagination: PaginationMeta;
  workspaceId?: string;
  permissionTree: PermissionTreeNode[];
  access: {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  };
}

type RoleFormState = {
  key: string;
  name: string;
  description: string;
  permissionIds: string[];
};

function createDefaultForm(): RoleFormState {
  return {
    key: '',
    name: '',
    description: '',
    permissionIds: []
  };
}

export function RolesManagementClient({
  initialRoles,
  initialPagination,
  workspaceId,
  permissionTree,
  access
}: RolesManagementClientProps) {
  const [roles, setRoles] = useState(initialRoles);
  const [pagination, setPagination] = useState(initialPagination);
  const [page, setPage] = useState(initialPagination.page);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [listPending, setListPending] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleSummary | null>(null);
  const [deletingRole, setDeletingRole] = useState<RoleSummary | null>(null);
  const [form, setForm] = useState<RoleFormState>(createDefaultForm());

  async function refreshRoles() {
    if (!workspaceId) {
      return;
    }

    const data = await requestJson<{
      roles: RoleSummary[];
      pagination: PaginationMeta;
    }>(
      buildPathWithQuery('/api/admin/roles', {
        workspaceId,
        page,
        search: debouncedSearch
      })
    );
    setRoles(data.roles);
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

    async function loadRoles() {
      setListPending(true);

      try {
        const data = await requestJson<{
          roles: RoleSummary[];
          pagination: PaginationMeta;
        }>(
          buildPathWithQuery('/api/admin/roles', {
            workspaceId,
            page,
            search: debouncedSearch
          })
        );

        if (cancelled) {
          return;
        }

        setRoles(data.roles);
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

    void loadRoles();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, page, workspaceId]);

  function openCreateDialog() {
    setEditingRole(null);
    setForm(createDefaultForm());
    setDialogOpen(true);
  }

  function openEditDialog(role: RoleSummary) {
    setEditingRole(role);
    setForm({
      key: role.key,
      name: role.name,
      description: role.description,
      permissionIds: role.permissionIds ?? []
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

      if (editingRole) {
        await requestJson(`/api/admin/roles/${editingRole.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        toast.success('角色已更新。');
      } else {
        await requestJson('/api/admin/roles', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        toast.success('角色已创建。');
      }

      await refreshRoles();
      setDialogOpen(false);
      setForm(createDefaultForm());
      setEditingRole(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitPending(false);
    }
  }

  async function handleDelete() {
    if (!deletingRole || !workspaceId) {
      return;
    }

    setDeletePending(true);

    try {
      await requestJson(
        `/api/admin/roles/${deletingRole.id}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE'
        }
      );
      toast.success('角色已删除。');
      await refreshRoles();
      setDeleteOpen(false);
      setDeletingRole(null);
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
          <CardTitle>角色列表</CardTitle>
          <CardDescription>
            请先选择一个工作区，再进行角色维护。
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
            <CardTitle>角色列表</CardTitle>
            <CardDescription>
              角色挂在工作区下，并通过权限集合控制页面与按钮访问能力。
            </CardDescription>
          </div>
          <div className='flex w-full flex-col gap-3 md:w-auto md:flex-row'>
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder='搜索角色键 / 名称 / 描述'
              className='md:w-80'
            />
            {access.canCreate ? (
              <Button onClick={openCreateDialog}>新增角色</Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>角色键</TableHead>
                <TableHead>角色名称</TableHead>
                <TableHead>权限数</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>说明</TableHead>
                {canManageAny ? <TableHead>操作</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className='font-medium'>{role.key}</TableCell>
                  <TableCell>{role.name}</TableCell>
                  <TableCell>{role.permissionCount}</TableCell>
                  <TableCell>
                    <Badge variant='outline'>
                      {role.isSystem ? '系统角色' : '业务角色'}
                    </Badge>
                  </TableCell>
                  <TableCell className='max-w-md whitespace-normal'>
                    {role.description}
                  </TableCell>
                  {canManageAny ? (
                    <TableCell>
                      <div className='flex gap-2'>
                        {access.canUpdate ? (
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => openEditDialog(role)}
                          >
                            编辑
                          </Button>
                        ) : null}
                        {access.canDelete ? (
                          <Button
                            variant='outline'
                            size='sm'
                            disabled={role.isSystem}
                            onClick={() => {
                              setDeletingRole(role);
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
              {!roles.length && (
                <TableRow>
                  <TableCell
                    colSpan={canManageAny ? 6 : 5}
                    className='text-muted-foreground py-10 text-center'
                  >
                    当前没有匹配的角色记录。
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
              setEditingRole(null);
              setForm(createDefaultForm());
            }
          }}
        >
          <DialogContent className='max-w-2xl'>
            <DialogHeader>
              <DialogTitle>{editingRole ? '编辑角色' : '新增角色'}</DialogTitle>
              <DialogDescription>
                角色键建议使用英文标识，权限会自动补齐上级菜单节点。
              </DialogDescription>
            </DialogHeader>
            <form className='space-y-4' onSubmit={handleSubmit}>
              <div className='grid gap-2 md:grid-cols-2'>
                <div className='grid gap-2'>
                  <label className='text-sm font-medium'>角色键</label>
                  <Input
                    value={form.key}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        key: event.target.value
                      }))
                    }
                    placeholder='例如 operator_manager'
                    required
                  />
                </div>
                <div className='grid gap-2'>
                  <label className='text-sm font-medium'>角色名称</label>
                  <Input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value
                      }))
                    }
                    placeholder='例如 运营管理员'
                    required
                  />
                </div>
              </div>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>角色说明</label>
                <Textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value
                    }))
                  }
                  placeholder='描述这个角色负责的业务范围'
                />
              </div>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>绑定权限</label>
                <PermissionTreeSelector
                  tree={permissionTree}
                  value={form.permissionIds}
                  onChange={(permissionIds) =>
                    setForm((current) => ({ ...current, permissionIds }))
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
                    : editingRole
                      ? '保存修改'
                      : '创建角色'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title='删除角色'
        description={
          deletingRole
            ? `将删除角色 ${deletingRole.name}，已经绑定的权限关系也会一并清理。`
            : '删除后不可恢复。'
        }
        confirmLabel='确认删除'
        pending={deletePending}
        onConfirm={handleDelete}
      />
    </>
  );
}
