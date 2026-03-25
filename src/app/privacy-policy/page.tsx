import type { Metadata } from 'next';
import { getServerLocale } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  robots: {
    index: false
  }
};

const copy = {
  zh: {
    title: '隐私政策',
    sections: [
      {
        title: '信息收集',
        body: '系统仅收集完成登录和管理协作所需的最少信息，例如 GitHub 用户名、头像、授权邮箱、工作区成员关系和操作所需的业务数据。'
      },
      {
        title: '认证说明',
        body: '当前登录方式仅包含 GitHub OAuth 与邮箱验证码登录。系统不开放注册，只有已录入的 GitHub 用户名或被授权的邮箱才能进入。'
      },
      {
        title: '数据存储',
        body: '结构化业务数据计划存储在 PostgreSQL，临时验证码和短期状态数据存储在 Redis，后续文件资源会落在 S3 兼容存储。'
      },
      {
        title: '数据使用',
        body: '这些数据只用于系统访问控制、团队协作和后台管理，不会被用于营销售卖或无关用途。'
      }
    ],
    contact: '如需处理数据相关问题，请联系当前系统管理员。',
    updated: '最后更新：2026-03-24'
  },
  en: {
    title: 'Privacy Policy',
    sections: [
      {
        title: 'Data collection',
        body: 'The system only stores the minimum information required for authentication and collaboration, such as GitHub username, avatar, approved email, workspace membership, and business records.'
      },
      {
        title: 'Authentication',
        body: 'Authentication is limited to GitHub OAuth and email verification codes. Registration is disabled. Only approved GitHub usernames or authorized email addresses may sign in.'
      },
      {
        title: 'Storage',
        body: 'Structured data is designed for PostgreSQL, temporary codes and short-lived state are designed for Redis, and future file assets will use S3-compatible storage.'
      },
      {
        title: 'Data usage',
        body: 'Collected data is used only for access control, collaboration, and admin workflows. It is not sold or shared for unrelated commercial use.'
      }
    ],
    contact: 'For privacy requests, please contact the system administrator.',
    updated: 'Last updated: 2026-03-24'
  }
} as const;

export default async function PrivacyPolicyPage() {
  const locale = await getServerLocale();
  const content = copy[locale];

  return (
    <div className='min-h-screen px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-3xl space-y-8'>
        <h1 className='text-foreground text-3xl font-bold'>{content.title}</h1>

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

        <section>
          <p className='text-muted-foreground text-base leading-relaxed'>
            {content.contact}
          </p>
        </section>

        <div className='border-border border-t pt-4'>
          <p className='text-muted-foreground text-sm'>{content.updated}</p>
        </div>
      </div>
    </div>
  );
}
