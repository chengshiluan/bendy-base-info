import type { Metadata } from 'next';
import { getServerLocale } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Terms of Service',
  robots: {
    index: false
  }
};

const copy = {
  zh: {
    title: '服务条款',
    subtitle: '访问和使用系统前，请先确认以下约定。',
    sections: [
      {
        title: '使用范围',
        body: '本系统为内部基础管理平台，面向已授权成员使用。未经授权的用户不得尝试访问、注册或绕过权限控制。'
      },
      {
        title: '账户规则',
        body: '系统没有独立注册账户。GitHub 用户名是唯一主标识，管理员录入用户时也以 GitHub 用户名为准。邮箱仅作为辅助登录方式。'
      },
      {
        title: '数据与权限',
        body: '用户应仅访问自己被授权的工作区、团队和功能。涉及按钮级权限、角色配置和成员治理的操作必须由管理员授权。'
      },
      {
        title: '系统调整',
        body: '我们会按版本计划持续迭代系统结构、字段和流程，必要时会调整功能入口、权限模型和数据结构。'
      }
    ],
    footer: '继续使用即视为同意这些条款。'
  },
  en: {
    title: 'Terms of Service',
    subtitle: 'Please review the following terms before using the system.',
    sections: [
      {
        title: 'Usage scope',
        body: 'This platform is an internal admin system for approved members. Unauthorized users must not attempt to access, register, or bypass permission controls.'
      },
      {
        title: 'Account model',
        body: 'There is no standalone registration flow. The GitHub username is the primary account identifier, and administrators create users by recording that username. Email is only a secondary login path.'
      },
      {
        title: 'Data and permissions',
        body: 'Users may only access the workspaces, teams, and actions they are authorized for. Button-level permissions and management capabilities must be explicitly granted.'
      },
      {
        title: 'System changes',
        body: 'The system will continue to evolve through planned iterations, including updates to flows, data structures, and permission models when needed.'
      }
    ],
    footer: 'Continued use of the platform indicates acceptance of these terms.'
  }
} as const;

export default async function TermsOfServicePage() {
  const locale = await getServerLocale();
  const content = copy[locale];

  return (
    <div className='min-h-screen px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-3xl space-y-8'>
        <div className='text-center'>
          <h1 className='text-foreground text-3xl font-bold'>
            {content.title}
          </h1>
          <p className='text-muted-foreground mt-2 text-sm'>
            {content.subtitle}
          </p>
        </div>

        {content.sections.map((section) => (
          <section key={section.title}>
            <h2 className='text-foreground mb-3 text-xl font-semibold'>
              {section.title}
            </h2>
            <p className='text-muted-foreground text-base leading-relaxed'>
              {section.body}
            </p>
          </section>
        ))}

        <section className='border-border border-t pt-4'>
          <p className='text-muted-foreground text-center text-sm'>
            {content.footer}
          </p>
        </section>
      </div>
    </div>
  );
}
