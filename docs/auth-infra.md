# Auth & Infra Setup

## 1. 认证方式

当前系统只保留两种登录方式：

- GitHub OAuth
- 邮箱验证码登录

系统不开放注册。

用户要先存在于 `users` 表里，才能登录。

## 2. GitHub OAuth 配置

在 GitHub 创建 OAuth App 时建议这样填写：

- Homepage URL
  - 本地：`http://localhost:3000`
  - 生产：`https://your-domain.com`
- Authorization callback URL
  - 本地：`http://localhost:3000/api/auth/callback/github`
  - 生产：`https://your-domain.com/api/auth/callback/github`

对应环境变量：

```env
GITHUB_ID=""
GITHUB_SECRET=""
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-random-32-char-secret"
```

## 3. 邮箱验证码登录

验证码依赖 Redis，邮件发送当前预留为 Resend。

```env
UPSTASH_REDIS_REST_URL="https://your-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN=""
RESEND_API_KEY=""
EMAIL_FROM="noreply@example.com"
```

说明：

- Redis 未配置时，邮箱验证码登录不可用
- 邮件服务未配置时，开发环境会返回 `devCode`
- 生产环境必须补齐真实邮件发送能力

## 4. Neon PostgreSQL

```env
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
```

初始化步骤：

```bash
npm run db:push
```

如果后续要生成迁移文件：

```bash
npm run db:generate
```

## 5. 初始超级管理员

示例 SQL：

```sql
insert into users (
  id,
  github_username,
  github_user_id,
  email,
  display_name,
  system_role,
  status,
  email_login_enabled
)
values (
  '270390664',
  'juzi',
  '270390664',
  'juzi@example.com',
  '橘色',
  'super_admin',
  'active',
  true
);
```

这里的 `id` 直接使用 GitHub 的 user ID，和 `github_user_id` 保持一致。

如果该用户需要进入某个工作区，再补：

```sql
insert into workspace_members (workspace_id, user_id, is_owner)
select 'your-workspace-id', id, true
from users
where github_username = 'juzi';
```

## 6. S3 配置预留

当前代码已经预留 S3 客户端与公开地址拼接能力：

```env
S3_REGION=""
S3_BUCKET=""
S3_ENDPOINT=""
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_PUBLIC_BASE_URL=""
```

适合后续接：

- 附件上传
- 用户头像缓存
- 工单文件
- 富文本资源

## 7. Vercel 部署建议

部署到 Vercel 时建议这样配置：

1. 创建 Vercel 项目并绑定仓库
2. 在 Project Settings -> Environment Variables 中录入全部生产环境变量
3. 将 `NEXTAUTH_URL` 设置为线上正式域名
4. 将 GitHub OAuth 回调地址改成线上域名
5. 首次上线前先对生产库执行 `npm run db:push`
6. 发布后用已录入的 GitHub 用户测试登录

## 8. 登录开关

如果某种登录方式暂时不想开放，可以直接控制：

```env
NEXT_PUBLIC_ENABLE_GITHUB_LOGIN="false"
NEXT_PUBLIC_ENABLE_EMAIL_LOGIN="false"
```
