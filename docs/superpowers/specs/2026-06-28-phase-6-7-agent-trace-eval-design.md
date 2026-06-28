# Phase 6.7 Agent Trace UI, Cost Dashboard, and Eval Set Design

## 背景

PrepMind 已完成 Phase 6.6：多 Agent 主线覆盖 RouterAgent、TutorAgent、KnowledgeVerifierAgent、WrongQuestionOrganizerAgent、ReviewAgent、PlannerAgent 和 MemoryAgent。当前 Agent 能力已经能影响 Chat prompt、RAG 保守提示、错题组织、复习建议和长期记忆候选，但这些能力还缺少统一的可观察性与回归评测闭环。

Phase 6.7 的目标不是继续增加新的 Agent，而是让已经存在的 Agent 行为可追踪、可评估、可解释。完成后，开发者可以看到一次 Chat 请求经过了哪些 Agent 决策、为什么选择该 route、是否降级、估算消耗多少 token 和成本；同时项目拥有一组固定 deterministic eval cases，用于防止后续改 prompt 或 policy 时悄悄破坏 Agent 行为。显式 Agent API 的 Trace 接入先作为同一数据模型的后续扩展点，本阶段第一版只把 `/api/chat` 接入 Trace 写入。

本阶段继续遵守既有边界：

- Agent 框架使用 LangGraph，不引入 AutoGen。
- `@repo/agent` 仍保持确定性 policy，不读取 API key，不调用真实模型。
- 真实模型调用仍只存在于 `/api/chat`，并受 `AI_PROVIDER_MODE=live` 与 `AI_ENABLE_LIVE_CALLS=true` 双开关保护。
- Trace 和成本看板只做估算与审计，不承诺等同供应商账单。
- 不保存完整用户 prompt、完整 system prompt、完整 RAG chunk 或完整模型回答。
- MemoryAgent 不自动注入每次 Chat，本阶段不改变 Phase 6.6 的长期记忆边界。

## 产品目标

- 提供账号级 Agent Trace：最近运行、route、confidence、RAG 命中数、Tutor intent、Verifier 状态、降级状态、耗时和步骤摘要。
- 提供轻量成本看板：mock/live 模式、模型名、输入 token 估算、输出 token 估算、最大输出预算和成本估算汇总。
- 提供固定 Agent eval set：覆盖 Router、Tutor、KnowledgeVerifier、WrongQuestionOrganizer、Review、Planner 和 Memory policy 的核心行为。
- 在 `/profile` 或独立页面提供移动端可读的 Trace / 成本入口，便于调试多 Agent 系统。
- 保持用户隐私边界：默认只保存短摘要、元数据、hash 和有限 token/cost 指标。

## 非目标

- 不做精确计费系统，不对账供应商 invoice。
- 不保存完整对话、完整 prompt、完整 OCR 文本、完整 RAG 命中文本或完整 assistant 输出。
- 不引入 OpenTelemetry / Prometheus / Grafana 的生产观测链路；这些留给 Phase 7。
- 不把 Trace 写入 Dexie `mutationQueue`；Trace 是在线账号级审计能力。
- 不实现后台异步任务和事件总线；BullMQ / EventBus 仍属于 Phase 7。
- 不把 eval set 改造成 LLM-as-judge；第一版只做 deterministic assertions。
- 不提供管理员全局审计后台；第一版只展示当前用户自己的 Trace。

## 推荐方案

采用“三层闭环”：

```text
@repo/agent deterministic policy
  -> fixed eval cases in packages/agent
  -> prevents policy regression

/api/chat
  -> sanitized trace event
  -> NestJS /agent-traces
  -> PostgreSQL AgentTraceRun / AgentTraceStep

/agent-trace page
  -> recent runs, detail steps, route distribution, cost estimate
  -> user-visible debugging and acceptance surface
```

核心原则：

- `@repo/types` 定义 Trace contract，前后端都用同一份 Zod schema。
- NestJS 负责 Trace 持久化、用户隔离、查询和汇总。
- Next.js `/api/chat` 只在拿到 access token 时向 NestJS 写入 Trace；无 token、写入失败或超时时不影响 Chat 流式输出。
- `review-agent`、`memory-agent` 和 `wrong-question-organizer` 等显式 API 暂不在第一版写入 Trace，后续可复用同一 `/agent-traces` contract 接入。
- 成本看板使用估算输入 token、最大输出预算和实际可估输出 token，不阻塞回答生成。
- 固定 eval set 放在 `packages/agent`，和生产 API 解耦，默认不需要 Docker、不需要 API key。

## Trace 数据边界

Trace 只保存以下信息。所有 summary 字段写入前必须先脱敏和截断：`inputSummary`、`outputSummary` 最大 160 字，`errorMessage` 最大 240 字；禁止把完整 prompt、完整回答、完整 RAG chunk 或包含密钥的错误堆栈写入 summary。

| 类别 | 保存 | 不保存 |
| --- | --- | --- |
| 用户输入 | `inputHash`、最多 80 字的 `inputPreview` | 完整用户 prompt |
| route | route、confidence、reason 摘要 | 完整内部推理链 |
| RAG | hit count、verifier status、checked chunk count | 完整 chunk 内容 |
| Tutor | intent、depth | 完整策略 prompt |
| 模型 | mode、provider、model、token 估算、成本估算、`pricingKnown` | API key、供应商原始响应 |
| 输出 | output token 估算、步骤摘要 | 完整 assistant 文本 |
| 错误 | 错误摘要、是否降级 | 堆栈中可能包含敏感文本的原文 |

`inputPreview` 必须在写入前做长度截断，并只用于用户自己的 Trace 页面。后续如果用户要求更强隐私，可以把 `inputPreview` 关掉，只保留 hash。

## 数据模型

新增 Prisma 枚举：

```prisma
enum AgentTraceStatus {
  RUNNING
  COMPLETED
  FAILED
  DEGRADED
}

enum AgentTraceMode {
  MOCK
  LIVE
}
```

新增 `AgentTraceRun`：

```prisma
model AgentTraceRun {
  id                  String           @id @default(cuid())
  userId              String
  conversationId      String?
  route               String?
  confidence          Float            @default(0)
  status              AgentTraceStatus @default(COMPLETED)
  mode                AgentTraceMode
  modelProvider       String
  modelName           String
  inputTokenEstimate  Int              @default(0)
  outputTokenEstimate Int              @default(0)
  maxOutputTokens     Int              @default(0)
  pricingKnown        Boolean          @default(true)
  costEstimate        Decimal          @default(0) @db.Decimal(12, 6)
  ragHitCount         Int              @default(0)
  verifierStatus      String?
  verifierChunkCount  Int              @default(0)
  tutorIntent         String?
  tutorDepth          String?
  degraded            Boolean          @default(false)
  inputHash           String?
  inputPreview        String?
  startedAt           DateTime         @default(now())
  finishedAt          DateTime?
  totalDurationMs     Int?
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  user  User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  steps AgentTraceStep[]

  @@unique([id, userId])
  @@index([userId, createdAt])
  @@index([userId, route, createdAt])
  @@index([userId, mode, createdAt])
}
```

新增 `AgentTraceStep`：

```prisma
model AgentTraceStep {
  id            String           @id @default(cuid())
  userId        String
  runId         String
  node          String
  status        AgentTraceStatus @default(COMPLETED)
  startedAt     DateTime
  finishedAt    DateTime?
  durationMs    Int?
  inputSummary  String           @db.Text
  outputSummary String           @db.Text
  errorMessage  String?          @db.Text
  createdAt     DateTime         @default(now())

  user User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  run  AgentTraceRun @relation(fields: [runId, userId], references: [id, userId], onDelete: Cascade)

  @@index([userId, runId])
  @@index([userId, node, createdAt])
}
```

实现时可以根据 Prisma 复合 relation 要求微调 relation name，但语义保持：Trace 按 `userId` 隔离，删除用户时级联清理。

## API Contract

在 `@repo/types` 新增 `api/agent-trace.ts`。

服务端新增 `AgentTraceModule`：

```text
POST /agent-traces
GET /agent-traces
GET /agent-traces/summary
GET /agent-traces/:id
```

所有接口都使用 `JwtAuthGuard`，只操作当前用户数据。

### POST /agent-traces

用于记录一次已经完成或降级的 Agent 运行。请求体：

```ts
type CreateAgentTraceRunRequest = {
  runId?: string;
  conversationId?: string | null;
  route?: AgentRoute | null;
  confidence: number;
  status: 'completed' | 'failed' | 'degraded';
  mode: 'mock' | 'live';
  modelProvider: string;
  modelName: string;
  inputTokenEstimate: number;
  outputTokenEstimate: number;
  maxOutputTokens: number;
  pricingKnown: boolean;
  costEstimate: number;
  ragHitCount: number;
  verifierStatus?: 'trusted' | 'suspicious' | 'conflict' | 'insufficient' | 'skipped';
  verifierChunkCount: number;
  tutorIntent?: string;
  tutorDepth?: string;
  degraded: boolean;
  inputHash?: string;
  inputPreview?: string;
  startedAt: string;
  finishedAt?: string | null;
  totalDurationMs?: number | null;
  steps: CreateAgentTraceStepRequest[];
};
```

幂等要求：

- 如果传入 `runId`，同一用户下重复 `POST` 同一个 `runId` 时更新同一条 run，并替换其 steps。
- 如果不传 `runId`，服务端生成 id。
- `inputPreview` 服务端二次截断到 80 字。
- `costEstimate` 服务端限制为非负数字，保留最多 6 位小数。

### GET /agent-traces

查询参数：

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `limit` | number | `20` | 1 到 50 |
| `route` | `AgentRoute` | 无 | 可选 route 过滤 |
| `mode` | `mock / live` | 无 | 可选模式过滤 |
| `status` | `completed / failed / degraded` | 无 | 可选状态过滤 |

返回最近 run 列表，不包含 steps。

### GET /agent-traces/:id

返回单次 run 详情和 steps。必须校验 `(id, userId)`。

### GET /agent-traces/summary

查询参数：

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `days` | number | `7` | 1 到 30 |

返回：

- run 总数。
- live run 数。
- mock run 数。
- degraded / failed 数。
- input / output token 估算总量。
- costEstimate 总量。
- route 分布。
- verifier status 分布。
- 最近一次运行时间。

## Chat 接入

`/api/chat` 当前由 Next.js API Route 负责流式输出、RAG、OCR 上下文、token 预算和 mock/live 成本保护。Phase 6.7 不迁移这条链路。

推荐接入方式：

1. `buildChatAgentDecision()` 继续生成 route metadata。
2. `buildChatRequestBudget()` 继续生成 token 估算。
3. 在返回 mock/live stream 前构造 sanitized trace payload。
4. 如果请求体有 access token，调用 NestJS `POST /agent-traces`。
5. Trace 写入失败时只 `console.warn`，不改变 Chat 响应状态。
6. 响应头增加 `x-prepmind-agent-trace-recorded=true/false`，便于 smoke 验收。

live 模式下，第一版不等待供应商最终 usage；`outputTokenEstimate` 使用实际可估文本长度或 `maxOutputTokens` 的保守估算。看板文案必须显示“估算”。

## 成本估算

成本估算放在 web 侧，因为真实模型调用和预算控制都在 `/api/chat`。新增 `apps/web/src/lib/ai-cost-estimator.ts`：

- `mock-prepmind-chat` 成本固定为 0。
- 未识别模型成本估算值固定为 0，但 UI 必须显示“未配置单价”，不能把它呈现成真实 0 成本。
- 已知模型单价通过本地常量或环境变量配置，不在文档中写死供应商价格。
- 计算结果保留 6 位小数。

第一版成本公式：

```text
inputCost = inputTokens / 1_000_000 * inputPricePerMillion
outputCost = outputTokens / 1_000_000 * outputPricePerMillion
total = inputCost + outputCost
```

价格会变，因此单价表必须集中在一个文件，UI 文案使用“估算成本”。

## 固定评测集

新增 `packages/agent/src/evals/phase-6-7-cases.ts`，用 TypeScript 描述 eval cases，避免 JSON 缺类型。

第一版覆盖：

| Agent | Case | 断言 |
| --- | --- | --- |
| RouterAgent | 普通聊天 | route=`chat`，confidence 合理 |
| RouterAgent | 讲题追问 | route=`tutor` |
| RouterAgent | 资料型问题 | route=`rag_answer`，requiresRag=true |
| TutorAgent | 求提示 | intent=`socratic_hint` |
| TutorAgent | 要完整解法 | intent=`explain_solution` |
| KnowledgeVerifierAgent | 高分一致资料 | status=`trusted` |
| KnowledgeVerifierAgent | 空命中 | status=`skipped` 或 `insufficient` |
| WrongQuestionOrganizerAgent | 数学错题 | 生成数学 subject group 和 deck |
| ReviewAgent | overdue cards | 生成复习压力提示 |
| PlannerAgent | 容量超载 | 生成减压建议 |
| MemoryAgent | 明确偏好 | 生成 `EXPLANATION_PREFERENCE` 候选 |

测试文件 `packages/agent/tests/phase-6-7-eval.test.ts` 直接运行 policy，不调用网络、不读数据库、不依赖 Docker。

## 前端体验

新增 `/agent-trace` 页面，并从 `/profile` 增加入口。

页面结构：

- 顶部：返回按钮、标题“Agent 调试台”、最近更新时间。
- 摘要区：近 7 天 run 数、live 次数、估算成本、降级次数。
- 分布区：route 分布、verifier status 分布。
- 最近运行列表：route、mode、模型、token、成本、状态、时间。
- 详情抽屉或内联展开：steps、duration、input/output summary、错误摘要。

移动端优先：

- 触摸目标不小于 44px。
- 列表项可点击展开。
- 不展示密集表格；桌面端可用两列布局，移动端单列。
- 不使用完整 prompt 文本，避免页面变成隐私泄露入口。

## 验收标准

Phase 6.7 完成后应满足：

- `@repo/types` 提供 Agent Trace API contract 和 schema tests。
- `@repo/agent` 提供固定 deterministic eval cases，覆盖既有 Agent policy。
- PostgreSQL 有 `AgentTraceRun` / `AgentTraceStep` 持久化模型，按当前用户隔离。
- NestJS 提供 `/agent-traces` 写入、列表、详情和 summary API。
- `/api/chat` 在有 access token 时写入 sanitized Trace，失败不影响 Chat；显式 Agent API Trace 接入留作后续扩展。
- `/agent-trace` 能展示近 7 天 Trace、route 分布和估算成本。
- 文档明确 Trace 不保存完整 prompt / full response，并对 step summary 与 error summary 做长度上限。
- mock 模式全链路无需 API key。
- live 模式仍需双开关，Trace 不绕过成本保护。

建议验证命令：

```powershell
bun test packages/types/tests/agent-trace.test.mts packages/types/tests/agent-trace-runtime-import.test.mts
bun --cwd packages/types typecheck
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
bun --cwd packages/database test
bun --filter @repo/server test -- agent-traces.service.spec.ts
bun --filter @repo/server build
bun --filter @repo/web test
bun --filter @repo/web build
bun --filter @repo/server test:e2e
git diff --check
```

后端 e2e 需要 Docker PostgreSQL 运行，并使用 `RAG_EMBEDDING_PROVIDER=fake`。

## 实施顺序

1. Types + fixed eval set：先把 contract 和 deterministic eval 固定下来。
2. Database + server API：新增 Trace 持久化和查询能力。
3. Web chat trace capture：让 `/api/chat` 非阻塞写入 Trace。
4. Dashboard UI：新增 `/agent-trace` 页面和 `/profile` 入口。
5. Docs closeout：更新 AGENTS / README / data-flow / roadmap / DEVLOG。

每一步完成后单独提交，避免混合 schema、后端、前端和文档改动。

## 风险与处理

- **Trace 写入影响 Chat 延迟**：web 侧使用短超时和 best-effort 写入，失败只记录 warning。
- **成本估算被误认为精确账单**：UI 和文档统一使用“估算”，未知模型不展示为真实 0 成本，而是提示“未配置单价”。
- **隐私泄露**：不保存完整 prompt、完整回答、完整 RAG chunk；`inputPreview` 限长并只展示给当前用户；step summary 和 error summary 写入前必须脱敏、截断。
- **eval case 过度绑定文案**：断言 route、intent、status、候选类型等结构化字段，不断言完整中文句子。
- **Prisma Decimal 与 Zod number 转换**：server mapper 统一把 Decimal 转成 number，再交给 response schema。
