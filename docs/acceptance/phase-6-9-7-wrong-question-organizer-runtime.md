# Phase 6.9.7 Task 7 — WrongQuestionOrganizer runtime、Trace 与 HTTP abort

日期：2026-07-23

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

状态：server-only default-off runtime、single/batch dispatch、两阶段 Trace 与 HTTP abort 已完成；生产 gate 仍关闭，controlled-Live、Docker 产品与可见浏览器验收尚未执行

## 1. 为什么需要这一任务

Task 4 只提供 package 内的受治理语义 candidate，Task 6 只建立 owner snapshot、三阶段 stale fence 和 model-free 授权写命令。没有 Task 7 时，NestJS 产品不会创建 Organizer 专属 runtime，也无法证明一次 HTTP 请求只调用一次模型、模型结果先有可审计 admission 才影响写入、客户端断开时不会继续启动新的昂贵步骤。

Organizer 与只读 Agent 不同：模型建议可能间接影响 `WrongQuestionSubjectGroup`、`WrongQuestionDeck` 和 `WrongQuestionDeckItem`。因此本任务不是把模型直接塞进 Service，而是把它限制在 Task 6 两次事务外 fence 之间，并把持久化 Trace 设为 model-influenced command 的准入条件。模型仍没有 owner、真实 ID、Prisma、工具或最终写权限。

## 2. 完成内容

### 2.1 Server-only default-off composition

- 新增独立 `WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED`，默认 `false`；
- 只读取 `WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY`，通用 `DEEPSEEK_API_KEY` 和其它 Agent credential 均不能替代；
- runtime 固定 `deepseek-v4-pro`、`https://api.deepseek.com/v1`、non-thinking JSON、5000ms、SDK retry 0、no tools；
- 真实 executor 只有在 `AI_PROVIDER_MODE=live`、全局 Live gate、Organizer gate、精确 URL、独立 credential 与精确价格全部成立时才创建；任一配置、依赖或价格异常都 fail-closed 为 disabled bundle；
- `SERVER_ROLE=api|both` 才可能启用，`worker` 强制关闭，因此 worker 不创建 Organizer executor；
- env 校验禁止用 generic key 冒充 Organizer credential，也不把 component key 写入公开 metadata。

### 2.2 不可变预算与价格边界

- 每个 Organizer HTTP 请求的冻结预算为 `1 call / 3500 input / 800 output`；
- dispatch 前先完成 reservation，candidate runtime 再做唯一权威 token reservation；
- DeepSeek V4 Pro CNY 价格固定为输入 `3 CNY / 1M`、输出 `6 CNY / 1M`，单请求 cap 为 `0.016 CNY`；
- usage 必须是 provider/runtime 一致的正安全整数，并在预算内；unknown/tampered pricing、`0/0`、超界或 Trace 不一致都不能获得 model admission；
- CNY 只进入有界安全 step，现有 `AgentTrace.costEstimate` 继续保持 USD 语义并写 `pricingKnown=false / costEstimate=0`，不把 CNY 冒充 USD。

### 2.3 Single / batch 单次 dispatch

```text
single
  -> 1 个 owner target snapshot
  -> eligibility / safety / budget
  -> 最多 1 次 candidate

batch（最多读取 50 个未组织目标）
  -> 选出最多 12 个低置信安全目标
  -> 共享 1 次 batch candidate
  -> 其余目标按每 12 条本地 deterministic command 处理
```

- default-off、已有 item、高置信结构字段、精确 deck、不安全 projection、越权、stale、abort 或预算失败都保持 provider 前零调用；
- batch 只对最多 12 个 eligible target 建一个 projection、一次 runtime call，不按错题逐条调用；
- candidate 后 owner fingerprint 漂移会丢弃旧模型结果；同一请求不会因 stale 或 transaction retry 再调用 provider；
- schema、usage、price、runtime、timeout、abort 或 Trace 失败都回到本地 deterministic decision，错题保存和已有组织能力不依赖模型可用性；
- 最终写入仍只执行 Task 6 的深冻结 `wrong-question-organizer-command-v1`，provider 不在任何数据库事务或 advisory lock 内。

### 2.4 两阶段 Trace admission

同一 request-scoped 稳定 `runId` 使用两次真实 `AgentTracesService.createTrace()`：

```text
candidate_applied
  -> 原子写 parent + deterministic + candidate + command_pending
  -> admission 成功后，candidate 才可进入 model-free command
  -> command 完成
  -> 同 owner / 同 runId 原子全量替换为 final command step
```

- admission Trace 写入失败时丢弃模型结果，并用 deterministic command 继续；
- `AgentTracesService` 在一个 Prisma transaction 内执行 run upsert、旧 step 删除、新 step 创建与结果读取；final transaction 失败会回滚整个替换，保留先前完整 `command_pending`；
- final Trace 失败不回滚已经通过 owner fence 与本地授权事务完成的业务写入，也不伪造 final 成功；pending 表示“候选已准入，但最终观测未完成”，便于后续诊断；
- composite owner/runId upsert 与数据库主键保证另一 owner 不能用相同 runId 替换当前用户的 Trace；
- Trace 只记录固定 agent/version/disposition/reason、latency、正 usage 与 CNY provenance，不记录题目、答案、prompt、ordinal 映射、provider output/body/header、credential、URL、cookie、token、stack 或 raw error。

### 2.5 HTTP abort

- single 与 batch controller 都为请求建立 `AbortController`，把 `request.aborted` 传播到 Service，并在完成/失败后移除 listener；
- signal 在 snapshot 前、candidate 前后、Trace admission 后和 command preflight 持续检查；
- 请求在写事务开始前取消时，不再启动新的 provider、Trace 或 command；
- 写事务开始后不把外部 abort 注入 Prisma transaction，只完成已经准入的最小本地 command，避免半写状态；
- runtime factory 把同一 signal 传给 HTTP executor，且 `maxRetries=0`。

## 3. 验证证据

| 验证项 | 结果 |
| --- | --- |
| Task 7 focused（env/config/runtime/Trace/controller/module/service/AgentTracesService） | `126/126` |
| 真实 PostgreSQL AgentTrace + Organizer E2E | `16/16` |
| Server full | `226/226` suites；`2146 passed / 30 skipped` |
| Agent full | `529/529` |
| AI full | `194/194` |
| Agent / AI typecheck 与 lint | exit 0 |
| Server lint | exit 0 |
| Server build | exit 0 |
| `git diff --check` | exit 0 |
| 独立代码/安全复审 | PASS，无 Critical/Important/Minor |
| 独立计划/测试复审 | PASS，无 Critical/Important |

真实 PostgreSQL contract 覆盖同 owner/runId 的 `command_pending -> final` step 全量替换、final createMany 失败后的事务回滚与 pending 保留、跨 owner 相同 runId 拒绝；Organizer E2E 还覆盖 default-off batch 的本地写入与模型 Trace 计数为 0。Service 单测覆盖一次 candidate、Trace admission 失败回退、final Trace 失败不回滚 command、13 条 batch 只调用一次 runtime 且只投影 12 条，以及 pre-abort 下 snapshot/provider/Trace/command 全部 0 调用。Controller 测试覆盖 abort signal 与 listener cleanup，runtime factory 测试覆盖 signal 传递和无重试。

最终 Server lint 首轮只在新增 Service spec 中发现未使用 fixture、无必要 `async` 与未类型化 Jest call 读取；测试改为显式安全类型访问后，Server lint、受影响 Service spec `19/19` 与 Server build 均重新通过。该收口没有改动产品实现，也没有重复运行已经通过的全量测试。

E2E 复用现有本地 PostgreSQL，并由测试账号级联精确清理；没有清空容器、镜像、volume、PostgreSQL、Redis 或 MinIO。

## 4. 本任务没有完成什么

- 没有读取根 `.env`、API key 或真实 provider credential；
- 没有调用 DeepSeek，也没有执行 controlled-Live 或证明 Organizer 语义质量；
- 没有启动 Docker 产品栈、没有执行真实产品 API gate-on 验收，也没有打开可见 `/error-book` 浏览器；
- 没有新增 Task 8 的 public runtime metadata、`local/hybrid/degraded` 来源状态或 UI badge；
- 没有执行 72-case paired runner、24/24 zero-call、48/48 runtime、质量/P95/费用门；
- 没有修改 `.env.example`、Compose、运维回滚或 Live acceptance 配置，这些属于后续 Task 11+；
- 没有证明 Phase 6.9.7、全部 Agent、可执行 LangGraph 或 Phase 6 已完成。

## 5. 下一步与回顾问题

下一任务是 Task 8：为 single/batch response 增加 strict runtime metadata，只允许 `source / disposition / degraded / 可选 traceId`；`/error-book` 展示“语义整理 / 本地规则 / 安全回退”来源状态。Task 8 不打开 gate、不调用 provider，不暴露 token、费用、provider error、prompt、真实 ID 映射或模型重试按钮。

回顾时可以问：

- 为什么 Organizer 使用独立 credential，不能复用 Chat 的 `DEEPSEEK_API_KEY`？
- 为什么 batch 最多 12 条只调用一次，而不是每道错题各调用一次？
- 为什么 model-influenced write 必须先持久化 `command_pending` Trace？
- 为什么 final Trace 失败要保留 pending，而不能回滚已经授权完成的业务写入？
- 为什么 provider 不能进入 owner snapshot 或 advisory-lock 写事务？
- 为什么 HTTP abort 在事务开始后不能中断一半写入？
- 为什么 Task 7 静态/Mock/数据库 contract 完成仍不能声称真实模型已经可用？
