# PrepMind AI - Agent 工作说明

> 本文件是每次进入仓库时的启动清单，不是开发日志。历史实现、阶段数字和失败证据请到验收文档或 `DEVLOG.md` 查询。

## 1. 启动顺序

开始任何实质工作前：

1. 阅读本文件、`docs/project-status.md`、`docs/acceptance/phase-6-agent-runtime-audit.md`。
2. 按任务需要阅读 `docs/data-flow.md`、`docs/dev-start.md`、`docs/roadmap.md` 和对应的 acceptance/spec/plan。
3. 检查当前分支、远程、工作区和用户改动：

   ```bash
   git status --short --branch
   git log -1 --oneline --decorate
   git rev-parse main
   git rev-parse origin/main
   ```

4. 不把旧的回执、Mock 结果或历史分支推断成当前状态；以最新 acceptance 文档和可复现命令为准。

## 2. 当前项目状态（2026-08-31）

- 2026-08-31 文档分层整理已合并并推送；开始新任务前始终用 `git rev-parse main` 与 `git rev-parse origin/main` 核对，不要复制历史 SHA。
- Phase 6 Agent 运行时总审计仍是当前主线。最新原子任务已完成 ChatTurn/BackgroundJob/Outbox 到 BullMQ 的
  deterministic Worker durable baseline；它不是真实模型 Worker、Redis/SSE replay 或 `/api/chat` turn-backed durability。
- `packages/agent/src/graph/index.ts` 是受治理的 catalog descriptor，不是执行器；产品 Chat 编排仍在 Web/API composition。
- Tool-Using Orchestrator 尚未实现。Review/Planner、Knowledge agents、Router/Verifier、Tutor、Retriever/FinalResponse
  的真实模型产品证据必须按矩阵逐项确认，不能用一条 Chat smoke 代替。
- MemoryAgent 目前是确定性候选策略；分层记忆实现、记忆注入和两篇面试博客均后置。
- 日常默认：`AI_PROVIDER_MODE=mock`、`AI_ENABLE_LIVE_CALLS=false`、所有组件 gate 关闭。开启任何 Live 或产品 gate
  都必须有独立数据边界、预算、凭据、授权和清理记录。

当前矩阵与缺口：`docs/acceptance/phase-6-agent-runtime-audit.md`。项目级摘要：`docs/project-status.md`。

## 3. 证据等级

| 等级                       | 可以证明什么                                                           | 不能证明什么                   |
| -------------------------- | ---------------------------------------------------------------------- | ------------------------------ |
| `implemented`              | 源码存在，静态/单元合同通过                                            | 产品接入、真实模型质量         |
| `mock/static validated`    | reviewed Mock 或确定性回归通过                                         | Provider 行为、计费、SLA       |
| `controlled-Live`          | 绑定独立 source/tag/授权的一次性真实 Provider 运行（成功或失败都封存） | 自动外推到别的版本、产品或生产 |
| `product real-model smoke` | 指定 endpoint 在指定配置下返回真实模型结果                             | 每个上游 Agent、长期稳定性     |
| `production-used`          | 有持续运行、观测和业务证据                                             | 仅凭一次测试获得               |

任何失败的 controlled-Live 都是不可重跑的历史事实。不得 retry、replay、backfill、移动 tag、改写 evidence，
也不得把不同版本、局部成功或 Mock 拼接成“通过”。

## 4. Git 协作流程

除非用户明确要求，使用普通 Git 分支，不使用 worktree：

1. 从最新且已推送的 `main` 建立 `drb/<short-task-name>` 分支。
2. 一个逻辑任务一个提交；提交只包含本任务拥有的文件。
3. 在功能分支运行 focused 测试、静态检查和文档/链接检查。
4. 推送功能分支。
5. 切回 `main`，用 `git merge --no-ff <branch>` 合并，再推送 `main`。
6. 在合并后的 `main` 再跑必要的回归、`git diff --check`、链接和分支 parity 检查。
7. 不需要的本地分支可以在合并验证后删除；远程分支按项目保留策略处理。

禁止用 `git reset --hard`、`git checkout --` 或批量清理来覆盖用户改动。提交前用显式路径 `git add -- <owned files>`，
不要使用 `git add -A`。

## 5. 必须保护的用户文件

以下三个文件当前含有用户预先修改，除非用户明确指定，本任务不得读取后改写、暂存或提交：

- `apps/server/src/wrong-question-organizer/wrong-question-organizer-agent-trace.ts`
- `apps/server/src/wrong-question-organizer/wrong-question-organizer.service.spec.ts`
- `apps/server/src/wrong-question-organizer/wrong-question-organizer.service.ts`

提交和合并前后都要确认它们仍在工作区、没有进入 staged/commit。

## 6. Docker、数据和凭据安全

- 不得执行 `docker system prune`、`docker compose down -v`、volume 删除、数据库 reset、Redis `FLUSHDB/FLUSHALL`
  或 MinIO wipe。不得为了测试清空或重建用户已有数据。
- Docker 迁移到其他磁盘不改变 Compose 项目名、卷和数据路径；先检查现有容器/卷，再决定启动哪个服务。
- 验收只精确清理本次创建的合成账号、记录、对象和隔离浏览器 storage，并记录清理范围。
- `.env`、`.env.local` 和凭据只在明确授权的受控 Live/产品验收入口读取；永远不要输出 key、完整 URL、cookie、token、
  prompt、模型原文、用户正文或未脱敏错误。
- `AI_PROVIDER_MODE=mock` 是安全默认值。真实模型必须同时满足全局开关、组件 gate、匹配 key、HTTPS allowlist、预算、超时和
  安全 eligibility；失败时使用受限 deterministic fallback，不绕过安全门。

## 7. 工具使用

- 本地搜索、读取、日志、配置和 Bash 优先使用 FastCtx：`mcp__fastctx__glob`、`mcp__fastctx__grep`、`mcp__fastctx__read`、
  `mcp__fastctx__run`。大任务用 background job，并持续读取到 `Complete`。
- 需要结构关系、调用链或影响面时先刷新并确保 CodeGraph：

  ```bash
  /e/CDriveOptimized/DevTools/.codegraph/bin/codegraph-update-check.sh
  /e/CDriveOptimized/DevTools/.codegraph/bin/codegraph-project-ensure.sh <project-root>
  ```

  再用 CodeGraph explore；精确字符串、配置、pending/stale 文件仍用 FastCtx。若初始化只是普通网络/索引失败，报告一次后
  继续用 FastCtx；若返回 `74`，停止修改并按 pre-run 备份检查源清单，不得 reset/clean。

- 手工语义编辑使用 `apply_patch`；机械批量替换使用 FastCtx replace，并先 dry-run。
- 只有确有独立探索、日志分析或交叉核验价值时才委派子代理。普通子代理必须 `agent_type=default`、`fork_turns=none`，
  自包含、只读、明确路径和验收证据；不要重复扫描同一问题。

## 8. 架构边界

```text
web -> server（HTTP，不直接 import）
server -> database, ai, fsrs, rag, agent, mcp, types
agent -> ai, fsrs, rag, mcp, types
rag -> database, ai, types
fsrs -> types
ai -> types
mcp -> ai, fsrs, rag, types
```

- `packages/` 不得依赖 `apps/`，同层 package 不得循环依赖。
- `@repo/types` 是 API contract 的优先位置，使用 Zod；Swagger 只做展示和调试。
- Agent 只能消费 typed、owner-bound、bounded projection；身份、owner、权限、业务事实、写命令、最终安全边界由本地代码掌握。
- RAG 当前是 Qwen `text-embedding-v4` / 1536 的向量召回 + PostgreSQL full-text 关键词召回的 hybrid rank；`fake` 仅用于非生产测试。
- PostgreSQL 是业务事实、ChatTurn、BackgroundJob、Outbox、Trace 和记忆的权威来源；Redis/BullMQ 是队列/缓存，不替代事实库。

## 9. 编码与验证约定

- TypeScript strict；2 空格、单引号、分号、100 列；文件名 kebab-case，类 PascalCase，变量 camelCase。
- 遵循 `Controller -> Service -> Repository`；高频 SQL 建索引；移动端触摸目标至少 44x44px。
- 代码任务至少运行受影响 package 的 test、typecheck/build、lint、Prettier check 和 `git diff --check`。
- 文档任务至少检查 Markdown 标题层级、内部链接、代码块闭合、敏感值扫描和换行差异；不要为了格式化触碰无关文件。
- 真实浏览器验收默认使用 headed 窗口并保持可见；headless 只能作为自动化补充。验收后非必要不要关闭窗口。

## 10. 文档分层

- `README.md`：GitHub 项目介绍，只写当前能力、启动方式、验证入口和明确限制。
- `docs/project-status.md`：项目级当前快照和下一步，变更阶段时同步更新。
- `docs/acceptance/phase-6-agent-runtime-audit.md`：Agent 矩阵、通信/权限/预算和缺口的权威审计。
- `docs/dev-start.md`：可执行的本地启动与运维命令；历史命令回顾在 `docs/archive/dev-start-history.md`。
- `docs/roadmap.md`：当前路线；旧阶段长记录在 `docs/archive/roadmap-history.md`。
- `docs/data-flow.md`：业务和 Agent 数据流；`docs/acceptance-checklist.md`：按功能验收的操作清单。
- `DEVLOG.md`：按日期追加事实、命令、结果和限制，不把日志复制到 README/AGENTS。
- 设计、计划和验收文件按阶段保存，已封存 evidence 只读。

每完成一个逻辑任务，同步相关文档并在回执中写清：目的、改动、验证、证据等级、未完成项、分支/提交/合并 SHA、是否读取
凭据/调用 Provider/触碰 Docker，以及下一步如何继续。

## 11. 交流偏好

默认使用中文，先说明目的和影响，再给出可复现的实现/验证结果。不要把“代码存在”说成“真实可用”，也不要在遇到一次失败时
停在原地；先定位是配置、传输、schema、权限、并发、证据还是产品链路，再用最小可逆改动修复。
