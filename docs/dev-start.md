# PrepMind 本地启动命令

> 适用于 Windows PowerShell。本项目 Phase 2 开发数据库使用 Docker PostgreSQL + pgvector。

## 端口约定

Docker PostgreSQL 默认仍支持 `5432`，但本机可能自动启动 `postgresql-x64-17` 并占用或干扰 `5432`。

本机开发固定使用：

```powershell
$env:POSTGRES_PORT='5433'
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
```

也就是说：**不是把 compose 写死为 5433，而是启动时通过 `POSTGRES_PORT=5433` 固定本机开发端口。**

## 日常启动

先确认 Docker Desktop 已启动，然后在项目根目录执行：

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres

$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
bun run db:generate
```

启动后端：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
bun --filter @repo/server start:dev
```

另开一个 PowerShell 启动前端：

```powershell
bun --filter @repo/web dev
```

访问地址：

```text
前端：http://localhost:3000
后端：http://localhost:3001
健康检查：http://localhost:3001/health
```

## 首次初始化或迁移

首次启动数据库后执行：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun run db:generate
bun run db:migrate
```

如果只是确认数据库迁移状态：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun --cwd packages/database prisma migrate status --schema prisma/schema.prisma
```

## 常用验证命令

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'

bun --filter @repo/database typecheck
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
bun run lint
```

只跑 Auth e2e：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
bun --filter @repo/server test:e2e -- auth.e2e-spec.ts
```

## 查看和停止 Docker 数据库

查看容器：

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml ps postgres
```

停止容器：

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml stop postgres
```

停止全部 Docker 开发服务：

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml down
```

## 常见问题

### 1. Prisma 提示 client 没初始化

执行：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun run db:generate
```

当前 `db:generate` 会自动运行 `packages/database/scripts/repair-prisma-client.mjs`，修复 Bun workspace 下 Prisma Client 生成路径和运行路径不一致的问题。

### 2. Prisma 认证失败

优先检查是否误连到本机 PostgreSQL 的 `5432`。本机开发应使用：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
```

不要用：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@localhost:5432/prepmind'
```

### 3. Docker 命令不可用

确认 Docker Desktop 已启动，并检查：

```powershell
docker version
docker compose version
wsl --list --verbose
```

`docker-desktop` 应该是 `Running`，并且 `VERSION` 为 `2`。
