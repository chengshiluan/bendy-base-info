'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

const milestones = [
  {
    time: '09:00',
    title: '项目启动会',
    description: '确认本周服务排期'
  },
  {
    time: '11:30',
    title: '客户需求沟通',
    description: '对齐核心交付范围'
  },
  {
    time: '15:00',
    title: '服务进度检查',
    description: '更新里程碑状态'
  },
  {
    time: '18:00',
    title: '日终复盘',
    description: '沉淀问题与改进点'
  }
];

export function DashboardCalendarTimeline() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const currentDateText = useMemo(() => {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);
  }, [now]);

  const currentTimeText = useMemo(() => {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(now);
  }, [now]);

  return (
    <div className='grid grid-cols-1 gap-4 lg:grid-cols-3'>
      <Card className='lg:col-span-1'>
        <CardHeader>
          <CardTitle>里程碑时间线</CardTitle>
          <CardDescription>后续可扩展为详细流程</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-6'>
            {milestones.map((item) => (
              <div key={item.time} className='relative pl-6'>
                <span className='bg-primary absolute top-1 left-0 h-2.5 w-2.5 rounded-full' />
                <span className='bg-border absolute top-4 left-1 h-full w-px' />
                <p className='text-sm font-medium'>{item.title}</p>
                <p className='text-muted-foreground text-xs'>{item.time}</p>
                <p className='text-muted-foreground text-sm'>
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className='lg:col-span-2'>
        <CardHeader>
          <CardTitle>日历</CardTitle>
          <CardDescription>当前日期：{currentDateText}</CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4 xl:grid-cols-[1fr_auto]'>
          <Calendar
            mode='single'
            selected={selectedDate}
            onSelect={setSelectedDate}
            className='rounded-lg border'
          />
          <div className='bg-muted/40 flex min-w-[160px] flex-col justify-center rounded-lg border p-4'>
            <p className='text-muted-foreground text-sm'>当前时分秒</p>
            <p className='text-xl font-semibold tabular-nums'>
              {currentTimeText}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
