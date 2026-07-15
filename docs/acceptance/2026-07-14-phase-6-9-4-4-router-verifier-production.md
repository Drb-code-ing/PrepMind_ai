# Phase 6.9.4.4 Router / Verifier 生产接入分支验收

> 验收日期：2026-07-15（文件名沿用阶段计划日期）
> 分支：`codex/phase-6-9-4-4-agent-production`
> 范围：Task 9 分支门禁、Mock、controlled-Live、Docker、可见浏览器、精确清理与 current docs
> 不包含：Task 10 的最终审查、合并 `main`、`main` 复验与远程推送

## 1. 结论

Task 9 分支验收已通过，生产 gate 已恢复默认关闭。受控 Live harness 的 5 个候选全部通过 strict schema 并应用；可见 Docker 浏览器最终覆盖 Router `candidate_applied`、Verifier `candidate_applied`、prompt-injection provider 前 `safety_blocked`、高置信 zero-call、失败 fallback 与 Trace 脱敏。共享预算、canonical permission rebuild、限制性 fallback 和精确清理均有测试或运行证据。

可见 Docker 浏览器初轮验收同时记录了一个必须保留的运行差异：唯一一次歧义 Router 生产请求确实进入模型路径，但在 5002ms 达到 5 秒 timeout，最终 disposition 为 `fallback_timeout`；请求仍返回 HTTP 200、Mock 最终回答继续显示、Trace 成功记录，且未发生重试。按照 stop-on-first-failure 规则，初轮没有继续发送 Verifier eligible 浏览器请求。因此该初轮证据不能表述为“浏览器 Router / Verifier 都 model-applied”，也不能把 Phase 6、全部 Agent 或分层记忆标记为完成。

2026-07-15 的定向 remediation 保留上述历史事实，并补齐全部缺口：Docker Web 服务端 RAG 内部地址缺陷已按 TDD 修复；同一自然语言 conflict / injection 查询在 Chat route 中形成真实命中与本地安全判定；可见浏览器 Verifier eligible 为 `candidate_applied`，injection 为 provider 前 `safety_blocked`，`/agent-trace` 也实际展开核对了固定字段和脱敏边界。第二个 `study_plan` 类 Router 样本仍在 4998ms 得到 `fallback_timeout`，但不同类别、已由本地 eligibility 确认为 `contextual_reference` 的最终样本在同一可见 Docker 浏览器链路以 3262ms 得到 `candidate_applied`。三次请求各自独立、均 `maxRetries=0`，没有把失败改写成成功或拼接 usage。

Task 9 到此通过；下一步才是 Task 10 的最终审查、完整分支门禁、合并 `main`、`main` 复验与推送。其后从新 `main` 进入 Phase 6.9.5 ReviewAgent / PlannerAgent，不提前进入 Phase 6.10 记忆系统。

2026-07-15 的 Task 10 已在 `main` 的 merge commit `b58e8d5` 上完成独立复验。最终 spec review 与 quality review 均为 PASS；这确认的是 Router / Verifier 这一受控子阶段已经可交付，不把结论扩大为全部 Agent、Phase 6 或分层记忆已经完成。主分支运行时默认已恢复为 Mock 和双 gate 关闭；远程同步以本次验收提交后的 `main` SHA 校对为准。

## 2. 生产边界

- Router：安全边界和高置信输入由 deterministic 路径零调用处理；仅歧义、多意图和上下文指代进入模型候选。模型只能建议 canonical route，`requiresRag` 与 `requiresHumanApproval` 始终由本地 route map 重建。
- Verifier：prompt injection、high-risk、credential material 或 `safeForPrompt=false` 在 provider 前零调用阻断；仅 semantic conflict、stale / uncertain 等语义必要证据进入模型候选。
- 两个组件 gate 可独立回滚，默认均为 `false`；timeout 分别为 5000ms / 4000ms。
- 单请求共享不可变预算：`maxCalls=2`、`maxInputTokens=2400`、`maxOutputTokens=800`。
- Provider 只保证合法 JSON object；canonical Zod 仍负责字段、长度、关联、枚举和安全语义。
- timeout、provider error、schema invalid、abort 或预算不足都回到 deterministic / 限制性结果，不自动重试，不取得写权限。
- headers / Trace 只保存固定状态、disposition、duration、usage、error code、安全聚合与受限输入预览，不保存完整 prompt、完整 query、RAG chunk、provider 原始输出、key、base URL、raw error 或 stack。

## 3. 分支门禁

完整分支门禁在本轮 Docker 验收前通过：

| 范围 | 结果 |
| --- | --- |
| `@repo/agent` | 374 / 374 tests；typecheck、lint 通过 |
| `@repo/ai` | 151 / 151 tests；typecheck、lint 通过 |
| `@repo/web` | 原完整门禁 404 / 404；remediation 后 407 / 407 tests，lint、build 通过 |
| `@repo/server` | 735 passed / 2 skipped；lint、build 通过 |
| `@repo/types` | typecheck 通过 |
| Compose | `config --quiet` 通过 |
| Git hygiene | `git diff --check` 通过 |

生产 eligibility / candidate 与 Web orchestration 的 Mock 定向门禁分别为 114 / 114 和 35 / 35。新增运行前的注入式失败定向验证为 11 / 11，覆盖 schema、timeout、provider/runtime、budget、abort 和 hostile input；结果均保持 deterministic 或限制性 fallback，未传播 raw error。

Server TypeScript build 的 12 个 TS5097 已由独立实现/测试提交修复；该修复不属于本 evidence 提交，Task 9 不重复 stage 其文件。

remediation 首先通过 authenticated direct search 证明 conflict / injection 夹具在 0.72 阈值上分别为 2 / 1 hits，但相同文本经 Docker Web Chat route 均为 0 hit。根因不是 embedding 或 query 改写，而是服务端 RAG fetch 只读取宿主公开地址、没有优先读取 Docker 内部 service 地址。提交 `de41de9` 复用 `resolveApiClientBaseUrl()`，固定 `PREPMIND_INTERNAL_API_BASE_URL -> NEXT_PUBLIC_API_BASE_URL -> localhost` 优先级；TDD RED 为 407 中 406 pass / 1 expected fail，GREEN 为 focused 28 / 28、完整 407 / 407、lint 与 build 通过。测试同时覆盖 internal 优先、缺失 internal 回退 public，以及 fetch 失败不泄露 URL / credential。

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

### 6.2 Router eligible：fallback 与 model-applied

首次零网络 eligibility preflight 确认样本属于 `ambiguous_multi_intent`，deterministic route 为 `study_plan`；真实生产候选结果为：

- HTTP 200，页面继续显示回复；最终 Chat 仍使用 Mock，因此没有额外最终回答模型调用。
- Router：`attempted=true`、`fallback_timeout`、5002ms、`TIMEOUT`、usage 0 / 0、aggregate calls=1。
- `x-prepmind-agent-trace-recorded=true`。
- 无重试。

remediation 的另一个 `study_plan` 类样本同样在 4998ms 得到 `fallback_timeout`、usage 0 / 0；该结果继续作为 5 秒边界和继续回复的真实证据保留。最后使用不同类别且本地判定为 `contextual_reference` 的短上下文样本，只发送一次：

- HTTP 200，最终 Chat 保持 Mock，route 为 `tutor`。
- Router：`attempted=true`、`candidate_applied`、3262ms、provider usage 289 / 177、error=`none`。
- `x-prepmind-agent-trace-recorded=true`。
- `maxRetries=0`，没有继续发送任何 Router 或 Verifier 模型请求。

两次 `study_plan` timeout 与一次 contextual-reference applied 并列保留：前者证明限制性 fallback，后者完成可见浏览器 model-applied 验收；任何一个结果都不覆盖另一个。

### 6.3 Verifier 与 RAG 补充诊断

初轮因 Router timeout 没有发送 Verifier eligible Live 请求。remediation 先修复 Docker Chat RAG 内部地址，再对同一精确 conflict / injection 夹具完成 direct search 与 Chat preflight：conflict 为 2 hits，injection 为 1 个 high-risk / unsafe hit；injection 的 prompt hits 为 0 是本地安全过滤后的预期，不是检索失败。

修复前的两次完整 UI 查询 0-hit 和 direct-search 分数 0.7460 / 0.8245 仍作为历史诊断保留，不冒充通过。修复后可见浏览器结果为：

- conflict：route=`rag_answer`、RAG hits=2；Router zero-call `not_eligible`；Verifier `attempted=true`、`candidate_applied`、status=`conflict`、1791ms、usage 568 / 85，页面显示限制性 notice，Trace 成功记录。
- injection：route=`rag_answer`；Router zero-call；Verifier `attempted=false`、`safety_blocked`，没有 DeepSeek candidate attempt，unsafe chunk 未进入 prompt/citation，Trace 成功记录。

两份文档处理与搜索使用既有 Qwen embedding 路径；它们不属于 DeepSeek Agent candidate attempts。文档不记录查询正文、chunk 正文或 embedding 原文。

### 6.4 可见 Trace 页面

可见浏览器实际打开 `/agent-trace` 并展开最新三类 run：安全阻断显示 0 / 0 usage，Verifier applied 显示 1791ms 与 568 / 85，Router timeout 显示 4998ms 与 0 / 0；最终 Router applied 另记录 3262ms 与 289 / 177。页面只展示固定 disposition、duration、token、error code 与受限摘要，未发现 synthetic chunk/document canary、API key、base URL、Bearer、raw provider error 或 stack。

## 7. Trace、数据水位与精确清理

各轮 synthetic identity 均使用唯一前缀。初轮数据达到 documents=3、chunks=2、jobs=2；remediation 数据达到 documents=3、chunks=3、jobs=3，并产生 conflict/injection/Trace 验收记录；最终 Router applied 使用独立最小账号，不创建文档或 job，删除前仅有 user=1、trace=1、conversation=1、messages=2。

清理顺序：

1. 每轮均先通过 authenticated Document API 删除本轮全部文档，使 MinIO object 走业务删除链路。
2. 按本轮 aggregate id 精确删除 synthetic OutboxEvent。
3. 按唯一 synthetic id + email 删除对应 User，依赖既有 `onDelete: Cascade` 清理 Trace、Step、BackgroundJob、Conversation、Message、Summary 与 State。
4. 按每轮 synthetic userId / conversationId 扫描 Redis，无残留 key。
5. 清除独立浏览器 profile 的 cookies、localStorage、sessionStorage 与 IndexedDB；最终复核为 0 / 0 / 0，窗口保持打开在 `/login`。

按本阶段全部 synthetic 前缀与精确 ID 过滤后的最终 PostgreSQL 新鲜计数：

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

各轮清理只针对对应 synthetic identity、document ids 与 aggregate ids；未删除或重置任何旧账号、旧资料、容器、volume、Redis 全库或 MinIO bucket。验收结束时 7 个服务继续运行、worker healthy，Web 已恢复 `AI_PROVIDER_MODE=mock`、全局 live 关闭、Router/Verifier gate 均为 `false`。

## 8. 已知限制与后续交接

- Router 的 `study_plan` 歧义样本两次在 5 秒预算边界 timeout；fallback 与 contextual-reference applied 都已验证。Task 10 的 main 复验必须同时保留，不得只展示成功样本或提高 timeout 掩盖时延风险。
- Docker Chat RAG 必须继续使用 `PREPMIND_INTERNAL_API_BASE_URL` 优先级；direct search 与 Chat route parity 已通过，不能退回宿主 loopback URL。
- Task 9 分支验收已通过；Task 10 才负责最终 spec/质量复核、完整分支门禁、`--no-ff` 合并、main 静态/controlled-Live/Docker/可见浏览器复验、推送与 SHA 核对。本提交不执行这些操作。
- Phase 6.9.5 才进入 ReviewAgent / PlannerAgent；后续仍需 KnowledgeDedup/Organizer、Tutor/WrongQuestionOrganizer、Retriever/FinalResponse、MemoryAgent 候选提取与 MCP-ready Orchestrator，完成后才进入 Phase 6.10。

## 9. Task 10：`main` 合并后复验

### 9.1 合并、审查与静态门禁

- feature branch 以 `--no-ff` 合并到 `main`，主分支 merge commit 为 `b58e8d5`。
- 最终规格审查与质量审查均为 PASS；审查覆盖混合模型边界、canonical 权限重建、零调用安全门、共享预算、超时/限制性 fallback、Trace 脱敏、Docker 内部 RAG 地址、价格快照与默认关闭 gate。
- 在 `main` 上重新通过：`@repo/agent` test/typecheck/lint、`@repo/ai` 151 tests/typecheck/lint、Server 737 passed / 2 skipped + lint/build、Web 407/407 + lint/build、`@repo/types` typecheck 与 Compose `config --quiet`。
- Server build 额外验证了 139 个 `dist/**/*.js` 产物不存在相对 `.ts/.tsx` 运行时引用；该回归由独立测试保护。

### 9.2 主分支 Docker 与可见浏览器

`postgres`、`redis`、`minio`、`server`、`worker`、`web`、`admin` 均保持运行，worker 为 healthy；Web 与 Admin 返回 200，未认证 `/worker-readiness` 返回预期 401。系统 Edge 独立可见窗口通过 CDP 完成验收，结束后仍保留在 `/login`。

- Router contextual reference：最终 Chat 维持 Mock，真实 Router candidate `candidate_applied`，HTTP 200，`4048ms`，usage `295 / 240`，Trace 成功写入。
- Verifier semantic conflict：RAG 命中 2，Router 为 `not_eligible` 零调用，真实 Verifier candidate `candidate_applied`，状态 `conflict`，HTTP 200，`2618ms`，usage `536 / 186`。
- Injection：Router 与 Verifier 均在 provider 前 `safety_blocked`，两者 usage 都是 `0 / 0`，聚合模型调用为 0；没有把不安全资料放入 prompt 或 citation。
- 价格回归：受控 Live final Chat 生成了新的 `deepseek / deepseek-v4-flash` Trace，`pricingKnown=true`，输入/最大输出 `244 / 1200`，成本估算 `0.000389 USD`。该值是集中价格快照按 token 上限估算，不是供应商最终账单。
- `/agent-trace` 仅显示固定 disposition、duration、token、错误码和估算成本；检查中未出现 prompt、chunk 正文、凭据、base URL、provider raw error 或 stack。

为避免 Docker Desktop Bake 的已知 gRPC shared-key 错误，Server、Worker、Web 使用直接 Docker build 成功重建。Admin 重建两次均在 Prisma 官方二进制下载阶段发生外部网络失败（一次请求失败、一次 `ECONNREFUSED`），未继续盲目重试；本次合并没有改动 `apps/admin` 源码或依赖，现有 Admin 镜像仍通过 HTTP 200 验证。该环境限制不影响 Router / Verifier 主分支交付，但后续若改动 Admin，必须在网络可用时重新构建其镜像。

### 9.3 精确清理与默认恢复

1. 先通过 authenticated Document API 删除本轮 5 份合成资料，使 MinIO 走业务删除路径。
2. 精确检查对应 document aggregate 的 OutboxEvent 为 0；随后按唯一合成用户删除 User，并由既有 cascade 删除 7 个 Trace 与 21 个 TraceStep。
3. PostgreSQL 复核 `user/documents/chunks/traces/traceSteps/jobs/conversations/summaries/states/messages/outbox` 全部为 0；Redis 只按该合成 user id 扫描，未发现残留 key，未执行 flush、prune、reset、`down -v` 或任何 volume 删除。
4. 可见浏览器的 cookies、localStorage、sessionStorage、Cache Storage、IndexedDB 已清空，窗口保留在 `/login`。
5. Web 已精确重建回 `AI_PROVIDER_MODE=mock`、`AI_ENABLE_LIVE_CALLS=false`、`ROUTER_MODEL_ENABLED=false`、`KNOWLEDGE_VERIFIER_MODEL_ENABLED=false`。Docker 数据服务与既有数据保持不变。
