# PrepMind AI 智能备考助手

PrepMind AI 是一个移动端优先的 AI 智能备考助手，目标是把拍照识题、AI 讲题、错题本、间隔复习、知识库检索和 Agent 工具调用串成完整学习闭环。

项目不是一次性 Demo，而是按 Phase 0 到 Phase 10 逐步推进的 AI 应用工程项目。Phase 7 后台任务工程化已经完成；当前进入 Phase 6.9，补齐真实模型 Agent 评测、共享模型运行时与分层记忆，再进入 Phase 8 性能/PWA 和 Phase 9 MCP Tool 体系。Phase 7.23 的 production 导出与维护开关仍默认关闭。

## 当前状态

| 阶段        | 主题                                                                                        | 状态   |
| ----------- | ------------------------------------------------------------------------------------------- | ------ |
| Phase 0     | Monorepo、架构设计、Prisma 初稿、Docker 基础设施                                            | 已完成 |
| Phase 1     | 前端 MVP：AI 聊天、OCR、错题本、今日任务、本地持久化                                        | 已完成 |
| Phase 2.1   | NestJS 后端基础、PostgreSQL、Auth/User API、测试覆盖                                        | 已完成 |
| Phase 2.2   | 前端接入后端 Auth，登录态迁移到真实 session                                                 | 已完成 |
| Phase 2.3   | WrongQuestion、ChatMessage、OCRRecord、图片上传链路、本地补偿队列                           | 已完成 |
| Phase 2.5   | Chat-first 产品壳层、注册登录页、个人中心、今日任务、交互体验                               | 已完成 |
| Phase 3     | AI 讲题系统：structured output、prompt、多题保存、tool action 边界                          | 已完成 |
| Phase 4.1   | WrongQuestion-first FSRS 复习闭环、Review API、今日复习卡                                   | 已完成 |
| Phase 4.2   | 学习统计页、Review stats/logs API、复习趋势与最近记录                                       | 已完成 |
| Phase 4.3   | ReviewTask 持久化任务流、评分完成、跳过和恢复                                               | 已完成 |
| Phase 4.4   | 离线评分队列、服务端幂等评分、待同步状态和 in-app 提醒摘要                                  | 已完成 |
| Phase 4.5.1 | 复习计划预览、`/plan` 页面、`/stats` ECharts 图表                                           | 已完成 |
| Phase 4.5.2 | 复习容量偏好、加权压力模型、7 / 14 天计划设置                                               | 已完成 |
| Phase 5.0   | RAG 知识库设计、可降级 Chat 边界、Phase 5.1 实施计划                                        | 已完成 |
| Phase 5.1   | RAG 数据模型、pgvector 索引预留、knowledge API contract                                     | 已完成 |
| Phase 5.2   | 文档上传与状态 API                                                                          | 已完成 |
| Phase 5.3   | 文档解析、分块、embedding 入库                                                              | 已完成 |
| Phase 5.4   | 检索 API、query embedding、pgvector 相似度搜索                                              | 已完成 |
| Phase 5.5   | Chat RAG 增强、知识库上下文注入、Markdown citations                                         | 已完成 |
| Phase 5.6   | 知识库页面、资料上传/处理/替换/删除/检索测试前端闭环                                        | 已完成 |
| Phase 6.0   | Agent Runtime 地基、共享 Agent contract、RouterAgent、阈值 guard、recorder                  | 已完成 |
| Phase 6.1   | RouterAgent 接入 `/api/chat`、route headers、route-aware prompt、mock route 展示            | 已完成 |
| Phase 6.2   | TutorAgent 策略层、讲题意图分类、策略 prompt、mock strategy metadata                        | 已完成 |
| Phase 6.3   | KnowledgeVerifierAgent、RAG 资料可信度评估、资料核对提示                                    | 已完成 |
| Phase 6.4   | WrongQuestionOrganizerAgent、错题学科卡片、专题 deck、组织层 API                            | 已完成 |
| Phase 6.5   | ReviewAgent / PlannerAgent、复习分析、学习计划建议、只读 suggestions API                    | 已完成 |
| Phase 6.6   | MemoryAgent、长期记忆候选、人审确认、停用/恢复/删除管理                                     | 已完成 |
| Phase 6.7   | Agent Trace UI、估算成本看板、固定 deterministic eval set                                   | 已完成 |
| Phase 6.8   | KnowledgeDedupAgent / KnowledgeOrganizerAgent、资料重复/新版/互补判断、只读 suggestions API | 已完成 |
| Phase 6.9.1 | Agent eval contract、32 个 seed cases、deterministic baseline、paired eval 报告模板         | 已完成 |
| Phase 6.9.2 | 共享 ModelAgentRuntime、结构化 Mock/Live contract、预算、超时和脱敏 Trace                   | 已完成 |
| Phase 6.9.3.1 | 会话摘要/状态 strict contract 与 PostgreSQL/Prisma 地基                              | 已完成 |
| Phase 6.9.3.2 | ConversationState、Redis 降级缓存、prepare API 与 Chat history 恢复                  | 已完成 |
| Phase 6.9.3.3 | 滚动摘要、ModelAgentRuntime、source hash、Serializable 复核与 CAS                   | 已完成 |
| Phase 6.9.3.4 | Web prepare、分层 context assembler、Dexie v9 sanitized state 恢复              | 已完成 |
| Phase 7     | BackgroundJob、BullMQ Worker、Durable Outbox、Readiness、Admin Console、Operator Audit      | 已完成 |
| Phase 7.23  | 180 天审计保留、24 小时证据包、fenced ZIP、Admin 下载、Docker 全链路验收                    | 已完成 |

## 已实现能力

- 真实登录注册：NestJS Auth API、JWT access token、httpOnly refresh token、refresh token rotation 与 reuse detection。
- AI 聊天：流式输出、Markdown / GFM / 数学公式渲染、上下文窗口裁剪、开发默认 mock 与 live 调用成本保护。
- 拍照识题：图片上传、OCR 流式识别、结构化题目输出、多题拆分、有效题目上下文注入，支持围绕当前题目继续追问。
- 错题本：服务端 CRUD、用户级数据隔离、备注、掌握状态、删除确认和操作反馈；`/error-book` 已升级为学科卡片 -> 专题 deck -> 错题列表的下钻结构。
- AI 讲题上下文：OCR structured output 写入 `OcrRecord.parsedJson`，`activeStudyContext` 从结构化题目生成。
- FSRS 复习：错题可加入复习计划，支持 Again / Hard / Good / Easy 四档评分和下一次复习调度。
- 今日复习任务：`ReviewTask` 持久化 pending / completed / skipped / cancelled 生命周期，支持跳过和恢复。
- 离线评分：ReviewTask rating 支持 `clientMutationId` 幂等，弱网失败进入 Dexie mutation queue，待同步期间不本地推进 FSRS 或统计。
- 复习计划：`/plan` 基于只读 `/review-tasks/plan` 展示未来 7 / 14 天复习压力、容量状态和原因标签，不提前创建未来 ReviewTask。
- 复习偏好：`ReviewPreference` 持久化每日分钟、每日卡片上限、提醒时间和计划窗口，`/today` 展示当天预计分钟与容量状态。
- RAG 基础：Phase 5.4 已补齐 `Document` / `Chunk` 元数据字段、`vector(1536)` 索引预留、`@repo/types` knowledge API contract，以及 `/knowledge/documents` 上传/列表/详情/删除 API。
- RAG 处理：`POST /knowledge/documents/:id/process` 支持 TXT / Markdown / DOCX / PDF 基础文本解析、`@repo/rag` 段落感知分块、OpenAI-compatible `text-embedding-3-small` 默认 embedding provider；本地开发和测试/e2e 可用 fake provider 无成本验收，production 禁止 fake provider。
- RAG 检索：`POST /knowledge/search` 支持 query embedding + pgvector 相似度搜索，只返回当前用户 `DONE` 文档 chunks，可配置 `limit`、`minScore` 和 `documentId` 过滤。
- Chat RAG：`/api/chat` 会在有 access token 时调用 `/knowledge/search`，命中后注入知识库片段，并在助手消息末尾追加 Markdown “参考资料”；无资料、无命中或检索失败时继续普通回答。
- 知识库页面：`/knowledge` 支持资料上传、列表、处理、替换上传、删除内联确认、状态摘要和检索测试；资料卡片使用右上角三点菜单承载操作，支持点击页面其它区域关闭，`DONE` 资料不再展示主按钮式重新处理。
- 知识库去重：`POST /knowledge/documents` 会按同用户 `contentHash` 返回已有资料，`PUT /knowledge/documents/:id/file` 会保留同一资料卡片并清空旧 chunks，避免用户更新笔记时产生重复资料。
- RAG 可信度评估：Phase 6.3 `KnowledgeVerifierAgent` 已接入 Chat RAG，命中资料后评估 `trusted / suspicious / conflict / insufficient / skipped`，资料片段只作为回答参考，不作为绝对真理。
- Agent Runtime：`@repo/agent` 已提供 Agent state、ActionProposal contract、RouterAgent、阈值触发 guard、运行 recorder、graph descriptor 和降级链路。
- Router Chat：`/api/chat` 已接入 RouterAgent，响应头会暴露 Agent route、confidence 和是否需要 RAG；现有流式输出、RAG、OCR 上下文、mock/live 双开关和 token 预算保持不变。
- TutorAgent：Tutor 路线会根据用户输入生成 `explain_solution`、`socratic_hint`、`step_check`、`concept_bridge`、`answer_direct` 或 `general_follow_up` 讲题策略，并把短策略 prompt 注入现有 Chat prompt。
- WrongQuestionOrganizerAgent：`@repo/agent/wrong-question-organizer` 当前是确定性 policy，不调用真实模型；NestJS organizer API 将错题组织到 `WrongQuestionSubjectGroup` / `WrongQuestionDeck` / `WrongQuestionDeckItem`，该组织层不替代 WrongQuestion / Card / ReviewLog / ReviewTask。
- ReviewAgent / PlannerAgent：`@repo/agent/review` 和 `@repo/agent/planner` 当前是确定性 policy，不调用真实模型；`GET /review-agent/suggestions` 基于当前用户复习事实生成只读建议，`/plan` 展示完整建议，`/today` 展示紧凑建议，不创建未来 ReviewTask，不写 Card / ReviewLog / ReviewPreference / WrongQuestion / deck。
- MemoryAgent：`@repo/agent/memory` 当前是确定性 policy，不调用真实模型；`UserMemoryCandidate` 与 `UserMemory` 以 PostgreSQL 为权威来源，候选必须由用户在 `/profile` 确认后才会成为正式 `ACTIVE` 记忆，支持停用、恢复和删除；当前不把记忆自动注入 `/api/chat`。
- Agent Trace：`/api/chat` 在有 access token 时 best-effort 写入脱敏 trace，`/agent-traces` 提供账号级在线 API，`/agent-trace` 展示路由、步骤、降级、token 和估算成本；trace 不保存完整 prompt、完整回答、完整 RAG chunk 或 API key，成本看板不替代供应商账单。
- KnowledgeDedupAgent / KnowledgeOrganizerAgent：`GET /knowledge-agent/suggestions` 基于当前用户资料元数据和少量 chunk 摘要，给出重复资料、疑似新版、互补资料、集合和标签建议；该能力只读展示，不自动合并、删除、替换、重命名或分类资料。
- Agent 成本边界：`@repo/agent` 当前不直接调用真实模型；真实模型调用仍只在 `/api/chat` 内由 `AI_PROVIDER_MODE=live` 与 `AI_ENABLE_LIVE_CALLS=true` 显式开启。
- Model Agent Runtime：`@repo/ai` 提供共享结构化 `ModelAgentRuntime`，Mock/Live 共用 Zod schema、不可变 run budget、结果和安全 Trace contract；package 不读取 env，API key 只保留在 composition root 创建的 executor closure。Phase 6.9.2 未迁移 `/api/chat` streaming，也未把任何业务 Agent 改为模型路径。
- 分层会话上下文：Phase 6.9.3.4 已让 Web request 携带 `conversationId`，仅在 token + id 存在且 live auth 已通过后调用 prepare。首轮无 id 安全跳过，sync 后第二轮进入 prepare；默认 10 秒有界 timeout 与 request abort 失败只产生固定 degraded 元数据。assembler 保留 base/latest user，独立预算 agent/state/OCR/recent/RAG/summary，RAG drop 同步清引用，summary 仅在历史被裁时使用，安全 headers/Trace 不含正文。
- 会话状态恢复：PostgreSQL 是权威源、Redis 是服务端 cache、Dexie v9 仅保存 sanitized state。local cache 按用户串行并执行版本单调、expiry、身份隔离和 logout/clear 清理；不存 summary、tool、proposal、prompt、token，也不把 activeQuestionId 伪造成 OCR 全文。
- 后台任务可靠性：知识库处理使用 BullMQ/BackgroundJob，Durable Outbox 负责 PostgreSQL 到 Redis 的可靠事件桥接，Worker heartbeat、observability 与 readiness 分别提供在线、诊断和接流量判断。
- 审计证据包：ADMIN 可在 `/audit` 按脱敏筛选申请异步 ZIP，服务端以事务型 Outbox 投递，Worker 使用 lease/processing token CAS 与 attempt-fenced MinIO key 防止僵尸覆盖；下载为 POST/no-store、fail-closed 审计，不使用 presigned URL，READY 24 小时后逻辑过期。
- AI 行为验收：mock 只证明工程链路，Chat / RAG / Agent 输出体验必须按 `docs/ai-behavior-acceptance.md` 做小样本 live smoke；`RAG_EMBEDDING_PROVIDER=fake` 不作为语义命中质量证明。
- 学习统计：`/stats` 使用客户端 ECharts 展示复习总览、7 天 / 30 天趋势、评分分布、卡片状态和最近复习记录。
- 历史恢复：聊天历史和 OCR 历史已进入 PostgreSQL，Dexie 负责本地快速恢复和离线兜底。
- 图片存储：新 OCR 图片上传到 MinIO，OCRRecord / WrongQuestion 优先保存服务端图片 URL。
- 离线补偿：WrongQuestion / OCRRecord / ReviewTask rating 写操作失败时进入 Dexie mutation queue，网络恢复后自动补偿同步。
- 产品体验：Chat-first 主入口，注册登录页、侧边栏、今日任务、错题本、个人中心和聊天页统一到亮色轻漫画视觉系统。

## 技术栈

| 层级        | 技术                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend    | Next.js 16, React 19, TypeScript, Tailwind CSS 4, TanStack Query, Zustand, Dexie                                                                  |
| Backend     | NestJS 11, Prisma, PostgreSQL, JWT, Zod                                                                                                           |
| AI          | Vercel AI SDK, OpenAI / DeepSeek API                                                                                                              |
| Review      | FSRS, Card, ReviewLog, ReviewTask                                                                                                                 |
| Storage     | PostgreSQL, MinIO, IndexedDB / Dexie                                                                                                              |
| Infra       | Docker Compose, pgvector, Redis                                                                                                                   |
| RAG         | pgvector, OpenAI-compatible embedding, local/test fake provider                                                                                   |
| Agent / MCP | LangGraph, RouterAgent, TutorAgent, KnowledgeVerifierAgent, WrongQuestionOrganizerAgent, ReviewAgent, PlannerAgent, MemoryAgent, Agent Trace, MCP |

## 架构概览

```mermaid
flowchart LR
  User[Student] --> Web[Next.js Web / PWA]
  Web --> ApiClient[apiClient + TanStack Query]
  Web --> NextApi[Next.js API Routes]
  Web --> Dexie[Dexie / IndexedDB]
  ApiClient --> Server[NestJS REST API]
  NextApi --> AIGuard[AI mode guard / token budget]
  NextApi --> Agent[RouterAgent / TutorAgent / Verifier policy]
  AIGuard --> LLM[Mock stream / OpenAI / DeepSeek]
  Server --> Prisma[Prisma]
  Server --> FSRS[@repo/fsrs]
  Prisma --> Postgres[(PostgreSQL + pgvector)]
  Server --> MinIO[(MinIO)]
  Server --> Redis[(Redis / BullMQ queues)]
```

当前边界：

- 登录态权威来源是 NestJS Auth API + PostgreSQL refresh token。
- WrongQuestion / ChatMessage / OCRRecord 权威来源已迁移到 PostgreSQL。
- WrongQuestionSubjectGroup / WrongQuestionDeck / WrongQuestionDeckItem 是错题组织层，服务于学科卡片和专题 deck 展示，不替代错题内容与 FSRS 复习事实。
- Card / ReviewLog / ReviewTask 权威来源是 PostgreSQL，学习统计以 ReviewLog 为事实来源。
- `/review-tasks/plan` 只读预览 `Card.nextReview`，结合 `Card.difficulty`、`Card.stability` 和 `ReviewPreference` 计算加权压力；今日任务仍由 `/review-tasks/today` 负责生成与执行。
- `/review-agent/suggestions` 只读聚合 Card、ReviewLog、ReviewTask plan、ReviewPreference 和错题组织摘要，返回 ReviewAgent / PlannerAgent 建议；它只服务 `/plan` 与 `/today` 展示，不进入 Dexie `mutationQueue`，不自动创建 `ReviewTask(source=PLANNER)`。
- `UserMemoryCandidate` 与 `UserMemory` 权威来源是 PostgreSQL；`/memory-agent` 生成长期记忆候选，`/user-memories` 管理正式记忆，候选必须经用户确认才生效；当前不在 `/api/chat` 自动读取或注入记忆。
- `AgentTraceRun` 与 `AgentTraceStep` 权威来源是 PostgreSQL；`/agent-traces` 是在线账号级观测 API，不进入 Dexie `mutationQueue`；`/api/chat` trace 写入失败不会影响流式回答。
- RAG 知识库已完成 Phase 5.6 前端闭环：上传资料原文件进入 MinIO，`Document` 状态流为 `PENDING -> PROCESSING -> DONE / FAILED`，`/knowledge` 提供在线管理、替换上传、删除确认和检索测试入口。
- RAG chunk 以 PostgreSQL + pgvector 为权威来源，`Chunk.embedding` 固定为 `vector(1536)` 并通过 raw SQL 持久化；处理写入前校验 document/user ownership，forced reprocess 会先清旧 chunks，避免 stale retrieval。
- `POST /knowledge/search` 使用 query embedding 检索当前用户 `DONE` 文档 chunks，返回 score、chunk metadata 和 document metadata。
- `/api/chat` 在有 access token 时调用知识库检索，命中后把 chunks 注入 system prompt 并追加 Markdown citations；未上传资料、未命中或检索失败时继续普通 AI 回答。
- `/api/chat` 与 `/api/ocr` 仍由 Next.js API Routes 代理 AI 服务；Chat 默认本地 mock，真实模型调用必须显式开启 `AI_PROVIDER_MODE=live` 和 `AI_ENABLE_LIVE_CALLS=true`，默认 live 模型为 `deepseek-v4-flash`。
- `/api/chat` 会统一估算 system prompt、activeStudyContext 和近期消息 token，默认输入上限 2500、输出上限 1200，超限返回 413。
- `/api/chat` 已接入 RouterAgent、TutorAgent policy 和 KnowledgeVerifierAgent：Agent 只决定路由、讲题策略、资料可信度提示和短 prompt，不直接调用模型、不写业务数据。
- `/error-book` 通过 organizer API 展示学科卡片、专题 deck 和 deck 内错题；创建错题后的自动整理为非阻塞流程，整理失败不影响错题保存。
- Dexie 负责本地快速恢复、离线兜底、乐观更新和旧图片预览；ReviewTask rating 已进入 mutation queue，但服务端仍是 FSRS 与统计权威来源。

## Monorepo 结构

```text
apps/
  web/       Next.js 前端应用
  server/    NestJS 后端服务

packages/
  database/  Prisma schema、migration、database client
  types/     共享 Zod schema 与 API 类型
  ai/        AI 能力封装预留
  fsrs/      FSRS 间隔重复调度算法
  rag/       RAG 能力预留
  agent/     LangGraph Agent 预留
  mcp/       MCP 工具体系预留
  ui/        共享 UI 组件预留

docker/      本地开发基础设施
docs/        架构、数据流、路线图和启动文档
```

## 本地启动

项目使用 Bun workspace。Windows 本机开发推荐使用 Docker Desktop 启动 PostgreSQL / Redis / MinIO。

```powershell
bun install

$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio

$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
bun run db:generate
bun run db:migrate

$env:RAG_EMBEDDING_PROVIDER='fake'
bun --filter @repo/server start:dev
bun --filter @repo/web dev
```

默认访问：

```text
Web: http://localhost:3000
API: http://localhost:3001
Health: http://localhost:3001/health
MinIO Console: http://127.0.0.1:9001
```

更完整的环境变量、Prisma 和 Docker 命令见 [docs/dev-start.md](./docs/dev-start.md)。

## 常用验证

```powershell
bun --filter @repo/web lint
bun --filter @repo/web test
bun --filter @repo/web build
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --cwd packages/fsrs test
```

## 下一步

下一步主线：

1. Phase 6.9.1 已固定 Agent 评测 contract 和 seed baseline；结果见
   [deterministic baseline](./docs/acceptance/2026-07-11-phase-6-9-1-deterministic-baseline.md)，
   paired Live 验收复用[报告模板](./docs/acceptance/phase-6-9-agent-eval-template.md)。
2. Phase 6.9.3.4 已完成 Web prepare、分层 assembler 与 Dexie 恢复；下一任务是 Phase 6.9.3.5 Docker Mock、受控 Live、清理与阶段证据。Phase 6.9 完成后进入 Phase 8 性能/PWA，
   随后进入 Phase 9 MCP Tool 体系。

## 文档入口

- [开发路线图](./docs/roadmap.md)
- [数据流说明](./docs/data-flow.md)
- [本地启动命令](./docs/dev-start.md)
- [架构设计文档](./docs/architecture.md)
- [开发日志](./DEVLOG.md)

## 项目声明

这是一个学习与作品集导向的 AI 应用工程项目，仍在快速迭代中。README 只描述当前真实状态，不把后续 Phase 包装成已经完成的能力。
