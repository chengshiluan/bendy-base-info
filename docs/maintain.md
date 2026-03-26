# Maintain

## 文档目的

这份文档用于项目后续维护，不负责讲“为什么做这个项目”，只负责讲：

- 怎么启动
- 怎么部署
- 怎么排障
- 怎么做日常维护
- 哪些文档要同步更新

## 强制协作流程

- 每次首次开始项目迭代前，先阅读 `docs/` 目录下的 Markdown 文档。
- 最少先看：`docs/AGENTS.md`、`docs/PLAN.md`、`docs/maintain.md`，以及本次任务相关专题文档。
- 每次较大的开发任务开始前，先把任务拆成子任务，再写入 `docs/PLAN.md`。
- 每完成一个子任务，就同步更新 `docs/PLAN.md` 的完成状态。
- 每次开发结束，都要在本文件记录本次做了什么、怎么验证、还有什么待继续。
- 默认在开发完成后执行 `git commit` 并 `git push origin <current-branch>`，除非用户明确要求不要提交或不要推送。

## 开发记录模板

```md
### YYYY-MM-DD - 迭代标题

- 完成事项：
  - ...
- 验证：
  - ...
- 后续待办：
  - ...
```

## 最近开发记录

### 2026-03-26 - 文档协作规范收口

- 完成事项：
  - 明确 `docs/` 为除 README 外的文档主目录
  - 在 `docs/AGENTS.md` 中加入首次先读 `docs/*.md`、计划拆分、完成即勾选、结束后更新维护文档、默认 `commit + push` 等规则
  - 将 `docs/PLAN.md` 切换为实际计划主文件
  - 将根目录 `Plan.md` 改为兼容入口，避免与 `docs/PLAN.md` 分叉
  - 补充 `docs/maintain.md` 的开发记录规范
- 验证：
  - 检查文档入口和引用路径，确保计划与维护入口统一到 `docs/`
- 后续待办：
  - 后续每次真实迭代继续在 `docs/PLAN.md` 和 `docs/maintain.md` 中追加记录

## 运行环境

### Node / 包管理器

- 推荐 Node：`24.11.0`
- `package.json` 要求：`24.x`
- 推荐包管理器：`npm` 或 `bun`

### 当前已知问题

- 如果本机仍在 Node 16，下列命令可能异常：
  - `npm run lint`
- 症状：
  - ESLint / Next 配置在加载阶段报 `structuredClone is not defined`
- 处理方式：
  - 先切到 Node 24 再执行开发命令

## 本地开发流程

### 1. 安装依赖

```bash
nvm use 24.11.0
npm install
```

### 2. 配置环境变量

```bash
cp env.example.txt .env.local
```

至少关注：

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GITHUB_ID`
- `GITHUB_SECRET`
- `DATABASE_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `S3_*`

### 3. 初始化数据库

```bash
npm run db:push
```

### 4. 启动开发

```bash
npm run dev
```

### 5. 交付前最小检查

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## 项目结构速记

- 路由：`src/app`
- 业务 UI：`src/features`
- 通用 UI：`src/components`
- 认证/平台基础设施：`src/lib`
- 数据库：`src/lib/db`
- 平台服务与写入：`src/lib/platform`
- 文档：`docs/PLAN.md`、`docs/maintain.md`、`docs/AGENTS.md`、`CHANGELOG.md`，以及其他 `docs/*`

## 核心维护点

### 认证

核心文件：

- [src/auth.ts](/Users/scx/data/codeData/javascript/nextjs/bendywork-info-base/src/auth.ts)
- [src/lib/auth/service.ts](/Users/scx/data/codeData/javascript/nextjs/bendywork-info-base/src/lib/auth/service.ts)
- [src/lib/auth/email-code.ts](/Users/scx/data/codeData/javascript/nextjs/bendywork-info-base/src/lib/auth/email-code.ts)

维护规则：

- 不开放注册
- GitHub 登录必须先有 `users` 表记录
- 邮箱验证码登录依赖 Redis
- 开发环境无邮件服务时会返回 `devCode`
- 生产环境必须配置真实邮件发送

排障检查：

- GitHub 登录失败：
  - 检查 `GITHUB_ID` / `GITHUB_SECRET`
  - 检查回调地址 `/api/auth/callback/github`
  - 检查用户是否已录入且状态为 `active`
- 邮箱验证码失败：
  - 检查 Redis 配置
  - 检查 `RESEND_API_KEY`
  - 检查 `EMAIL_FROM`

### 数据库

核心文件：

- [src/lib/db/schema.ts](/Users/scx/data/codeData/javascript/nextjs/bendywork-info-base/src/lib/db/schema.ts)
- [drizzle.config.ts](/Users/scx/data/codeData/javascript/nextjs/bendywork-info-base/drizzle.config.ts)

维护规则：

- 当前以 `drizzle-kit push` 为主
- 每次改 schema 前先确认生产库兼容性
- 删除字段、改唯一索引、改 enum 时必须先写迁移策略

变更流程：

1. 修改 schema
2. 本地 `npm run db:push`
3. 验证页面与 API
4. 更新 `docs/maintain.md` 或相关专题文档

### 平台服务与管理后台

核心文件：

- [src/lib/platform/service.ts](/Users/scx/data/codeData/javascript/nextjs/bendywork-info-base/src/lib/platform/service.ts)
- [src/lib/platform/mutations.ts](/Users/scx/data/codeData/javascript/nextjs/bendywork-info-base/src/lib/platform/mutations.ts)
- [src/lib/platform/validators.ts](/Users/scx/data/codeData/javascript/nextjs/bendywork-info-base/src/lib/platform/validators.ts)

维护规则：

- 读操作优先收敛到 `service.ts`
- 写操作优先收敛到 `mutations.ts`
- API route 只做：
  - session / permission guard
  - request parse
  - 调用 service / mutations
  - 错误转换

补功能时优先顺序：

1. `types`
2. `validators`
3. `service` / `mutations`
4. API route
5. page / client component
6. 文档与 changelog

### 工作区切换

核心文件：

- [src/components/org-switcher.tsx](/Users/scx/data/codeData/javascript/nextjs/bendywork-info-base/src/components/org-switcher.tsx)
- [src/app/api/workspaces/route.ts](/Users/scx/data/codeData/javascript/nextjs/bendywork-info-base/src/app/api/workspaces/route.ts)
- [src/app/api/workspaces/active/route.ts](/Users/scx/data/codeData/javascript/nextjs/bendywork-info-base/src/app/api/workspaces/active/route.ts)

维护规则：

- 工作区切换依赖 cookie `active_workspace_id`
- 已归档工作区不应进入切换器
- 非 `super_admin` 只能看到自己归属的工作区

### 文件上传 / S3

核心文件：

- [src/app/api/admin/uploads/route.ts](/Users/scx/data/codeData/javascript/nextjs/bendywork-info-base/src/app/api/admin/uploads/route.ts)
- [src/lib/storage](/Users/scx/data/codeData/javascript/nextjs/bendywork-info-base/src/lib/storage)

维护规则：

- 目前是能力预留，不代表业务已经完全接通
- 真正接入前要明确：
  - 文件大小限制
  - MIME 白名单
  - 工作区隔离策略
  - 公有 / 私有访问策略

## 部署维护

### Vercel

推荐顺序：

1. 配置 GitHub OAuth
2. 配置 Neon
3. 配置 Upstash
4. 配置邮件服务
5. 配置 S3
6. 录入 Vercel 环境变量
7. 首次部署前执行 `npm run db:push`
8. 部署后验证登录、工作区切换、核心管理页面

### 每次发布前检查

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- 至少用一个管理员账号走通：
  - 登录
  - 工作区切换
  - 工作区/团队/用户/角色/权限任一写入操作
  - 通知或工单任一写入操作

### 生产故障排查顺序

1. 看 Vercel build log
2. 看运行时 log
3. 查环境变量是否缺失
4. 查数据库连接
5. 查 Redis
6. 查 OAuth 回调地址
7. 查最近 schema 变更

## 文档维护规则

### 这些文件分别负责什么

- `docs/PLAN.md`
  - 记录后续要做的事情和迭代顺序
- `docs/maintain.md`
  - 记录怎么维护项目
- `docs/AGENTS.md`
  - 记录 AI / 开发协作约束与开发前置规则
- `CHANGELOG.md`
  - 记录已经完成的可感知变更
- `README.md`
  - 面向项目使用者和新接手开发者

### 什么时候更新文档

- 完成一个阶段性功能：更新 `CHANGELOG.md`
- 改变路线图：更新 `docs/PLAN.md`
- 改变运行、部署、排障方式：更新 `docs/maintain.md`
- 改变项目介绍或使用方式：更新 `README.md`

## 常见维护动作

### 新增一个管理模块

1. 在 `src/lib/platform/types.ts` 定义类型
2. 在 `src/lib/platform/validators.ts` 定义 schema
3. 在 `src/lib/platform/service.ts` / `mutations.ts` 落服务逻辑
4. 在 `src/app/api/admin/...` 增加路由
5. 在 `src/features/management/components` 增加 client 组件
6. 在 `src/app/dashboard/...` 增加页面
7. 更新导航、计划、变更记录

### 改数据库结构

1. 改 `schema.ts`
2. 本地 `db:push`
3. 验证受影响页面与 API
4. 更新部署和维护文档

### 发布新版本

1. 确认 `docs/PLAN.md` 中本轮目标已完成
2. 更新 `CHANGELOG.md`
3. 跑最小验证
4. 再发布

## 仍需持续补强的维护项

- CI 自动检查
- 自动化测试
- 生产错误采集
- 审计日志查看能力
- 数据库备份与回滚手册
- 邮件模板与通知模板
