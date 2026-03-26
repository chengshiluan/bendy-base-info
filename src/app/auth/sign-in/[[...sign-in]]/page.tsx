import { Metadata } from 'next';
import SignInViewPage from '@/features/auth/components/sign-in-view';
import { env } from '@/lib/env';

export const metadata: Metadata = {
  title: '登录',
  description: 'GitHub 或邮箱验证码登录。'
};

export default async function Page({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = typeof params.error === 'string' ? params.error : undefined;

  return (
    <SignInViewPage
      githubEnabled={env.auth.githubEnabled}
      emailEnabled={env.auth.emailEnabled}
      error={error}
    />
  );
}
