# 服务器管理 技术方案

## 文档目的

这份文档是 `运维管理 -> 服务器管理` 模块的技术方案，用于：

- 定义数据模型与拆表策略
- 定义权限码与页面路由
- 定义 SSH 自动采集的触发时机、超时策略与失败兜底
- 定义对外 API、服务层分工和 UI 结构
- 列出落地步骤与验证清单

写在这里是为了先让用户审一遍，再决定是否进入代码实施阶段。

## 模块定位

- 归属：`dashboard.ops`（运维管理）下新增一级菜单 `服务器管理`
- 面向人群：需要统一登记工作区内 Linux 服务器基本信息并能自动拉取系统状态的运维同学
- 核心诉求：用户只填连接得上机器的最小字段，其他详情由系统 SSH 登录后自动采集，避免人肉维护 CPU/内存/磁盘/网卡等易漂移的字段

## 数据模型（两张表拆分）

按用户要求拆成主表 + 详情表。主表只放“登记与连接”必要字段；详情表放系统自己采集到的信息，且按时间保留多条快照，主表冗余最新一条的引用。

### 主表 `ops_servers`

| 字段             | 类型                              | 说明                                                                             |
| ---------------- | --------------------------------- | -------------------------------------------------------------------------------- |
| `id`             | `integer primary key autoincrement` | 内部主键                                                                         |
| `workspace_id`   | `text` FK → `workspaces.id`       | 工作区隔离，级联删除                                                             |
| `name`           | `text` not null                   | 服务器别名 / 标识（工作区内唯一）                                                |
| `hostname`       | `text`                            | 主机名（可空，采集后可回填）                                                     |
| `ip`             | `text` not null                   | 连接用 IP 地址（IPv4 / IPv6 均允许）                                             |
| `ssh_port`       | `integer` default `22`            | SSH 端口                                                                         |
| `ssh_user`       | `text` not null                   | SSH 登录用户名                                                                   |
| `auth_type`      | `text` enum `password` / `private_key` | 认证方式                                                                     |
| `secret_cipher`  | `text`                            | 密码或私钥密文（复用 `account-management/password.ts` 的 AES-GCM）               |
| `secret_passphrase_cipher` | `text`                  | 私钥口令密文（可空）                                                             |
| `status`         | `text` enum                       | `pending` / `collecting` / `healthy` / `unreachable` / `disabled`                |
| `last_collected_at` | `integer timestamp`            | 最近一次采集完成时间                                                             |
| `last_facts_id`  | `integer` FK → `ops_server_facts.id` on delete set null | 指向最新一条详情快照                                      |
| `collect_error`  | `text`                            | 最近一次采集失败的错误简要                                                       |
| `remark`         | `text`                            | 备注                                                                             |
| `created_at`     | `integer timestamp`               | 跟随 `timestamps` helper                                                         |
| `updated_at`     | `integer timestamp`               | 跟随 `timestamps` helper                                                         |

索引：

- `unique (workspace_id, name)`：工作区内名称唯一
- `unique (workspace_id, ip, ssh_port)`：工作区内 IP + 端口唯一，避免重复登记同一台机
- 普通索引 `(workspace_id, status)` 用于列表筛选

### 详情表 `ops_server_facts`

采集快照表，每次采集成功都追加一条，主表 `last_facts_id` 指向最新一条。

| 字段            | 类型                                   | 说明                                       |
| --------------- | -------------------------------------- | ------------------------------------------ |
| `id`            | `integer primary key autoincrement`    | 内部主键                                   |
| `server_id`     | `integer` FK → `ops_servers.id` on delete cascade | 归属服务器                      |
| `collected_at`  | `integer timestamp` not null           | 采集完成时间                               |
| `os_name`       | `text`                                 | e.g. `Ubuntu`、`CentOS`                    |
| `os_version`    | `text`                                 | e.g. `22.04`                               |
| `kernel`        | `text`                                 | `uname -r`                                 |
| `arch`          | `text`                                 | `uname -m`                                 |
| `cpu_model`     | `text`                                 | `/proc/cpuinfo` 第一条 `model name`        |
| `cpu_cores`     | `integer`                              | `nproc`                                    |
| `memory_total_mb` | `integer`                            | `/proc/meminfo` → `MemTotal`               |
| `memory_used_mb`  | `integer`                            | 计算值                                     |
| `disk_json`     | `text (mode:json)`                     | `df -PT` 解析后的数组                      |
| `network_json`  | `text (mode:json)`                     | `ip -j addr`（不可用时降级 `ifconfig`）     |
| `services_json` | `text (mode:json)`                     | `systemctl list-units --type=service --state=running --no-legend` 解析 |
| `uptime_seconds`| `integer`                              | `/proc/uptime` 第一列                      |
| `raw_json`      | `text (mode:json)`                     | 原始命令输出汇总，便于排障                 |
| `created_at`    | `integer timestamp`                    | 跟随 `timestamps` helper                   |

索引：

- 普通索引 `(server_id, collected_at desc)` 用于快照列表查询

说明：

- 选择 1:N 而非 1:1 的原因：保留历史快照能支撑后续“变化对比”“异常回溯”。当前版本只读最新一条，存储成本可控
- 所有 JSON 字段都走 Drizzle 的 `text({ mode: 'json' })`，与 `schema.ts` 现有风格一致

### 迁移策略

- 使用 `drizzle-kit push` 推送 schema
- `src/lib/db/bootstrap.ts` 中补 legacy 兼容分支（首次无表直接建表；无需数据迁移）
- `docs/database-init.sql` 同步追加建表语句与权限/角色映射

## 权限码

新增一组 workspace scope 的菜单与动作权限，挂在 `dashboard.ops.menu` 下，和现有 `system/config/information/data` 四个占位兄弟并列：

| 权限码                              | 类型   | 说明                             |
| ----------------------------------- | ------ | -------------------------------- |
| `dashboard.ops.servers.menu`        | menu   | 运维 / 服务器管理菜单入口        |
| `dashboard.ops.servers.create`      | action | 新增服务器                       |
| `dashboard.ops.servers.update`      | action | 编辑服务器基本信息与凭据         |
| `dashboard.ops.servers.delete`      | action | 删除服务器（物理删除详情级联）   |
| `dashboard.ops.servers.collect`     | action | 手动触发一次 SSH 采集            |

落地点：

- `src/lib/platform/rbac.ts` 常量与工作区可绑定集合
- `src/lib/platform/permission-tree.ts` 树形结构
- `src/lib/db/bootstrap.ts` 种子权限 + 默认 `admin` 角色自动分配全部 5 个
- `docs/database-init.sql` 同步

## 路由规划

### 页面

- `/dashboard/workspaces/ops/servers/page.tsx`
  - 服务端取列表 / 平台 / 权限快照，透传给 client
  - 进入前守卫 `dashboard.ops.servers.menu`

### API（管理后台）

所有路由挂在 `src/app/api/admin/ops/servers/` 下，便于和现有 `src/app/api/admin/accounts/` 并列。

| 方法   | 路径                                     | 作用                                      |
| ------ | ---------------------------------------- | ----------------------------------------- |
| `GET`  | `/api/admin/ops/servers`                 | 分页列表（支持 name/ip 搜索、status 过滤）|
| `POST` | `/api/admin/ops/servers`                 | 新增服务器（创建后异步采集）              |
| `GET`  | `/api/admin/ops/servers/[id]`            | 详情 + 最新 facts                         |
| `PATCH`| `/api/admin/ops/servers/[id]`            | 更新                                      |
| `DELETE`| `/api/admin/ops/servers/[id]`           | 删除                                      |
| `POST` | `/api/admin/ops/servers/[id]/collect`   | 手动再次采集                              |
| `GET`  | `/api/admin/ops/servers/[id]/facts`     | 历史快照列表（分页，供详情抽屉切换）      |

权限守卫：

- 读类接口：`dashboard.ops.servers.menu`
- 写类接口：对应 `create / update / delete / collect`

## 服务层分工

仿照现有 `src/lib/account-management/`，新增：

- `src/lib/server-management/types.ts`
- `src/lib/server-management/validators.ts`（Zod：新增 / 编辑 / 采集触发）
- `src/lib/server-management/service.ts`（读）
- `src/lib/server-management/mutations.ts`（写，包括“新增 + 触发异步采集”“删除级联 facts”）
- `src/lib/server-management/ssh-client.ts`（SSH 连接工厂，封装超时与关闭）
- `src/lib/server-management/collector.ts`（具体采集命令组与解析器）

凭据加解密复用 `src/lib/account-management/password.ts`，不再新增密钥体系。

## SSH 自动采集策略

### 依赖

- 新增依赖 `ssh2`（主流、无额外原生编译步骤）
- 不再额外引入 `node-ssh` 等封装，直接写薄封装，便于控制连接超时、命令超时与流读取

### 触发时机

采用 **异步触发 + 状态轮询** 方案：

1. 用户保存主表后，API 立即返回 `status = pending`
2. 服务端在返回前用 `queueMicrotask` / `after()` 调度一次采集任务（运行在 Next.js 同进程内，Vercel serverless 下用 `after()` 保证不截流请求）
3. 采集任务执行过程中主表 `status = collecting`
4. 采集完成写 `ops_server_facts`，更新主表 `status = healthy` / `unreachable`，设置 `last_facts_id`、`last_collected_at`、`collect_error`
5. 前端列表和详情抽屉每 3s 轮询一次，直到 `status` 脱离 `pending` / `collecting`

手动再采集走 `/api/admin/ops/servers/[id]/collect`，逻辑同步，立即将 `status` 置为 `collecting` 并调度任务。

### 超时与并发

- 整体超时：**20s**（超过置 `unreachable`，记录 `collect_error = 'timeout'`）
- 单命令超时：**8s**
- 同服务器同一时刻只允许一个采集任务在跑，用进程内的 `Map<serverId, Promise>` 作互斥锁，重复触发直接复用已有 promise
- 不同服务器并发数限制：全局并发 **5**，用轻量 semaphore；多出来的请求排队即可

### 采集命令清单（按顺序跑，互相独立失败不互相阻塞）

```sh
cat /etc/os-release               # os_name / os_version
uname -srm                        # kernel / arch
nproc                             # cpu_cores
grep -m1 'model name' /proc/cpuinfo # cpu_model
cat /proc/meminfo                 # memory_total / memory_available
df -PT                            # disk_json
ip -j addr || ifconfig            # network_json
systemctl list-units --type=service --state=running --no-legend  # services_json
cat /proc/uptime                  # uptime_seconds
hostname                          # 回填主表 hostname（仅当主表为空时回填）
```

单条命令失败记进 `raw_json.errors`，不阻断整体采集；只要有一条关键命令（`os-release` 或 `uname`）成功，快照就落库，`status = healthy`。

### 凭据保密

- 入库前 AES-GCM 加密，解密只发生在 `ssh-client.ts` 内部连接期间，连接结束立即丢弃解密结果
- 列表接口永不返回 `secret_cipher` / `secret_passphrase_cipher`
- 编辑时如果用户没填新密码，保留旧密文
- 审计日志（`audit_logs`）记录 `servers.create / update / delete / collect`，但绝不写入凭据明文

## UI 结构（遵循 `docs/designUI.md`）

### 列表页（`servers-management-client.tsx`）

- 顶部一体化工具栏：
  - 搜索框（name / ip 前缀匹配）
  - 状态筛选下拉（`pending / collecting / healthy / unreachable / disabled`）
  - 右侧按钮：`新增`、`批量删除`（选中时亮起）
- 表格列：
  - 多选框 / 名称 / 主机名 / IP / SSH 端口 / 状态（彩色徽标）/ 最近采集时间 / 操作
- 行操作：
  - `查看详情`（打开右侧抽屉）
  - `立即采集`（权限：`collect`）
  - `编辑`
  - `删除`（confirm-action-dialog）
- 空态走通用空表格组件

### 新增 / 编辑弹窗

- 字段分两组：
  - **基本信息**：名称、主机名、IP、SSH 端口、备注
  - **连接凭据**：SSH 用户名、认证方式（password / private_key）、密码或私钥内容、私钥口令（仅 private_key 下出现）
- 编辑场景下密码 / 私钥字段默认显示“保留原值”，用户主动清空并填新值才覆盖

### 详情抽屉

- 顶部状态徽标 + `立即采集` 按钮（显示当前状态，置灰处理 `collecting`）
- 三个 tab：
  - **基本信息**：主表全部非敏感字段
  - **最新采集**：最新一条 `ops_server_facts` 的结构化呈现
  - **采集历史**：分页加载 `/[id]/facts`

## 落地步骤（真正开工后的执行顺序）

1. **docs/PLAN.md 补子任务清单**（按本文件）
2. schema + bootstrap 权限种子 + database-init.sql
3. `ssh2` 依赖添加 + `ssh-client.ts` + `collector.ts`
4. 服务层 `types / validators / service / mutations`
5. API 路由 7 个
6. 列表页 + 弹窗 + 详情抽屉
7. 菜单项与 icon（`src/constants/data.ts` 或现有导航配置里）
8. 最小验证：
   - `npm run db:push`
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npm run build`
   - 真机：准备一台可 SSH 的 Linux，跑一次新增 → 采集成功 → 删除 全流程
9. 按协作规则 `git commit + git push origin <current-branch>`
10. 同步更新 `docs/maintain.md` 开发记录、`CHANGELOG.md`、版本号

## 风险与权衡

- **Vercel serverless 里跑 SSH**：Vercel 默认函数超时 10s（Hobby）/ 60s（Pro），需要确认部署套餐支持。生产如果要稳跑，建议把采集任务拆到自建 runner；当前版本先在同进程跑，并且将整体超时控制在 20s 内，不满足的机型会落 `unreachable`
- **同步 vs 异步采集**：选异步是因为同步会把 UI 卡 10s+ 且失败体验差；代价是需要一次轮询接入
- **快照保留策略**：当前无限保留，后续如果量上去再加 cron 清理 30/90 天以前的快照
- **只支持 Linux**：Windows / BSD 不在本轮范围；如果后续要支持，采集层抽成 `adapter`
- **凭据落地方式**：沿用账号管理的 AES-GCM + 环境变量主密钥，不引入 KMS；生产环境需要保证 `ACCOUNT_SECRET_KEY` 稳定且有备份

## 不做的事情

- 不做 Web Terminal / 远程执行命令
- 不做告警 / 监控 / 阈值通知（以后如果要做再起一个 `ops.monitoring` 模块）
- 不做批量导入（CSV / 批量 SSH 扫描）
- 不做 Agent 模式（只用 SSH 一次性拉取）

---

## 审阅结论占位

> 用户审阅意见：

（等你反馈后再进入实施阶段。）
