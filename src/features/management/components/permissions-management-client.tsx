'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  filterPermissionTree,
  flattenPermissionTree
} from '@/lib/platform/permission-tree';
import type {
  PermissionMenuOption,
  PermissionTreeNode,
  RoleSummary
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
    .filter((node) => node.children.length > 0)
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

function InfoRow({
  label,
  value,
  mono
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className='flex items-start gap-4 px-4 py-3'>
      <span className='text-muted-foreground w-14 shrink-0 pt-px text-xs'>
        {label}
      </span>
      <span
        className={cn(
          'flex-1 break-all text-[13px]',
          mono
            ? 'rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-foreground/80'
            : 'font-medium'
        )}
      >
        {value}
      </span>
    </div>
  );
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
  const [appliedSearch, setAppliedSearch] = useState('');
  const [expandedCodes, setExpandedCodes] = useState<string[]>(() =>
    getExpandableCodes(initialPermissionTree)
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [listPending, setListPending] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPermission, setEditingPermission] =
    useState<PermissionTreeNode | null>(null);
  const [form, setForm] = useState<PermissionFormState>(createDefaultForm());
  const [submitPending, setSubmitPending] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingPermission, setDeletingPermission] =
    useState<PermissionTreeNode | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeletePending, setBatchDeletePending] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailNode, setDetailNode] = useState<PermissionTreeNode | null>(null);
  const [sheetTab, setSheetTab] = useState('info');
  const [bindings, setBindings] = useState<RoleSummary[]>([]);
  const [bindingsPending, setBindingsPending] = useState(false);

  useEffect(() => {
    setPermissionTree(initialPermissionTree);
    setParentMenuOptions(menuOptions);
    setExpandedCodes(getExpandableCodes(initialPermissionTree));
  }, [initialPermissionTree, menuOptions]);

  const filteredTree = useMemo(
    () => filterPermissionTree(permissionTree, appliedSearch),
    [permissionTree, appliedSearch]
  );

  const allVisibleNodes = useMemo(
    () => flattenPermissionTree(filteredTree),
    [filteredTree]
  );

  const expandedSet = useMemo(() => new Set(expandedCodes), [expandedCodes]);

  const selectedParent = useMemo(
    () => parentMenuOptions.find((opt) => opt.value === form.parentCode),
    [form.parentCode, parentMenuOptions]
  );

  const deletableNodeIds = useMemo(
    () => new Set(allVisibleNodes.filter((n) => !n.isSystem).map((n) => n.id)),
    [allVisibleNodes]
  );

  const allDeletableSelected = useMemo(
    () =>
      deletableNodeIds.size > 0 &&
      Array.from(deletableNodeIds).every((id) => selectedIds.has(id)),
    [deletableNodeIds, selectedIds]
  );

  function toggleSelectAll() {
    if (allDeletableSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deletableNodeIds));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function refreshPermissions() {
    if (!workspaceId) return;
    setListPending(true);
    try {
      const data = await requestJson<{
        permissions: PermissionTreeNode[];
        menuOptions: PermissionMenuOption[];
      }>(buildPathWithQuery('/api/admin/permissions', { workspaceId }));
      setPermissionTree(data.permissions);
      setParentMenuOptions(data.menuOptions);
      setExpandedCodes(getExpandableCodes(data.permissions));
      setSelectedIds(new Set());
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
    if (!access.canCreate) return;
    setEditingPermission(null);
    setForm(createDefaultForm(parentCode, permissionType));
    setDialogOpen(true);
  }

  function openEditDialog(node: PermissionTreeNode) {
    if (!access.canUpdate || node.isSystem) return;
    setEditingPermission(node);
    setForm({
      name: node.name,
      code: node.code,
      permissionType: node.permissionType,
      parentCode: node.parentCode ?? '',
      route: node.route ?? '',
      sortOrder: node.sortOrder,
      description: node.description ?? ''
    });
    setDialogOpen(true);
  }

  function openDetailSheet(node: PermissionTreeNode) {
    setDetailNode(node);
    setSheetTab('info');
    setBindings([]);
    setSheetOpen(true);
  }

  async function loadBindings(node: PermissionTreeNode) {
    if (!workspaceId) return;
    setBindingsPending(true);
    try {
      const data = await requestJson<{ roles: RoleSummary[] }>(
        buildPathWithQuery(`/api/admin/permissions/${node.id}/bindings`, {
          workspaceId
        })
      );
      setBindings(data.roles);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBindingsPending(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) {
      toast.error('当前没有可操作的工作区。');
      return;
    }
    setSubmitPending(true);
    try {
      if (editingPermission) {
        await requestJson(
          `/api/admin/permissions/${editingPermission.id}?workspaceId=${workspaceId}`,
          { method: 'PUT', body: JSON.stringify(form) }
        );
        toast.success('权限节点已更新。');
      } else {
        await requestJson(`/api/admin/permissions?workspaceId=${workspaceId}`, {
          method: 'POST',
          body: JSON.stringify(form)
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
    if (!deletingPermission || !workspaceId) return;
    setDeletePending(true);
    try {
      await requestJson(
        `/api/admin/permissions/${deletingPermission.id}?workspaceId=${workspaceId}`,
        { method: 'DELETE' }
      );
      toast.success('权限节点已删除。');
      if (detailNode?.id === deletingPermission.id) {
        setSheetOpen(false);
        setDetailNode(null);
      }
      await refreshPermissions();
      setDeleteOpen(false);
      setDeletingPermission(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletePending(false);
    }
  }

  async function handleBatchDelete() {
    if (!workspaceId || selectedIds.size === 0) return;
    setBatchDeletePending(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          requestJson(
            `/api/admin/permissions/${id}?workspaceId=${workspaceId}`,
            { method: 'DELETE' }
          )
        )
      );
      toast.success(`已删除 ${selectedIds.size} 个自定义权限节点。`);
      await refreshPermissions();
      setBatchDeleteOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBatchDeletePending(false);
    }
  }

  if (!workspaceId) {
    return (
      <div className='text-muted-foreground rounded-lg border border-dashed p-12 text-center text-sm'>
        请先选择一个工作区，再查看当前系统的功能权限树。
      </div>
    );
  }

  function renderNode(node: PermissionTreeNode, depth = 0): React.ReactNode {
    const hasChildren = node.children.length > 0;
    const isExpanded = appliedSearch ? true : expandedSet.has(node.code);
    const isSelected = selectedIds.has(node.id);
    const canDelete = !node.isSystem && access.canDelete;

    return (
      <div key={node.id}>
        <div
          className={cn(
            'group flex h-9 items-center gap-1.5 rounded px-2 text-sm transition-colors hover:bg-muted/50',
            node.isSystem && 'opacity-70'
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <button
            type='button'
            className='text-muted-foreground flex size-4 shrink-0 items-center justify-center'
            onClick={() => {
              if (hasChildren) {
                setExpandedCodes((prev) =>
                  prev.includes(node.code)
                    ? prev.filter((c) => c !== node.code)
                    : [...prev, node.code]
                );
              }
            }}
            tabIndex={-1}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className='size-3.5' />
              ) : (
                <ChevronRight className='size-3.5' />
              )
            ) : (
              <span className='bg-muted-foreground/30 mx-auto block size-1 rounded-full' />
            )}
          </button>

          <Checkbox
            className='shrink-0'
            checked={isSelected}
            disabled={!canDelete}
            onCheckedChange={() => {
              if (canDelete) toggleSelect(node.id);
            }}
          />

          <button
            type='button'
            className='flex min-w-0 flex-1 items-center gap-2 text-left'
            onClick={() => openDetailSheet(node)}
          >
            <span className='truncate font-medium'>{node.name}</span>
            <Badge variant='outline' className='shrink-0 px-1.5 py-0 text-[10px]'>
              {node.permissionType === 'menu' ? '菜单' : '按钮'}
            </Badge>
            {node.isSystem ? (
              <Badge
                variant='secondary'
                className='shrink-0 px-1.5 py-0 text-[10px]'
              >
                内置
              </Badge>
            ) : null}
            <span className='text-muted-foreground ml-1 truncate text-xs'>
              {node.code}
            </span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className='size-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100'
                tabIndex={-1}
              >
                <MoreHorizontal className='size-3.5' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onClick={() => openDetailSheet(node)}>
                详情
              </DropdownMenuItem>
              {access.canCreate &&
              node.permissionType === 'menu' &&
              !node.isVirtual ? (
                <DropdownMenuItem
                  onClick={() => openCreateDialog(node.code, 'action')}
                >
                  新增下级
                </DropdownMenuItem>
              ) : null}
              {access.canUpdate && !node.isSystem ? (
                <DropdownMenuItem onClick={() => openEditDialog(node)}>
                  编辑
                </DropdownMenuItem>
              ) : null}
              {access.canDelete && !node.isSystem ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className='text-destructive focus:text-destructive'
                    onClick={() => {
                      setDeletingPermission(node);
                      setDeleteOpen(true);
                    }}
                  >
                    删除
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {hasChildren && isExpanded ? (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {/* toolbar */}
      <div className='mb-4 flex items-center gap-2'>
        <div className='flex flex-1 items-center gap-2'>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setAppliedSearch(search);
            }}
            placeholder='搜索名称、编码、路由'
            className='h-10 max-w-64'
          />
          <Button
            type='button'
            variant='outline'
            className='h-10'
            onClick={() => setAppliedSearch(search)}
          >
            搜索
          </Button>
        </div>

        {selectedIds.size > 0 && access.canDelete ? (
          <Button
            type='button'
            variant='destructive'
            className='h-10 gap-1.5'
            onClick={() => setBatchDeleteOpen(true)}
          >
            <Trash2 className='size-4' />
            删除（{selectedIds.size}）
          </Button>
        ) : null}

        {access.canCreate ? (
          <Button
            type='button'
            className='h-10 gap-1.5'
            onClick={() => openCreateDialog()}
            disabled={listPending}
          >
            {listPending ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <Plus className='size-4' />
            )}
            新增
          </Button>
        ) : null}
      </div>

      {/* tree header row */}
      <div className='mb-1 flex h-8 items-center gap-1.5 px-2'>
        <span className='flex size-4 shrink-0 items-center justify-center'>
          <Checkbox
            className='size-3.5'
            checked={allDeletableSelected}
            disabled={deletableNodeIds.size === 0}
            onCheckedChange={toggleSelectAll}
          />
        </span>
        <span className='text-muted-foreground ml-1.5 text-xs'>权限节点</span>
      </div>

      {/* tree body */}
      <div className='rounded-md border'>
        {filteredTree.length > 0 ? (
          <div className='py-1'>
            {filteredTree.map((node) => renderNode(node))}
          </div>
        ) : (
          <div className='text-muted-foreground py-12 text-center text-sm'>
            暂无数据
          </div>
        )}
      </div>

      {/* detail sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className='flex min-w-[480px] flex-col gap-0 p-0 sm:max-w-lg'>
          {/* header */}
          <SheetHeader className='border-b px-6 py-5'>
            <div className='flex items-start gap-3 pr-6'>
              <div className='min-w-0 flex-1'>
                <SheetTitle className='text-base font-semibold tracking-tight'>
                  {detailNode?.name ?? '权限详情'}
                </SheetTitle>
                <SheetDescription className='mt-1 break-all font-mono text-[11px] leading-relaxed'>
                  {detailNode?.code}
                </SheetDescription>
              </div>
              <div className='flex shrink-0 flex-wrap gap-1 pt-0.5'>
                {detailNode?.isSystem ? (
                  <Badge variant='secondary' className='px-2 py-0.5 text-[10px]'>
                    系统内置
                  </Badge>
                ) : null}
                <Badge variant='outline' className='px-2 py-0.5 text-[10px]'>
                  {detailNode?.permissionType === 'menu' ? '菜单' : '按钮'}
                </Badge>
              </div>
            </div>
          </SheetHeader>

          {detailNode ? (
            <div className='flex min-h-0 flex-1 flex-col'>
              {/* tabs bar */}
              <div className='border-b px-6 pt-3'>
                <Tabs
                  value={sheetTab}
                  onValueChange={(v) => {
                    setSheetTab(v);
                    if (
                      v === 'bindings' &&
                      bindings.length === 0 &&
                      !bindingsPending
                    ) {
                      void loadBindings(detailNode);
                    }
                  }}
                >
                  <TabsList className='h-8 gap-0 rounded-none bg-transparent p-0'>
                    {(['info', 'children', 'bindings'] as const).map((val) => (
                      <TabsTrigger
                        key={val}
                        value={val}
                        className='h-8 rounded-none border-b-2 border-transparent px-4 text-sm data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none'
                      >
                        {val === 'info' ? '基本信息' : val === 'children' ? '子节点' : '绑定角色'}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {/* scrollable content */}
                  <div className='overflow-y-auto pb-10 pt-2'>
                    <TabsContent value='info' className='mt-0'>
                      {/* identity group */}
                      <div className='py-2'>
                        <p className='px-6 pb-1 pt-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground'>
                          标识
                        </p>
                        <div className='divide-y divide-border/60'>
                          <InfoRow label='名称' value={detailNode.name} />
                          <InfoRow label='编码' value={detailNode.code} mono />
                          <InfoRow
                            label='类型'
                            value={detailNode.permissionType === 'menu' ? '菜单' : '按钮'}
                          />
                          <InfoRow
                            label='来源'
                            value={detailNode.isSystem ? '系统内置' : '自定义'}
                          />
                        </div>
                      </div>

                      <div className='mx-6 border-t border-border/50' />

                      {/* config group */}
                      <div className='py-2'>
                        <p className='px-6 pb-1 pt-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground'>
                          配置
                        </p>
                        <div className='divide-y divide-border/60'>
                          <InfoRow
                            label='范围'
                            value={detailNode.scope === 'workspace' ? '工作区' : '全局'}
                          />
                          <InfoRow
                            label='路由'
                            value={detailNode.route ?? '继承上级菜单路由'}
                            mono
                          />
                          <InfoRow label='排序' value={String(detailNode.sortOrder)} />
                          <InfoRow
                            label='说明'
                            value={detailNode.description ?? '未填写说明'}
                          />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value='children' className='mt-0 pt-3'>
                      {detailNode.children.length === 0 ? (
                        <div className='text-muted-foreground py-12 text-center text-sm'>
                          暂无子节点
                        </div>
                      ) : (
                        <div className='mx-4 space-y-0.5'>
                          {detailNode.children.map((child) => (
                            <div
                              key={child.id}
                              className='flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted/50'
                            >
                              <Badge
                                variant='outline'
                                className='shrink-0 px-1.5 py-0 text-[10px]'
                              >
                                {child.permissionType === 'menu' ? '菜单' : '按钮'}
                              </Badge>
                              <span className='flex-1 truncate font-medium'>
                                {child.name}
                              </span>
                              <span className='text-muted-foreground truncate font-mono text-[11px]'>
                                {child.code}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value='bindings' className='mt-0 pt-3'>
                      {bindingsPending ? (
                        <div className='flex items-center justify-center py-12'>
                          <Loader2 className='text-muted-foreground size-5 animate-spin' />
                        </div>
                      ) : bindings.length === 0 ? (
                        <div className='text-muted-foreground py-12 text-center text-sm'>
                          暂无已绑定的角色
                        </div>
                      ) : (
                        <div className='mx-4 space-y-0.5'>
                          {bindings.map((role) => (
                            <div
                              key={role.id}
                              className='flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted/50'
                            >
                              <span className='flex-1 font-medium'>{role.name}</span>
                              {role.isSystem ? (
                                <Badge
                                  variant='secondary'
                                  className='shrink-0 px-1.5 py-0 text-[10px]'
                                >
                                  内置
                                </Badge>
                              ) : null}
                              <span className='text-muted-foreground font-mono text-[11px]'>
                                {role.key}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* create / edit dialog */}
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
                {editingPermission ? '编辑权限节点' : '新增权限节点'}
              </DialogTitle>
              <DialogDescription>
                菜单节点控制目录和路由，按钮节点控制最小功能权限。
              </DialogDescription>
            </DialogHeader>

            <form className='space-y-4' onSubmit={handleSubmit}>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>权限类型</label>
                <RadioGroup
                  value={form.permissionType}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      permissionType: value as PermissionFormState['permissionType']
                    }))
                  }
                  className='flex gap-6'
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
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder={
                      form.permissionType === 'menu'
                        ? '例如 客户管理'
                        : '例如 导出客户'
                    }
                    className='rounded-xl px-4'
                    required
                  />
                </div>
                <div className='grid gap-2'>
                  <label className='text-sm font-medium'>上级菜单</label>
                  <Select
                    value={form.parentCode || undefined}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, parentCode: value }))
                    }
                  >
                    <SelectTrigger className='w-full rounded-xl'>
                      <SelectValue placeholder='请选择上级菜单' />
                    </SelectTrigger>
                    <SelectContent>
                      {parentMenuOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
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
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, code: e.target.value }))
                    }
                    placeholder={
                      form.permissionType === 'menu'
                        ? '例如 dashboard.workspaces.customers.menu'
                        : '例如 dashboard.workspaces.customers.export'
                    }
                    className='rounded-xl px-4'
                    required
                  />
                </div>
                <div className='grid gap-2'>
                  <label className='text-sm font-medium'>排序</label>
                  <Input
                    type='number'
                    min={0}
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        sortOrder: Number(e.target.value || 0)
                      }))
                    }
                    className='rounded-xl px-4'
                  />
                </div>
              </div>

              {form.permissionType === 'menu' ? (
                <div className='grid gap-2'>
                  <label className='text-sm font-medium'>路由</label>
                  <Input
                    value={form.route}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, route: e.target.value }))
                    }
                    placeholder='例如 /dashboard/workspaces/customers'
                    className='rounded-xl px-4'
                    required
                  />
                </div>
              ) : (
                <div className='text-muted-foreground rounded-xl border border-dashed px-4 py-2 text-sm'>
                  按钮权限继承上级菜单路由：
                  <span className='ml-1 font-medium'>
                    {selectedParent?.route ?? '请先选择上级菜单'}
                  </span>
                </div>
              )}

              <div className='grid gap-2'>
                <label className='text-sm font-medium'>说明</label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value
                    }))
                  }
                  placeholder='说明这个权限节点在页面上控制什么功能'
                  className='rounded-2xl px-4 py-3'
                />
              </div>

              <DialogFooter className='border-t pt-4'>
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

      {/* single delete */}
      {access.canDelete ? (
        <ConfirmActionDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title='删除权限节点'
          description={
            deletingPermission
              ? `将删除权限 ${deletingPermission.code} 以及其下自定义子节点，相关角色绑定也会一并清理。`
              : '删除后不可恢复。'
          }
          confirmLabel='确认删除'
          pending={deletePending}
          onConfirm={handleDelete}
        />
      ) : null}

      {/* batch delete */}
      {access.canDelete ? (
        <ConfirmActionDialog
          open={batchDeleteOpen}
          onOpenChange={setBatchDeleteOpen}
          title='批量删除权限节点'
          description={`将删除已选中的 ${selectedIds.size} 个自定义权限节点，相关角色绑定也会一并清理。`}
          confirmLabel='确认删除'
          pending={batchDeletePending}
          onConfirm={handleBatchDelete}
        />
      ) : null}
    </>
  );
}
