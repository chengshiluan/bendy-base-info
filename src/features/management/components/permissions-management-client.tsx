'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  filterPermissionTree,
  flattenPermissionTree
} from '@/lib/platform/permission-tree';
import type {
  PermissionMenuOption,
  PermissionTreeNode
} from '@/lib/platform/types';
import { cn } from '@/lib/utils';
import { ConfirmActionDialog } from './confirm-action-dialog';
import {
  buildPathWithQuery,
  getErrorMessage,
  requestJson
} from '../lib/client';

interface PermissionsManagementClientProps {
  initialPermissionTree: PermissionTreeNode[];
  menuOptions: PermissionMenuOption[];
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
  permissionType: 'menu' | 'action';
  parentCode: string;
  route: string;
  sortOrder: number;
  description: string;
};

function getExpandableCodes(nodes: PermissionTreeNode[]) {
  return flattenPermissionTree(nodes)
    .filter((node) => node.children.length)
    .map((node) => node.code);
}

function createDefaultForm(
  parentCode = '',
  permissionType: PermissionFormState['permissionType'] = 'action'
): PermissionFormState {
  return {
    name: '',
    code: '',
    permissionType,
    parentCode,
    route: '',
    sortOrder: 0,
    description: ''
  };
}

export function PermissionsManagementClient({
  initialPermissionTree,
  menuOptions,
  workspaceId,
  access
}: PermissionsManagementClientProps) {
  const [permissionTree, setPermissionTree] = useState(initialPermissionTree);
  const [parentMenuOptions, setParentMenuOptions] = useState(menuOptions);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [listPending, setListPending] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [editingPermission, setEditingPermission] =
    useState<PermissionTreeNode | null>(null);
  const [deletingPermission, setDeletingPermission] =
    useState<PermissionTreeNode | null>(null);
  const [form, setForm] = useState<PermissionFormState>(createDefaultForm());
  const [expandedCodes, setExpandedCodes] = useState<string[]>(() =>
    getExpandableCodes(initialPermissionTree)
  );

  useEffect(() => {
    setPermissionTree(initialPermissionTree);
    setParentMenuOptions(menuOptions);
    setExpandedCodes(getExpandableCodes(initialPermissionTree));
  }, [initialPermissionTree, menuOptions]);

  const filteredTree = useMemo(
    () => filterPermissionTree(permissionTree, search),
    [permissionTree, search]
  );
  const visibleExpandableCodes = useMemo(
    () => getExpandableCodes(filteredTree),
    [filteredTree]
  );
  const expandedSet = useMemo(() => new Set(expandedCodes), [expandedCodes]);
  const selectedParent = useMemo(
    () => parentMenuOptions.find((option) => option.value === form.parentCode),
    [form.parentCode, parentMenuOptions]
  );

  async function refreshPermissions() {
    if (!workspaceId) {
      return;
    }

    setListPending(true);

    try {
      const data = await requestJson<{
        permissions: PermissionTreeNode[];
        menuOptions: PermissionMenuOption[];
      }>(
        buildPathWithQuery('/api/admin/permissions', {
          workspaceId
        })
      );

      setPermissionTree(data.permissions);
      setParentMenuOptions(data.menuOptions);
      setExpandedCodes(getExpandableCodes(data.permissions));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setListPending(false);
    }
  }

  function openCreateDialog(
    parentCode = '',
    permissionType: PermissionFormState['permissionType'] = 'action'
  ) {
    if (!access.canCreate) {
      return;
    }

    setEditingPermission(null);
    setForm(createDefaultForm(parentCode, permissionType));
    setDialogOpen(true);
  }

  function openEditDialog(permission: PermissionTreeNode) {
    if (!access.canUpdate || permission.isSystem) {
      return;
    }

    setEditingPermission(permission);
    setForm({
      name: permission.name,
      code: permission.code,
      permissionType: permission.permissionType,
      parentCode: permission.parentCode ?? '',
      route: permission.route ?? '',
      sortOrder: permission.sortOrder,
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
        ...form
      };

      if (editingPermission) {
        await requestJson(
          `/api/admin/permissions/${editingPermission.id}?workspaceId=${workspaceId}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload)
          }
        );
        toast.success('权限节点已更新。');
      } else {
        await requestJson(`/api/admin/permissions?workspaceId=${workspaceId}`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        toast.success('权限节点已创建。');
      }

      await refreshPermissions();
      setDialogOpen(false);
      setEditingPermission(null);
      setForm(createDefaultForm());
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
      toast.success('权限节点已删除。');
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
          <CardTitle>权限树</CardTitle>
          <CardDescription>
            请先选择一个工作区，再查看当前系统的功能权限树。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const canManageAny = access.canUpdate || access.canDelete || access.canCreate;

  const toggleExpanded = (code: string) => {
    setExpandedCodes((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code]
    );
  };

  const renderNode = (node: PermissionTreeNode, depth = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = search ? true : expandedSet.has(node.code);

    return (
      <div key={node.id} className='space-y-2'>
        <div
          className={cn(
            'hover:bg-muted/40 grid gap-3 rounded-lg border px-3 py-3 lg:grid-cols-[minmax(320px,1.5fr)_minmax(220px,1fr)_minmax(160px,0.7fr)_minmax(220px,1fr)_auto]',
            node.isSystem && 'bg-muted/20'
          )}
          style={{ marginLeft: depth * 18 }}
        >
          <div className='flex min-w-0 items-start gap-3'>
            <button
              type='button'
              className='text-muted-foreground mt-0.5 flex size-5 items-center justify-center'
              onClick={() => {
                if (hasChildren) {
                  toggleExpanded(node.code);
                }
              }}
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className='size-4' />
                ) : (
                  <ChevronRight className='size-4' />
                )
              ) : null}
            </button>
            <div className='min-w-0 space-y-1'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='font-medium'>{node.name}</span>
                <Badge variant='outline'>
                  {node.permissionType === 'menu' ? '菜单' : '按钮'}
                </Badge>
                {node.isSystem ? (
                  <Badge variant='secondary'>系统内置</Badge>
                ) : null}
              </div>
              <div className='text-muted-foreground text-xs'>
                {node.pathLabel}
              </div>
              <div className='text-muted-foreground text-xs break-all'>
                {node.code}
              </div>
            </div>
          </div>

          <div className='space-y-1 text-sm'>
            <div className='font-medium'>路由</div>
            <div className='text-muted-foreground break-all'>
              {node.route || '按钮继承上级菜单路由'}
            </div>
          </div>

          <div className='space-y-1 text-sm'>
            <div className='font-medium'>排序 / 范围</div>
            <div className='text-muted-foreground flex flex-wrap items-center gap-2'>
              <span>{node.sortOrder}</span>
              <Badge variant='outline'>
                {node.scope === 'workspace' ? '工作区' : '全局'}
              </Badge>
            </div>
          </div>

          <div className='space-y-1 text-sm'>
            <div className='font-medium'>说明</div>
            <div className='text-muted-foreground whitespace-pre-wrap'>
              {node.description || '未填写说明'}
            </div>
          </div>

          {canManageAny ? (
            <div className='flex flex-wrap items-start justify-end gap-2'>
              {access.canCreate &&
              node.permissionType === 'menu' &&
              node.scope === 'workspace' &&
              !node.isVirtual ? (
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => openCreateDialog(node.code, 'action')}
                >
                  新增下级
                </Button>
              ) : null}
              {access.canUpdate && !node.isSystem ? (
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => openEditDialog(node)}
                >
                  编辑
                </Button>
              ) : null}
              {access.canDelete && !node.isSystem ? (
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    setDeletingPermission(node);
                    setDeleteOpen(true);
                  }}
                >
                  删除
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {hasChildren && isExpanded ? (
          <div className='space-y-2'>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
          <div>
            <CardTitle>权限树</CardTitle>
            <CardDescription>
              权限树就是系统的功能目录树。每一级菜单都落在权限表中，最小节点对应当前路由下的按钮权限。
            </CardDescription>
          </div>
          <div className='flex w-full flex-col gap-3 md:w-auto md:flex-row'>
            <div className='relative md:w-80'>
              <Search className='text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2' />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder='搜索菜单名、权限编码、路由'
                className='pl-9'
              />
            </div>
            <Button
              type='button'
              variant='outline'
              onClick={() => setExpandedCodes(visibleExpandableCodes)}
            >
              全部展开
            </Button>
            <Button
              type='button'
              variant='outline'
              onClick={() => setExpandedCodes([])}
              disabled={Boolean(search)}
            >
              全部收起
            </Button>
            {access.canCreate ? (
              <Button type='button' onClick={() => openCreateDialog()}>
                新增权限
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className='h-[720px] rounded-md border'>
            <div className='space-y-3 p-3'>
              {filteredTree.length ? (
                filteredTree.map((node) => renderNode(node))
              ) : (
                <div className='text-muted-foreground py-12 text-center text-sm'>
                  当前没有匹配的权限节点。
                </div>
              )}
            </div>
          </ScrollArea>
          {listPending ? (
            <div className='text-muted-foreground mt-3 text-sm'>
              刷新权限树中...
            </div>
          ) : null}
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
          <DialogContent className='max-w-3xl'>
            <DialogHeader>
              <DialogTitle>
                {editingPermission ? '编辑权限节点' : '新增权限节点'}
              </DialogTitle>
              <DialogDescription>
                权限节点必须挂在一个上级菜单下。菜单节点控制目录和路由，按钮节点控制当前页面下的最小功能权限。
              </DialogDescription>
            </DialogHeader>
            <form className='space-y-4' onSubmit={handleSubmit}>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>权限类型</label>
                <RadioGroup
                  value={form.permissionType}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      permissionType:
                        value as PermissionFormState['permissionType']
                    }))
                  }
                  className='flex flex-wrap gap-6'
                >
                  <label className='flex items-center gap-2 text-sm'>
                    <RadioGroupItem value='menu' />
                    菜单
                  </label>
                  <label className='flex items-center gap-2 text-sm'>
                    <RadioGroupItem value='action' />
                    按钮
                  </label>
                </RadioGroup>
              </div>

              <div className='grid gap-4 md:grid-cols-2'>
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
                    placeholder={
                      form.permissionType === 'menu'
                        ? '例如 客户管理'
                        : '例如 导出客户'
                    }
                    required
                  />
                </div>
                <div className='grid gap-2'>
                  <label className='text-sm font-medium'>上级菜单</label>
                  <Select
                    value={form.parentCode || undefined}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, parentCode: value }))
                    }
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='请选择上级菜单' />
                    </SelectTrigger>
                    <SelectContent>
                      {parentMenuOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className='grid gap-4 md:grid-cols-2'>
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
                    placeholder={
                      form.permissionType === 'menu'
                        ? '例如 dashboard.workspaces.customers.menu'
                        : '例如 dashboard.workspaces.customers.export'
                    }
                    required
                  />
                </div>
                <div className='grid gap-2'>
                  <label className='text-sm font-medium'>排序</label>
                  <Input
                    type='number'
                    min={0}
                    value={form.sortOrder}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        sortOrder: Number(event.target.value || 0)
                      }))
                    }
                  />
                </div>
              </div>

              {form.permissionType === 'menu' ? (
                <div className='grid gap-2'>
                  <label className='text-sm font-medium'>路由</label>
                  <Input
                    value={form.route}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        route: event.target.value
                      }))
                    }
                    placeholder='例如 /dashboard/workspaces/customers'
                    required
                  />
                </div>
              ) : (
                <div className='text-muted-foreground rounded-md border border-dashed px-3 py-2 text-sm'>
                  按钮权限会继承上级菜单路由：
                  <span className='ml-1 font-medium'>
                    {selectedParent?.route || '请先选择上级菜单'}
                  </span>
                </div>
              )}

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
                  placeholder='说明这个权限节点在页面上控制什么功能'
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
                      : '创建节点'}
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
          title='删除权限节点'
          description={
            deletingPermission
              ? `将删除权限 ${deletingPermission.code} 以及它下面的自定义子节点，相关角色绑定也会一并清理。`
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
