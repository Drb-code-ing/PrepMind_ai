# Phase 6 真实模型验收报告

日期：2026-06-29  
分支：`codex/phase-6-8-knowledge-agents`  
结论：通过。最终轮验收 `23 / 23` 项检查通过。

## 验收口径

这次验收不是只跑 mock 单测，而是用真实模型做一轮 Phase 6 小样本 smoke：

- `/api/chat` 前端代理使用 `AI_PROVIDER_MODE=live` 和 `AI_ENABLE_LIVE_CALLS=true`。
- live 模型为 `deepseek-v4-flash`，输出预算 `AI_MAX_OUTPUT_TOKENS=900`。
- Phase 6 的确定性 Agent 仍然不直接调模型，包括 RouterAgent、TutorAgent policy、KnowledgeVerifierAgent、WrongQuestionOrganizerAgent、ReviewAgent、PlannerAgent、MemoryAgent、KnowledgeDedupAgent 和 KnowledgeOrganizerAgent。
- 真实模型只验证最终 Chat 流式输出是否真的受到 route prompt、Tutor strategy、RAG context、Verifier guidance 影响。
- RAG 文档处理本轮使用 `RAG_EMBEDDING_PROVIDER=fake`，因为 server 侧本地环境没有配置 `OPENAI_API_KEY`。这能验工程链路，但不能证明真实 embedding 语义检索质量。

## 环境

后端：

```powershell
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
$env:RAG_EMBEDDING_PROVIDER='fake'
$env:PUBLIC_API_BASE_URL='http://localhost:3001'
```

前端：

```powershell
$env:AI_PROVIDER_MODE='live'
$env:AI_ENABLE_LIVE_CALLS='true'
$env:AI_MAX_INPUT_TOKENS='2500'
$env:AI_MAX_OUTPUT_TOKENS='900'
$env:NEXT_PUBLIC_API_BASE_URL='http://localhost:3001'
```

迁移状态已重新确认：

```text
12 migrations found in prisma/migrations
Database schema is up to date!
```

## 数据准备

本轮验收使用临时账号：

```text
phase6-live-1782717515792-8784721d3f72f@example.com
```

准备的数据：

- 错题 3 条：2 条格林公式 / 曲线积分，1 条链式法则 / 导数。
- 错题组织：生成 1 个学科组“高等数学”，2 个专题 deck：“格林公式”和“链式法则”。
- 复习卡 3 张：今日任务生成 3 条，提交 1 条 Again 评分，写入 1 条 ReviewLog。
- 知识库资料 4 份：`chain-rule-v1`、`chain-rule-v2`、`green-theorem-notes`、`suspicious-chain-note`，全部处理为 `DONE`，每份 1 个 chunk。
- 记忆信号：同步一段用户偏好对话，用于生成 MemoryAgent 候选。

## 确定性 Agent 验收

WrongQuestionOrganizerAgent：

- 学科组：`高等数学`，总错题数 3，专题数 2。
- Deck：`格林公式` 2 题，`链式法则` 1 题。
- 说明：错题事实表仍是权威来源，组织层只写入独立 group/deck/item。

KnowledgeDedupAgent / KnowledgeOrganizerAgent：

- Dedup 建议包含 `possible_revision`，识别 `chain-rule-v1` 与 `chain-rule-v2` 为疑似版本关系。
- Dedup 建议包含多条 `complementary`，识别同主题数学资料之间的互补关系。
- Organizer 生成 1 个集合：`数学资料`，包含 4 份文档，置信度 0.82。
- Organizer 生成 4 个 tags，覆盖数学、笔记、讲义等标签。

ReviewAgent / PlannerAgent：

- ReviewAgent priority：`high`。
- 主要薄弱点：`格林公式`、`曲线积分`、`导数`、`链式法则`。
- PlannerAgent 生成 2 个建议块：`先完成今日复习` 18 分钟，`复盘格林公式` 8 分钟。
- 说明：建议接口只读，不创建未来 `ReviewTask`，也不写复习偏好。

MemoryAgent：

- 生成 1 条 `EXPLANATION_PREFERENCE` 候选。
- 候选来源为用户聊天偏好：“先给提示，再逐步讲清楚”。
- 说明：候选仍需用户确认，不会自动成为 active memory，也不会自动注入每次 Chat。

## Live Chat 验收

| 用例 | route | live | RAG hits | verifier | Tutor intent | trace |
| --- | --- | --- | ---: | --- | --- | --- |
| 讲解 `e^{sin x}` 求导 | `tutor` | 是 | 0 | `skipped` | `explain_solution` | 已写入 |
| 链式法则提示追问 | `tutor` | 是 | 0 | `skipped` | `socratic_hint` | 已写入 |
| Green theorem 资料问答 | `rag_answer` | 是 | 1 | `trusted` | 无 | 已写入 |
| 可疑 chain rule 笔记核对 | `rag_answer` | 是 | 1 | `suspicious` | 无 | 已写入 |
| 学习计划建议 | `study_plan` | 是 | 0 | `skipped` | 无 | 已写入 |

关键观察：

- TutorAgent 的 `explain_solution` 会让模型按“已知条件、概念、步骤、答案”组织回答。
- TutorAgent 的 `socratic_hint` 会明显偏向提示和引导，而不是只丢最终答案。
- RAG trusted case 会引用 `kaoyan-math-green-theorem-notes.txt`，并在引用区追加参考资料。
- RAG suspicious case 会提示链式法则“相加”说法不可信，Verifier 状态为 `suspicious`。
- `study_plan` case 没有写入任务，只给策略性建议，符合 Phase 6.1 advisory 边界。

Agent Trace summary：

```text
liveRuns: 5
failedRuns: 0
degradedRuns: 1
totalInputTokens: 2498
totalOutputTokens: 4500
routeBreakdown: tutor=2, rag_answer=2, study_plan=1
verifierBreakdown: trusted=1, suspicious=1, skipped=3
```

`degradedRuns=1` 来自 advisory route 的保守状态，不代表请求失败。成本看板仍是本地估算值，不等于供应商账单。

## 发现的问题和处理

### 1. 旧前端进程占用 3000

第一次 live 脚本卡住，根因不是模型超时，而是 3000 端口已有旧 Next dev server。新的 live 前端进程尝试启动时退到 3002 后退出，验收请求实际打到了旧进程。

处理：

- 停止旧 PID `35048`。
- 用明确 live 环境变量重启 3000。
- 给验收脚本加阶段日志和单请求超时，避免整轮无结果。

### 2. fake embedding 下 RAG 查询容易被阈值影响

直接检索能命中资料，但 Chat 内部检索默认 `minScore=0.72`。如果 smoke prompt 带太多中文自然语言包装，fake embedding 相似度会被稀释，导致 `ragHitCount=0`。

处理：

- 不改产品代码。
- 将验收 query 调整为更接近 chunk 的固定句子，保证在 fake embedding 下稳定超过阈值。
- 报告中明确：fake embedding 只能证明上传、解析、chunk、入库、检索 API、prompt 注入和 verifier 链路可用，不能证明真实语义召回质量。

### 3. RouterAgent 的 `根据我` 关键词过宽

验收时发现一句很常见的表达会误路由：

```text
请根据我最近的错题和复习情况，安排今天学习重点和下周计划。
```

原实现会因为 RAG 关键词 `根据我` 抢先命中，路由为 `rag_answer`，而不是 `study_plan`。

处理：

- 先补回归测试，确认当前实现失败。
- 收窄 RouterAgent RAG 关键词，移除过宽的 `根据我`。
- 保留 `上传`、`资料`、`笔记`、`知识库`、`参考资料`，所以“根据我上传的笔记”仍会命中 RAG。
- 验证：`bun --filter @repo/agent test -- router` 通过，`79 pass / 0 fail`。

## 未覆盖和不能夸大的结论

- 没有验证真实 embedding 语义质量。需要 server 侧配置 `OPENAI_API_KEY` 或接入生产 embedding provider 后再做一轮 RAG 语义验收。
- 没有做高并发、长上下文、长文档、多用户并发上传的压力测试。
- 没有用 Playwright 逐页验 UI，本轮重点是 API、Agent headers、live stream、trace 和文档处理链路。
- 真实模型输出质量只做 5 个固定小样本 smoke，不能替代系统性人工评测。

## 提交前验证

已执行：

```text
Phase 6 live smoke: 23 / 23 checks passed
bun --cwd packages/database prisma migrate status --schema prisma/schema.prisma: up to date
bun --filter @repo/agent test: 79 pass / 0 fail
bun --cwd packages/types typecheck: pass
bun --filter @repo/server test -- knowledge-agent agent-traces review-agent memory-agent wrong-question-organizer: 5 suites, 33 tests passed
bun --filter @repo/web test -- knowledge-agent agent-trace chat-agent-runtime chat-api-policy chat-rag-context: 237 tests passed
bun --cwd packages/database test: pass
bun --cwd packages/fsrs test: pass
bun --filter @repo/server build: pass
bun --filter @repo/web build: pass
git diff --check: pass
```

Web 测试仍会输出既有 `MODULE_TYPELESS_PACKAGE_JSON` warning，本轮没有引入新的失败。

## 最终结论

Phase 6 的核心 Agent 闭环可以验收：

- Router / Tutor / RAG / Verifier / Trace 能在真实模型链路下协同工作。
- Organizer / Review / Planner / Memory / KnowledgeDedup / KnowledgeOrganizer 的确定性 policy 能基于真实数据库数据生成符合边界的结果。
- Trace 能记录 live route、token 估算、verifier 状态和成本估算元数据。
- 本轮发现的 Router 误路由问题已通过测试驱动修复。

下一步建议进入 Phase 7：BullMQ 后台任务、事件总线、文档处理异步化、生产化观测和更接近生产环境的 RAG embedding 验收。
