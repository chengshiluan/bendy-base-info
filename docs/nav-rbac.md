# Navigation & RBAC

## 当前权限模型

系统分两层控制：

- 系统级角色：`super_admin` / `admin` / `member`
- 工作区内细粒度权限：例如 `users.create`、`users.update`、`roles.manage`、`tickets.assign`

## 设计原则

- 导航过滤只负责体验，不负责最终安全
- 真正的数据读写权限要在服务端校验
- 权限码要细到按钮级，便于后续做精细控制
- 用户主身份基于 GitHub 用户名，不单独维护用户名密码体系

## 当前导航结构

- 仪表盘
- 工作区
  - 团队管理
  - 用户管理
  - 角色管理
  - 权限管理
- 站内消息
- 看板
- 工单系统

## 权限码建议

推荐按照 `模块.动作` 形式维护：

- `users.view`
- `users.create`
- `users.update`
- `users.delete`
- `roles.view`
- `roles.manage`
- `permissions.manage`
- `teams.manage`
- `notifications.view`
- `tickets.assign`

## 服务端约束

后续每个关键模块都应补齐：

- 读取权限校验
- 写入权限校验
- 工作区归属校验
- 超级管理员兜底逻辑

## 前端约束

前端继续保留导航过滤与按钮显隐，但仅作为辅助体验层。
