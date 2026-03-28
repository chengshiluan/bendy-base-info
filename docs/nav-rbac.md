# Navigation & RBAC

## 当前权限模型

系统分两层控制：

- 系统级角色：`super_admin` / `admin` / `member`
- 工作区内细粒度权限：以“菜单节点 + 操作节点”树形组织

## 设计原则

- 导航过滤只负责体验，不负责最终安全
- 真正的数据读写权限要在服务端校验
- 权限码要细到按钮级，并且优先挂在菜单树下，便于角色弹窗按树展示
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

## 当前权限码形态

当前仓库已经切到树形权限编码，推荐直接复用菜单节点与按钮节点：

- 菜单节点：`dashboard.overview.menu`
- 菜单节点：`dashboard.workspaces.menu`
- 隐藏菜单节点：`dashboard.workspaces.manage.menu`
- 页面操作：`dashboard.workspaces.manage.create`
- 页面操作：`dashboard.workspaces.manage.update`
- 页面操作：`dashboard.workspaces.manage.archive`
- 菜单节点：`dashboard.workspaces.roles.menu`
- 页面操作：`dashboard.workspaces.roles.create`
- 页面操作：`dashboard.workspaces.roles.update`
- 页面操作：`dashboard.workspaces.roles.delete`
- 菜单节点：`dashboard.workspaces.permissions.menu`
- 页面操作：`dashboard.workspaces.permissions.create`
- 菜单节点：`dashboard.workspaces.tickets.menu`
- 页面操作：`dashboard.workspaces.tickets.assign`
- 菜单节点：`dashboard.profile.menu`
- 页面操作：`dashboard.profile.update`

角色管理里的“绑定权限”应优先按当前菜单树展示；没有挂到菜单树上的历史权限，只能作为兼容项收纳，不能再作为主展示结构。

其中 `dashboard.overview.menu` 虽然是全局菜单节点，但当前已经允许通过工作区角色进行绑定，用于控制当前活跃工作区下的仪表盘入口显示与 `/dashboard/overview` 页面访问。

其中 `dashboard.workspaces.manage.menu` 属于隐藏菜单节点，不在左侧菜单栏直接展示，但它对应工作区切换器里的“管理工作区”入口，树层级与 `团队管理 / 用户管理 / 角色管理 / 权限管理` 保持一致。

## 服务端约束

后续每个关键模块都应补齐：

- 读取权限校验
- 写入权限校验
- 工作区归属校验
- 超级管理员兜底逻辑

## 前端约束

前端继续保留导航过滤与按钮显隐，但仅作为辅助体验层。
