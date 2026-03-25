import { NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { findUserByEmail } from '@/lib/auth/service';
import { generateLoginCode, saveLoginCode } from '@/lib/auth/email-code';
import { sendLoginCodeEmail } from '@/lib/auth/email';

const requestSchema = z.object({
  email: z.string().email()
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: '请输入有效的邮箱地址。' },
      { status: 400 }
    );
  }

  if (!env.database.enabled) {
    return NextResponse.json(
      { message: '数据库尚未配置，暂时无法发送验证码。' },
      { status: 503 }
    );
  }

  if (!env.redis.enabled) {
    return NextResponse.json(
      { message: 'Redis 尚未配置，暂时无法发送验证码。' },
      { status: 503 }
    );
  }

  const email = parsed.data.email.toLowerCase();
  const user = await findUserByEmail(email);

  if (!user || user.status !== 'active') {
    return NextResponse.json(
      { message: '该邮箱未被授权登录系统。' },
      { status: 403 }
    );
  }

  const code = generateLoginCode();
  await saveLoginCode(email, code);
  await sendLoginCodeEmail({ email, code });

  return NextResponse.json({
    message: env.email.enabled
      ? '验证码已发送，请检查邮箱。'
      : '邮箱服务尚未配置，验证码已输出到服务端日志。',
    ...(env.app.isDevelopment && !env.email.enabled ? { devCode: code } : {})
  });
}
