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
- `git commit` 与 `git push origin <current-branch>` 是每次开发完成后的硬性交付指标，不再只是默认动作。
- 除非用户明确要求不要提交或不要推送，否则禁止跳过 `commit` 或 `push`。
- 如果 `git push` 失败，必须在本文件记录失败原因、已做重试和下一步处理，不能把任务判定为已完整交付。

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

### 2026-03-28 - 仪表盘权限可绑定修复与版本升级 0.1.8

- 完成事项：
  - 排查确认角色编辑弹窗里 `仪表盘` 不能勾选的直接原因有三层：`listRolePermissionTree()` 把 `dashboard.overview.menu` 当成虚拟展示节点、角色权限展开逻辑拒绝任何全局权限、会话快照又只读取工作区级角色权限，导致 UI 不可勾选且即使强行绑定也不会真正生效
  - 调整 `src/lib/platform/service.ts`、`src/lib/platform/mutations.ts` 与 `src/lib/platform/rbac.ts`，将 `dashboard.overview.menu` 纳入工作区角色可绑定的特例全局权限，同时把默认 `admin` / `member` 角色种子补上该权限，保证现有默认角色不会在升级后丢失仪表盘入口
  - 调整 `src/lib/auth/service.ts` 与 `src/lib/auth/permission.ts`，让当前活跃工作区角色绑定的 `dashboard.overview.menu` 能正确进入会话权限判断，并去掉 `admin` / `member` 上原本硬编码的仪表盘全局权限，保证角色勾选结果与访问结果一致
  - 在 `src/app/dashboard/overview/layout.tsx` 为仪表盘页补上基于当前活跃工作区的页面权限守卫，未绑定该权限时即使直达 `/dashboard/overview` 也会被拦截
  - 将项目版本号升级到 `0.1.8`，并同步更新 `CHANGELOG.md`、`docs/PLAN.md`、`docs/nav-rbac.md`、`docs/database-init.sql`、`package.json`、`package-lock.json`、`src/lib/app-info.ts`
- 验证：
  - 在 Node `24.11.0` 环境执行 `npx tsc --noEmit`，通过
  - 在 Node `24.11.0` 环境执行 `npm run lint`，通过；保留 2 条既有 `react-hooks/incompatible-library` warning（`src/components/forms/demo-form.tsx`、`src/hooks/use-data-table.ts`）
  - 在 Node `24.11.0` 环境执行 `npm run build`，通过；保留既有 `baseline-browser-mapping` 过期提示
- 后续待办：
  - 部署后进入角色管理弹窗，确认 `仪表盘` 节点已恢复可勾选，取消勾选后左侧菜单不再显示该入口
  - 部署后使用一个非超级管理员账号验证：当前活跃工作区角色未绑定 `dashboard.overview.menu` 时，直达 `/dashboard/overview` 会被拦截

### 2026-03-27 - 新增用户 GitHub 自动搜索恢复与版本升级 0.1.7

- 完成事项：
  - 排查确认新增用户弹窗当前没有任何 GitHub 自动搜索逻辑，而 `/api/admin/users/github-search` 在 RBAC 收口后又只允许“团队导入”权限访问，导致用户管理页既没有自动搜索体验，也无法直接复用现有 GitHub 搜索接口
  - 在 `src/features/management/components/users-management-client.tsx` 为 GitHub 用户名输入补上防抖自动搜索、候选结果回填、完全匹配高亮和统一的弹窗关闭重置逻辑
  - 调整 `src/app/api/admin/users/github-search/route.ts` 的权限守卫，允许“团队导入”或“用户新增 / 编辑”任一权限命中时访问 GitHub 搜索接口
  - 将项目版本号升级到 `0.1.7`，并同步更新 `CHANGELOG.md`、`docs/PLAN.md`、`package.json`、`package-lock.json`、`src/lib/app-info.ts`
- 验证：
  - 在 Node `24.11.0` 环境执行 `npx tsc --noEmit`，通过
  - 在 Node `24.11.0` 环境执行 `npm run lint`，通过；保留 2 条既有 `react-hooks/incompatible-library` warning（`src/components/forms/demo-form.tsx`、`src/hooks/use-data-table.ts`）
  - 在 Node `24.11.0` 环境执行 `npm run build`，通过；保留既有 `baseline-browser-mapping` 过期提示
- 后续待办：
  - 部署后进入“用户管理 -> 新增用户”弹窗，确认输入 GitHub 用户名关键字后会自动出现候选结果，且点击候选后可以正常创建用户
  - 如后续需要把显示名称在前端即时预填，可在现有自动搜索基础上继续增加单用户详情预览接口

### 2026-03-27 - 角色弹窗权限树层级修复

- 完成事项：
  - 将角色管理页从通用工作区权限树切回专用的 `listRolePermissionTree()`，让编辑角色弹窗使用与权限管理页一致的层级展示模型
  - 在角色专用权限树中补出 `dashboard.overview.menu` 与 `dashboard.workspaces.manage.*` 这一组仅用于展示层级的虚拟节点，确保 `仪表盘` 与 `管理工作区` 出现在正确位置
  - 调整 `PermissionTreeSelector`，对没有任何可绑定权限 ID 的纯展示节点禁用勾选，避免把全局展示节点误认为可绑定到工作区角色
- 验证：
  - 在 Node `24.11.0` 环境执行 `listRolePermissionTree()` 复查，确认根层包含 `dashboard.overview.menu`，且 `dashboard.workspaces.menu` 下包含 `dashboard.workspaces.manage.menu`
  - 在 Node `24.11.0` 环境执行 `npx tsc --noEmit`，通过
  - 在 Node `24.11.0` 环境执行 `npm run lint`，通过；保留 2 条既有 `react-hooks/incompatible-library` warning（`src/components/forms/demo-form.tsx`、`src/hooks/use-data-table.ts`）
  - 在 Node `24.11.0` 环境执行 `npm run build`，通过
- 后续待办：
  - 部署后进入角色管理弹窗，确认 `仪表盘`、`管理工作区` 已出现在树中，且纯展示节点复选框为禁用态

### 2026-03-27 - 隐藏菜单节点补齐

- 完成事项：
  - 将 `管理工作区` 从“旧权限映射问题”提升为当前菜单模型中的真实隐藏菜单节点，挂到 `dashboard.workspaces.menu` 下，并把工作区管理页对应的 `新增 / 编辑 / 归档` 动作权限一起迁到该节点下
  - 将权限管理页与 `/api/admin/permissions` 的树数据改为读取完整权限树，补上根层 `仪表盘`，并让 `工作区 -> 管理工作区` 在树层级上与 `团队管理 / 用户管理 / 角色管理 / 权限管理` 保持一致
  - 联调 `src/components/org-switcher.tsx`、工作区管理页和工作区相关 API 守卫，让工作区切换器里的“管理工作区”入口与隐藏菜单权限保持一致
  - 同步更新 `docs/database-init.sql` 与 `docs/nav-rbac.md`，确保初始化 SQL、权限码示例和当前菜单模型一致
- 验证：
  - 在 Node `24.11.0` 环境执行 `ensureWorkspaceRbacInitialized()`，返回 `insertedPermissions: 4`，本地库已补齐 `dashboard.workspaces.manage.menu` 与其 3 个动作权限
  - 在 Node `24.11.0` 环境复查 `listPermissionTree('all')`，确认根层包含 `dashboard.overview.menu`，且 `dashboard.workspaces.menu` 下第一层包含 `dashboard.workspaces.manage.menu`
  - 在 Node `24.11.0` 环境执行 `npx tsc --noEmit`，通过
  - 在 Node `24.11.0` 环境执行 `npm run lint`，通过；保留 2 条既有 `react-hooks/incompatible-library` warning（`src/components/forms/demo-form.tsx`、`src/hooks/use-data-table.ts`）
  - 在 Node `24.11.0` 环境执行 `npm run build`，通过
- 后续待办：
  - 部署后进入权限管理页，确认根层能看到 `仪表盘`，展开 `工作区菜单` 后能看到 `管理工作区`
  - 部署后验证工作区切换器中的“管理工作区”仅在具备对应隐藏菜单权限时显示

### 2026-03-27 - 顶层旧权限映射修正

- 完成事项：
  - 修正上一轮对顶层旧权限的归类，确认 `workspaces.manage`、`workspaces.view` 不应被视为纯废弃项，而是应对应当前全局 `dashboard.workspaces.menu` 层级
  - 同步将 `dashboard.view`、`profile.view`、`profile.update` 一并纳入顶层旧权限映射，统一收口到当前全局菜单 / 动作权限
  - 调整 `src/lib/db/bootstrap.ts` 的 legacy 权限迁移逻辑，允许向当前全局权限树补齐祖先链，而不再只处理工作区级节点
- 验证：
  - 在 Node `24.11.0` 环境执行 `npx tsc --noEmit`，通过
  - 在 Node `24.11.0` 环境执行 `npm run lint`，通过；保留 2 条既有 `react-hooks/incompatible-library` warning（`src/components/forms/demo-form.tsx`、`src/hooks/use-data-table.ts`）
  - 在 Node `24.11.0` 环境执行 `npm run build`，通过
- 后续待办：
  - 线上如仍存在绑定 `workspaces.manage` / `workspaces.view` 的旧角色数据，部署后会优先迁移到当前全局工作区权限，再删除旧编码

### 2026-03-27 - 历史未归类权限清理

- 完成事项：
  - 盘点当前库中的“历史未归类权限”后确认，真正需要处理的是 27 条旧模型遗留的扁平动作权限，例如 `teams.view`、`roles.manage`、`tickets.view`、`workspaces.switch`，而不是当前树里的工作区菜单节点
  - 逐条核对这些旧权限后确认：本地库里不存在仍被角色引用的重复权限，也没有需要补回树结构的漏挂节点；其中顶层 `workspaces.*` / `dashboard.*` / `profile.*` 已在后续修正中改为映射到当前全局权限层，其余遗留权限均属于当前模型已废弃的旧扁平编码
  - 在 `src/lib/db/bootstrap.ts` 中补充 legacy 权限迁移与清理逻辑：对仍有明确替代关系的旧权限先映射到当前树形权限，再统一删除旧权限记录
  - 在本地执行一次 `ensureWorkspaceRbacInitialized()`，实际删除 27 条遗留权限，当前库中“历史未归类权限”已清零
- 验证：
  - 在 Node `24.11.0` 环境执行库内巡检，确认旧扁平权限共 27 条，且本地库里 `roleCount` 全为 0
  - 在 Node `24.11.0` 环境执行 `ensureWorkspaceRbacInitialized()`，返回 `deletedLegacyPermissions: 27`
  - 在 Node `24.11.0` 环境复查数据库，确认剩余历史未归类权限数量为 0
  - 在 Node `24.11.0` 环境执行 `npx tsc --noEmit`，通过
  - 在 Node `24.11.0` 环境执行 `npm run lint`，通过；保留 2 条既有 `react-hooks/incompatible-library` warning（`src/components/forms/demo-form.tsx`、`src/hooks/use-data-table.ts`）
  - 在 Node `24.11.0` 环境执行 `npm run build`，通过
- 后续待办：
  - 部署后复查线上库里是否存在仍被角色引用的旧扁平权限；如果有，将按本次 bootstrap 映射先迁移再删除
  - 如后续要重新开放“自定义根权限”这类能力，需要先给它定义合法父节点，避免再次出现无父级扁平动作权限

### 2026-03-27 - 工作区权限树断层修复

- 完成事项：
  - 定位当前“权限不成树、还有零散节点”的直接原因是工作区权限树按 `scope=workspace` 过滤后丢失了全局祖先 `dashboard.workspaces.menu`，导致角色页、权限页和权限接口拿到的都是断裂树
  - 在 `src/lib/platform/service.ts` 新增 `listWorkspacePermissionTree()`，统一为工作区权限补齐缺失祖先链，再供角色管理页、权限管理页和 `/api/admin/permissions` 复用
  - 调整 `PermissionTreeSelector` 的勾选逻辑，虚拟祖先节点只负责承载子树，不再把虚拟 ID 提交给角色写入接口
  - 调整权限管理页的新增入口，仅允许在真实工作区菜单节点下新增下级权限，避免对虚拟全局祖先发起无效创建
- 验证：
  - 在 Node `24.11.0` 环境执行 `npx tsc --noEmit`，通过
  - 在 Node `24.11.0` 环境执行 `npm run lint`，通过；保留 2 条既有 `react-hooks/incompatible-library` warning（`src/components/forms/demo-form.tsx`、`src/hooks/use-data-table.ts`）
  - 在 Node `24.11.0` 环境执行 `npm run build`，通过
- 后续待办：
  - 部署后进入角色管理页和权限管理页，确认 `工作区` 节点已恢复成完整树，角色保存不会再带入虚拟权限 ID
  - 如后续需要支持在 `dashboard.workspaces.menu` 下新增自定义一级菜单，再单独放开全局父菜单的创建约束

### 2026-03-27 - 角色权限树与遗留权限收口

- 完成事项：
  - 定位角色管理弹窗“绑定权限”杂乱的直接原因是当前菜单树权限与历史扁平权限同时存在，导致角色编辑时混在一起展示
  - 调整 `PermissionTreeSelector`，让角色弹窗默认按当前菜单树展示，并把未挂到菜单树上的历史 / 未归类权限收纳到单独分组
  - 调整系统角色权限同步逻辑，启动期会移除 `super_admin` / `admin` / `member` 上不在当前种子里的旧权限映射，再补齐缺失的当前权限
  - 让 `docs/database-init.sql` 直接由当前 bootstrap 权限种子生成，并同步更新 `docs/nav-rbac.md` 与 `docs/PLAN.md`
- 验证：
  - 在 Node `24.11.0` 环境执行 `npx tsc --noEmit`，通过
  - 在 Node `24.11.0` 环境执行 `npm run lint`，通过；保留 2 条既有 `react-hooks/incompatible-library` warning（`src/components/forms/demo-form.tsx`、`src/hooks/use-data-table.ts`）
  - 在 Node `24.11.0` 环境执行 `npm run build`，通过
- 后续待办：
  - 部署后进入角色管理页，确认系统内置角色会自动切换到当前菜单树权限，遗留权限仅在兼容分组中出现
  - 如线上仍存在业务自定义的历史权限编码，可按业务需要决定是否继续迁移或下线

### 2026-03-27 - Legacy UUID 兼容补丁

- 完成事项：
  - 定位启动期 `value too long for type character varying(32)` 的直接原因是历史 `users.id` / 用户外键仍为 UUID 文本 36 位，迁移时被强制改为 `varchar(32)`
  - 将 `users.id` 以及所有引用用户主键的外键兼容长度统一放宽到 `varchar(64)`，允许 legacy UUID 与 GitHub 数字 ID 共存迁移
  - 同步更新 `src/lib/db/schema.ts`、`src/lib/db/bootstrap.ts` 与 `docs/database-init.sql`
  - 顺手修复 `src/lib/platform/rbac.ts` 中 `module` 变量名触发的 lint / TypeScript 问题，恢复 Node 24 环境下的最小检查
- 验证：
  - 在 Node `24.11.0` 环境执行 `npx tsc --noEmit`，通过
  - 在 Node `24.11.0` 环境执行 `npm run lint`，通过；保留 2 条既有 `react-hooks/incompatible-library` warning（`src/components/forms/demo-form.tsx`、`src/hooks/use-data-table.ts`）
  - 在 Node `24.11.0` 环境执行 `npm run build`，通过
- 后续待办：
  - 部署后观察 instrumentation bootstrap 是否消失
  - 验证历史 UUID 用户、已对齐 GitHub ID 用户、仅邮箱登录用户三类数据都能正常通过认证与权限查询

### 2026-03-27 - GitHub 用户 ID 对齐与启动期 bootstrap 修复

- 完成事项：
  - 将 GitHub OAuth、管理后台新增/导入/更新用户、数据库 schema 统一到 GitHub `user.id` 主键模型
  - 为旧库补充用户主键与关联外键从 UUID 向 GitHub user ID 的兼容迁移逻辑
  - 修复启动期 bootstrap 中对 UUID 类型 `users.id` 直接做正则判断导致的 `operator does not exist: uuid ~ unknown`
  - 为 instrumentation 中的数据库初始化增加容错，避免 bootstrap 失败直接导致服务启动 500
  - 按协作文档要求补充 `docs/PLAN.md`、`docs/auth-infra.md`、`docs/database-init.sql`、`docs/local-bootstrap.sql`
- 验证：
  - 执行 `npx tsc --noEmit`，通过
  - 执行 `npm run lint`，失败；当前环境为 Node `v16.20.2`，ESLint 配置加载阶段报 `structuredClone is not defined`
  - 执行 `npm run build`，失败；Next.js 16 要求 Node `>=20.9.0`，当前环境为 Node `v16.20.2`
- 后续待办：
  - 在 Node 24 环境重新执行 `npm run lint` 与 `npm run build`
  - 部署最新提交后，观察首次 GitHub OAuth 登录是否完成旧用户记录对齐
  - 如线上历史数据存在重复 `github_username` / `github_user_id` 映射，需先清理冲突记录再继续迁移

### 2026-03-26 - 团队成员 GitHub 搜索添加与版本升级 0.1.3

- 完成事项：
  - 严查团队管理相关真实数据库结构，核对 `users`、`workspaces`、`workspace_members`、`teams`、`team_members` 5 张表的字段、主键、外键和唯一索引
  - 为团队管理新增 GitHub 成员搜索能力，新增 `/api/admin/users/github-search` 搜索接口
  - 新增 `/api/admin/users/github-import` 批量导入接口，按规范先补 `users`，再补 `workspace_members`，最后由团队表单提交时写入 `team_members`
  - 在新增/编辑团队弹窗的“团队成员”区域增加 `+` 按钮，点击后打开子弹窗，支持搜索 GitHub 用户、批量勾选、批量加入团队待选成员
  - 为新一轮交付同步升级版本号到 `0.1.3`，并更新 `CHANGELOG.md`、`README.md`、`docs/PLAN.md`、`src/lib/app-info.ts`
- 验证：
  - 在 Node `24.11.0` 环境下查询真实数据库，确认上述 5 张表已存在，且字段结构、关系约束与代码 schema 一致
  - 在 Node `24.11.0` 环境下执行 `npx tsc --noEmit`，通过
  - 在 Node `24.11.0` 环境下执行 `npm run lint`，通过；保留 2 条既有 `react-hooks/incompatible-library` warning（`src/components/forms/demo-form.tsx`、`src/hooks/use-data-table.ts`）
  - 在 Node `24.11.0` 环境下执行 `npm run build`，通过
- 后续待办：
  - 如 GitHub 搜索使用频率升高，可考虑补充专用 `GITHUB_API_TOKEN` 以缓解公共速率限制
  - 视需要更新 `baseline-browser-mapping` 开发依赖，消除构建阶段的过期提示

### 2026-03-26 - 登录页 UI 重构与缩放校准

- 完成事项：
  - 重做登录页左右双栏布局，右侧切换为 `GitHub 授权` / `邮箱验证码` 两种登录方式
  - 将 GitHub 登录入口改为中央图标直达授权，邮箱验证码区保留现有链路并调整为更紧凑的表单样式
  - 删除登录页服务状态和无效说明，左侧品牌区改为打字机文案与开发提效导向描述
  - 增加动态粒子背景，并在桌面端为登录页增加 `0.9` 整体缩放，观感对齐浏览器 90% 视角
  - 将 GitHub 引导文案更新为“请点击 GitHub 图标，授权登录并进入系统。”
  - 将登录卡副标题更新为“本系统为工作室内部系统，不开放注册。”
- 验证：
  - 执行 `npx tsc --noEmit`，通过
  - 在 Node `24.11.0` 环境下执行 `npm run lint`，通过；保留 2 条既有 `react-hooks/incompatible-library` warning（`src/components/forms/demo-form.tsx`、`src/hooks/use-data-table.ts`）
  - 在 Node `24.11.0` 环境下执行 `npm run build`，通过
- 后续待办：
  - 视需要更新 `baseline-browser-mapping` 开发依赖，消除构建阶段的过期提示

### 2026-03-26 - 提交与远程推送硬指标化

- 完成事项：
  - 将开发完成后必须执行 `git commit` 与 `git push origin <current-branch>` 明确升级为协作硬性指标
  - 在 `docs/AGENTS.md` 与 `docs/maintain.md` 中统一跳过条件，只允许用户明确禁止时例外
  - 增加 `git push` 失败时必须记录阻塞与重试情况的要求，避免出现“本地完成、远程未交付”的假完成态
- 验证：
  - 逐条检查 `docs/AGENTS.md` 与 `docs/maintain.md` 中关于交付阶段的措辞，确认都已改为强制要求
  - 检查本文件开发记录已同步追加
- 后续待办：
  - 后续所有真实开发迭代执行完成后，严格按该硬指标进行 `commit + push`

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
