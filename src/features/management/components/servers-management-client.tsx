'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { PaginationMeta } from '@/lib/platform/types';
import type {
  OpsServerDetail,
  OpsServerFactsSummary,
  OpsServerStatus,
  OpsServerSummary
} from '@/lib/server-management/types';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { ManagementPagination } from './management-pagination';

interface AccessFlags {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canCollect: boolean;
}

interface ServersManagementClientProps {
  workspaceId?: string;
  initialServers: OpsServerSummary[];
  initialPagination: PaginationMeta;
  access: AccessFlags;
}

type StatusFilter = OpsServerStatus | 'all';

const STATUS_LABELS: Record<OpsServerStatus, string> = {
  pending: '待采集',
  collecting: '采集中',
  healthy: '正常',
  unreachable: '不可达',
  disabled: '已停用'
};

const STATUS_VARIANT: Record<
  OpsServerStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  pending: 'secondary',
  collecting: 'secondary',
  healthy: 'default',
  unreachable: 'destructive',
  disabled: 'outline'
};

type FormState = {
  id: number | null;
  name: string;
  hostname: string;
  ip: string;
  sshPort: string;
  sshUser: string;
  authType: 'password' | 'private_key';
  secret: string;
  passphrase: string;
  keepSecret: boolean;
  keepPassphrase: boolean;
  remark: string;
};

function createEmptyForm(): FormState {
  return {
    id: null,
    name: '',
    hostname: '',
    ip: '',
    sshPort: '22',
    sshUser: 'root',
    authType: 'password',
    secret: '',
    passphrase: '',
    keepSecret: false,
    keepPassphrase: false,
    remark: ''
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return '操作失败，请稍后重试。';
}

export function ServersManagementClient({
  workspaceId,
  initialServers,
  initialPagination,
  access
}: ServersManagementClientProps) {
  const [servers, setServers] = useState<OpsServerSummary[]>(initialServers);
  const [pagination, setPagination] =
    useState<PaginationMeta>(initialPagination);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(createEmptyForm);

  const [detailServer, setDetailServer] = useState<OpsServerDetail | null>(
    null
  );
  const [detailTab, setDetailTab] = useState<'info' | 'facts' | 'history'>(
    'info'
  );
  const [historyFacts, setHistoryFacts] = useState<OpsServerFactsSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<OpsServerSummary | null>(
    null
  );
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);

  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasPendingWork = useMemo(
    () =>
      servers.some(
        (item) => item.status === 'pending' || item.status === 'collecting'
      ),
    [servers]
  );

  const fetchServers = useCallback(
    async (
      targetPage = pagination.page,
      keyword = searchKeyword,
      status: StatusFilter = statusFilter
    ) => {
      if (!workspaceId) return;
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('workspaceId', workspaceId);
        params.set('page', String(targetPage));
        params.set('pageSize', String(pagination.pageSize));
        if (keyword.trim()) params.set('search', keyword.trim());
        if (status !== 'all') params.set('status', status);
        const response = await fetch(
          `/api/admin/ops/servers?${params.toString()}`
        );
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            message?: string;
          };
          throw new Error(body.message ?? '加载失败。');
        }
        const data = (await response.json()) as {
          servers: OpsServerSummary[];
          pagination: PaginationMeta;
        };
        setServers(data.servers);
        setPagination(data.pagination);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [pagination.page, pagination.pageSize, searchKeyword, statusFilter, workspaceId]
  );

  useEffect(() => {
    if (!hasPendingWork || !workspaceId) {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      return;
    }
    if (pollingTimerRef.current) return;
    pollingTimerRef.current = setInterval(() => {
      void fetchServers();
    }, 3000);
    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [hasPendingWork, fetchServers, workspaceId]);

  const openCreateDialog = () => {
    setForm(createEmptyForm());
    setDialogOpen(true);
  };

  const openEditDialog = (server: OpsServerSummary) => {
    setForm({
      id: server.id,
      name: server.name,
      hostname: server.hostname ?? '',
      ip: server.ip,
      sshPort: String(server.sshPort),
      sshUser: server.sshUser,
      authType: server.authType,
      secret: '',
      passphrase: '',
      keepSecret: server.hasSecret,
      keepPassphrase: server.hasPassphrase,
      remark: server.remark ?? ''
    });
    setDialogOpen(true);
  };

  const submitForm = async () => {
    if (!workspaceId) {
      toast.error('未选择工作区。');
      return;
    }
    setMutating(true);
    try {
      const isEdit = form.id != null;
      const basePayload = {
        workspaceId,
        name: form.name,
        hostname: form.hostname.trim() || null,
        ip: form.ip,
        sshPort: Number(form.sshPort) || 22,
        sshUser: form.sshUser,
        authType: form.authType,
        secret: form.secret || null,
        passphrase: form.passphrase || null,
        remark: form.remark.trim() || null
      };
      const payload = isEdit
        ? {
            ...basePayload,
            keepSecret: form.keepSecret && !form.secret,
            keepPassphrase: form.keepPassphrase && !form.passphrase
          }
        : basePayload;

      const url = isEdit
        ? `/api/admin/ops/servers/${form.id}`
        : '/api/admin/ops/servers';
      const response = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(body.message ?? '保存失败。');
      }
      toast.success(isEdit ? '已保存修改。' : '已创建并触发采集。');
      setDialogOpen(false);
      await fetchServers(isEdit ? pagination.page : 1);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setMutating(false);
    }
  };

  const triggerCollect = async (server: OpsServerSummary) => {
    if (!workspaceId) return;
    try {
      const response = await fetch(
        `/api/admin/ops/servers/${server.id}/collect?workspaceId=${encodeURIComponent(workspaceId)}`,
        { method: 'POST' }
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(body.message ?? '触发失败。');
      }
      toast.success('已触发采集。');
      await fetchServers();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const deleteServer = async (server: OpsServerSummary) => {
    if (!workspaceId) return;
    setMutating(true);
    try {
      const response = await fetch(
        `/api/admin/ops/servers/${server.id}?workspaceId=${encodeURIComponent(workspaceId)}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(body.message ?? '删除失败。');
      }
      toast.success('已删除。');
      setConfirmDelete(null);
      await fetchServers();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setMutating(false);
    }
  };

  const deleteBatch = async () => {
    if (!workspaceId || !selectedIds.length) return;
    setMutating(true);
    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) =>
          fetch(
            `/api/admin/ops/servers/${id}?workspaceId=${encodeURIComponent(workspaceId)}`,
            { method: 'DELETE' }
          )
        )
      );
      const failed = results.filter(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)
      ).length;
      if (failed) {
        toast.error(`批量删除失败 ${failed} / ${selectedIds.length} 条。`);
      } else {
        toast.success('批量删除成功。');
      }
      setSelectedIds([]);
      setConfirmBatchDelete(false);
      await fetchServers();
    } finally {
      setMutating(false);
    }
  };

  const openDetail = async (server: OpsServerSummary) => {
    if (!workspaceId) return;
    try {
      const response = await fetch(
        `/api/admin/ops/servers/${server.id}?workspaceId=${encodeURIComponent(workspaceId)}`
      );
      if (!response.ok) throw new Error('加载详情失败。');
      const data = (await response.json()) as { server: OpsServerDetail };
      setDetailServer(data.server);
      setDetailTab('info');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const loadHistory = async () => {
    if (!detailServer || !workspaceId) return;
    setHistoryLoading(true);
    try {
      const response = await fetch(
        `/api/admin/ops/servers/${detailServer.id}/facts?workspaceId=${encodeURIComponent(workspaceId)}`
      );
      if (!response.ok) throw new Error('加载历史失败。');
      const data = (await response.json()) as {
        facts: OpsServerFactsSummary[];
      };
      setHistoryFacts(data.facts);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (detailTab === 'history' && detailServer) {
      void loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailTab, detailServer?.id]);

  const allSelected =
    servers.length > 0 && servers.every((s) => selectedIds.includes(s.id));

  if (!workspaceId) {
    return (
      <div className='rounded-2xl border border-dashed p-10 text-center text-muted-foreground'>
        请先选择一个工作区。
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/40 p-3'>
        <Input
          className='h-10 w-64 rounded-xl'
          placeholder='按名称 / IP / 主机名搜索'
          value={searchKeyword}
          onChange={(event) => setSearchKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void fetchServers(1);
          }}
        />
        <Select
          value={statusFilter}
          onValueChange={(value: StatusFilter) => {
            setStatusFilter(value);
            void fetchServers(1, searchKeyword, value);
          }}
        >
          <SelectTrigger className='h-10 w-36 rounded-xl'>
            <SelectValue placeholder='状态' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>全部状态</SelectItem>
            {(Object.keys(STATUS_LABELS) as OpsServerStatus[]).map((key) => (
              <SelectItem key={key} value={key}>
                {STATUS_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant='outline'
          className='h-10 rounded-xl'
          onClick={() => void fetchServers(1)}
          disabled={loading}
        >
          搜索
        </Button>
        <div className='ml-auto flex items-center gap-2'>
          {access.canDelete && selectedIds.length > 0 && (
            <Button
              variant='destructive'
              className='h-10 rounded-xl'
              onClick={() => setConfirmBatchDelete(true)}
            >
              <Trash2 className='mr-1 size-4' /> 删除 {selectedIds.length}
            </Button>
          )}
          {access.canCreate && (
            <Button className='h-10 rounded-xl' onClick={openCreateDialog}>
              <Plus className='mr-1 size-4' /> 新增
            </Button>
          )}
        </div>
      </div>

      <div className='rounded-2xl border border-border/60 bg-background/40'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-10'>
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedIds(servers.map((s) => s.id));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                />
              </TableHead>
              <TableHead>名称</TableHead>
              <TableHead>主机名</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>端口</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>最近采集</TableHead>
              <TableHead className='text-right'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {servers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className='py-12 text-center text-muted-foreground'
                >
                  {loading ? '加载中…' : '暂无服务器数据。'}
                </TableCell>
              </TableRow>
            )}
            {servers.map((server) => {
              const isSelected = selectedIds.includes(server.id);
              return (
                <TableRow key={server.id}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        setSelectedIds((prev) =>
                          checked
                            ? Array.from(new Set([...prev, server.id]))
                            : prev.filter((id) => id !== server.id)
                        );
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      className='font-medium text-primary hover:underline'
                      onClick={() => void openDetail(server)}
                    >
                      {server.name}
                    </button>
                  </TableCell>
                  <TableCell className='text-muted-foreground'>
                    {server.hostname ?? '-'}
                  </TableCell>
                  <TableCell>{server.ip}</TableCell>
                  <TableCell>{server.sshPort}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[server.status]}>
                      {server.status === 'collecting' && (
                        <Loader2 className='mr-1 size-3 animate-spin' />
                      )}
                      {STATUS_LABELS[server.status]}
                    </Badge>
                    {server.collectError && (
                      <div className='mt-1 text-xs text-destructive'>
                        {server.collectError}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className='text-muted-foreground'>
                    {server.lastCollectedAt
                      ? new Date(server.lastCollectedAt).toLocaleString()
                      : '-'}
                  </TableCell>
                  <TableCell className='space-x-1 text-right'>
                    {access.canCollect && (
                      <Button
                        variant='ghost'
                        size='sm'
                        disabled={server.status === 'collecting'}
                        onClick={() => void triggerCollect(server)}
                      >
                        <RefreshCw className='mr-1 size-3.5' /> 采集
                      </Button>
                    )}
                    {access.canUpdate && (
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => openEditDialog(server)}
                      >
                        编辑
                      </Button>
                    )}
                    {access.canDelete && (
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => setConfirmDelete(server)}
                      >
                        删除
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className='px-4 pb-3'>
          <ManagementPagination
            pagination={pagination}
            pending={loading}
            onPageChange={(page) => void fetchServers(page)}
          />
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-xl'>
          <DialogHeader>
            <DialogTitle>
              {form.id ? '编辑服务器' : '新增服务器'}
            </DialogTitle>
            <DialogDescription>
              只需登记连接所需字段，系统会自动 SSH 采集其他信息。
            </DialogDescription>
          </DialogHeader>
          <div className='grid grid-cols-2 gap-3'>
            <div className='col-span-2'>
              <label className='text-sm font-medium'>名称</label>
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>
            <div>
              <label className='text-sm font-medium'>主机名（可选）</label>
              <Input
                value={form.hostname}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    hostname: event.target.value
                  }))
                }
              />
            </div>
            <div>
              <label className='text-sm font-medium'>IP 地址</label>
              <Input
                value={form.ip}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, ip: event.target.value }))
                }
              />
            </div>
            <div>
              <label className='text-sm font-medium'>SSH 端口</label>
              <Input
                type='number'
                value={form.sshPort}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, sshPort: event.target.value }))
                }
              />
            </div>
            <div>
              <label className='text-sm font-medium'>SSH 用户名</label>
              <Input
                value={form.sshUser}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, sshUser: event.target.value }))
                }
              />
            </div>
            <div>
              <label className='text-sm font-medium'>认证方式</label>
              <Select
                value={form.authType}
                onValueChange={(value: 'password' | 'private_key') =>
                  setForm((prev) => ({
                    ...prev,
                    authType: value,
                    keepSecret: false
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='password'>密码</SelectItem>
                  <SelectItem value='private_key'>私钥</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='col-span-2'>
              <label className='text-sm font-medium'>
                {form.authType === 'password' ? '密码' : '私钥内容'}
                {form.id && form.keepSecret && !form.secret && (
                  <span className='ml-2 text-xs text-muted-foreground'>
                    留空则保留原值
                  </span>
                )}
              </label>
              {form.authType === 'password' ? (
                <Input
                  type='password'
                  value={form.secret}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      secret: event.target.value,
                      keepSecret: false
                    }))
                  }
                />
              ) : (
                <Textarea
                  value={form.secret}
                  rows={5}
                  placeholder='-----BEGIN OPENSSH PRIVATE KEY-----'
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      secret: event.target.value,
                      keepSecret: false
                    }))
                  }
                />
              )}
            </div>
            {form.authType === 'private_key' && (
              <div className='col-span-2'>
                <label className='text-sm font-medium'>
                  私钥口令（可选）
                  {form.id && form.keepPassphrase && !form.passphrase && (
                    <span className='ml-2 text-xs text-muted-foreground'>
                      留空则保留原值
                    </span>
                  )}
                </label>
                <Input
                  type='password'
                  value={form.passphrase}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      passphrase: event.target.value,
                      keepPassphrase: false
                    }))
                  }
                />
              </div>
            )}
            <div className='col-span-2'>
              <label className='text-sm font-medium'>备注</label>
              <Textarea
                value={form.remark}
                rows={2}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, remark: event.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setDialogOpen(false)}
              disabled={mutating}
            >
              取消
            </Button>
            <Button onClick={() => void submitForm()} disabled={mutating}>
              {mutating ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet
        open={Boolean(detailServer)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailServer(null);
            setHistoryFacts([]);
          }
        }}
      >
        <SheetContent className='w-full overflow-y-auto sm:max-w-2xl'>
          {detailServer && (
            <>
              <SheetHeader>
                <SheetTitle className='flex items-center gap-2'>
                  {detailServer.name}
                  <Badge variant={STATUS_VARIANT[detailServer.status]}>
                    {STATUS_LABELS[detailServer.status]}
                  </Badge>
                </SheetTitle>
                <SheetDescription>
                  {detailServer.ip}:{detailServer.sshPort} · {detailServer.sshUser}
                </SheetDescription>
              </SheetHeader>
              <div className='flex items-center gap-2 px-4 pb-2'>
                {access.canCollect && (
                  <Button
                    size='sm'
                    disabled={detailServer.status === 'collecting'}
                    onClick={() => void triggerCollect(detailServer)}
                  >
                    <RefreshCw className='mr-1 size-3.5' /> 立即采集
                  </Button>
                )}
              </div>
              <Tabs
                value={detailTab}
                onValueChange={(value) =>
                  setDetailTab(value as 'info' | 'facts' | 'history')
                }
                className='px-4'
              >
                <TabsList>
                  <TabsTrigger value='info'>基本信息</TabsTrigger>
                  <TabsTrigger value='facts'>最新采集</TabsTrigger>
                  <TabsTrigger value='history'>采集历史</TabsTrigger>
                </TabsList>
                <TabsContent value='info' className='space-y-2 pt-4 text-sm'>
                  <DetailRow label='主机名' value={detailServer.hostname ?? '-'} />
                  <DetailRow label='IP 地址' value={detailServer.ip} />
                  <DetailRow label='SSH 端口' value={String(detailServer.sshPort)} />
                  <DetailRow label='SSH 用户' value={detailServer.sshUser} />
                  <DetailRow
                    label='认证方式'
                    value={detailServer.authType === 'password' ? '密码' : '私钥'}
                  />
                  <DetailRow
                    label='最近采集'
                    value={
                      detailServer.lastCollectedAt
                        ? new Date(detailServer.lastCollectedAt).toLocaleString()
                        : '—'
                    }
                  />
                  <DetailRow
                    label='采集错误'
                    value={detailServer.collectError ?? '—'}
                  />
                  <DetailRow label='备注' value={detailServer.remark ?? '—'} />
                </TabsContent>
                <TabsContent value='facts' className='pt-4 text-sm'>
                  <FactsDetail facts={detailServer.latestFacts} />
                </TabsContent>
                <TabsContent value='history' className='pt-4 text-sm'>
                  {historyLoading ? (
                    <div className='text-muted-foreground'>加载中…</div>
                  ) : historyFacts.length === 0 ? (
                    <div className='text-muted-foreground'>暂无历史快照。</div>
                  ) : (
                    <ul className='space-y-2'>
                      {historyFacts.map((facts) => (
                        <li
                          key={facts.id}
                          className='rounded-xl border p-3'
                        >
                          <div className='font-medium'>
                            {new Date(facts.collectedAt).toLocaleString()}
                          </div>
                          <div className='text-muted-foreground text-xs'>
                            {facts.osName} {facts.osVersion} · {facts.kernel}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmActionDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title='删除服务器'
        description={`确认删除 ${confirmDelete?.name} 吗？该操作会同时清除所有历史采集快照。`}
        pending={mutating}
        confirmLabel='删除'
        onConfirm={() => {
          if (confirmDelete) {
            void deleteServer(confirmDelete);
          }
        }}
      />
      <ConfirmActionDialog
        open={confirmBatchDelete}
        onOpenChange={setConfirmBatchDelete}
        title='批量删除服务器'
        description={`确认删除选中的 ${selectedIds.length} 台服务器吗？该操作无法撤销。`}
        pending={mutating}
        confirmLabel='删除'
        onConfirm={deleteBatch}
      />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex justify-between gap-4 border-b py-1 last:border-0'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='font-medium'>{value}</span>
    </div>
  );
}

function FactsDetail({ facts }: { facts: OpsServerFactsSummary | null }) {
  if (!facts) {
    return <div className='text-muted-foreground'>尚无采集快照。</div>;
  }
  return (
    <div className='space-y-3'>
      <DetailRow
        label='采集时间'
        value={new Date(facts.collectedAt).toLocaleString()}
      />
      <DetailRow
        label='操作系统'
        value={`${facts.osName ?? '—'} ${facts.osVersion ?? ''}`}
      />
      <DetailRow label='内核' value={facts.kernel ?? '—'} />
      <DetailRow label='架构' value={facts.arch ?? '—'} />
      <DetailRow
        label='CPU'
        value={`${facts.cpuModel ?? '—'} × ${facts.cpuCores ?? '—'}`}
      />
      <DetailRow
        label='内存'
        value={
          facts.memoryTotalMb
            ? `${facts.memoryUsedMb ?? 0} / ${facts.memoryTotalMb} MB`
            : '—'
        }
      />
      <DetailRow
        label='在线时长'
        value={
          facts.uptimeSeconds
            ? `${Math.floor(facts.uptimeSeconds / 3600)} 小时`
            : '—'
        }
      />
      {facts.disks.length > 0 && (
        <div>
          <div className='mb-1 text-muted-foreground'>磁盘</div>
          <ul className='space-y-1'>
            {facts.disks.map((disk, index) => (
              <li key={index} className='rounded-lg bg-muted/40 p-2 text-xs'>
                {disk.mountedOn} · {disk.used} / {disk.size} ({disk.usePercent})
              </li>
            ))}
          </ul>
        </div>
      )}
      {facts.networks.length > 0 && (
        <div>
          <div className='mb-1 text-muted-foreground'>网卡</div>
          <ul className='space-y-1'>
            {facts.networks.map((nic) => (
              <li key={nic.name} className='rounded-lg bg-muted/40 p-2 text-xs'>
                {nic.name} · {nic.addresses.join(', ') || '无地址'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
