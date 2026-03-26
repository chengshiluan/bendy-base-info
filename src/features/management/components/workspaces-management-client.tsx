'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import type { PaginationMeta, WorkspaceSummary } from '@/lib/platform/types';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { ManagementPagination } from './management-pagination';
import {
  buildPathWithQuery,
  getErrorMessage,
  requestJson
} from '../lib/client';

interface WorkspacesManagementClientProps {
  initialWorkspaces: WorkspaceSummary[];
  initialPagination: PaginationMeta;
  initialMetrics: WorkspaceMetrics;
  canManage: boolean;
}

type WorkspaceMetrics = {
  total: number;
  active: number;
  archived: number;
};

type WorkspaceFormState = {
  name: string;
  slug: string;
  description: string;
  status: 'active' | 'archived';
};

const EMPTY_WORKSPACE_DESCRIPTION = '未填写工作区描述。';

function createDefaultForm(): WorkspaceFormState {
  return {
    name: '',
    slug: '',
    description: '',
    status: 'active'
  };
}

export function WorkspacesManagementClient({
  initialWorkspaces,
  initialPagination,
  initialMetrics,
  canManage
}: WorkspacesManagementClientProps) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState(initialWorkspaces);
  const [pagination, setPagination] = useState(initialPagination);
  const [page, setPage] = useState(initialPagination.page);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [listPending, setListPending] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [archivePending, setArchivePending] = useState(false);
  const [editingWorkspace, setEditingWorkspace] =
    useState<WorkspaceSummary | null>(null);
  const [archivingWorkspace, setArchivingWorkspace] =
    useState<WorkspaceSummary | null>(null);
  const [form, setForm] = useState<WorkspaceFormState>(createDefaultForm());

  async function refreshWorkspaces() {
    const data = await requestJson<{
      workspaces: WorkspaceSummary[];
      pagination: PaginationMeta;
      summary: WorkspaceMetrics;
    }>(
      buildPathWithQuery('/api/admin/workspaces', {
        page,
        search: debouncedSearch
      })
    );
    setWorkspaces(data.workspaces);
    setPagination(data.pagination);
    setMetrics(data.summary);
    if (data.pagination.page !== page) {
      setPage(data.pagination.page);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaces() {
      setListPending(true);

      try {
        const data = await requestJson<{
          workspaces: WorkspaceSummary[];
          pagination: PaginationMeta;
          summary: WorkspaceMetrics;
        }>(
          buildPathWithQuery('/api/admin/workspaces', {
            page,
            search: debouncedSearch
          })
        );

        if (cancelled) {
          return;
        }

        setWorkspaces(data.workspaces);
        setPagination(data.pagination);
        setMetrics(data.summary);
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

    void loadWorkspaces();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, page]);

  function openCreateDialog() {
    setEditingWorkspace(null);
    setForm(createDefaultForm());
    setDialogOpen(true);
  }

  function openEditDialog(workspace: WorkspaceSummary) {
    setEditingWorkspace(workspace);
    setForm({
      name: workspace.name,
      slug: workspace.slug,
      description:
        workspace.description === EMPTY_WORKSPACE_DESCRIPTION
          ? ''
          : workspace.description,
      status: workspace.status
    });
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage) {
      toast.error('当前仅超级管理员可以维护工作区。');
      return;
    }

    setSubmitPending(true);

    try {
      if (editingWorkspace) {
        await requestJson(`/api/admin/workspaces/${editingWorkspace.id}`, {
          method: 'PUT',
          body: JSON.stringify(form)
        });
        toast.success('工作区已更新。');
      } else {
        await requestJson('/api/admin/workspaces', {
          method: 'POST',
          body: JSON.stringify(form)
        });
        toast.success('工作区已创建。');
      }

      await refreshWorkspaces();
      router.refresh();
      setDialogOpen(false);
      setEditingWorkspace(null);
      setForm(createDefaultForm());
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitPending(false);
    }
  }

  async function handleArchive() {
    if (!canManage || !archivingWorkspace) {
      return;
    }

    setArchivePending(true);

    try {
      await requestJson(`/api/admin/workspaces/${archivingWorkspace.id}`, {
        method: 'DELETE'
      });
      toast.success('工作区已归档。');
      await refreshWorkspaces();
      router.refresh();
      setArchiveOpen(false);
      setArchivingWorkspace(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setArchivePending(false);
    }
  }

  const tableColumns = canManage ? 7 : 6;

  return (
    <>
      <div className='grid gap-4 md:grid-cols-3'>
        <Card>
          <CardHeader>
            <CardDescription>工作区总数</CardDescription>
            <CardTitle>{metrics.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>活跃工作区</CardDescription>
            <CardTitle>{metrics.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>已归档工作区</CardDescription>
            <CardTitle>{metrics.archived}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
          <div>
            <CardTitle>工作区列表</CardTitle>
            <CardDescription>
              {canManage
                ? '支持新增、编辑和归档工作区。归档后的工作区不会出现在工作区切换器中。'
                : '当前为只读模式。只有超级管理员可以新增、编辑和归档工作区。'}
            </CardDescription>
          </div>
          <div className='flex w-full flex-col gap-3 md:w-auto md:flex-row'>
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder='搜索工作区名称 / 标识 / 说明'
              className='md:w-80'
            />
            {canManage ? (
              <Button onClick={openCreateDialog}>新增工作区</Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>标识</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>团队数</TableHead>
                <TableHead>成员数</TableHead>
                <TableHead>说明</TableHead>
                {canManage ? <TableHead>操作</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspaces.map((workspace) => (
                <TableRow key={workspace.id}>
                  <TableCell>
                    <div className='flex flex-wrap items-center gap-2'>
                      <span className='font-medium'>{workspace.name}</span>
                      {workspace.isDefault ? (
                        <Badge variant='secondary'>默认</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{workspace.slug}</TableCell>
                  <TableCell>
                    <Badge variant='outline'>
                      {workspace.status === 'active' ? '启用中' : '已归档'}
                    </Badge>
                  </TableCell>
                  <TableCell>{workspace.teamCount}</TableCell>
                  <TableCell>{workspace.memberCount}</TableCell>
                  <TableCell className='max-w-md whitespace-normal'>
                    {workspace.description}
                  </TableCell>
                  {canManage ? (
                    <TableCell>
                      <div className='flex gap-2'>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => openEditDialog(workspace)}
                        >
                          编辑
                        </Button>
                        <Button
                          variant='outline'
                          size='sm'
                          disabled={
                            workspace.status === 'archived' ||
                            workspace.isDefault
                          }
                          onClick={() => {
                            setArchivingWorkspace(workspace);
                            setArchiveOpen(true);
                          }}
                        >
                          {workspace.isDefault
                            ? '默认工作区'
                            : workspace.status === 'archived'
                              ? '已归档'
                              : '归档'}
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
              {!workspaces.length ? (
                <TableRow>
                  <TableCell
                    colSpan={tableColumns}
                    className='text-muted-foreground py-10 text-center'
                  >
                    当前没有匹配的工作区记录。
                  </TableCell>
                </TableRow>
              ) : null}
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

      {canManage ? (
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingWorkspace(null);
              setForm(createDefaultForm());
            }
          }}
        >
          <DialogContent className='max-w-2xl'>
            <DialogHeader>
              <DialogTitle>
                {editingWorkspace ? '编辑工作区' : '新增工作区'}
              </DialogTitle>
              <DialogDescription>
                工作区是团队、成员、角色和工单等资源的顶层业务空间。
              </DialogDescription>
            </DialogHeader>
            <form className='space-y-4' onSubmit={handleSubmit}>
              <div className='grid gap-4 md:grid-cols-2'>
                <div className='grid gap-2'>
                  <label className='text-sm font-medium'>工作区名称</label>
                  <Input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value
                      }))
                    }
                    placeholder='例如 Bendywork Core'
                    required
                  />
                </div>
                <div className='grid gap-2'>
                  <label className='text-sm font-medium'>工作区标识</label>
                  <Input
                    value={form.slug}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        slug: event.target.value
                      }))
                    }
                    placeholder='留空时按工作区名称生成'
                  />
                </div>
              </div>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>工作区状态</label>
                <Select
                  value={form.status}
                  onValueChange={(value: 'active' | 'archived') =>
                    setForm((current) => ({ ...current, status: value }))
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='请选择工作区状态' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='active'>启用中</SelectItem>
                    {!editingWorkspace?.isDefault ? (
                      <SelectItem value='archived'>已归档</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>工作区说明</label>
                <Textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value
                    }))
                  }
                  placeholder='说明这个工作区承接的业务范围和管理边界'
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
                    : editingWorkspace
                      ? '保存修改'
                      : '创建工作区'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}

      {canManage ? (
        <ConfirmActionDialog
          open={archiveOpen}
          onOpenChange={setArchiveOpen}
          title='归档工作区'
          description={
            archivingWorkspace
              ? `将归档工作区 ${archivingWorkspace.name}。归档后它不会出现在工作区切换器中，但历史数据仍会保留。`
              : '归档后可通过编辑工作区重新启用。'
          }
          confirmLabel='确认归档'
          pending={archivePending}
          onConfirm={handleArchive}
        />
      ) : null}
    </>
  );
}
