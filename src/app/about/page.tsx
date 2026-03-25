import type { Metadata } from 'next';
import { getServerLocale } from '@/lib/i18n/server';
import { APP_VERSION_LABEL } from '@/lib/app-info';

export const metadata: Metadata = {
  title: 'About'
};

const copy = {
  zh: {
    title: '关于项目',
    subtitle: 'Bendywork Base 是一个面向基础管理系统的长期演进底座。',
    sections: [
      {
        title: '项目定位',
        body: '我们基于现有 UI 骨架做瘦身改造，保留仪表盘、工作区、团队、用户、角色、权限、通知、看板和工单这些基础能力，后续按计划持续迭代。'
      },
      {
        title: '认证方式',
        body: '系统不开放注册，只允许已录入的 GitHub 用户名或已授权邮箱登录。GitHub 用户名就是账户主标识，邮箱验证码登录作为辅助入口。'
      },
      {
        title: '基础设施',
        body: '当前后端基础设施围绕 Neon PostgreSQL、Upstash Redis 和可选 S3 存储进行设计，方便部署到 Vercel 并持续扩展。'
      }
    ],
    footer: `当前基线版本：${APP_VERSION_LABEL}`
  },
  en: {
    title: 'About',
    subtitle:
      'Bendywork Base is a long-term foundation for a lightweight admin system.',
    sections: [
      {
        title: 'Project scope',
        body: 'This codebase trims the original starter into a focused management system with dashboard, workspaces, teams, users, roles, permissions, notifications, kanban, and tickets.'
      },
      {
        title: 'Authentication',
        body: 'Registration is disabled. Only pre-authorized GitHub usernames or approved email addresses can sign in. The GitHub username is the primary account identity.'
      },
      {
        title: 'Infrastructure',
        body: 'The platform is prepared for Neon PostgreSQL, Upstash Redis, and optional S3-compatible storage so it can be deployed to Vercel and iterated safely.'
      }
    ],
    footer: `Current baseline version: ${APP_VERSION_LABEL}`
  }
} as const;

export default async function AboutPage() {
  const locale = await getServerLocale();
  const content = copy[locale];

  return (
    <div className='min-h-screen px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-3xl'>
        <div className='mb-12 text-center'>
          <h1 className='text-foreground text-3xl font-bold tracking-tight sm:text-4xl'>
            {content.title}
          </h1>
          <p className='text-muted-foreground mt-4 text-lg'>
            {content.subtitle}
          </p>
        </div>

        <div className='space-y-8'>
          {content.sections.map((section) => (
            <section
              key={section.title}
              className='bg-card rounded-2xl border p-8 shadow-sm'
            >
              <h2 className='text-foreground mb-4 text-xl font-semibold'>
                {section.title}
              </h2>
              <p className='text-muted-foreground text-lg leading-relaxed'>
                {section.body}
              </p>
            </section>
          ))}
        </div>

        <div className='mt-12 text-center'>
          <p className='text-muted-foreground text-sm'>{content.footer}</p>
        </div>
      </div>
    </div>
  );
}
