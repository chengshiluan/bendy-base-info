'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
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
import type {
  ImportedWorkspaceGithubUser,
  OptionItem,
  PaginationMeta,
  TeamSummary
} from '@/lib/platform/types';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { ManagementPagination } from './management-pagination';
import { OptionCheckboxGroup } from './option-checkbox-group';
import { TeamGithubMemberPickerDialog } from './team-github-member-picker-dialog';
import {
  buildPathWithQuery,
  getErrorMessage,
  requestJson
} from '../lib/client';

interface TeamsManagementClientProps {
  initialTeams: TeamSummary[];
  initialPagination: PaginationMeta;
  workspaceId?: string;
  memberOptions: OptionItem[];
}

type TeamFormState = {
  name: string;
  slug: string;
  description: string;
  leadUserId: string;
  memberIds: string[];
};

function createDefaultForm(): TeamFormState {
  return {
    name: '',
    slug: '',
    description: '',
    leadUserId: '',
    memberIds: []
  };
}

function buildMemberOptionLabel(user: {
  githubUsername: string;
  displayName: string | null;
}) {
  return `${user.displayName || user.githubUsername} (@${user.githubUsername})`;
}

function mergeMemberOptions(
  currentOptions: OptionItem[],
  importedUsers: ImportedWorkspaceGithubUser[]
) {
  const nextOptions = new Map(
    currentOptions.map((option) => [option.value, option] as const)
  );

  importedUsers.forEach((user) => {
    nextOptions.set(user.id, {
      value: user.id,
      label: buildMemberOptionLabel(user)
    });
  });

  return Array.from(nextOptions.values()).sort((left, right) =>
    left.label.localeCompare(right.label, 'zh-CN')
  );
}

function mergeMemberIds(
  currentIds: string[],
  importedUsers: ImportedWorkspaceGithubUser[]
) {
  return Array.from(
    new Set([...currentIds, ...importedUsers.map((user) => user.id)])
  );
}

export function TeamsManagementClient({
  initialTeams,
  initialPagination,
  workspaceId,
  memberOptions
}: TeamsManagementClientProps) {
  const [teams, setTeams] = useState(initialTeams);
  const [pagination, setPagination] = useState(initialPagination);
  const [page, setPage] = useState(initialPagination.page);
  const [availableMemberOptions, setAvailableMemberOptions] =
    useState(memberOptions);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [githubPickerOpen, setGithubPickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [listPending, setListPending] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamSummary | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<TeamSummary | null>(null);
  const [form, setForm] = useState<TeamFormState>(createDefaultForm());

  async function refreshTeams() {
    if (!workspaceId) {
      return;
    }

    const data = await requestJson<{
      teams: TeamSummary[];
      pagination: PaginationMeta;
    }>(
      buildPathWithQuery('/api/admin/teams', {
        workspaceId,
        page,
        search: debouncedSearch
      })
    );
    setTeams(data.teams);
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

    async function loadTeams() {
      setListPending(true);

      try {
        const data = await requestJson<{
          teams: TeamSummary[];
          pagination: PaginationMeta;
        }>(
          buildPathWithQuery('/api/admin/teams', {
            workspaceId,
            page,
            search: debouncedSearch
          })
        );

        if (cancelled) {
          return;
        }

        setTeams(data.teams);
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

    void loadTeams();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, page, workspaceId]);

  function openCreateDialog() {
    setEditingTeam(null);
    setForm(createDefaultForm());
    setGithubPickerOpen(false);
    setDialogOpen(true);
  }

  function openEditDialog(team: TeamSummary) {
    setEditingTeam(team);
    setForm({
      name: team.name,
      slug: team.slug ?? '',
      description: team.description,
      leadUserId: team.leadUserId ?? '',
      memberIds: team.memberIds ?? []
    });
    setGithubPickerOpen(false);
    setDialogOpen(true);
  }

  function handleGithubMembersImported(
    importedUsers: ImportedWorkspaceGithubUser[]
  ) {
    setAvailableMemberOptions((current) =>
      mergeMemberOptions(current, importedUsers)
    );
    setForm((current) => ({
      ...current,
      memberIds: mergeMemberIds(current.memberIds, importedUsers)
    }));
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
        ...form,
        leadUserId: form.leadUserId || null
      };

      if (editingTeam) {
        await requestJson(`/api/admin/teams/${editingTeam.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        toast.success('团队已更新。');
      } else {
        await requestJson('/api/admin/teams', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        toast.success('团队已创建。');
      }

      await refreshTeams();
      setDialogOpen(false);
      setGithubPickerOpen(false);
      setForm(createDefaultForm());
      setEditingTeam(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitPending(false);
    }
  }

  async function handleDelete() {
    if (!deletingTeam || !workspaceId) {
      return;
    }

    setDeletePending(true);

    try {
      await requestJson(
        `/api/admin/teams/${deletingTeam.id}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE'
        }
      );
      toast.success('团队已删除。');
      await refreshTeams();
      setDeleteOpen(false);
      setDeletingTeam(null);
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
          <CardTitle>团队列表</CardTitle>
          <CardDescription>
            请先选择一个工作区，再进行团队维护。
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
            <CardTitle>团队列表</CardTitle>
            <CardDescription>
              团队负责承接工作区内的成员分组、负责人配置和协作分工。
            </CardDescription>
          </div>
          <div className='flex w-full flex-col gap-3 md:w-auto md:flex-row'>
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder='搜索团队名 / 标识 / 负责人'
              className='md:w-80'
            />
            <Button onClick={openCreateDialog}>新增团队</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>团队名称</TableHead>
                <TableHead>标识</TableHead>
                <TableHead>负责人</TableHead>
                <TableHead>成员数</TableHead>
                <TableHead>说明</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className='font-medium'>{team.name}</TableCell>
                  <TableCell>{team.slug || '-'}</TableCell>
                  <TableCell>
                    <Badge variant='outline'>{team.lead || '待配置'}</Badge>
                  </TableCell>
                  <TableCell>{team.memberCount}</TableCell>
                  <TableCell className='max-w-md whitespace-normal'>
                    {team.description}
                  </TableCell>
                  <TableCell>
                    <div className='flex gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => openEditDialog(team)}
                      >
                        编辑
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          setDeletingTeam(team);
                          setDeleteOpen(true);
                        }}
                      >
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!teams.length && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className='text-muted-foreground py-10 text-center'
                  >
                    当前没有匹配的团队记录。
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
          setDialogOpen(open);
          if (!open) {
            setGithubPickerOpen(false);
            setEditingTeam(null);
            setForm(createDefaultForm());
          }
        }}
      >
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>{editingTeam ? '编辑团队' : '新增团队'}</DialogTitle>
            <DialogDescription>
              团队支持负责人配置和成员绑定，标识可以留空自动生成。
            </DialogDescription>
          </DialogHeader>
          <form className='space-y-4' onSubmit={handleSubmit}>
            <div className='grid gap-2 md:grid-cols-2'>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>团队名称</label>
                <Input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                  placeholder='例如 平台运营组'
                  required
                />
              </div>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>团队标识</label>
                <Input
                  value={form.slug}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      slug: event.target.value
                    }))
                  }
                  placeholder='留空时按团队名称生成'
                />
              </div>
            </div>
            <div className='grid gap-2'>
              <label className='text-sm font-medium'>团队说明</label>
              <Textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value
                  }))
                }
                placeholder='描述这个团队主要负责的工作'
              />
            </div>
            <div className='grid gap-2'>
              <label className='text-sm font-medium'>负责人</label>
              <Select
                value={form.leadUserId || 'none'}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    leadUserId: value === 'none' ? '' : value
                  }))
                }
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='请选择负责人' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>暂不设置</SelectItem>
                  {availableMemberOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='grid gap-2'>
              <div className='flex items-center justify-between gap-3'>
                <label className='text-sm font-medium'>团队成员</label>
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  onClick={() => setGithubPickerOpen(true)}
                  aria-label='从 GitHub 添加团队成员'
                  title='从 GitHub 添加团队成员'
                >
                  <Plus />
                </Button>
              </div>
              <OptionCheckboxGroup
                options={availableMemberOptions}
                value={form.memberIds}
                onChange={(memberIds) =>
                  setForm((current) => ({ ...current, memberIds }))
                }
                emptyLabel='当前工作区还没有可绑定的成员。'
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
                  : editingTeam
                    ? '保存修改'
                    : '创建团队'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {workspaceId ? (
        <TeamGithubMemberPickerDialog
          open={githubPickerOpen}
          onOpenChange={setGithubPickerOpen}
          workspaceId={workspaceId}
          onImported={handleGithubMembersImported}
        />
      ) : null}

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title='删除团队'
        description={
          deletingTeam
            ? `将删除团队 ${deletingTeam.name}，相关成员绑定也会一并清理。`
            : '删除后不可恢复。'
        }
        confirmLabel='确认删除'
        pending={deletePending}
        onConfirm={handleDelete}
      />
    </>
  );
}
