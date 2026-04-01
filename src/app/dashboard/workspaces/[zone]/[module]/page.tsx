import { notFound } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { requireSession } from '@/lib/auth/session';
import { getActiveWorkspaceCookie } from '@/lib/auth/workspace';
import { listWorkspaceOptions } from '@/lib/platform/service';

const moduleConfig: Record<
  string,
  Record<string, { title: string; description: string }>
> = {
  ops: {
    accounts: {
      title: '账号管理',
      description: '聚焦当前工作区下的账号、平台、密钥、绑定与资产信息。'
    },
    system: {
      title: '系统管理',
      description: '承接当前工作区的系统设置、运行开关与基础运维配置。'
    },
    config: {
      title: '配置管理',
      description: '围绕当前工作区维护可配置项、参数策略与环境基线。'
    },
    information: {
      title: '信息管理',
      description: '集中整理当前工作区的信息台账、发布内容与维护说明。'
    },
    data: {
      title: '数据管理',
      description: '围绕当前工作区的数据资产、同步任务与治理规则开展维护。'
    }
  },
  dev: {
    projects: {
      title: '项目管理',
      description: '管理当前工作区的项目清单、推进状态与协作边界。'
    },
    resources: {
      title: '资源管理',
      description: '维护当前工作区的资源目录、配额视图与资产分配。'
    }
  },
  admin: {
    hr: {
      title: '人力资源',
      description: '承接当前工作区的人力安排、岗位协同与组织支持事项。'
    },
    policies: {
      title: '规章制度',
      description: '集中维护当前工作区可见的制度文档、执行口径与规范说明。'
    },
    governance: {
      title: '司政中心',
      description: '管理当前工作区的行政协同、公告传达与治理事项。'
    }
  }
};

export default async function WorkspaceScopedModulePage({
  params
}: {
  params: Promise<{ zone: string; module: string }>;
}) {
  const { zone, module } = await params;

  if (!(zone in moduleConfig)) {
    notFound();
  }

  const zoneConfig = moduleConfig[zone];

  if (!(module in zoneConfig)) {
    notFound();
  }

  const session = await requireSession();
  const activeWorkspaceId =
    (await getActiveWorkspaceCookie()) ||
    session.user.defaultWorkspaceId ||
    undefined;
  const workspaces = await listWorkspaceOptions(
    session.user.id,
    session.user.systemRole
  );
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  const config = zoneConfig[module];

  return (
    <PageContainer
      pageTitle={config.title}
      pageDescription={config.description}
    >
      <div className='grid gap-4'>
        <Card>
          <CardHeader>
            <CardTitle>当前工作区上下文</CardTitle>
            <CardDescription>
              这些模块的数据都会跟随工作区切换刷新，确保不同工作区之间的数据边界保持独立。
            </CardDescription>
          </CardHeader>
          <CardContent className='flex flex-wrap items-center gap-3'>
            <Badge variant='outline'>
              当前工作区：{activeWorkspace?.name || '未选择工作区'}
            </Badge>
            <Badge variant='secondary'>
              标识：{activeWorkspace?.slug || 'workspace'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{config.title}模块</CardTitle>
            <CardDescription>
              菜单入口已经就位，后续可以在这里继续承接当前工作区的数据表、搜索和分页能力。
            </CardDescription>
          </CardHeader>
          <CardContent className='text-muted-foreground text-sm leading-6'>
            当前先保留为工作区感知的占位页，确保导航、上下文切换和页面容器都已经打通，不会出现菜单点击后
            404 或切换工作区后上下文不一致的问题。
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
