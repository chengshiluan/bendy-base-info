'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
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
import { Input } from '@/components/ui/input';
import type { TicketSummary } from '@/lib/platform/types';
import { getErrorMessage, requestJson } from '../lib/client';
import { getTicketPriorityLabel, getTicketStatusLabel } from '../lib/display';

interface TicketKanbanClientProps {
  initialTickets: TicketSummary[];
  workspaceId?: string;
}

const columns: Array<{
  id: TicketSummary['status'];
  title: string;
  description: string;
}> = [
  { id: 'open', title: '待处理', description: '刚录入或待确认的事项。' },
  { id: 'in_progress', title: '处理中', description: '已经有人接手并推进。' },
  {
    id: 'resolved',
    title: '已解决',
    description: '已经给出结果，待最终关闭。'
  },
  { id: 'closed', title: '已关闭', description: '已完成归档。' }
];

interface TicketCardProps {
  ticket: TicketSummary;
}

function TicketCard({ ticket }: TicketCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: ticket.id,
      data: {
        ticketId: ticket.id,
        status: ticket.status
      }
    });

  const style = {
    transform: CSS.Translate.toString(transform)
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-background rounded-lg border p-4 shadow-sm transition ${
        isDragging ? 'opacity-60' : 'opacity-100'
      }`}
      {...attributes}
      {...listeners}
    >
      <div className='mb-3 flex items-center justify-between gap-2'>
        <p className='text-sm font-semibold'>{ticket.code}</p>
        <Badge variant='outline'>
          {getTicketPriorityLabel(ticket.priority)}
        </Badge>
      </div>
      <p className='mb-3 text-sm leading-6 font-medium'>{ticket.title}</p>
      <div className='text-muted-foreground flex flex-wrap gap-2 text-xs'>
        <span>负责人：{ticket.assignee}</span>
        <span>评论：{ticket.commentCount ?? 0}</span>
      </div>
    </div>
  );
}

interface KanbanColumnProps {
  column: (typeof columns)[number];
  tickets: TicketSummary[];
}

function KanbanColumn({ column, tickets }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[24rem] flex-1 flex-col rounded-xl border p-4 transition ${
        isOver ? 'border-primary bg-muted/30' : 'bg-card'
      }`}
    >
      <div className='mb-4'>
        <div className='flex items-center justify-between gap-2'>
          <h3 className='font-semibold'>{column.title}</h3>
          <Badge variant='outline'>{tickets.length}</Badge>
        </div>
        <p className='text-muted-foreground mt-1 text-sm'>
          {column.description}
        </p>
      </div>
      <div className='space-y-3'>
        {tickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} />
        ))}
        {!tickets.length && (
          <div className='text-muted-foreground rounded-lg border border-dashed py-10 text-center text-sm'>
            将工单拖到这里
          </div>
        )}
      </div>
    </div>
  );
}

export function TicketKanbanClient({
  initialTickets,
  workspaceId
}: TicketKanbanClientProps) {
  const [tickets, setTickets] = useState(initialTickets);
  const [search, setSearch] = useState('');
  const sensors = useSensors(useSensor(PointerSensor));

  const filteredTickets = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return tickets;
    }

    return tickets.filter((ticket) =>
      [ticket.code, ticket.title, ticket.assignee, ticket.reporter]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(keyword))
    );
  }, [search, tickets]);

  async function refreshTickets() {
    if (!workspaceId) {
      return;
    }

    const data = await requestJson<{ tickets: TicketSummary[] }>(
      `/api/admin/tickets?workspaceId=${workspaceId}`
    );
    setTickets(data.tickets);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const overId = event.over?.id;
    const activeId = event.active.id;

    if (!workspaceId || !overId) {
      return;
    }

    const nextStatus = String(overId) as TicketSummary['status'];
    if (!columns.some((column) => column.id === nextStatus)) {
      return;
    }

    const ticket = tickets.find((item) => item.id === activeId);
    if (!ticket || ticket.status === nextStatus) {
      return;
    }

    const previousTickets = tickets;
    setTickets((current) =>
      current.map((item) =>
        item.id === ticket.id
          ? {
              ...item,
              status: nextStatus
            }
          : item
      )
    );

    try {
      await requestJson(`/api/admin/tickets/${ticket.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          workspaceId,
          title: ticket.title,
          description: ticket.description ?? '',
          priority: ticket.priority,
          status: nextStatus,
          assigneeId: ticket.assigneeId ?? null
        })
      });
      toast.success(
        `工单 ${ticket.code} 已移动到 ${getTicketStatusLabel(nextStatus)}。`
      );
      await refreshTickets();
    } catch (error) {
      setTickets(previousTickets);
      toast.error(getErrorMessage(error));
    }
  }

  if (!workspaceId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>工单看板</CardTitle>
          <CardDescription>请先选择一个工作区，再查看看板。</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className='flex flex-col gap-4'>
        <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
          <div>
            <CardTitle>工单看板</CardTitle>
            <CardDescription>
              直接基于真实工单数据拖拽状态，和工单页共享同一套状态流转。
            </CardDescription>
          </div>
          <Button variant='outline' onClick={() => void refreshTickets()}>
            刷新看板
          </Button>
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder='搜索工单号 / 标题 / 负责人 / 发起人'
          className='md:w-80'
        />
      </CardHeader>
      <CardContent>
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className='grid gap-4 xl:grid-cols-4'>
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                tickets={filteredTickets.filter(
                  (ticket) => ticket.status === column.id
                )}
              />
            ))}
          </div>
        </DndContext>
      </CardContent>
    </Card>
  );
}
