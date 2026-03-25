import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { DashboardCalendarTimeline } from '@/features/overview/components/dashboard-calendar-timeline';
import { getDashboardMetrics } from '@/lib/platform/service';
import {
  IconBellRinging,
  IconChecklist,
  IconLayoutKanban,
  IconUsers
} from '@tabler/icons-react';
import React from 'react';

export default async function OverViewLayout({
  sales,
  pie_stats,
  bar_stats,
  area_stats
}: {
  sales: React.ReactNode;
  pie_stats: React.ReactNode;
  bar_stats: React.ReactNode;
  area_stats: React.ReactNode;
}) {
  const metrics = await getDashboardMetrics();

  return (
    <PageContainer
      pageTitle='仪表盘'
      pageDescription='当前展示系统基础规模、模块状态与演示统计视图。'
    >
      <div className='flex flex-1 flex-col space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              橘色的系统总览
            </h2>
            <p className='text-muted-foreground text-sm'>
              这一版先把基础管理骨架搭稳，后续按计划逐步补齐
              CRUD、流程与上传能力。
            </p>
          </div>
          <Badge variant='outline'>v0.1.0 Foundation</Badge>
        </div>

        <div className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs md:grid-cols-2 xl:grid-cols-4'>
          <Card>
            <CardHeader>
              <CardDescription>工作区总数</CardDescription>
              <CardTitle className='text-3xl font-semibold tabular-nums'>
                {metrics.workspaceCount}
              </CardTitle>
              <CardAction>
                <IconLayoutKanban className='text-muted-foreground size-5' />
              </CardAction>
            </CardHeader>
            <CardFooter className='text-muted-foreground text-sm'>
              支撑多工作区与团队协作。
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>团队与成员</CardDescription>
              <CardTitle className='text-3xl font-semibold tabular-nums'>
                {metrics.teamCount} / {metrics.userCount}
              </CardTitle>
              <CardAction>
                <IconUsers className='text-muted-foreground size-5' />
              </CardAction>
            </CardHeader>
            <CardFooter className='text-muted-foreground text-sm'>
              团队、用户、角色与权限已进入统一底座。
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>站内消息</CardDescription>
              <CardTitle className='text-3xl font-semibold tabular-nums'>
                {metrics.notificationCount}
              </CardTitle>
              <CardAction>
                <IconBellRinging className='text-muted-foreground size-5' />
              </CardAction>
            </CardHeader>
            <CardFooter className='text-muted-foreground text-sm'>
              作为系统通知中心的基础数据入口。
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>工单规模</CardDescription>
              <CardTitle className='text-3xl font-semibold tabular-nums'>
                {metrics.ticketCount}
              </CardTitle>
              <CardAction>
                <IconChecklist className='text-muted-foreground size-5' />
              </CardAction>
            </CardHeader>
            <CardFooter className='text-muted-foreground text-sm'>
              后续会补齐状态流转、分配和评论能力。
            </CardFooter>
          </Card>
        </div>

        <div className='grid gap-4 xl:grid-cols-[1.5fr_1fr]'>
          <div className='space-y-4'>
            {area_stats}
            {bar_stats}
          </div>
          <div className='space-y-4'>
            {pie_stats}
            {sales}
          </div>
        </div>

        <DashboardCalendarTimeline />
      </div>
    </PageContainer>
  );
}
