# Changelog

## 0.1.2 - 2026-03-25

### Changed

- 账户下拉菜单移除“用户管理”快捷入口，避免重复导航
- 账户下拉菜单底部新增当前系统版本展示
- 项目版本号统一升级为 `0.1.2`

## 0.1.0 - 2026-03-24

### Added

- 新的认证基线：GitHub OAuth + 邮箱验证码登录
- NextAuth.js 认证入口与会话扩展
- Neon PostgreSQL + Drizzle ORM 基础设施
- Upstash Redis 验证码存储
- S3 配置占位与客户端封装
- 根目录 `Plan.md` 与 `maintain.md` 主文档
- 工作区管理 CRUD（新增、编辑、归档）
- 工作区、团队、用户、角色、权限、通知、工单管理页基础骨架
- `Plan.md` 作为迭代计划主文件
- `docs/auth-infra.md` 作为部署和配置说明

### Changed

- 根布局与全局 Provider 改为基于 NextAuth 的会话体系
- 登录页改为“仅授权用户可登录”的业务模式
- 工作区管理页升级为可维护模式，归档工作区会从工作区切换器中隐藏
- 管理写入链路增加唯一性与关联校验，减少脏数据写入
- 仪表盘改为基础管理系统语义与真实指标汇总
- README 与环境模板重写为当前项目说明

### Removed

- 旧认证、组织与计费依赖
- 旧监控配置与接入
- Billing、Exclusive、旧 Team Profile 等不再适用页面
- 原模板 README 与旧体系文档
