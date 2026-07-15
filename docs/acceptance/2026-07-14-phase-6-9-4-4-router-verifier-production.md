# Phase 6.9.4.4 Router / Verifier 生产接入分支验收

> 验收日期：2026-07-15（文件名沿用阶段计划日期）
> 分支：`codex/phase-6-9-4-4-agent-production`
> 范围：Task 9 分支门禁、Mock、controlled-Live、Docker、可见浏览器、精确清理与 current docs
> 不包含：Task 10 的最终审查、合并 `main`、`main` 复验与远程推送

## 1. 结论

Task 9 的证据整理、环境恢复与合成数据清理已完成，但分支验收尚未通过，生产 gate 已恢复默认关闭。受控 Live harness 的 5 个候选全部通过 strict schema 并应用，Router 三例均低于 5 秒、Verifier 两例均低于 4 秒；安全边界、高置信 zero-call、共享预算、canonical permission rebuild 与限制性 fallback 均有测试或运行证据。

可见 Docker 浏览器验收同时记录了一个必须保留的运行差异：唯一一次歧义 Router 生产请求确实进入模型路径，但在 5002ms 达到 5 秒 timeout，最终 disposition 为 `fallback_timeout`；请求仍返回 HTTP 200、Mock 最终回答继续显示、Trace 成功记录，且未发生重试。按照 stop-on-first-failure 规则，本轮没有继续发送 Verifier eligible 浏览器请求。因此本证据不能表述为“浏览器 Router / Verifier 都 model-applied”，也不能把 Phase 6、全部 Agent 或分层记忆标记为完成。

Task 9 的剩余验收缺口是：生产可见浏览器 Router eligible 未 model-applied，Verifier eligible 未执行，RAG conflict/injection 的完整 UI 查询也未形成 hit。必须先评估并收口这些差异，才能进入 Task 10 的最终审查、合并 `main`、`main` 复验与推送。其后才从新 `main` 进入 Phase 6.9.5 ReviewAgent / PlannerAgent，不提前进入 Phase 6.10 记忆系统。

## 2. 生产边界

- Router：安全边界和高置信输入由 deterministic 路径零调用处理；仅歧义、多意图和上下文指代进入模型候选。模型只能建议 canonical route，`requiresRag` 与 `requiresHumanApproval` 始终由本地 route map 重建。
- Verifier：prompt injection、high-risk、credential material 或 `safeForPrompt=false` 在 provider 前零调用阻断；仅 semantic conflict、stale / uncertain 等语义必要证据进入模型候选。
- 两个组件 gate 可独立回滚，默认均为 `false`；timeout 分别为 5000ms / 4000ms。
- 单请求共享不可变预算：`maxCalls=2`、`maxInputTokens=2400`、`maxOutputTokens=800`。
- Provider 只保证合法 JSON object；canonical Zod 仍负责字段、长度、关联、枚举和安全语义。
- timeout、provider error、schema invalid、abort 或预算不足都回到 deterministic / 限制性结果，不自动重试，不取得写权限。
- headers / Trace 只保存固定状态、disposition、duration、usage、error code 和安全聚合，不保存 prompt、query、chunk、provider 原始输出、key、base URL、raw error 或 stack。

## 3. 分支门禁

完整分支门禁在本轮 Docker 验收前通过：

| 范围 | 结果 |
| --- | --- |
| `@repo/agent` | 374 / 374 tests；typecheck、lint 通过 |
| `@repo/ai` | 151 / 151 tests；typecheck、lint 通过 |
| `@repo/web` | 404 / 404 tests；lint、build 通过 |
| `@repo/server` | 735 passed / 2 skipped；lint、build 通过 |
| `@repo/types` | typecheck 通过 |
| Compose | `config --quiet` 通过 |
| Git hygiene | `git diff --check` 通过 |

生产 eligibility / candidate 与 Web orchestration 的 Mock 定向门禁分别为 114 / 114 和 35 / 35。新增运行前的注入式失败定向验证为 11 / 11，覆盖 schema、timeout、provider/runtime、budget、abort 和 hostile input；结果均保持 deterministic 或限制性 fallback，未传播 raw error。

Server TypeScript build 的 12 个 TS5097 已由独立实现/测试提交修复；该修复不属于本 evidence 提交，Task 9 不重复 stage 其文件。

## 4. Controlled-Live harness

本轮没有重跑 Phase 6.9.4.3 的 100-case paired Live。Task 9 只运行 5 个最小生产候选，使用 DeepSeek `deepseek-v4-flash`、JSON-object mode、`maxRetries=0`。总结果为 5 / 5 strict success、exactly 5 provider attempts、wall duration 9.8s；component duration 合计 9356ms，provider-reported usage 合计 1893 input / 762 output tokens。

| Case | Disposition / 结果 | 权限或 notice | Duration | Usage |
| --- | --- | --- | ---: | ---: |
| Router mixed-material tutor | `candidate_applied` / `rag_answer` | `rag=true`、`approval=false` | 1961ms | 304 / 152 |
| Verifier complex conflict | `candidate_applied` / `conflict` | 有限制性 notice；与上一项共享请求，`usedCalls=2` | 2331ms | 511 / 217 |
| Router contextual reference | `candidate_applied` / `tutor` | `rag=false`、`approval=false` | 1552ms | 300 / 94 |
| Router mixed plan/review | `candidate_applied` / `study_plan` | `rag=false`、`approval=true` | 1754ms | 300 / 149 |
| Verifier stale/uncertain | `candidate_applied` / `suspicious` | 有限制性 notice | 1758ms | 478 / 150 |

表中不记录测试正文、资料正文、模型原始输出或供应商错误正文。5 次 provider attempt 均为单次尝试；没有把历史 run、Mock 或本次浏览器 timeout 拼接成新的 paired report。

## 5. Docker 全栈

使用过程环境显式设置 `KNOWLEDGE_PROCESSING_MODE=queue`。首次多服务 build 命中已知 Docker Desktop Bake gRPC shared-key 非打印字符错误；按 `docs/dev-start.md` 仅在当前 PowerShell 设置 `COMPOSE_BAKE=false`，逐服务构建 `server`、`worker`、`web`、`admin`，随后对 `postgres redis minio server worker web admin` 执行精确 `up -d --no-build`。

- 7 / 7 服务为 running，worker 为 healthy。
- 学习端 `http://127.0.0.1:3000` 返回 200。
- 管理端 `http://127.0.0.1:3100` 返回 200。
- 未认证 `/worker-readiness` 返回 401，符合认证边界。
- 未执行 `down -v`、prune、flush、reset、build-cache 清理或 volume 清理；旧 PostgreSQL、Redis、MinIO 与 Docker volume 均保留。

验收结束后精确重建 Web，容器运行值恢复为：

```text
AI_PROVIDER_MODE=mock
AI_ENABLE_LIVE_CALLS=false
ROUTER_MODEL_ENABLED=false
KNOWLEDGE_VERIFIER_MODEL_ENABLED=false
ROUTER_MODEL_TIMEOUT_MS=5000
KNOWLEDGE_VERIFIER_MODEL_TIMEOUT_MS=4000
```

## 6. 可见浏览器验收

验收使用系统 Edge 的独立 synthetic profile，以 headed 新窗口打开，Node Playwright 通过 CDP 驱动；窗口在验收和清理后仍保留，最终停在 `/login`。Python runtime 缺少 Playwright，因此没有安装新依赖，改用 bundled Node Playwright。

### 6.1 Mock 高置信 zero-call

UI 登录成功后从 `/chat` 发起高置信普通请求：

- HTTP 200，页面显示回复。
- `x-prepmind-ai-mode=mock`。
- Router：`attempted=false`、`disposition=not_eligible`、duration/input/output 均为 0、error/provider failure 均为 `none`。
- Verifier：`attempted=false`、`disposition=not_present`。
- 聚合：calls=0、totalTokens=0。
- `x-prepmind-agent-trace-recorded=true`。

### 6.2 唯一生产 Router eligible 请求

零网络 eligibility preflight 先确认该样本属于 `ambiguous_multi_intent`，deterministic route 为 `study_plan`；随后只发送一次真实生产候选：

- HTTP 200，页面继续显示回复；最终 Chat 仍使用 Mock，因此没有额外最终回答模型调用。
- Router：`attempted=true`、`fallback_timeout`、5002ms、`TIMEOUT`、usage 0 / 0、aggregate calls=1。
- `x-prepmind-agent-trace-recorded=true`。
- 无重试；没有发送第二个 Router eligible 样本。

该结果验证了真实 composition、5 秒边界和继续回复的 fallback，但不证明此浏览器样本 model-applied。它与 5 / 5 harness 的成功样本并列保留，不能互相覆盖。

### 6.3 Verifier 与 RAG 补充诊断

因 Router 浏览器请求先发生 timeout，本轮按 stop-on-first-failure 规则没有发送 Verifier eligible Live 请求；Verifier 的 `candidate_applied` 生产语义证据来自第 4 节两例 controlled-Live harness。

为检查 Docker RAG 路径，在 Mock/default-off 下创建了 conflict 与 injection 两份 synthetic 文档并由 queue worker 处理完成。精确关键词的 authenticated direct search 在生产阈值 0.72 上各有 1 个 top hit：conflict 0.7460、injection 0.8245。可见 UI 各只允许一次完整自然语言查询，但两次 Chat search 都返回 hit=0，Verifier 为 `skipped/not_present`，Agent calls=0；原因是完整查询的混合分数未达到 0.72。本轮据此停止，不改词重试，也不把 direct-search 命中冒充为 Chat Verifier / safety notice 通过。

两份文档处理与搜索使用既有 Qwen embedding 路径；它们不属于 DeepSeek Agent candidate attempts。文档不记录查询正文、chunk 正文或 embedding 原文。

## 7. Trace、数据水位与精确清理

Synthetic identity 使用唯一前缀，账号创建后初始水位为 user=1、documents=0、chunks=0、traces=0、jobs=0。验收数据达到 documents=3、chunks=2、jobs=2；中途新鲜水位为 traces=3、traceSteps=6、conversations=1、messages=6、outbox=2，之后最后一次 UI 诊断仍由 User cascade 一并清理。

清理顺序：

1. 通过 authenticated Document API 删除 3 / 3 文档，使 MinIO object 走业务删除链路。
2. 按 3 个 synthetic aggregate id 精确删除 2 / 2 OutboxEvent。
3. 按唯一 synthetic email 删除 1 / 1 User，依赖既有 `onDelete: Cascade` 清理 Trace、Step、BackgroundJob、Conversation、Message、Summary 与 State。
4. 按 synthetic userId / conversationId 扫描 Redis，无残留 key。
5. 清除独立浏览器 profile 的 cookies、localStorage、sessionStorage 与 IndexedDB；复核为 0 / 0 / 0，窗口保持打开在 `/login`。

最终 PostgreSQL 新鲜计数：

```text
users=0
documents=0
chunks=0
traces=0
traceSteps=0
jobs=0
conversations=0
summaries=0
states=0
messages=0
outbox=0
```

清理只针对本轮唯一 synthetic identity、document ids 与 aggregate ids；未删除或重置任何旧账号、旧资料、容器、volume、Redis 全库或 MinIO bucket。

## 8. 已知限制与后续交接

- Browser Router Live 仍可能在 5 秒预算边界 timeout；fallback 已验证，Task 10 的 main 复验必须保留该事实，不得改写为 model-applied。
- Browser Verifier eligible 未执行；Task 10 如需补验，只允许一个受控 conflict/stale 样本，并继续遵守零调用安全门、`maxRetries=0`、4 秒 timeout 和调用上限。
- Browser RAG 两个完整查询未达到 0.72；不能据此声称 Verifier notice 或 injection safety UI 已通过。安全门的工程证据来自 114 / 114、35 / 35、11 / 11 与 controlled-Live harness。
- Task 9 当前只完成证据、恢复和清理，尚未通过分支验收；先收口上述浏览器差异，Task 10 才负责最终审查、合并、main 复验和推送。本提交不执行这些操作。
- Phase 6.9.5 才进入 ReviewAgent / PlannerAgent；后续仍需 KnowledgeDedup/Organizer、Tutor/WrongQuestionOrganizer、Retriever/FinalResponse、MemoryAgent 候选提取与 MCP-ready Orchestrator，完成后才进入 Phase 6.10。
