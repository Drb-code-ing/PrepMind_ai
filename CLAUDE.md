# PrepMind AI — 协作快速上下文

本文件只提供进入仓库所需的短指针。详细协作规则以 [`AGENTS.md`](./AGENTS.md) 为准；当前事实以 [`docs/current-status.md`](./docs/current-status.md)、[`docs/branch-map.md`](./docs/branch-map.md) 和对应验收文档为准。

## 当前阶段（2026-08-06）

- Phase 7 核心工程化与 Phase 7.8.5 RAG runtime parity 已完成。
- Phase 6.9.7 Tutor/Organizer 已完成 SR5 语义门、SR6 产品 default-off 验收和 SR7 main 回放；这些 authority 彼此独立。
- Phase 6.9.8 Task 9C 唯一 controlled-Live 已失败封存，不得重跑、追加 Provider 探测或改写 evidence。
- Architecture Recovery R0--R4 已完成；R4 是 zero-provider reviewed Mock-only，`qualityAuthority=none`。
- 下一步仅为 R5 fresh admission，当前未授权、未开始。R5 之前不调用 Provider、不做产品 Docker/API/可见浏览器验收、不合并 main。

## 先读这些文档

1. [`docs/current-status.md`](./docs/current-status.md)：当前允许/禁止、证据入口、R5 准入和可复制提问。
2. [`docs/branch-map.md`](./docs/branch-map.md)：分支、合并和 main 回放关系。
3. [`docs/README.md`](./docs/README.md)：文档类型、阅读顺序与历史文档规则。
4. [`docs/roadmap.md`](./docs/roadmap.md)：阶段路线。
5. [`docs/data-flow.md`](./docs/data-flow.md)：当前数据权威与模块边界。
6. [`docs/dev-start.md`](./docs/dev-start.md)：启动、环境和本地验收。
7. [`docs/acceptance-checklist.md`](./docs/acceptance-checklist.md)：统一验收与安全清理。
8. [`DEVLOG.md`](./DEVLOG.md)：按提交记录时间线，不替代验收证据。

## 项目概要

PrepMind AI 是移动端优先的 Web + PWA 智能备考助手，串联拍照识题、AI 讲题、错题本、FSRS 复习、Hybrid RAG 和多 Agent 协作。仓库是 Bun monorepo：

```text
apps/web     -> apps/server (HTTP)
apps/server  -> packages/database, ai, agent, rag, fsrs, mcp, types
packages/agent -> packages/ai, fsrs, rag, mcp, types
packages/rag -> packages/database, ai, types
```

`packages/` 不得依赖 `apps/`；API contract 优先放在 `@repo/types`；真实模型 executor 只由 server-only composition root 注入，package 本身不读取 env 或 credential。

## 本地启动

```powershell
bun install

# 基础设施（不要清空已有 Docker 数据）
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio

# 开发服务
bun --filter @repo/server start:dev
bun --filter @repo/web dev
```

常用验证：

```powershell
bun --filter @repo/web lint
bun --filter @repo/web test
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --cwd packages/types typecheck
bun --cwd packages/agent run test
```

后端 e2e 通常需要 PostgreSQL `127.0.0.1:5433`、Redis 和 MinIO 已运行；环境不足时记录 `environment_blocked`，不要用破坏性清理“修复”。

## 模型与 gate

- Chat 开发默认 `AI_PROVIDER_MODE=mock`；真实 Chat 需要 `AI_PROVIDER_MODE=live` 与 `AI_ENABLE_LIVE_CALLS=true`。
- Router、Verifier、Tutor、Organizer、Review/Planner、Retriever、FinalResponse 的组件 gate 独立管理，默认关闭；模型只能提出受限 candidate，本地负责 owner、facts、权限、写入、citation、terminal 和 fallback。
- Mock/fake 只证明工程链路；`diagnostic_only` 只证明诊断；`*_semantic_gate` 只覆盖对应 lineage；产品与 main authority 必须单独验收。
- 任何真实模型验收都要先重新接受当次数据保留/训练边界并给出精确一次性授权。普通“继续”不构成授权。

## Git 与文档纪律

- 一个原子任务一个清晰 commit；新任务从规定基线创建普通 git 分支，不套 worktree；分支关系以 [`docs/branch-map.md`](./docs/branch-map.md) 为准。
- 代码完成后同步 `DEVLOG.md`、`docs/current-status.md`、`docs/roadmap.md` 和对应 acceptance/设计文档。
- 运行 focused/全量测试、Prettier、`git diff --check`、链接与敏感信息检查；注明 Docker、浏览器、Trace、清理和远程 parity。
- sealed evidence 不重跑、不改写、不拼接；未授权阶段只推送功能分支，不擅自合并 main。

## 关键安全规则

禁止 `docker compose down -v`、volume/prune、数据库 reset、Redis flush、MinIO wipe，以及 curl/单 case/产品 API 形式的追加 Provider 探测。完整规则和历史边界见 [`docs/documentation-guide.md`](./docs/documentation-guide.md) 与 [`docs/current-status.md`](./docs/current-status.md)。
