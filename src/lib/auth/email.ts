import { env } from '@/lib/env';

interface SendLoginCodeEmailParams {
  email: string;
  code: string;
}

export async function sendLoginCodeEmail({
  email,
  code
}: SendLoginCodeEmailParams): Promise<void> {
  if (env.email.enabled && env.email.resendApiKey && env.email.from) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.email.resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: env.email.from,
        to: email,
        subject: `${env.app.name} 登录验证码`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>${env.app.name}</h2><p>你的登录验证码是：</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>验证码 10 分钟内有效。</p></div>`
      })
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to send login code email: ${message}`);
    }

    return;
  }

  console.info(
    `[auth] Email provider not configured. Login code for ${email}: ${code}`
  );
}
