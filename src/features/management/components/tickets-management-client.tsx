'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileUploader } from '@/components/file-uploader';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
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
import { Textarea } from '@/components/ui/textarea';
import { formatBytes } from '@/lib/utils';
import type {
  FileAssetSummary,
  OptionItem,
  TicketCommentSummary,
  TicketSummary
} from '@/lib/platform/types';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { getErrorMessage, requestJson } from '../lib/client';

interface TicketsManagementClientProps {
  initialTickets: TicketSummary[];
  workspaceId?: string;
  memberOptions: OptionItem[];
}

type TicketFilter = 'all' | TicketSummary['status'];

type TicketFormState = {
  title: string;
  description: string;
  priority: TicketSummary['priority'];
  status: TicketSummary['status'];
  assigneeId: string;
};

function createDefaultForm(): TicketFormState {
  return {
    title: '',
    description: '',
    priority: 'medium',
    status: 'open',
    assigneeId: ''
  };
}

function getTicketPayload(workspaceId: string, form: TicketFormState) {
  return {
    workspaceId,
    title: form.title,
    description: form.description,
    priority: form.priority,
    status: form.status,
    assigneeId: form.assigneeId || null
  };
}

export function TicketsManagementClient({
  initialTickets,
  workspaceId,
  memberOptions
}: TicketsManagementClientProps) {
  const [tickets, setTickets] = useState(initialTickets);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<TicketFilter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [commentPending, setCommentPending] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingTicket, setEditingTicket] = useState<TicketSummary | null>(
    null
  );
  const [selectedTicket, setSelectedTicket] = useState<TicketSummary | null>(
    null
  );
  const [deletingTicket, setDeletingTicket] = useState<TicketSummary | null>(
    null
  );
  const [comments, setComments] = useState<TicketCommentSummary[]>([]);
  const [files, setFiles] = useState<FileAssetSummary[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<FileAssetSummary[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [form, setForm] = useState<TicketFormState>(createDefaultForm());

  const filteredTickets = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesFilter = filter === 'all' || ticket.status === filter;
      const matchesKeyword =
        !keyword ||
        [
          ticket.code,
          ticket.title,
          ticket.description,
          ticket.assignee,
          ticket.reporter
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(keyword));

      return matchesFilter && matchesKeyword;
    });
  }, [filter, search, tickets]);

  async function refreshTickets() {
    if (!workspaceId) {
      return;
    }

    const data = await requestJson<{ tickets: TicketSummary[] }>(
      `/api/admin/tickets?workspaceId=${workspaceId}`
    );
    setTickets(data.tickets);

    if (selectedTicket) {
      const nextSelected = data.tickets.find(
        (ticket) => ticket.id === selectedTicket.id
      );
      setSelectedTicket(nextSelected ?? null);
    }
  }

  async function loadTicketDetail(ticketId: string) {
    if (!workspaceId) {
      return;
    }

    setDetailLoading(true);

    try {
      const [commentsResponse, filesResponse] = await Promise.all([
        requestJson<{ comments: TicketCommentSummary[] }>(
          `/api/admin/tickets/${ticketId}/comments?workspaceId=${workspaceId}`
        ),
        requestJson<{ files: FileAssetSummary[] }>(
          `/api/admin/files?workspaceId=${workspaceId}&entityType=ticket&entityId=${ticketId}`
        )
      ]);

      setComments(commentsResponse.comments);
      setFiles(filesResponse.files);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDetailLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingTicket(null);
    setForm(createDefaultForm());
    setDialogOpen(true);
  }

  function openEditDialog(ticket: TicketSummary) {
    setEditingTicket(ticket);
    setForm({
      title: ticket.title,
      description: ticket.description ?? '',
      priority: ticket.priority,
      status: ticket.status,
      assigneeId: ticket.assigneeId ?? ''
    });
    setDialogOpen(true);
  }

  async function openDetail(ticket: TicketSummary) {
    setSelectedTicket(ticket);
    setDetailOpen(true);
    setUploadedFiles([]);
    setCommentBody('');
    await loadTicketDetail(ticket.id);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceId) {
      toast.error('当前没有可操作的工作区。');
      return;
    }

    setSubmitPending(true);

    try {
      const payload = getTicketPayload(workspaceId, form);

      if (editingTicket) {
        await requestJson(`/api/admin/tickets/${editingTicket.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        toast.success('工单已更新。');
      } else {
        await requestJson('/api/admin/tickets', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        toast.success('工单已创建。');
      }

      await refreshTickets();
      setDialogOpen(false);
      setForm(createDefaultForm());
      setEditingTicket(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitPending(false);
    }
  }

  async function handleDelete() {
    if (!deletingTicket || !workspaceId) {
      return;
    }

    setDeletePending(true);

    try {
      await requestJson(
        `/api/admin/tickets/${deletingTicket.id}?workspaceId=${workspaceId}`,
        {
          method: 'DELETE'
        }
      );
      toast.success('工单已删除。');
      await refreshTickets();
      setDeleteOpen(false);
      if (selectedTicket?.id === deletingTicket.id) {
        setDetailOpen(false);
        setSelectedTicket(null);
        setComments([]);
        setFiles([]);
      }
      setDeletingTicket(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletePending(false);
    }
  }

  async function handleCommentSubmit() {
    if (!selectedTicket || !workspaceId || !commentBody.trim()) {
      return;
    }

    setCommentPending(true);

    try {
      const attachmentIds = uploadedFiles.map((file) => file.id);
      await requestJson(
        `/api/admin/tickets/${selectedTicket.id}/comments?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            body: commentBody,
            attachmentIds
          })
        }
      );
      toast.success('评论已提交。');
      setCommentBody('');
      setUploadedFiles([]);
      await Promise.all([
        refreshTickets(),
        loadTicketDetail(selectedTicket.id)
      ]);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCommentPending(false);
    }
  }

  async function handleUpload(filesToUpload: File[]) {
    if (!selectedTicket || !workspaceId) {
      throw new Error('请先打开一个工单详情，再上传附件。');
    }

    const uploaded: FileAssetSummary[] = [];

    for (const file of filesToUpload) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceId', workspaceId);
      formData.append('entityType', 'ticket');
      formData.append('entityId', selectedTicket.id);

      const response = await fetch('/api/admin/uploads', {
        method: 'POST',
        body: formData
      });
      const payload = (await response.json().catch(() => null)) as {
        file?: FileAssetSummary;
        message?: string;
      } | null;

      if (!response.ok || !payload?.file) {
        throw new Error(payload?.message || '文件上传失败。');
      }

      uploaded.push(payload.file);
    }

    setUploadedFiles((current) => [...current, ...uploaded]);
    await loadTicketDetail(selectedTicket.id);
  }

  if (!workspaceId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>工单系统</CardTitle>
          <CardDescription>
            请先选择一个工作区，再进行工单管理。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className='flex flex-col gap-4'>
          <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
            <div>
              <CardTitle>工单列表</CardTitle>
              <CardDescription>
                工单负责承接需求、问题和内部协作，支持状态流转、评论和附件上传。
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>新建工单</Button>
          </div>
          <div className='flex flex-col gap-3 md:flex-row md:items-center'>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder='搜索工单号 / 标题 / 负责人 / 发起人'
              className='md:w-80'
            />
            <div className='flex gap-2'>
              {(
                ['all', 'open', 'in_progress', 'resolved', 'closed'] as const
              ).map((item) => (
                <Button
                  key={item}
                  variant={filter === item ? 'default' : 'outline'}
                  onClick={() => setFilter(item)}
                >
                  {item === 'all' ? '全部' : item}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>工单号</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>优先级</TableHead>
                <TableHead>负责人</TableHead>
                <TableHead>评论数</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className='font-medium'>{ticket.code}</TableCell>
                  <TableCell className='max-w-md whitespace-normal'>
                    {ticket.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant='outline'>{ticket.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant='outline'>{ticket.priority}</Badge>
                  </TableCell>
                  <TableCell>{ticket.assignee}</TableCell>
                  <TableCell>{ticket.commentCount ?? 0}</TableCell>
                  <TableCell>{ticket.updatedAt}</TableCell>
                  <TableCell>
                    <div className='flex gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => void openDetail(ticket)}
                      >
                        详情
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => openEditDialog(ticket)}
                      >
                        编辑
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          setDeletingTicket(ticket);
                          setDeleteOpen(true);
                        }}
                      >
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!filteredTickets.length && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className='text-muted-foreground py-10 text-center'
                  >
                    当前没有匹配的工单记录。
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
            setEditingTicket(null);
            setForm(createDefaultForm());
          }
        }}
      >
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>{editingTicket ? '编辑工单' : '新建工单'}</DialogTitle>
            <DialogDescription>
              工单创建后会自动生成编号，并记录当前操作人为发起人。
            </DialogDescription>
          </DialogHeader>
          <form className='space-y-4' onSubmit={handleSubmit}>
            <div className='grid gap-2'>
              <label className='text-sm font-medium'>工单标题</label>
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value
                  }))
                }
                placeholder='请输入工单标题'
                required
              />
            </div>
            <div className='grid gap-2'>
              <label className='text-sm font-medium'>工单描述</label>
              <Textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value
                  }))
                }
                placeholder='详细描述问题或需求背景'
              />
            </div>
            <div className='grid gap-2 md:grid-cols-3'>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>优先级</label>
                <Select
                  value={form.priority}
                  onValueChange={(value: TicketFormState['priority']) =>
                    setForm((current) => ({ ...current, priority: value }))
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='low'>low</SelectItem>
                    <SelectItem value='medium'>medium</SelectItem>
                    <SelectItem value='high'>high</SelectItem>
                    <SelectItem value='urgent'>urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>状态</label>
                <Select
                  value={form.status}
                  onValueChange={(value: TicketFormState['status']) =>
                    setForm((current) => ({ ...current, status: value }))
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='open'>open</SelectItem>
                    <SelectItem value='in_progress'>in_progress</SelectItem>
                    <SelectItem value='resolved'>resolved</SelectItem>
                    <SelectItem value='closed'>closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>负责人</label>
                <Select
                  value={form.assigneeId || 'none'}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      assigneeId: value === 'none' ? '' : value
                    }))
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='none'>暂不分配</SelectItem>
                    {memberOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                  : editingTicket
                    ? '保存修改'
                    : '创建工单'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className='w-full overflow-y-auto sm:max-w-2xl'>
          <SheetHeader>
            <SheetTitle>{selectedTicket?.title || '工单详情'}</SheetTitle>
            <SheetDescription>
              {selectedTicket
                ? `${selectedTicket.code} · 状态 ${selectedTicket.status} · 优先级 ${selectedTicket.priority}`
                : '查看工单详情、评论流和附件。'}
            </SheetDescription>
          </SheetHeader>
          {selectedTicket && (
            <div className='space-y-6 p-4'>
              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>基础信息</CardTitle>
                </CardHeader>
                <CardContent className='space-y-3 text-sm'>
                  <div className='flex flex-wrap gap-2'>
                    <Badge variant='outline'>{selectedTicket.status}</Badge>
                    <Badge variant='outline'>{selectedTicket.priority}</Badge>
                    <Badge variant='outline'>
                      负责人：{selectedTicket.assignee}
                    </Badge>
                    <Badge variant='outline'>
                      发起人：{selectedTicket.reporter}
                    </Badge>
                  </div>
                  <p className='text-muted-foreground leading-6 whitespace-pre-wrap'>
                    {selectedTicket.description || '暂无描述。'}
                  </p>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => {
                        openEditDialog(selectedTicket);
                        setDetailOpen(false);
                      }}
                    >
                      编辑工单
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>附件</CardTitle>
                  <CardDescription>
                    上传后会自动写入 S3 和操作日志。
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <FileUploader
                    maxFiles={5}
                    multiple
                    accept={{ '*/*': [] }}
                    onUpload={handleUpload}
                  />
                  {uploadedFiles.length > 0 && (
                    <div className='rounded-md border border-dashed p-3 text-sm'>
                      已上传待评论引用：
                      <div className='mt-2 flex flex-wrap gap-2'>
                        {uploadedFiles.map((file) => (
                          <Badge key={file.id} variant='outline'>
                            {file.fileName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {detailLoading ? (
                    <p className='text-muted-foreground text-sm'>
                      附件加载中...
                    </p>
                  ) : files.length ? (
                    <div className='space-y-2'>
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className='flex items-center justify-between rounded-md border p-3 text-sm'
                        >
                          <div>
                            <p className='font-medium'>{file.fileName}</p>
                            <p className='text-muted-foreground'>
                              {formatBytes(file.size)} · 上传人{' '}
                              {file.uploadedByName}
                            </p>
                          </div>
                          {file.publicUrl ? (
                            <Button variant='outline' size='sm' asChild>
                              <a
                                href={file.publicUrl}
                                target='_blank'
                                rel='noreferrer'
                              >
                                打开
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className='text-muted-foreground text-sm'>
                      当前还没有附件。
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>评论流</CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='grid gap-2'>
                    <label className='text-sm font-medium'>新增评论</label>
                    <Textarea
                      value={commentBody}
                      onChange={(event) => setCommentBody(event.target.value)}
                      placeholder='补充处理进度、结论或协作说明'
                    />
                  </div>
                  <div className='flex justify-end'>
                    <Button
                      disabled={commentPending || !commentBody.trim()}
                      onClick={handleCommentSubmit}
                    >
                      {commentPending ? '提交中...' : '提交评论'}
                    </Button>
                  </div>
                  {detailLoading ? (
                    <p className='text-muted-foreground text-sm'>
                      评论加载中...
                    </p>
                  ) : comments.length ? (
                    <div className='space-y-3'>
                      {comments.map((comment) => (
                        <div key={comment.id} className='rounded-md border p-3'>
                          <div className='mb-2 flex items-center justify-between text-sm'>
                            <span className='font-medium'>
                              {comment.author}
                            </span>
                            <span className='text-muted-foreground'>
                              {comment.createdAt}
                            </span>
                          </div>
                          <p className='text-muted-foreground text-sm leading-6 whitespace-pre-wrap'>
                            {comment.body}
                          </p>
                          {comment.attachmentIds.length > 0 && (
                            <div className='mt-3 flex flex-wrap gap-2'>
                              {comment.attachmentIds.map((attachmentId) => (
                                <Badge key={attachmentId} variant='outline'>
                                  附件 {attachmentId.slice(0, 8)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className='text-muted-foreground text-sm'>
                      当前还没有评论。
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          <SheetFooter>
            <Button variant='outline' onClick={() => setDetailOpen(false)}>
              关闭
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title='删除工单'
        description={
          deletingTicket
            ? `将删除工单 ${deletingTicket.code} 及其评论记录，删除后不可恢复。`
            : '删除后不可恢复。'
        }
        confirmLabel='确认删除'
        pending={deletePending}
        onConfirm={handleDelete}
      />
    </>
  );
}
