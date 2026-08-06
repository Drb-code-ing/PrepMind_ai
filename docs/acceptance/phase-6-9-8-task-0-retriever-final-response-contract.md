# Phase 6.9.8 Task 0 RetrieverAgent / FinalResponseAgent Contract 验收

日期：2026-08-04

分支：`drb/phase-6-9-8-retriever-final-response-contract`

起始提交：`185b8171772d43bf49cfde9bb31323c5fe4647d4`

状态：Task 0 zero-provider contract freeze 完成；尚未实现 shared schema、runtime、Mock、Live 或产品接线

Authority：`zero_provider_retriever_final_response_design`

## 1. 结论

Phase 6.9.8 不把现有 RAG helper 和 `/api/chat` 的 `streamText` 简单改名为两个 Agent。Task 0 先冻结正式
Retriever/FinalResponse contract、canonical identity、跨 Agent envelope、证据投影、结构化 stream、Trace terminal、
并发/取消、失败降级、预算与 48-case 质量门。

当前生产检索已经具备 Qwen `text-embedding-v4` / 1536 与 PostgreSQL vector + keyword hybrid search，而且 Nest
SQL 同时按 Chunk/Document owner 和 `DONE` 状态过滤；这些能力继续复用。尚未完成的是正式 Retriever node、受限
query rewrite、canonical Chat principal、VerifiedEvidenceBundle、FinalResponse node、结构化 citation/terminal Trace
和配套质量 authority。

Task 0 没有修改 apps/packages 运行时代码，没有读取 `.env` 或 credential，没有调用 Qwen/DeepSeek，没有启动
Docker/API/browser，也没有创建 Live marker、journal 或 artifact。

## 2. 当前源码证据

| 证据                                                                 | 可证事实                                                                                   | Task 0 结论                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `packages/rag/src/retriever.ts`                                      | `search()` 仍直接抛出 `Not implemented`                                                    | 不能把 package stub 写成已完成 RetrieverAgent   |
| `apps/server/src/knowledge-documents/knowledge-search.service.ts`    | query embedding 后执行 vector/keyword 两路 SQL；两路均限定 Chunk/Document userId 与 `DONE` | 复用现有 owner-scoped hybrid search，不复制 SQL |
| `apps/server/src/knowledge-documents/knowledge-search.controller.ts` | `JwtAuthGuard + CurrentUser.user.id` 调用 search                                           | owner 只能来自服务器认证结果                    |
| `apps/web/src/app/api/chat/route.ts`                                 | Agent orchestration 仍传 `userId: 'web-chat-user'`                                         | Phase 6.9.8 必须清除 placeholder identity       |
| `apps/web/src/app/api/chat/route.ts`                                 | live 最终回答仍直接调用 `streamText`；citation 在 text stream 后以 Markdown 追加           | FinalResponse/structured citation 尚未正式化    |
| `apps/web/src/app/api/chat/route.ts`                                 | Trace 在 live stream 返回前写入 `finishedAt`                                               | 当前 Trace 不能证明真实 stream terminal/usage   |
| `packages/agent/src/graph/index.ts`                                  | `createAgentGraph()` 返回节点名称 descriptor                                               | 当前不是 owner-aware executable graph           |

以上源码事实只用于冻结缺口；Task 0 不声称任何 runtime 已经修复。

## 3. 冻结的正式边界

### 3.1 Identity 与通信

- `AgentExecutionContextV1` 只接受 server JWT 创建的 authenticated principal 或 anonymous；ownerId 不进入模型、
  public header 或 Trace。
- ownerId 固定为 server-assigned opaque identifier，并与同一 auth receipt/request/bearer token 创建的 deep-frozen
  context 绑定；节点不能替换 principal，也不能另传 ownerId 给 `/knowledge/search`。
- `AgentMessageEnvelopeV1` 固定 schema version、producer/consumer、status/reason、payload 与唯一 usageRef；unknown
  key、非法状态组合、重复 usage 均 fail-closed。
- anonymous 只允许无 owner 数据的 Mock/普通 Chat；Retriever、Verifier、所有 live candidate 与 owner Trace 在
  Provider 构造前拒绝并保持 zero-call。

### 3.2 RetrieverAgent

- 本地 policy 决定是否检索、owner、topK、minScore、status/source filter；模型不能扩大权限或选择其它用户资料。
- DeepSeek V4 Pro query rewrite 只为有认证、Router 要求 RAG 且存在多轮指代/省略的复杂问题建议一次 bounded
  `rewrittenQuery`；本地 validator/merger 决定使用 original 还是 rewrite。
- 正式配置名固定为 `RETRIEVER_QUERY_REWRITE_MODEL_ENABLED=false`、
  `RETRIEVER_QUERY_REWRITE_MODEL_TIMEOUT_MS=4000` 与 Web-only
  `RETRIEVER_QUERY_REWRITE_DEEPSEEK_API_KEY`。
- Task 3 的 zero-provider owner isolation/baseline 使用 injected fake embedding；只有独立 Task 9 admission 才能调用
  Qwen。

### 3.3 VerifiedEvidenceBundle 与 FinalResponseAgent

- deterministic SafetyGuard + Verifier 只能收紧 evidence；blocked/cross-owner/credential/injection/unknown safety
  正文在 model prompt 前删除。
- 完整 bundle 中的 `documentId/chunkId/sourceRef/safetyCodes` 只留在本地 correlation map。FinalResponse model
  最多看到 `citationId/sourceLabel/excerpt/trustLabel`；其中 `sourceLabel` 是本地生成的非敏感 ordinal alias，
  不是用户文档标题。真实 display name 留在本地 renderer 并单独清洗/截断。
- FinalResponse 固定 DeepSeek V4 Pro non-thinking streaming；模型只生成正文，本地 renderer 独占 citation event、
  tool execution status、usage/cost 和 Trace terminal authority。
- 正式配置名固定为 `FINAL_RESPONSE_AGENT_MODEL_ENABLED=false`、
  `FINAL_RESPONSE_AGENT_MODEL_TIMEOUT_MS=20000` 与 Web-only
  `FINAL_RESPONSE_AGENT_DEEPSEEK_API_KEY`；不得借用 generic 或其它 Agent key。
- 当前 AI SDK `streamText` 尚未证明满足 exact endpoint/non-thinking/verified usage/abort/terminal contract；Task 6
  必须先完成专项 adapter 测试。
- 首 token 前失败返回固定不可用响应；首 token 后失败保留 partial text、显式标记 incomplete，并禁止 citation 或
  工具成功状态。所有路径 no retry。

### 3.4 Trace、并发与任务不丢失

- Trace 先写 running，FinalResponse terminal 后再写 finish/TTFT/total/verified usage/cost；估算值与 verified usage
  分栏，不能互相替代。
- 每个 request 使用独立 immutable context/budget/runId/requestId；parent abort 贯穿 rewrite/search/Verifier/
  FinalResponse/Trace，event sequence 单调且 terminal exactly-once。
- exactly-once 只表示服务端 emitter/ledger 与 Trace terminal 不变量，不表示网络恰好交付；客户端断连后仍只允许
  一个 server terminal，不能自动重放或再次收费。`modelRef` 只能是本地安全 allowlist 标识，不能包含 endpoint、
  base URL、credential 或 provider raw metadata。
- 当前 FinalResponse 是同步 request/stream，不创建 `BackgroundJob`，因此 Task 0 不新增 Outbox。未来异步化必须把
  `BackgroundJob + Durable Outbox + idempotency key` 一起设计，禁止只写 job 或只投队列。

## 4. Dataset、预算与质量门

冻结 dataset `phase-6.9.8-retriever-final-response-v1` 共 48 case：

- 16 Retriever guard；
- 16 query-rewrite paired runtime；
- 16 FinalResponse runtime。

正式 gate 要求 guard/fixed denominator/strict terminal/verified usage 全完整，owner、cross-user、credential、
injection、blocked evidence、false tool success 与 false citation failure 全为 0；Retriever Recall@5 `>=0.90`、
nDCG@5 `>=0.85`、eligible rewrite 相对 original-query baseline nDCG `>=+0.08`；Final grounded rubric
`>=0.90`、citation precision `=1`、required citation recall `>=0.90`。

DeepSeek rewrite/FinalResponse 单请求 cap 分别为 `0.005/0.015 CNY`；正式 16+16 run 最多 32 次 DeepSeek 调用、
`0.32 CNY`。paired original/rewrite search 最多 32 次 Qwen query embedding。Qwen 正式价格 profile 与 cap 尚未
冻结，故 Qwen cost 和总成本 aggregate 必须保持 `null`，Task 9 admission 继续阻断。

P95 门固定为 rewrite `<=3500ms`、hybrid retrieval `<=5500ms`、Final TTFT `<=5000ms`、Final total
`<=15000ms`、Chat end-to-end `<=20000ms`。任一分母、usage、price、Trace terminal 或 critical safety 不完整都使
正式 aggregate 为 `null`，production gate fail-closed。

## 5. Task 0 验收清单

- [x] 当前 RAG/Chat/Trace/identity/graph 缺口均有源码证据；
- [x] Retriever、Verifier、evidence projector 与 FinalResponse 职责边界已冻结；
- [x] canonical principal、跨 Agent envelope、权限矩阵、reason/usage attribution 已冻结；
- [x] 独立 gate/timeout/credential 名称与 Web-only 投影边界已冻结；
- [x] model-visible evidence projection 排除 document/chunk/source ref；
- [x] sourceLabel 使用非敏感 ordinal alias，canonical owner/token/request binding 与 safe modelRef 已冻结；
- [x] streaming 首 token 前后失败、abort、terminal、Trace finalization 与 citation authority 已冻结；
- [x] synchronous stream 与未来 BackgroundJob/Outbox 分界已冻结；
- [x] 48-case、Recall/nDCG/grounded/citation/P95/token/CNY/null aggregate 门已冻结；
- [x] 一任务一提交、普通分支、no-worktree、Task 1--11 顺序与 Live 停止门已记录；
- [x] apps/packages runtime 未修改；Provider/credential/Docker/API/browser/正式 evidence 均为 0。

## 6. 本次验证

Task 0 只执行 Markdown 格式、diff、相对链接和独立 authority/docs Reader Testing；不运行 package runtime
tests、Docker、API、browser 或 Provider 命令。

| 验证                                   | 结果                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------- |
| 11 个本次 Markdown 文件 Prettier check | 通过                                                                        |
| `git diff --check`                     | 通过                                                                        |
| 仓库 Markdown 相对链接                 | `349 files / 149 relative links / missing=0`                                |
| authority/security Reader Testing      | `APPROVED`，无 Critical/Important                                           |
| docs/history Reader Testing            | `APPROVED`，无 Critical/Important                                           |
| Git worktree                           | 仅主工作区；已注销的旧 Phase 6.9.5 residue 精确清理，`.worktrees` residue=0 |

首次全目录链接检查把已注销旧 worktree 的孤立 README 当成当前仓库文档并报告 12 个 missing；`git worktree
list` 确认该目录不再是 worktree，且只有旧快照与依赖。按既有清理授权精确删除后，当前仓库检查为 missing=0。
这不是产品、Provider 或 runtime 验收。

## 7. 没有形成的 Authority

Task 0 不证明：

- Retriever/FinalResponse node、Zod contract、query rewrite 或 stream adapter 已实现；
- `web-chat-user`、pre-stream Trace 或 Markdown citation 已修复；
- Qwen/DeepSeek Provider 健康、真实模型语义、usage、费用、P95 或 SLA；
- Docker/API/可见浏览器、产品权限、main 或生产可用；
- `createAgentGraph()` 已成为可执行 LangGraph；
- Phase 6.9.8、6.9.9、6.9.10、6.10、8、9 或博客已完成。

旧 Chat live、现有 Qwen hybrid search、Phase 6.9.7 authority 或未来 Mock 满分都不能拼接成 Phase 6.9.8 pass。

## 8. 后续原子任务

Task 0 只解锁 Task 1：在 `@repo/agent` 落地 shared principal/envelope/Retriever/Bundle/FinalResponse strict Zod
contract、negative tests、deep freeze 与 export。Task 1 仍为 zero-provider，不接 Web/Server runtime，不读取 `.env`，
不启动 Docker，也不执行 Mock/Live。

完整设计与计划见：

- [Phase 6.9.8 RetrieverAgent / FinalResponseAgent 正式化设计](../superpowers/specs/phase-6-9-8-retriever-final-response-agents-design.md)
- [Phase 6.9.8 RetrieverAgent / FinalResponseAgent 实施计划](../superpowers/plans/phase-6-9-8-retriever-final-response-agents.md)

回顾时可以问：

- “为什么现有 hybrid search 已可用，RetrieverAgent 仍不能算完成？”
- “为什么 query rewrite 可以改 query，但不能决定 owner、topK 或 filter？”
- “为什么 FinalResponse model 看不到 documentId/chunkId，citation 仍由本地 renderer 控制？”
- “为什么首 token 后失败不能假装成完整回答？”
- “同步 stream 为什么不需要 Outbox，未来异步化时为什么 BackgroundJob/Outbox 必须一起做？”
- “为什么 Qwen 价格未知会阻断 Task 9，而不能按 0 元计算？”
