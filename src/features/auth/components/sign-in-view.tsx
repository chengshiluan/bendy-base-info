'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { AlertCircle, CheckCircle2, Github, Mail, Shield } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface SignInViewPageProps {
  githubEnabled: boolean;
  emailEnabled: boolean;
  databaseEnabled: boolean;
  redisEnabled: boolean;
  emailProviderEnabled: boolean;
  error?: string;
}

const errorMessageMap: Record<string, string> = {
  github_not_allowed: '当前 GitHub 用户未被录入系统，无法登录。',
  github_profile: '未能从 GitHub 获取用户名，请稍后重试。',
  CredentialsSignin: '验证码无效或已过期，请重新发送验证码。'
};

export default function SignInViewPage({
  githubEnabled,
  emailEnabled,
  databaseEnabled,
  redisEnabled,
  emailProviderEnabled,
  error
}: SignInViewPageProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const errorMessage = useMemo(() => {
    if (!error) {
      return null;
    }

    return errorMessageMap[error] || '登录失败，请检查配置后重试。';
  }, [error]);

  const requestCode = async () => {
    setRequestLoading(true);
    setNotice(null);
    setDevCode(null);

    try {
      const response = await fetch('/api/auth/email/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const payload = (await response.json()) as {
        message?: string;
        devCode?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message || '发送验证码失败。');
      }

      setNotice(payload.message || '验证码已发送。');
      setDevCode(payload.devCode || null);
    } catch (requestError) {
      setNotice(
        requestError instanceof Error
          ? requestError.message
          : '发送验证码失败，请稍后再试。'
      );
    } finally {
      setRequestLoading(false);
    }
  };

  const submitEmailCode = async () => {
    setSubmitLoading(true);
    const result = await signIn('email-code', {
      email,
      code,
      redirect: false,
      callbackUrl: '/dashboard/overview'
    });

    if (result?.ok && result.url) {
      window.location.href = result.url;
      return;
    }

    setNotice('验证码校验失败，请确认输入正确。');
    setSubmitLoading(false);
  };

  return (
    <div className='bg-muted/30 flex min-h-screen items-center justify-center px-4 py-10'>
      <div className='grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]'>
        <div className='from-background via-background to-muted hidden rounded-3xl border bg-gradient-to-br p-10 lg:flex lg:flex-col lg:justify-between'>
          <div className='space-y-6'>
            <span className='text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium'>
              <Shield className='h-4 w-4' />
              Bendywork Base
            </span>
            <div className='space-y-3'>
              <h1 className='text-4xl font-semibold tracking-tight'>
                轻量、直接、可持续迭代的基础管理系统
              </h1>
              <p className='text-muted-foreground max-w-xl text-base leading-7'>
                本系统不开放注册，只允许已录入的 GitHub 用户名或已授权邮箱登录。
                这一版会以超级管理员视角先把工作区、团队、权限、通知、看板和工单这些基础模块搭稳。
              </p>
            </div>
          </div>
          <div className='grid gap-3 sm:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>GitHub 用户即账户</CardTitle>
                <CardDescription>
                  用户录入时只需要维护 GitHub 用户名。
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>邮箱验证码登录</CardTitle>
                <CardDescription>
                  通过 Upstash Redis 临时存储验证码，配置邮件服务后即可启用。
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        <Card className='mx-auto w-full max-w-xl rounded-3xl border shadow-sm'>
          <CardHeader className='space-y-2'>
            <CardTitle className='text-2xl'>登录系统</CardTitle>
            <CardDescription>
              仅允许管理员提前录入的 GitHub 用户名或邮箱进入系统。
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            {errorMessage && (
              <Alert variant='destructive'>
                <AlertCircle className='h-4 w-4' />
                <AlertTitle>登录失败</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {notice && (
              <Alert>
                <CheckCircle2 className='h-4 w-4' />
                <AlertTitle>状态提醒</AlertTitle>
                <AlertDescription>
                  <div>{notice}</div>
                  {devCode && (
                    <div className='mt-2 text-sm'>
                      开发环境验证码：
                      <span className='font-semibold'>{devCode}</span>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className='space-y-3'>
              <Button
                className='w-full'
                size='lg'
                disabled={!githubEnabled}
                onClick={() =>
                  signIn('github', { callbackUrl: '/dashboard/overview' })
                }
              >
                <Github className='mr-2 h-4 w-4' />
                通过 GitHub 登录
              </Button>
              {!githubEnabled && (
                <p className='text-muted-foreground text-sm'>
                  GitHub OAuth 尚未配置，请后续补充 `GITHUB_ID` 与
                  `GITHUB_SECRET`。
                </p>
              )}
            </div>

            <div className='relative'>
              <div className='absolute inset-0 flex items-center'>
                <span className='w-full border-t' />
              </div>
              <div className='relative flex justify-center text-xs uppercase'>
                <span className='bg-background text-muted-foreground px-2'>
                  或使用邮箱验证码
                </span>
              </div>
            </div>

            <div className='space-y-4'>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>邮箱地址</label>
                <Input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type='email'
                  placeholder='you@example.com'
                />
              </div>

              <div className='grid gap-3 sm:grid-cols-[1fr_auto]'>
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>验证码</label>
                  <Input
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    inputMode='numeric'
                    maxLength={6}
                    placeholder='6 位验证码'
                  />
                </div>
                <Button
                  variant='outline'
                  className='self-end'
                  disabled={!emailEnabled || !email || requestLoading}
                  onClick={requestCode}
                >
                  <Mail className='mr-2 h-4 w-4' />
                  {requestLoading ? '发送中...' : '发送验证码'}
                </Button>
              </div>

              <Button
                className='w-full'
                size='lg'
                disabled={
                  !emailEnabled || !email || code.length !== 6 || submitLoading
                }
                onClick={submitEmailCode}
              >
                {submitLoading ? '登录中...' : '使用验证码登录'}
              </Button>
            </div>

            <div className='rounded-2xl border p-4'>
              <div className='mb-3 text-sm font-medium'>当前基础设施状态</div>
              <div className='grid gap-2 text-sm'>
                <div>PostgreSQL: {databaseEnabled ? '已就绪' : '待配置'}</div>
                <div>Upstash Redis: {redisEnabled ? '已就绪' : '待配置'}</div>
                <div>GitHub OAuth: {githubEnabled ? '已就绪' : '待配置'}</div>
                <div>
                  邮件服务:{' '}
                  {emailProviderEnabled
                    ? '已就绪'
                    : '待配置，当前会输出开发日志'}
                </div>
              </div>
            </div>

            <Link
              href='/dashboard/overview'
              className={cn(buttonVariants({ variant: 'ghost' }), 'w-full')}
            >
              查看系统结构
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
