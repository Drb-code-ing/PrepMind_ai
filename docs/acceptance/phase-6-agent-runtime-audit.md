# Phase 6 Agent Runtime Audit

更新时间：2026-08-25
范围：Phase 6 全部 Agent、模型 gate、通信边界、权限、预算、Trace、降级和现有证据。  
结论级别：本文件是审计基线，不代表所有 Agent 已完成真实模型验收。

## 1. 结论摘要

- 产品 `/api/chat` 的实际链路是：认证与 owner 绑定 -> Router/Tutor 编排 -> Retriever（可选 query rewrite）-> KnowledgeVerifier -> 本地 evidence projector -> FinalResponse 流式回答。
- `packages/agent/src/graph/index.ts` 当前只是 11 个节点的 descriptor，没有 edges、执行器、权限或预算 enforcement；它不是产品运行时的 source of truth。
- `Tool-Using Orchestrator` 在行为文档中被列为规划组件，但尚未进入 graph descriptor 或产品执行链。该项不能标记为已完成。
- 模型只能增强候选或生成受限 guidance；身份、owner、权限、业务事实、写操作和最终安全边界由确定性代码掌握。
- 目前有产品真实模型 smoke 的是 FinalResponse 主链（`/api/chat` 返回 `200 / mode=live / trace=true`）；这不等于 Router、Tutor、Retriever rewrite、Verifier、Review/Planner 或 Knowledge agents 都已逐项真实成功。
- 默认环境保持 `AI_PROVIDER_MODE=mock`、`AI_ENABLE_LIVE_CALLS=false`、各组件 gate=false。打开 gate 需要独立的组件 key、预算和产品验收，不应把默认关闭误解为未实现。
- ChatTurn 第一原子实现、第二步可靠入队与第三步 deterministic Worker durable baseline 已完成：请求 Outbox 幂等桥接到 BullMQ，Worker
  在 owner-scoped claim 后将 assistant/Turn/BackgroundJob/终态 Outbox 同事务提交；这仍不等于真实模型 Worker、Replay 或 `/api/chat`
  turn-backed durability 已完成。证据见 `docs/acceptance/phase-6-chat-response-worker.md`。

## 2. Agent 总矩阵

Chat 入队与后台执行的当前实现状态：`ChatTurnEnqueueService` 完成同事务 Turn/Job/Outbox，Chat Response Worker 完成
requested bridge、claim、deterministic generation 和 terminal commit；active claim recovery、单点 Queue 注册与 timeout/lease
交叉校验也已补齐。Replay、产品切换、真实模型和生产使用证据仍按下表推进。

| Agent | 职责与入口 | 模式与模型 | gate /预算 /超时 | 权限与通信边界 | Trace /证据 | 当前缺口 |
|---|---|---|---|---|---|---|
| RouterAgent | `/api/chat` 内确定路由：`rag_answer`、`study_plan`、`review_analysis`、`wrong_question_organize`、`tutor`、`chat` | 确定性关键词/上下文为权威；可选 DeepSeek/OpenAI-compatible candidate | `ROUTER_MODEL_ENABLED` + 全局 live 两项；共享 Router/Verifier `2 calls / 2400 input / 800 output`；5s | 只读 request/context；不得决定身份、owner、权限或写操作；输出 route contract 给编排器 | observation 可进 header/Trace；模型失败回退普通 Chat；无专属 product-live 逐项证据 | 与 graph descriptor 没有执行边；全链路预算未统一 |
| TutorAgent | 为 `route=tutor` 生成 bounded 学习引导 | 确定性 Tutor strategy 为基础；可选真实模型只增强 guidance | 独立 `1 / 1200 / 300`；3s；显式非 tutor 或 gate-off 为 zero-call | 只读最近上下文与 strategy；输出受限 guidance，不得替代最终回答 | degraded observation 进入编排结果；失败回退 deterministic strategy；无专属 product-live 证据 | runtime/config 仍由 Web 编排层维护，未纳入 graph enforcement |
| RetrieverAgent | owner-scoped 关键词+向量 hybrid search，返回 bounded evidence | 检索本体确定性；query rewrite 可选 DeepSeek `deepseek-v4-pro` | `RETRIEVER_QUERY_REWRITE_MODEL_ENABLED` + 全局 live；4s，`1200/160`，cap `0.005 CNY` | canonical auth、owner、run/request/deadline 绑定；不得跨 owner 或写业务 | query hash、命中数、延迟、rewrite disposition；失败可 `failed_no_rag`；历史 SR5 不是 quality authority | 没有单独 product-live rewrite 成功证据；budget 未跨节点聚合 |
| KnowledgeVerifierAgent | 审查 Retriever evidence 的可信度 | 先确定性 `verifyKnowledgeChunks`；模型只能收紧结论 | `KNOWLEDGE_VERIFIER_MODEL_ENABLED` + 全局 live；共享 `2 / 2400 / 800`；4s | 只读 chunks；不得放宽安全边界或写知识库；输出 `trusted/suspicious/conflict/insufficient` | conservative fallback；observation 进 Trace；无专属 product-live 证据 | 与 Router 共用 bundle，缺少显式跨节点 capability/预算记录 |
| FinalResponseAgent | 消费本地 projection、citation、bounded turns/guidance 并流式回答 | 产品真实流式节点；DeepSeek `deepseek-v4-pro` non-thinking，mock/live 双路径 | `FINAL_RESPONSE_AGENT_MODEL_ENABLED` + 全局 live；20s，`2500/1200`，cap `0.015 CNY` | 只读 context-bound request；不得直接写业务或引入未授权 citation；必须产生唯一 terminal | Trace finalize best-effort；已具备合并后 `/api/chat` live smoke | 现有 smoke 未逐项证明上游每个 Agent 成功；全链路预算/断连持久化仍待补强 |
| WrongQuestionOrganizerAgent | 组织单题/批量错题，并通过 command executor 执行受控写操作 | 确定性 organizer 为权威；可选 DeepSeek candidate | 一次调用，`3500/800`，5s，cap `0.016 CNY`；worker 强制关闭 | JWT + owner snapshot/freshness/admission；模型不得直接写，必须经过 trace/admission/command | AgentTrace best-effort；用户预修改文件不在本轮审计范围 | 需要独立产品真实模型 smoke；不能触碰当前 3 个用户 dirty 文件 |
| ReviewAgent | `GET /review-agent/suggestions`，生成复习分析/建议 | 确定性 tasks/preferences/cards/logs 为权威；可选 Review candidate | Review/Planner 共享 `2 / 1950 / 440`；默认 4.5s | JWT；只读业务快照；candidate 不得写业务 | AgentTrace best-effort；AbortSignal 与外层 deterministic fallback 已有 focused `13/13`；无本轮产品 live endpoint smoke | 仍需独立真实模型产品验收、共享 ledger 与持续运行证据 |
| PlannerAgent | 同一 suggestions endpoint 的学习计划生成 | 确定性 `planStudy` 为权威；可选 Planner candidate | 与 Review 共享 `2 / 1950 / 440`；默认 4.5s | JWT；只读快照；输出计划候选，不得改任务数据 | AgentTrace best-effort；AbortSignal 与外层 fallback 已修复；无本轮产品 live endpoint smoke | 仍需独立真实模型产品验收、并发预算与持续运行证据 |
| MemoryAgent | `/memory-agent/*` 候选生成、接受/拒绝及用户记忆 CRUD | 当前 `generateCandidates` 为确定性 `analyzeMemory`；没有模型 gate | 无 provider/gate/timeout/budget/Trace 合同 | JWT；读取 60 日消息/cards/logs/preferences；接受需显式用户确认；写入事务化 | 无 AgentTrace；accept/reject/update/delete 是明确业务写操作 | 架构上是“代码存在但没有模型增强”的明显缺口；需先定义隐私、候选范围、预算和降级合同，再接真实模型 |
| KnowledgeDedupAgent | `/knowledge-agent/suggestions` 中知识去重候选 | 确定性快照/重复判断 + 可选 DeepSeek `deepseek-v4-pro` | 每 agent 约 `3000/500`；共享 `2 / 6000 / 1200`；4.5s；cap `0.03 CNY` | JWT、RepeatableRead owner snapshot、前后 stale revalidation；不直接写领域数据 | Trace best-effort；异常 safe fallback；无本轮 product live smoke | 需要真实 endpoint smoke 与共享预算/并发证据 |
| KnowledgeOrganizerAgent | 同一 endpoint 中知识组织候选 | 确定性组织 + 可选 DeepSeek `deepseek-v4-pro` | 每 agent 约 `3000/700`；共享 `2 / 6000 / 1200`；4.5s；cap `0.03 CNY` | 与 Dedup 相同；模型结果必须经过 freshness fence | Trace best-effort；异常 safe fallback；无本轮 product live smoke | 同 DedupAgent |
| ConversationSummary（支持子系统） | `ConversationContextService.prepare` 的会话摘要与长期上下文压缩 | 确定性 redaction/schema；可选 model runtime；不是 graph Agent | 有 summary 专属 calls/input/output/timeout 配置 | 只读当前会话与安全摘要；Serializable CAS 后才持久化；失败回退 previous/degraded | 尚未发现 AgentTrace stage；需决定纳入正式 trace taxonomy 还是保持独立 | 应在记忆系统阶段明确它与瞬时/短期/长期记忆的边界 |

## 3. 通信与权限审计

### 3.1 当前真实 Chat 组合

```text
HTTP request
  -> canonical /auth/me + owner binding
  -> Trace start (best-effort)
  -> Router/Tutor orchestration
  -> Retriever + optional query rewrite
  -> KnowledgeVerifier
  -> local evidence projector
  -> FinalResponse stream
  -> terminal Trace finalize (best-effort)
```

每个模型节点消费上游的 typed、bounded projection；模型不得读取原始数据库连接、凭据、其他用户数据或直接调用领域 command。

### 3.2 目前的架构断点

1. `packages/agent/src/graph/index.ts` 已升级为受治理 catalog：明确 `executionAuthority=catalog_only`、产品组合层权威、typed communication edges、模型模式、领域写权限和 planned Orchestrator；它仍不执行 Agent，也不伪造 owner capability、budget ledger 或 terminal policy。
2. `packages/agent/src/runtime.ts` 的通用运行时与产品 `/api/chat` 不是同一执行契约，不能用它证明产品链路已经串联。
3. 行为文档中的 Tool-Using Orchestrator 尚未实现，不能列入“已完成 Agent”。
4. Chat Trace 是旁路 best-effort，写入超时或失败不会阻断回答；Worker 已建立 assistant/Turn/Job/terminal Outbox durable
   baseline，但 Redis/SSE cursor、断线 replay 与 `/api/chat` turn-backed 产品路径仍未接入。
5. Review/Planner 的 HTTP AbortSignal 与 candidate 外层 fallback 已完成；但共享预算 ledger 和真实模型产品验收仍未建立。
6. Router/Verifier/Tutor/FinalResponse 各自持有局部预算，全链路没有统一 ledger，需补跨节点上限和越界测试。

## 4. 证据分级

| 级别 | 含义 |
|---|---|
| implemented | 源码存在且静态/单元合同通过，不代表产品接入 |
| mock/static validated | reviewed mock 或确定性回归通过，不代表真实模型 |
| controlled-Live | 在独立 source/tag/授权下的一次性真实 Provider 证据；失败也要封存，禁止重跑 |
| product real-model smoke | 真实产品 endpoint 返回模型结果；只证明该入口和当次配置，不自动证明每个 Agent |
| production-used | 需要额外的持续运行、可观测性和业务证据，本阶段不宣称 |

当前已确认的 product real-model smoke 只有 `/api/chat` 主回答链；其余 Agent 的真实调用仍需逐项或组合式受控验收。历史 SR5 Retriever/FinalResponse controlled-Live 证据保持 `qualityAuthority=none`，不能反推语义质量。

## 5. 本审计后续顺序

1. ~~先修复并测试 Review/Planner 的 AbortSignal 与 candidate 外层 fail-safe。~~ 已完成：controller 将 HTTP `aborted` 映射为请求级 AbortSignal，service 传入两个 candidate；两个 candidate runner 额外有 deterministic 外层 fallback。`review-agent.controller.spec.ts` + `review-agent.service.spec.ts` 为 `13/13`，Server build 通过。
2. ~~定义 graph descriptor 与产品组合层的关系。~~ 已完成：catalog 明确不是执行器，补 typed edges、model mode、domain write permission、产品组合位置和 planned Orchestrator；graph focused `3/3`、Agent typecheck 通过。
3. ~~为 Chat 增加全链路预算/断连 durability 的明确合同和测试。~~ 设计 checkpoint、可靠入队与 deterministic Worker durable baseline 已完成：明确 ChatTurn、BackgroundJob+Outbox 同事务、worker/replay、owner/幂等和 run-level budget；Replay、产品切换与全链路 ledger 仍未完成，详见 `docs/acceptance/phase-6-chat-durability-budget-design.md` 与 `docs/acceptance/phase-6-chat-response-worker.md`。
   ChatTurn schema/migration 与 owner-scoped repository focused `10/10`、schema `9/9`，可靠入队 focused `8/8`，Worker focused `9 suites / 137 tests`；Server build 通过。Worker 当前仍是 deterministic，不代表真实模型。
4. 为 MemoryAgent 定义真实模型增强的隐私、候选确认、预算和 Trace 合同；完成 Agent 架构后再进入分层记忆实现。
5. 做独立 Review/Planner、Knowledge agents、Router/Verifier/Tutor/Rewrite 的产品验收，保持浏览器窗口可见并保留证据。
6. 所有代码/文档任务逐项提交、推送、`--no-ff` 合并 main，再在 merged-main 复验；全部 Agent 架构与真实验收完成后，才写两篇面试博客。

