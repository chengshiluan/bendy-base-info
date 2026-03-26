'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import {
  AlertCircle,
  CheckCircle2,
  Github,
  Mail,
  Send,
  Shield,
  Workflow,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ParticleBackground } from './particle-background';
import { TypewriterText } from './typewriter-text';

interface SignInViewPageProps {
  githubEnabled: boolean;
  emailEnabled: boolean;
  error?: string;
}

type LoginMode = 'github' | 'email';

type Notice = {
  tone: 'success' | 'error';
  message: string;
};

const errorMessageMap: Record<string, string> = {
  github_not_allowed: '当前 GitHub 用户未被录入系统，无法登录。',
  github_profile: '未能从 GitHub 获取用户名，请稍后重试。',
  CredentialsSignin: '验证码无效或已过期，请重新发送验证码。'
};

const heroPhrases = [
  '轻量、直接、可持续迭代的基础管理系统',
  '把权限、工作区与流程骨架一次搭稳',
  '减少重复造轮子，让开发时间回到业务本身',
  '让后台模块按节奏扩展，而不是边做边返工'
];

const valueCards = [
  {
    title: '更快起盘',
    description:
      '把认证、权限、工作区这些共性能力先铺稳，业务模块可以直接往上接。',
    icon: Zap
  },
  {
    title: '更稳迭代',
    description:
      '保持边界清晰与结构简洁，后续扩通知、看板、工单时不用反复返工底层。',
    icon: Workflow
  }
] as const;

export default function SignInViewPage({
  githubEnabled,
  emailEnabled,
  error
}: SignInViewPageProps) {
  const [loginMode, setLoginMode] = useState<LoginMode>(
    githubEnabled ? 'github' : 'email'
  );
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const errorMessage = useMemo(() => {
    if (!error) {
      return null;
    }

    return errorMessageMap[error] || '登录失败，请检查配置后重试。';
  }, [error]);

  const switchLoginMode = (mode: LoginMode) => {
    if (
      (mode === 'github' && !githubEnabled) ||
      (mode === 'email' && !emailEnabled)
    ) {
      return;
    }

    setLoginMode(mode);
    setNotice(null);
    setDevCode(null);
  };

  const requestCode = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setNotice({ tone: 'error', message: '请先输入邮箱地址。' });
      return;
    }

    setRequestLoading(true);
    setNotice(null);
    setDevCode(null);

    try {
      const response = await fetch('/api/auth/email/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: normalizedEmail })
      });

      const payload = (await response.json()) as {
        message?: string;
        devCode?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message || '发送验证码失败。');
      }

      setNotice({
        tone: 'success',
        message: payload.message || '验证码已发送。'
      });
      setDevCode(payload.devCode || null);
    } catch (requestError) {
      setNotice({
        tone: 'error',
        message:
          requestError instanceof Error
            ? requestError.message
            : '发送验证码失败，请稍后再试。'
      });
    } finally {
      setRequestLoading(false);
    }
  };

  const submitEmailCode = async () => {
    const normalizedEmail = email.trim();
    const normalizedCode = code.trim();

    if (!normalizedEmail || normalizedCode.length !== 6) {
      setNotice({
        tone: 'error',
        message: '请输入邮箱并填写 6 位验证码。'
      });
      return;
    }

    setSubmitLoading(true);
    setNotice(null);

    const result = await signIn('email-code', {
      email: normalizedEmail,
      code: normalizedCode,
      redirect: false,
      callbackUrl: '/dashboard/overview'
    });

    if (result?.ok && result.url) {
      window.location.href = result.url;
      return;
    }

    setNotice({
      tone: 'error',
      message: '验证码校验失败，请确认输入正确。'
    });
    setSubmitLoading(false);
  };

  return (
    <div className='bg-background text-foreground relative min-h-screen overflow-hidden'>
      <ParticleBackground />
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.08),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.05),transparent_28%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_28%)]' />

      <div className='auth-page-scale relative mx-auto grid min-h-screen w-full max-w-[1440px] gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1.15fr)_480px] lg:px-8 lg:py-8'>
        <section className='border-border/70 bg-background/70 relative overflow-hidden rounded-[2rem] border p-6 shadow-2xl backdrop-blur-xl sm:p-8 lg:p-10'>
          <div className='via-foreground/25 absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent' />

          <div className='flex h-full flex-col justify-between gap-10'>
            <div className='space-y-8'>
              <div className='border-border/70 bg-background/75 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm backdrop-blur'>
                <Shield className='h-4 w-4' />
                Bendywork Base
              </div>

              <div className='space-y-5'>
                <p className='text-muted-foreground text-xs font-medium tracking-[0.32em] uppercase sm:text-sm'>
                  Build Faster
                </p>
                <div className='min-h-[144px] sm:min-h-[168px] lg:min-h-[224px]'>
                  <h1 className='max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl'>
                    <TypewriterText phrases={heroPhrases} />
                  </h1>
                </div>
                <div className='text-muted-foreground max-w-2xl space-y-3 text-sm leading-7 sm:text-base'>
                  <p>
                    系统不开放注册，只允许已录入的 GitHub
                    用户名或已授权邮箱登录。
                  </p>
                  <p>
                    先把认证、权限、工作区这些通用地基搭稳，再把开发节奏留给真正的业务需求。
                  </p>
                  <p>
                    结构保持轻量，扩展保持直接，后续每一轮迭代都能更可控地往前推进。
                  </p>
                </div>
              </div>
            </div>

            <div className='grid gap-4 xl:grid-cols-2'>
              {valueCards.map((card) => {
                const Icon = card.icon;

                return (
                  <div
                    key={card.title}
                    className='border-border/70 bg-background/60 rounded-[1.75rem] border p-6 shadow-lg backdrop-blur-sm'
                  >
                    <div className='bg-muted/80 mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl'>
                      <Icon className='h-5 w-5' />
                    </div>
                    <h2 className='text-xl font-semibold'>{card.title}</h2>
                    <p className='text-muted-foreground mt-3 text-sm leading-7'>
                      {card.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className='border-border/70 bg-background/80 relative overflow-hidden rounded-[2rem] border p-5 shadow-2xl backdrop-blur-xl sm:p-8'>
          <div className='via-foreground/30 absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent' />

          <div className='flex h-full flex-col justify-between gap-8'>
            <div className='space-y-6'>
              <div className='space-y-3 text-center sm:text-left'>
                <p className='text-muted-foreground text-xs font-medium tracking-[0.28em] uppercase'>
                  Access Portal
                </p>
                <div className='space-y-2'>
                  <h2 className='text-3xl font-semibold tracking-tight sm:text-4xl'>
                    登录系统
                  </h2>
                  <p className='text-muted-foreground text-sm leading-6'>
                    本系统为工作室内部系统，不开放注册。
                  </p>
                </div>
              </div>

              {(errorMessage || notice) && (
                <div className='space-y-3'>
                  {errorMessage && (
                    <div className='border-destructive/30 bg-destructive/10 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm'>
                      <AlertCircle className='text-destructive mt-0.5 h-4 w-4 shrink-0' />
                      <p className='leading-6'>{errorMessage}</p>
                    </div>
                  )}

                  {notice && (
                    <div
                      className={cn(
                        'flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm',
                        notice.tone === 'success'
                          ? 'border-emerald-500/25 bg-emerald-500/10'
                          : 'border-destructive/30 bg-destructive/10'
                      )}
                    >
                      {notice.tone === 'success' ? (
                        <CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0 text-emerald-500' />
                      ) : (
                        <AlertCircle className='text-destructive mt-0.5 h-4 w-4 shrink-0' />
                      )}
                      <div className='space-y-2 leading-6'>
                        <p>{notice.message}</p>
                        {devCode && (
                          <p className='text-muted-foreground text-xs sm:text-sm'>
                            开发环境验证码：
                            <span className='text-foreground ml-2 rounded-md border px-2 py-1 font-mono'>
                              {devCode}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className='bg-muted/60 grid grid-cols-2 gap-1 rounded-full p-1'>
                <button
                  type='button'
                  className={cn(
                    'rounded-full px-4 py-3 text-sm font-medium transition sm:px-5',
                    loginMode === 'github'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                    !githubEnabled && 'cursor-not-allowed opacity-40'
                  )}
                  onClick={() => switchLoginMode('github')}
                  aria-pressed={loginMode === 'github'}
                >
                  GitHub 授权
                </button>
                <button
                  type='button'
                  className={cn(
                    'rounded-full px-4 py-3 text-sm font-medium transition sm:px-5',
                    loginMode === 'email'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                    !emailEnabled && 'cursor-not-allowed opacity-40'
                  )}
                  onClick={() => switchLoginMode('email')}
                  aria-pressed={loginMode === 'email'}
                >
                  邮箱验证码
                </button>
              </div>

              <div className='border-border/70 bg-background/50 rounded-[1.75rem] border p-5 sm:p-6'>
                {loginMode === 'github' ? (
                  <div className='flex min-h-[360px] flex-col items-center justify-center text-center'>
                    <button
                      type='button'
                      className={cn(
                        'border-border/80 bg-background flex h-24 w-24 items-center justify-center rounded-full border shadow-lg transition duration-300',
                        githubEnabled
                          ? 'hover:-translate-y-1 hover:shadow-2xl'
                          : 'cursor-not-allowed opacity-50'
                      )}
                      onClick={() =>
                        githubEnabled &&
                        signIn('github', { callbackUrl: '/dashboard/overview' })
                      }
                      disabled={!githubEnabled}
                    >
                      <Github className='h-10 w-10' />
                    </button>

                    <div className='mt-8 space-y-3'>
                      <h3 className='text-2xl font-semibold'>
                        GitHub 授权登录
                      </h3>
                      <p className='text-muted-foreground mx-auto max-w-sm text-sm leading-7'>
                        请点击 GitHub 图标，授权登录并进入系统。
                      </p>
                      {!githubEnabled && (
                        <p className='text-destructive text-sm leading-6'>
                          当前环境未启用 GitHub 登录，请切换到邮箱验证码方式。
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <form
                    className='flex min-h-[360px] flex-col justify-center space-y-4'
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitEmailCode();
                    }}
                  >
                    <div className='space-y-2'>
                      <label className='text-sm font-medium'>邮箱地址</label>
                      <div className='relative'>
                        <Mail className='text-muted-foreground absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2' />
                        <Input
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          type='email'
                          placeholder='you@example.com'
                          className='border-border/70 bg-background/70 h-12 rounded-2xl pl-11'
                        />
                      </div>
                    </div>

                    <div className='grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end'>
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>验证码</label>
                        <Input
                          value={code}
                          onChange={(event) => setCode(event.target.value)}
                          inputMode='numeric'
                          maxLength={6}
                          placeholder='6 位验证码'
                          className='border-border/70 bg-background/70 h-12 rounded-2xl'
                        />
                      </div>
                      <Button
                        type='button'
                        variant='outline'
                        className='h-12 rounded-2xl px-5'
                        disabled={
                          !emailEnabled || !email.trim() || requestLoading
                        }
                        onClick={() => void requestCode()}
                      >
                        <Send className='h-4 w-4' />
                        {requestLoading ? '发送中' : '发送'}
                      </Button>
                    </div>

                    <Button
                      className='h-12 w-full rounded-2xl text-base font-medium'
                      size='lg'
                      disabled={
                        !emailEnabled ||
                        !email.trim() ||
                        code.trim().length !== 6 ||
                        submitLoading
                      }
                    >
                      {submitLoading ? '登录中...' : '使用验证码登录'}
                    </Button>

                    <p className='text-muted-foreground text-sm leading-6'>
                      仅限已授权邮箱使用，验证码有效期为 10 分钟。
                      {!emailEnabled && ' 当前环境未启用邮箱验证码登录。'}
                    </p>
                  </form>
                )}
              </div>
            </div>

            <div className='text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs sm:justify-start'>
              <span>系统不开放注册</span>
              <span className='hidden h-1 w-1 rounded-full bg-current/40 sm:inline-flex' />
              <Link
                href='/terms-of-service'
                className='hover:text-foreground transition'
              >
                服务条款
              </Link>
              <Link
                href='/privacy-policy'
                className='hover:text-foreground transition'
              >
                隐私政策
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
