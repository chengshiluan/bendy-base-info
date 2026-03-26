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
import { Textarea } from '@/components/ui/textarea';
import type { NotificationSummary, OptionItem } from '@/lib/platform/types';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { getErrorMessage, requestJson } from '../lib/client';

interface NotificationsManagementClientProps {
  initialNotifications: NotificationSummary[];
  workspaceId?: string;
  memberOptions: OptionItem[];
}

type NotificationFilter = 'all' | 'unread' | 'read';
type NotificationTargetType = 'workspace' | 'user' | 'global';

type NotificationFormState = {
  title: string;
  content: string;
  level: 'info' | 'success' | 'warning' | 'error';
  userId: string;
  targetType: NotificationTargetType;
};

function createDefaultForm(): NotificationFormState {
  return {
    title: '',
    content: '',
    level: 'info',
    userId: '',
    targetType: 'workspace'
  };
}

export function NotificationsManagementClient({
  initialNotifications,
  workspaceId,
  memberOptions
}: NotificationsManagementClientProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [editingNotification, setEditingNotification] =
    useState<NotificationSummary | null>(null);
  const [deletingNotification, setDeletingNotification] =
    useState<NotificationSummary | null>(null);
  const [form, setForm] = useState<NotificationFormState>(createDefaultForm());

  const filteredNotifications = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return notifications.filter((notification) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'read' ? notification.isRead : !notification.isRead);
      const matchesKeyword =
        !keyword ||
        [notification.title, notification.content, notification.targetLabel]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(keyword));

      return matchesFilter && matchesKeyword;
    });
  }, [filter, notifications, searchKeyword]);

  async function refreshNotifications() {
    if (!workspaceId) {
      return;
    }

    const data = await requestJson<{ notifications: NotificationSummary[] }>(
      `/api/admin/notifications?workspaceId=${workspaceId}`
    );
    setNotifications(data.notifications);
  }

  function openCreateDialog() {
    setEditingNotification(null);
    setForm(createDefaultForm());
    setDialogOpen(true);
  }

  function openEditDialog(notification: NotificationSummary) {
    const targetType: NotificationTargetType = notification.userId
      ? 'user'
      : notification.workspaceId
        ? 'workspace'
        : 'global';

    setEditingNotification(notification);
    setForm({
      title: notification.title,
      content: notification.content,
      level: notification.level,
      userId: notification.userId ?? '',
      targetType
    });
    setDialogOpen(true);
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchKeyword(searchDraft.trim());
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitPending(true);

    try {
      const payload = {
        title: form.title,
        content: form.content,
        level: form.level,
        workspaceId:
          form.targetType === 'global' ? null : (workspaceId ?? null),
        userId: form.targetType === 'user' ? form.userId : null
      };

      if (editingNotification) {
        await requestJson(
          `/api/admin/notifications/${editingNotification.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload)
          }
        );
        toast.success('通知已更新。');
      } else {
        await requestJson('/api/admin/notifications', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        toast.success('通知已发布。');
      }

      await refreshNotifications();
      setDialogOpen(false);
      setForm(createDefaultForm());
      setEditingNotification(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitPending(false);
    }
  }

  async function handleToggleRead(
    notification: NotificationSummary,
    isRead: boolean
  ) {
    try {
      await requestJson(
        `/api/admin/notifications/${notification.id}?workspaceId=${workspaceId ?? ''}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isRead })
        }
      );
      toast.success(isRead ? '消息已标记为已读。' : '消息已恢复为未读。');
      await refreshNotifications();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function handleDelete() {
    if (!deletingNotification) {
      return;
    }

    setDeletePending(true);

    try {
      await requestJson(
        `/api/admin/notifications/${deletingNotification.id}?workspaceId=${workspaceId ?? ''}`,
        {
          method: 'DELETE'
        }
      );
      toast.success('通知已删除。');
      await refreshNotifications();
      setDeleteOpen(false);
      setDeletingNotification(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className='flex flex-col gap-4'>
          <div>
            <CardTitle>站内消息中心</CardTitle>
            <CardDescription>
              支持工作区广播、指定成员通知和系统广播，适合作为日常运维与协作提醒入口。
            </CardDescription>
          </div>
          <form
            className='flex flex-col gap-3 lg:flex-row lg:items-center'
            onSubmit={handleSearchSubmit}
          >
            <div className='border-input bg-background focus-within:border-ring focus-within:ring-ring/50 flex w-full min-w-0 items-center rounded-md border shadow-xs transition-[color,box-shadow] focus-within:ring-[3px] lg:max-w-xl'>
              <Input
                value={searchDraft}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearchDraft(value);

                  if (!value.trim()) {
                    setSearchKeyword('');
                  }
                }}
                placeholder='搜索标题 / 内容 / 目标对象'
                className='h-9 border-0 bg-transparent shadow-none focus-visible:border-transparent focus-visible:ring-0'
              />
              <Select
                value={filter}
                onValueChange={(value: NotificationFilter) => setFilter(value)}
              >
                <SelectTrigger
                  aria-label='通知状态筛选'
                  className='text-muted-foreground h-9 w-[7.5rem] shrink-0 rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:border-transparent focus-visible:ring-0'
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>全部</SelectItem>
                  <SelectItem value='unread'>未读</SelectItem>
                  <SelectItem value='read'>已读</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type='submit' variant='outline' className='lg:shrink-0'>
              搜索
            </Button>
            <Button
              type='button'
              className='lg:shrink-0'
              onClick={openCreateDialog}
            >
              发布
            </Button>
          </form>
        </CardHeader>
        <CardContent className='space-y-4'>
          {filteredNotifications.map((notification) => (
            <Card key={notification.id} className='border-dashed'>
              <CardHeader>
                <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
                  <div className='space-y-2'>
                    <CardTitle className='text-lg'>
                      {notification.title}
                    </CardTitle>
                    <CardDescription>
                      {notification.createdAt} · 目标：
                      {notification.targetLabel}
                    </CardDescription>
                  </div>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant='outline'>{notification.level}</Badge>
                    <Badge
                      variant={notification.isRead ? 'secondary' : 'default'}
                    >
                      {notification.isRead ? '已读' : '未读'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className='space-y-4'>
                <p className='text-muted-foreground text-sm leading-6 whitespace-pre-wrap'>
                  {notification.content}
                </p>
                <div className='flex flex-wrap gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => openEditDialog(notification)}
                  >
                    编辑
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() =>
                      void handleToggleRead(notification, !notification.isRead)
                    }
                  >
                    {notification.isRead ? '恢复未读' : '标记已读'}
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      setDeletingNotification(notification);
                      setDeleteOpen(true);
                    }}
                  >
                    删除
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!filteredNotifications.length && (
            <div className='text-muted-foreground rounded-md border border-dashed py-10 text-center text-sm'>
              当前没有匹配的通知记录。
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingNotification(null);
            setForm(createDefaultForm());
          }
        }}
      >
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>
              {editingNotification ? '编辑通知' : '发布通知'}
            </DialogTitle>
            <DialogDescription>
              可以选择当前工作区广播、指定成员或系统广播，消息内容支持长文本。
            </DialogDescription>
          </DialogHeader>
          <form className='space-y-4' onSubmit={handleSubmit}>
            <div className='grid gap-2'>
              <label className='text-sm font-medium'>通知标题</label>
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value
                  }))
                }
                placeholder='例如 数据库维护窗口提醒'
                required
              />
            </div>
            <div className='grid gap-2 md:grid-cols-2'>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>通知级别</label>
                <Select
                  value={form.level}
                  onValueChange={(value: NotificationFormState['level']) =>
                    setForm((current) => ({ ...current, level: value }))
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='info'>info</SelectItem>
                    <SelectItem value='success'>success</SelectItem>
                    <SelectItem value='warning'>warning</SelectItem>
                    <SelectItem value='error'>error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>通知目标</label>
                <Select
                  value={form.targetType}
                  onValueChange={(value: NotificationTargetType) =>
                    setForm((current) => ({ ...current, targetType: value }))
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='workspace'>当前工作区</SelectItem>
                    <SelectItem value='user'>指定成员</SelectItem>
                    <SelectItem value='global'>系统广播</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.targetType === 'user' && (
              <div className='grid gap-2'>
                <label className='text-sm font-medium'>指定成员</label>
                <Select
                  value={form.userId}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, userId: value }))
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='请选择接收成员' />
                  </SelectTrigger>
                  <SelectContent>
                    {memberOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className='grid gap-2'>
              <label className='text-sm font-medium'>通知内容</label>
              <Textarea
                value={form.content}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    content: event.target.value
                  }))
                }
                placeholder='请输入消息正文'
                required
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
                  : editingNotification
                    ? '保存修改'
                    : '立即发布'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title='删除通知'
        description={
          deletingNotification
            ? `将删除通知《${deletingNotification.title}》，删除后不可恢复。`
            : '删除后不可恢复。'
        }
        confirmLabel='确认删除'
        pending={deletePending}
        onConfirm={handleDelete}
      />
    </>
  );
}
