# 本地与 Docker 部署

本文档描述如何在本地开发环境以及通过 Docker / docker-compose 运行完整的 Bendywork Info Base。

## 本地开发

### 前置条件

- Node `24.x`（推荐 `24.11.0`），可通过 `nvm` 或 `fnm` 切换
- 系统需具备 `python3 / make / g++ / libsqlite3-dev`（`better-sqlite3` 会在安装时本地编译）

### 启动步骤

```bash
cp env.example.txt .env.local
# 填入 NEXTAUTH_SECRET / GITHUB_ID / GITHUB_SECRET 等必要变量
./scripts/start-local.sh
```

`scripts/start-local.sh` 会：

1. 校验 `.env` 或 `.env.local` 是否存在
2. 若 `node_modules` 不存在则 `npm install`
3. 执行 `npm run db:push` 把 `schema.ts` 同步到 SQLite
4. 启动 `npm run dev`

默认数据库文件为 `./local.db`（可通过 `.env.local` 中的 `DATABASE_URL` 覆盖）。

## Docker 部署

### 文件清单

- `Dockerfile` — 三阶段多阶段构建（`deps` → `builder` → `runner`）
- `docker-compose.yml` — 挂载 `./data` 宿主目录到容器 `/data`
- `docker/entrypoint.sh` — 容器启动时自动运行 `drizzle-kit push`
- `.dockerignore` — 排除本地 `node_modules / .next / local.db*` 等

镜像基础为 `node:24-bookworm-slim`，运行阶段额外安装 `libsqlite3-0 / tini / openssh-client / ca-certificates`，并以非 root 用户 `nextjs:nodejs (1001:1001)` 启动。

### 数据持久化

SQLite 文件位于容器内 `/data/local.db`，通过 volume 挂载到宿主机 `./data`，容器重建不会丢数据。

### 启动步骤

```bash
cp env.example.txt .env
# 填入生产用的密钥 / OAuth / S3 配置
./scripts/start.sh
```

`scripts/start.sh` 会：

1. 校验 `.env` 是否存在
2. `mkdir -p ./data`
3. `docker compose build`
4. `docker compose up -d`
5. `docker compose logs -f app`

### 手动操作

```bash
# 构建镜像
docker compose build

# 启动
docker compose up -d

# 查看日志
docker compose logs -f app

# 停止并保留数据
docker compose down

# 彻底清理数据
docker compose down
rm -rf ./data
```

### 进入容器

```bash
docker compose exec app sh
```

容器工作目录为 `/app`，Next.js 以 `node server.js` 启动（由 `next.config.ts` 中的 `output: 'standalone'` 产出）。

### 健康检查

`docker-compose.yml` 中定义了基于 `/api/health` 的 healthcheck。如当前未提供该端点，healthcheck 会以退出码 0 短路（避免误判），可按需要替换为真实端点。

## 环境变量

必填：

- `NEXTAUTH_SECRET` / `AUTH_SECRET`
- `NEXTAUTH_URL`
- `GITHUB_ID` / `GITHUB_SECRET`
- `DATABASE_URL`（Docker 场景默认 `/data/local.db`）

可选（S3 上传）：

- `S3_PUBLIC_BASE_URL`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

## 服务器管理模块特别说明

- 运维菜单 `dashboard > 运维 > 服务器管理` 通过 SSH 采集目标机器系统信息
- Docker 镜像的 runner 阶段已安装 `openssh-client`，容器可直接对外发起 SSH 连接
- SSH 凭据（密码 / 私钥 / passphrase）以 `AES-256-GCM` 加密写入 SQLite，密钥派生自 `AUTH_SECRET`
- 如部署环境位于私有网络内，需保证容器能从 `/data` 所在主机访问目标服务器的 SSH 端口（默认 22）

## 排障

| 症状 | 可能原因 | 处理 |
| --- | --- | --- |
| 容器启动报 `SQLITE_CANTOPEN` | 宿主 `./data` 目录权限不足 | `chown -R 1001:1001 ./data` |
| `drizzle-kit push` 卡住 | SQLite 文件被其它进程锁住 | 停掉本地 `npm run dev`，或删除 `local.db-wal/local.db-shm` |
| 服务器采集始终 `unreachable` | 容器网络不通 / 防火墙阻断 | 在容器内 `ssh user@host` 手动验证 |
| 构建镜像时 `better-sqlite3` 失败 | deps 阶段缺编译工具 | 检查是否使用了非官方 `node:24-bookworm-slim` 基础镜像 |
