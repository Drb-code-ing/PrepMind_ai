# Phase 6.9.8 RetrieverAgent / FinalResponseAgent 实施计划

> 设计来源：
> [Phase 6.9.8 RetrieverAgent / FinalResponseAgent 正式化设计](../specs/phase-6-9-8-retriever-final-response-agents-design.md)
> 当前状态：Task 9C 与 Architecture Recovery R5 均已失败封存；Transport Evidence Recovery T0/T1/T2/T3-A 已完成，T3-B
> controlled canary 已按一次性授权执行并以配置失败 durable seal，T3-C configuration guard 已完成；R6/R7、产品/main
> 与后续阶段阻断
> 当前分支：`drb/phase-6-9-8-retriever-final-response-contract`

## 执行原则

- 每个 Task 只处理一个可独立验证的关注点，并形成一个提交。
- Phase 6.9.8 功能分支最初来自已推送的最新 `main`；不创建 worktree，也不从该功能分支再开子分支。当前
  Recovery 必须复用尚未进入 main 的 Task 0--9B 基线，因此继续在同一功能分支做原子提交，禁止为满足分支形式
  提前合并失败 gate。
- Task 0--8 与 Task 9A/9B 全部 zero-provider；禁止读取或输出 `.env`、credential，禁止调用 Qwen/DeepSeek。
- Task 9C 必须在静态/Mock checkpoint、9A/9B、source parity、fresh 数据边界接受和精确一次性授权后单独执行。
- Task 9C 唯一名额现已消费；禁止 retry/resume/replay/backfill、seal/recovery 或追加 Provider 探测。
- Mock、synthetic、旧 Chat Live 或 Phase 6.9.7 evidence 均不能替代 Phase 6.9.8 质量 authority。
- 任何 owner、安全、usage、价格、分母或 Trace terminal 不可验证都 fail-closed。
- 每个 Task 完成后同步 AGENTS/DEVLOG/roadmap/acceptance；只有新增运行配置时才更新 dev-start/README。

## Task 0：设计、边界与数值门冻结

### 交付

- 新建设计文档与本计划；
- 冻结 `AgentExecutionContextV1`、`AgentMessageEnvelopeV1`、`RetrieverRequest/ResultV1`、
  `VerifiedEvidenceBundleV1`、`FinalResponseRequest/StreamEventV1`；
- 冻结 authority/permission/failure/concurrency/Trace 边界；
- 冻结 `phase-6.9.8-retriever-final-response-v1` 48-case、P95、token 和 CNY 门；
- 记录当前 `packages/rag` stub、真实 Nest hybrid search、`web-chat-user`、非结构化 citation 和
  pre-stream Trace 缺口。
- 冻结 Web-only 独立配置名：
  `RETRIEVER_QUERY_REWRITE_MODEL_ENABLED/RETRIEVER_QUERY_REWRITE_MODEL_TIMEOUT_MS/
RETRIEVER_QUERY_REWRITE_DEEPSEEK_API_KEY` 与
  `FINAL_RESPONSE_AGENT_MODEL_ENABLED/FINAL_RESPONSE_AGENT_MODEL_TIMEOUT_MS/
FINAL_RESPONSE_AGENT_DEEPSEEK_API_KEY`；Task 0 不把它们接入 runtime。

### 验证

- Markdown Prettier；
- `git diff --check`；
- 仓库 Markdown 相对链接检查；
- 独立 contract/authority 与文档一致性复审；
- Provider/Docker/browser/credential 计数均为 0。

### 只解锁

Task 1 shared Zod contracts。不得进入 runtime、Live 或产品验收。

## Task 1：Shared communication contracts

### 目标文件

- `packages/agent/src/contracts/realtime-chat.ts`；
- `packages/agent/src/index.ts` 与 `packages/agent/package.json` export；
- `packages/agent/tests/realtime-chat-contract.test.ts`；
- 必要时为现有 `AgentState` 增加只读兼容字段，但不得一次重写所有历史 node。

### RED

先覆盖：

- strict unknown-key rejection；
- envelope status/payload/degraded/usageRef 不变量；
- authenticated/anonymous principal union；
- ownerId opaque format、deep-freeze 与 token/request binding helper；
- ownerId/token/raw error 不能进入 model payload 或 public summary；
- FinalResponse model projection 不含 documentId/chunkId/sourceRef/safetyCodes；
- model-visible sourceLabel 只能是 bounded non-sensitive ordinal alias；真实 title/display name 留在本地 renderer；
- Retriever/Bundle 数量、长度、ID、score、安全字段上限；
- stream sequence、terminal exactly-once、citation allowlist；
- safe modelRef allowlist，不含 endpoint/base URL/credential/provider raw metadata；
- hostile getter/proxy、NaN/unsafe integer、重复 reason/citation/message ID；
- deep freeze 与输入对象不变性。

### GREEN

只实现 schema、parser、projector-independent helper 和类型 export；不接 Web/Server，不创建 executor。

### 验收

- focused contract tests；
- Agent full/typecheck/lint；
- zero Provider/env/Docker/browser。

### 完成状态（2026-08-04）

- `packages/agent/src/contracts/realtime-chat.ts` 已实现 strict schema、hostile-input-safe parser、deep-freeze、
  authenticated receipt binding、local evidence/model projection 与 stream ledger validator；
- `@repo/agent` root 和 `@repo/agent/realtime-chat` subpath 均已导出；
- focused、Agent full、typecheck、lint、Prettier 与 SR5 approved-tag history parity 均通过；
- 全程 zero-provider，未读 `.env`/credential，未接 Web/Server runtime，未启动 Docker/API/browser；
- 只解锁 Task 2，不形成 Retriever/FinalResponse runtime、Mock/Live、产品或 main authority。

## Task 2：Canonical principal 与 Chat access

### 目标

- 把 `/auth/me` 的后端认证结果投影成 `AgentExecutionContextV1.principal`；
- 删除 `/api/chat` 的固定 `web-chat-user`；
- token 缺失时只允许 anonymous Mock 普通 Chat；
- token 存在但无效时 401；
- Live、Retriever、Verifier、owner Trace 在未认证时 Provider 前 zero-call。

### 关键边界

- request body 不新增 userId；
- model prompt/Trace/header 不含 ownerId；
- `/knowledge/search` 继续由 Nest JWT + `CurrentUser` 二次强制 owner；
- auth 与 context prepare 共用 parent abort，但 auth failure 必须先于 Agent runtime。

### 验收

- no-token Mock；
- valid-token Mock；
- invalid/expired/cross-owner token；
- auth receipt owner、request context 与发往 `/knowledge/search` 的同一 bearer token 不可替换/串用；
- 并发不同 owner 不串 state/budget；
- Web/Server focused + typecheck/lint；
- zero Provider。

### 完成状态（2026-08-04）

- 新增 server-only canonical access seam：无 token Mock 创建 anonymous context，无 token Live 为 401；任意非空
  Mock/Live token 都只调用一次 `/auth/me`，owner 唯一取 strict `AuthUser.id`；
- raw bearer 只存在 WeakMap capability，并与 Task 1 receipt 的 auth response、原始 Request、execution context
  引用绑定；clone/cross-owner/cross-request 读取 fail-closed；
- `/api/chat` 已删除 `web-chat-user`，Agent orchestration 只接收 immutable execution context；Conversation、RAG 与
  owner Trace 使用同一绑定 token，未认证路径在 runtime 前终止或保持 owner Agent zero-call；
- request body 拒绝 `userId/ownerId/principal`，并发反序、invalid/expired/malformed、pre/auth abort 与 no-leak
  回归通过；Web full `457/457`、非测试源码 typecheck `158/0`、受影响 lint、Server Auth `6/6` 通过；
- 全程 zero-provider，未读 `.env`/credential，未启动 Docker/API/browser；只解锁 Task 3，不形成 Retriever/
  FinalResponse runtime、产品或 main authority。

## Task 3：RetrieverAgent node 与 deterministic baseline

### 目标

- 在 `@repo/agent` 新增正式 Retriever node；
- 通过 composition port 复用现有 authenticated `/knowledge/search` / `KnowledgeSearchService`，`@repo/agent`
  不直接依赖 Nest，也不复制 SQL；
- 移除或替换 `packages/rag/src/retriever.ts` 的无用 throw stub；
- 输出 strict `RetrieverResultV1`，记录 hybrid/vector/keyword score 与固定 degradation；
- 建立 original-query deterministic baseline。

### 必测

- topK/minScore/document status 由本地 policy 固定；
- owner/cross-owner/injection/credential/abort 的 embedding/rewrite counter=0；
- duplicate chunk merge、稳定排序、score tie、empty hit、HTTP/schema failure；
- context budget 丢 RAG 时同步丢 bundle/citation；
- query、chunk 和 owner 正文不进入 Trace。

### 验收

- Agent/RAG/Server/Web focused；
- PostgreSQL owner isolation e2e；
- E2E 注入固定/fake embedding，Qwen attempt=0；
- baseline report reproducible；
- zero query-rewrite/FinalResponse Provider。

### 完成状态（2026-08-04）

- `packages/rag` throw stub 已替换为 WeakMap exact-scope opaque search port；clone/forge/cross-scope 在 executor
  前 fail-closed，ESM/CJS export parity 保持；
- `@repo/agent` 正式 Retriever node 固定 `topK=8/minScore=0.72/knowledge_document/DONE`，Task 3 只执行
  original query，rewrite 固定 gate-off；单次 search、deadline/abort、stable dedupe/rank/tie、blocked-body
  replacement 与 no-raw Trace 已落地；
- Web server-only adapter 用 Task 2 canonical bearer 调用 `/knowledge/search`，owner 不进入 body，端点只来自可信
  server env；可选 response `requestId` 必须与当前 request 精确一致；
- 16 guard + 16 runtime baseline 的 manifest/report SHA 为 `8a1788aa...654d / a1478f22...6442`，Recall@5/
  nDCG@5/Top1/no-hit/critical recall 为 `1/0.813219437888/0.571428571429/1/1`，Qwen/rewrite/
  FinalResponse/Provider calls=0；
- Agent `1215/1215`、RAG `19/19`、Web `462/462`、Web source typecheck `165/0`、Server service
  `7/7`、fake-embedding PostgreSQL E2E `12/12` 通过；仅形成 `deterministic_baseline_only`，只解锁 Task 4。

## Task 4：VerifiedEvidenceBundle 与结构化 citation

### 目标

- 新增本地 evidence projector；
- deterministic SafetyGuard + Verifier 共同收紧证据；
- blocked body 在 projector 前删除；
- citation 由稳定 allowlist 生成；
- 兼容 adapter 继续向现有 UI 输出 Markdown，但底层保存结构化 citation event。

### 必测

- trusted/suspicious/conflict/insufficient/skipped；
- prompt injection、credential、high-risk、unknown safety、cross-owner 全阻断；
- Verifier failure 不得把状态放宽；
- 4 entries / 700 chars / truncate；
- document/chunk reorder 不改变 citation identity；
- bundle 整层 dropped 时引用为 0；
- model 伪造 citation ID 被拒绝。

### 验收

- Agent/AI/Web/Types focused 与全量受影响回归；
- no raw evidence in Trace snapshot；
- zero Provider。

### 完成状态（2026-08-04）

- 新增本地 evidence projector，以 exact execution-context-bound Retriever result 为唯一检索输入；正式 bundle、
  citation projection、FinalResponse request/model projection 全部绑定同一 context，低层 constructor、clone、伪造、
  cross-owner/context 与缺失 context 均 fail-closed；
- deterministic owner/SafetyGuard 先删除 blocked/unknown/injection/credential/high-risk/control/cross-owner body，
  Verifier 五态与 unavailable 只允许维持或收紧；最多 4 条、每条 700 UTF-16、稳定排序/citation identity 和
  `资料 1..N` ordinal 已落地；
- `ragIncluded=false` 会同时清空 bundle、structured allowlist/citations 和 Markdown；模型伪造 citation 被 strict
  stream validator 拒绝，Trace 只有固定状态、reason 与计数；
- `@repo/agent/evidence-projector` 与 root export 已落地；最终 focused/full/static、独立 architecture/security
  复审及文档门通过；全程 zero-provider，未读 credential，未接产品 runtime 或执行 Docker/API/browser；
- authority 仅 `zero_provider_verified_evidence_projector`，该 checkpoint 当时只解锁 Task 5 query rewrite candidate。

## Task 5：Retriever query rewrite candidate

### 目标

- 新增 DeepSeek V4 Pro non-thinking strict JSON candidate；
- 新增 default-off `RETRIEVER_QUERY_REWRITE_MODEL_ENABLED`、
  `RETRIEVER_QUERY_REWRITE_MODEL_TIMEOUT_MS=4000` 和 Web-only
  `RETRIEVER_QUERY_REWRITE_DEEPSEEK_API_KEY`；
- eligibility 先于 credential/executor；
- output 只含 `rewrittenQuery`，local validator/merger 决定是否应用；
- 失败回 original query 或 no-RAG。

### 必测

- 明确 standalone query、无认证、unsafe、gate-off、invalid config、budget/abort zero-call；
- 中文/英文多轮指代、省略、active question；
- entity/constraint preservation；
- schema/Unicode/control character/credential/overlength；
- original query、每条 recent turn 与 active context 分段扫描，组合后不得绕过安全门；
- max one call、no retry、独立 budget 不污染 Router/Tutor/Verifier；
- Mock provenance 永远不能通过 Live gate。

### 验收

- reviewed Mock；
- Compose 仅向 `web` 投影 gate/timeout/独立 key；
- default false；
- zero real Provider。

### 完成状态（2026-08-04）

- 新增 DeepSeek V4 Pro non-thinking strict `{ rewrittenQuery }` candidate；只有 authenticated、`requiresRag=true`、
  存在多轮指代/省略或 active context、输入安全、deadline/abort/预算可用时才允许创建 runtime；
- original query、每条 recent turn、active question/goal 分段安全扫描；模型不能修改 owner、`topK=8`、
  `minScore=0.72`、source/status filter，实体、公式、数字与约束由本地 validator/merger 保留；
- 独立 default-off Web server-only config/runtime 与 Compose web-only allowlist 已落地；组件 key 不借用 generic 或
  sibling credential，单请求固定 `1/1200/160`、4000ms、`0.005 CNY` cap、no retry；
- reviewed Mock、focused/full/typecheck/lint/Compose/static 与三路只读复审通过；全程未读 `.env`/credential、未调用
  Qwen/DeepSeek/Provider，authority 仅 `zero_provider_retriever_query_rewrite_candidate`；
- reviewed Mock 固定 `qualityAuthority=none`，不是 query rewrite uplift 或真实模型质量证据；尚未接入 `/api/chat`，
  Task 6 FinalResponse、Task 7 composition、Task 8 48-case gate、Docker/API/browser/main 在该 checkpoint 当时均未
  完成；该 checkpoint 当时只解锁 Task 6。

## Task 6：FinalResponseAgent 与 stream contract

### 目标

- 在 `@repo/agent` 新增正式 FinalResponse node；
- 把现有 live Chat model 调用包装成 `FinalResponseStreamEventV1`；
- 新增 default-off `FINAL_RESPONSE_AGENT_MODEL_ENABLED`、`FINAL_RESPONSE_AGENT_MODEL_TIMEOUT_MS=20000` 与
  Web-only `FINAL_RESPONSE_AGENT_DEEPSEEK_API_KEY`；不得借用 generic/其它 Agent key；
- DeepSeek V4 Pro non-thinking streaming、20000ms、`1/2500/1200` 和 `0.015 CNY`；
- citation/tool status 由本地 adapter 追加；
- Task 0 不假定现有 AI SDK transport 已满足 exact endpoint/non-thinking/verified usage/terminal contract；先做专项
  adapter 测试；
- provider 首 token 前失败返回固定诚实不可用响应；首 token 后失败保留 partial text、明确 incomplete，且不发送
  citation/工具成功。

### 必测

- started/delta/citations/completed/failed 顺序；
- sequence 单调、terminal exactly-once、terminal 后无 delta；
- duplicate callback/timeout/abort/client-disconnect race 只产生一个 server terminal；不声称网络 exactly-once；
- no-RAG、trusted、conflict、insufficient；
- model prompt 只含 `citationId/sourceLabel/excerpt/trustLabel`，真实 document/chunk/source ref 不可见；
- false citation/false tool success=0；
- timeout/abort/network/schema/unknown usage/price；
- Mock/local renderer 与现有前端兼容；
- 用户消息保留，不创建后台重试。

### 验收

- Agent/AI/Web focused；
- stream cancellation test；
- cost profile test；
- zero real Provider。

### 完成状态（2026-08-04）

- `@repo/ai` 已新增 exact DeepSeek V4 Pro non-thinking streaming adapter：固定 endpoint、`stream=true`、
  verified usage、1200 output、no tools/reasoning/retry；
- `@repo/agent` 已新增正式 FinalResponse node：authenticated/exact-context/safety/config/deadline/abort/budget
  均先于 executor，固定 `20000ms / 1 call / 2500 input / 1200 output / 0.015 CNY`；
- 本地 citation allowlist、连续 sequence、唯一 terminal 与首 token 前后失败边界已落地。Citation/completed
  本地 ledger 先封存再 best-effort 投递；断连只标记 delivery failure，不改写 completed，也不声称网络
  exactly-once；
- Web server-only default-off config/runtime、组件专用 key、single-consume executor factory 与 Compose web-only
  allowlist 已完成；
- focused `30/30 + 6/6`、Agent `1244/1244`、AI `330/330`、Web `474/474`、Agent/AI typecheck/lint、Web
  受影响文件 lint 与 Compose safe-example config 通过；三路只读复审无 blocker；
- 全程未读 `.env`/credential、未调用 Provider、未接 `/api/chat`，也未执行产品 Docker/API/browser、48-case、
  controlled-Live 或 main；authority 仅 `zero_provider_final_response_stream_contract / qualityAuthority=none`，
  只解锁 Task 7。

## Task 7：实时 Chat composition 与 terminal Trace

### 目标

正式串联：

```text
canonical principal
  -> Router
  -> Tutor? / Retriever(query rewrite?)?
  -> Verifier?
  -> local evidence projector
  -> FinalResponse
  -> terminal Trace
```

### 关键修复

- Trace run 先 `running`，不得在 FinalResponse 前写 completed；
- terminal 后记录 TTFT/total/finish/verified usage/cost；
- 一个 modelCallId 只计费一次；
- request abort 贯穿全部节点；
- 同 conversation 并发 run 互相隔离；
- Trace unavailable 不阻断已交付回答，但关闭质量 authority；
- 同步 stream 不创建 BackgroundJob/Outbox；未来异步化必须两者一起设计。

### 验收

- route-level orchestration tests；
- abort before/after retrieval/first token；
- concurrency、budget isolation、listener/timer cleanup；
- Trace API/DB e2e；
- zero real Provider。

### 完成状态（2026-08-05）

- `/api/chat` 已串联 canonical auth、minimal RUNNING Trace、Router/Tutor、Retriever/query rewrite、Verifier、本地
  evidence projector、Trace prepare、FinalResponse stream 与 terminal finalize；anonymous Mock 在 Provider config/
  Agent runtime 前返回；
- realtime Trace `start/prepare/finalize` 已完成 minimal placeholder、digest 幂等、CAS terminal、prepare ACK 原子补写、
  全局唯一 `modelCallId`、legacy/late/conflicting 409 与 concurrent finalize 单胜者；
- AI SDK stream adapter 已完成 sequence/citation lockstep/terminal-last/唯一 terminal 校验；response cancel 与 parent
  abort 都会终止 request scope 并单次取消底层 reader；
- Retriever transport/schema failure 保持安全 no-RAG，`ragIncluded=false` 时 bundle/citation/Markdown 整层清零；
  principal binding invalid=403，abort=499；Trace steps 只保存固定节点/枚举/reason/count summary；
- focused Web composition/stream/abort/Trace/wiring `17/17`、Server AgentTracesService `17/17`、Types
  `42/42 + tsc`、Server build 与受影响 Web/Server lint 已通过；完整 Web `tsc` 仍有仓库既有 `.test.mts`
  类型债，Task 7 新增文件无诊断；
- 数据库 E2E 已更新覆盖 minimal start、prepare 幂等/冲突、legacy/late 409 与 concurrent finalize，但因本地 Redis
  `6379`、PostgreSQL `5433` 未运行而 `environment_blocked`；不声明真实数据库迁移/API authority；
- providerCalls=0、模型 gate default-off、同步流无 BackgroundJob/Outbox；未执行 Docker/API/browser、48-case、
  controlled-Live 或 main。Authority 为 `zero_provider_chat_composition_terminal_trace / qualityAuthority=none`，只
  解锁 Task 8。

## Task 8：48-case baseline、reviewed Mock 与 static checkpoint

### 交付

- fixed dataset/manifest/policy SHA；
- original-query baseline；
- strict report/scorer/gate；
- Mock responder 只读 prompt，不读 expected/oracle；
- source admission、price identity、single-run/no-retry、evidence validator；
- branch full static、Docker config quiet、default-off gate 检查。

### 必须满足

- `16/16` guard；
- `16/16` rewrite Mock strict；
- `16/16` FinalResponse Mock terminal；
- critical/permission/cross-owner/blocked evidence/false execution/citation failure=0；
- Mock authority 固定 `mock_quality_not_evidence`；
- 正式 Live marker/evidence 为 0。

### 完成状态（2026-08-05）

- 已冻结独立 `16 guard + 16 rewrite + 16 FinalResponse` manifest/policy 与 prompt-only Mock responder；
  manifest/policy/factory/report SHA 为 `3734b698...31d8 / e7f19f34...1464 / d9fa0ddc...c51 /
02294586...1be`；
- guard `16/16` 且 zero-call `16/16`；rewrite strict/usage/runtime `16/16/16`，original/candidate Recall@5
  `0.875/1`、nDCG@5 `0.56923614767/1`、critical/intent `1/1`；
- FinalResponse strict/terminal/usage `16/16/16`，grounded/citation precision/recall/critical notice `1/1/1/1`，
  false tool/citation 与 critical safety failure 为 0；
- strict report/scorer/canonical bytes validator、single-consume/no-retry capability 与 source admission/parity/
  artifact-zero contract 已完成；admission 核对 Git root/branch/HEAD/upstream/origin ref/clean tree，并从 exact commit
  blobs 独立重算 bundle SHA；`.gitignore` 仅排除本地 `.codex/` 状态，其他 untracked/tracked drift 仍拒绝；静态
  report 固定 `sourceAdmissionExecuted=false`；
- gate 为 `mock_quality_not_evidence / qualityAuthority=none`；synthetic DeepSeek estimate `0.027366 CNY`，P95/
  Qwen verified/aggregate verified cost 为 `null`；Provider/credential/Qwen 与正式 marker/journal/evidence/recovery=0；
- focused `8/8`、Agent full `1252/1252`、typecheck/lint、CLI/Prettier/diff/Compose static 与两路独立复审通过；
  未启动 Docker/API/browser、修改业务数据、创建 approved tag/正式 evidence 或合并 main；
- 完整证据见
  `../../acceptance/phase-6-9-8-task-8-retriever-final-response-reviewed-mock-static.md`。

### 历史停止点

Task 8 完成时没有 fresh 数据边界接受或 exact Phase 6.9.8 authorization，因此不得直接执行 controlled-Live。
后续审计确认 Task 9 还缺正式 Qwen transport 与 runner/durability；这些缺口必须先 zero-provider 完成，不能等到
一次性授权后临时编写。

## Task 9：paired eval 工程准备与唯一 controlled-Live

### Task 9A：Qwen transport / official price contract（已完成，zero-provider）

- 官方北京区 profile：`text-embedding-v4 / 1536 / 0.5 CNY per 1M input tokens`；OpenAI-compatible 响应
  `prompt_tokens == total_tokens`；
- endpoint 只允许北京业务空间或 legacy 北京域名，path/model/dimensions/profile 漂移均在 dispatch 前关闭；
- 独立 direct fetch 固定单次调用/no retry/AbortSignal，严格校验 response、index、1536 维有限非零向量、verified
  usage 与本地 CNY；
- 32 次单文本 embedding 的 Task 9 cap 冻结为 `262144 input tokens / 0.131072 CNY`；
- injected fetch fault matrix 与 public export 通过，Provider/credential/正式 evidence=0；
- authority 仅 `zero_provider_qwen_embedding_transport_price_contract / qualityAuthority=none`，只解锁 9B。

### Task 9B：paired runner / durability / admission（已完成，zero-provider）

- 新建独立 Task 9 report/schema/scorer/gate，不能修改 Task 8 frozen manifest/report；
- 先跑 16 guards，再按 case 串行执行 original/rewrite search pair，最后执行 16 FinalResponse；
- DeepSeek 与 Qwen 各自拥有 dispatch/response/usage/cost/timeout counters，任一不完整使 aggregate=`null`；
- source parity、approved tag、dedicated credential gate、exclusive marker、dispatch-before-call fsynced hash-chain
  journal、hard-link artifact、strict validator 与 crash-only seal；
- recovery 只补安全 terminal/not-started，不调用 Provider，禁止 retry/resume/replay/backfill；
- 使用 injected DeepSeek/Qwen transport 完成 fault/durability/static 验证；不创建正式 tag/marker/evidence。

完成回执：固定 64-call schedule、Qwen/DeepSeek 独立 accounting/null aggregation、双 opaque capability/source
drift recheck、breaker、exclusive marker、dispatch-before-call journal、hard-link artifact、strict validator、crash-only
seal 与 Task 9C production CLI 已落成。Reviewed Mock 为 guard `16/16`、双 Provider wire+usage 各
`32/32/32/32`、rewrite nDCG `0.56923614767 -> 1`、FinalResponse/safety 全门通过，但固定
`task9b_mock_quality_not_evidence / qualityAuthority=none`。Provider/credential/approved tag/正式 evidence 均为
0；证据见 `../../acceptance/phase-6-9-8-task-9b-runner-durability-admission.md`。

### Task 9C：唯一 controlled-Live paired eval

#### Admission

- branch/upstream/remote/source tag SHA 完全一致；
- working tree clean；
- exact DeepSeek/Qwen model/endpoint/price profile；
- dedicated credential 只存在于受限 runtime；
- all unrelated Agent gates=false；
- unique marker 不存在；
- fresh data-retention acceptance + exact authorization。

#### 正式运行

- 16 Retriever guard；
- 16 query-rewrite paired runtime；
- 16 FinalResponse runtime；
- max DeepSeek calls=32、run cap `0.32 CNY`；
- original/rewrite paired search 的 Qwen embedding 最多 32 次，attempt/usage/cost 独立记录；冻结 Qwen cap 为
  `262144 input tokens / 0.131072 CNY`；
- no retry/resume/replay/backfill；
- strict terminal/evidence publication。

#### Gate

完全复用设计文档 `12.3`。任一分母、usage、price、Trace terminal 或 critical safety 不完整时 aggregate
为 null，gate fail-closed；失败后先封存和复盘，不得盲目重跑。

#### 完成回执（失败封存）

- approved source/tag/HEAD/upstream/origin：`66a009ddb40b14d5117cfc0ec785a0d328708c5b`；
- runId：`28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2`；
- guard `16/16` zero-call；Provider `4 succeeded / 1 failed / 59 not_started_quality_breaker`；
- Qwen wire/usage `3/3/3/3`；DeepSeek `2/2/1/1`；
- 第二条 DeepSeek rewrite 在 dispatch 后以 `schema_invalid / wire 1/1/0/0` 失败；
- rewrite/FinalResponse strict `1/16 / 0/16`；semantic/P95/token/CNY aggregate 全 `null`；
- `task9_quality_gate_failed / qualityAuthority=none`；journal `134`、`evidence_published`、validator
  `ok=true`、recovery claim=`null`。

当前 evidence 只能定位到本地 strict rewrite schema/contract，不能声称具体 Provider payload、transport、账号或
服务端根因。Task 9C 不得重跑；Task 10 admission 未满足。

## Architecture Recovery R0--R4：独立 zero-provider 设计、TDD、robustness、durability 与 reviewed Mock

R0 已完成，authority 为
`zero_provider_retriever_final_response_architecture_recovery_design / qualityAuthority=none`：

- 新 lineage 同时覆盖 DeepSeek rewrite、Qwen retrieval 与 DeepSeek FinalResponse stream；
- 分离第一方 `providerWire` 与 runner lifecycle `runnerWire`；
- diagnostic 仅允许固定 stage/reason/provider-boundary/type-count bucket 与
  `rawDataRetained=false`；
- 禁止 raw、unknown key、Zod issue、credential、URL、raw error 与 raw-derived hash；
- 保持 16 guards、64 calls、阈值、预算、权限、no-retry、breaker 与 aggregate-null 语义；
- R0 未修改 TypeScript、读取 credential、调用 Provider、创建正式 evidence 或执行产品验收。

R1 随后已完成 strict diagnostic、module-owned opaque rewrite session 与第一方 V7 terminal wire snapshot 只读
投影；Provider observation 不接受 caller-supplied 状态，forged/reused/active capability 均 fail-closed。Focused
`11/11`、AI wire/export `25/25`、Agent full `1289/1289` 通过；external Provider/credential/formal evidence=0。

R2 又完成 Qwen/FinalResponse 两个独立第一方 wire family 与 recovery session，覆盖 transport/HTTP/envelope/
embedding/usage、stream/terminal/false-tool/abort 与 hostile capability/input；首个畸形 stream event 固定为
`response_observed + stream_event_invalid`。Focused compatibility `58/58`、AI full `345/345`、Agent full
`1301/1301` 通过。该 checkpoint 当时的包内 cost/ranking/citation/Trace/delivery/result mapper 尚未绑定
source-admitted runner/validator，因此只形成
`zero_provider_retriever_final_response_architecture_recovery_robustness / qualityAuthority=none`。

R3 随后完成固定 16-guard/64-call report/runner、`providerWire/runnerWire` 双层 accounting、source admission、
三个模块私有 observation authority、exclusive marker、reservation-before-dispatch、fsynced hash-chain journal、
hard-link artifact、strict validator、crash-only seal 与 zero-provider maintenance CLI。所有 durability artifact 只在
临时 synthetic root 创建；正式 approved tag/marker/journal/artifact/recovery claim 均为 0。Focused `39/39`、
Agent full `1318/1318`、AI full `345/345`、typecheck/lint 与 Task 9C validator/SHA parity 通过；该 R3 checkpoint authority 为
`zero_provider_retriever_final_response_architecture_recovery_runner_durability_admission / qualityAuthority=none`。

R4 随后把 Task 8 production node/ledger reviewed Mock 路径接入 R3 runner，固定 guards `16/16` zero-call、双 wire
`64/64/64/64`、diagnostic `64 applied`、rewrite/FinalResponse `16/16`。其 gate 固定为
`architecture_recovery_mock_quality_not_evidence / qualityAuthority=none`；Provider、credential 与 formal evidence
均为 0，synthetic cost 仅是本地预算回归值，verified provider cost 保持 `null`。完整验收见
[R4 reviewed Mock / static](../../acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r4-reviewed-mock-static.md)。

完整路线已转入独立
[Architecture Recovery 实施计划](./phase-6-9-8-retriever-final-response-architecture-recovery.md)。R4 已完成；其后
唯一 R5 run `34eb99be...fc68` 已失败封存且不得重跑，Task 10/11 与产品/main 继续阻断。

## Transport Evidence Recovery T0--T3-C（T3-B 失败封存，T3-C zero-provider guard 已完成）

T0/T1 冻结并实现独立 no-raw diagnostic contract 后，T2 完成 `30` zero-provider matrix、`15` classifier fixture
和 synthetic durability checkpoint。Focused `11/11`（39 assertions）、Agent `1348/1348`（23746 expect()，168 files）、
typecheck/lint/Prettier/`git diff --check` 全部通过；Provider、credential、global fetch、正式 evidence 和业务写入均为 0。

T2 还验证了 strict journal state machine、partial/terminal prefix recovery、幂等 report snapshot、existing-artifact
publication recovery、multiple-marker rejection、hard-link artifact 与 Windows/Bun fsync compatibility。Synthetic
temp-root 文件只用于测试并已清理。完整证据见
[T2 验收](../../acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t2-zero-provider-robustness-durability.md)。

T3-A 又完成 source admission（branch/HEAD/upstream/origin/approved ref parity、clean tree、formal artifact=0、source
bundle SHA）、T2 gate binding、admission/reservation 双 module-owned single-consume capability、fresh proxy nonce 与
exact data-boundary/authorization reader。Zero-provider runner 固定 `rewrite -> qwen -> final_response` 三槽位、最多
3 slots、总预算 `0.024096 CNY`、首错 breaker 与固定未启动 suffix；CLI gate 顺序为
`argv -> source -> T2 -> proxy -> boundary -> authorization -> runner`。T3-A focused `12/12`（49 assertions）、
Agent `1360/1360`（23805 expect()，169 files）、typecheck/lint/Prettier/`git diff --check` 通过，Provider、credential、
global fetch、formal evidence、业务/Trace 写入均为 0。完整证据见
[T3-A 验收](../../acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t3-zero-provider-admission.md)。

T3-A 不形成 Provider/semantic/product authority。随后在 fresh data-boundary acceptance 与 exact authorization 下，
唯一 T3-B controlled canary run `075e2d5f-682b-426d-847e-f5a6ce5b97c6` 在 late-bound credential gate 以
`configuration_invalid` 失败并 durable seal：planned/started/completed=`3/0/0`、三个 slot 均为
`not_started_quality_breaker`、`providerCalls=0`、`credentialReads=0`、journal `7`、validator `ok=true`。该结果只能
证明配置门在 Provider 调用前 fail-closed，不能归因 DNS/TLS/proxy/账号/余额/权限/服务端，也不形成 Provider health、
semantic、product 或 main authority；完整记录见
[T3-B controlled failure](../../acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t3-controlled-canary-failure.md)。

T3-C 随后完成 zero-provider configuration composition guard：静态锁定 controlled package 对仓库根 `.env` 的显式
加载路径，并确认 crash-only seal CLI 不携带 credential/fetch/Provider port。Focused `2/2`（10 assertions）、
typecheck/lint/`git diff --check` 通过；authority 固定为
`zero_provider_transport_evidence_t3_configuration_guard / qualityAuthority=none`。该 guard 不读取真实 `.env`、
不启动 controlled CLI、不创建正式 evidence；完整记录见
[T3-C configuration guard](../../acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t3-configuration-zero-provider.md)。

## Task 10：分支产品 Docker/API/可见浏览器验收

仅当 Task 9 形成可接产品的 quality authority 时执行：

- 新镜像 server/web；
- canonical auth、owner isolation、query rewrite eligible/ineligible；
- trusted/conflict/insufficient/no-hit；
- FinalResponse live + forced failure + abort；
- structured citation 和 `/agent-trace`；
- 390/510/1440px 可见页面；
- precise synthetic User/Document/Chunk/Trace/Chat/browser cleanup；
- mode/gates 恢复 default-off；
- 禁止 `down -v`、prune、database reset、Redis `FLUSH*`、MinIO wipe。

浏览器窗口保留给用户查看，除非用户明确要求关闭。

## Task 11：文档、main 与远程收口

- 独立 authority/security/docs 复审；
- 分支提交与推送；
- 切回最新 `main`，`--no-ff` 合并；
- main 关键 static + default-off Docker/API/browser/Trace 回放；
- 精确清理；
- 推送 main；
- 复核 `HEAD == upstream == origin/main == remote main`；
- 记录 Phase 6.9.8 是否完成及 Phase 6.9.9 的唯一下一任务。

## 当前停止边界

Task 0--8 与 Task 9A/9B 已完成；唯一 Task 9C 已失败封存，Architecture Recovery R0--R4 设计、rewrite TDD、
Qwen/FinalResponse robustness、runner/durability/admission 与 reviewed Mock/static 已完成；唯一 R5 又以
`architecture_recovery_quality_gate_failed / qualityAuthority=none` 封存。当前已有 shared contracts、canonical Chat principal/access、正式 Retriever/query rewrite、
exact-context evidence projector、正式 FinalResponse stream、`/api/chat` composition/terminal Trace，以及独立
48-case reviewed Mock/static checkpoint、严格 Qwen price/endpoint/usage transport，以及独立 64-call runner、双
Provider accounting、source admission 与 durability/validator/CLI。Transport Evidence Recovery T0/T1/T2/T3-A 已完成
30-case/15-classifier zero-provider、synthetic durability 与 admission/runner contract；T3-B controlled canary 已失败
封存，T3-C configuration guard 已完成。当前仍没有：

- Task 9C 已执行，但没有形成 controlled-Live 质量 authority；
- 真实 DeepSeek rewrite/FinalResponse 与真实 Qwen paired retrieval 的完整分母、verified usage/CNY 与 P95；
- Task 10 Docker/API/可见浏览器/Trace/权限/精确清理 authority；
- Task 11 main/default-off 回放与远程 main parity authority。
- R4 只形成 `architecture_recovery_mock_quality_not_evidence / qualityAuthority=none`；R5 只形成 bounded failure/durability
  evidence；Transport T2/T3-A/T3-C 只形成 `qualityAuthority=none` 的 zero-provider authority，T3-B 只形成
  `controlled_live_transport_evidence_t3 / qualityAuthority=none` 的配置失败证据，三者都不形成产品或 main authority。

不得把 Task 3 fake-search baseline、Task 5/8 reviewed Mock、Task 9A injected transport、Task 9B synthetic runner、旧 Chat Live、Qwen
hybrid search 或 graph descriptor 写成 Phase 6.9.8 controlled-Live、产品或 main 能力已完成。Task 9C source/tag、
marker、journal 与 artifact 必须保持不可变；当前禁止 Task 10/11、产品/main，以及任何 Task 9C/R5/T3-B retry、
resume、replay、backfill、seal、recovery 或 Provider 追加调用。T3-C 仅是 zero-provider 配置回归 guard，不构成重新
授权或重跑 T3-B 的理由。下一步必须先形成新的独立架构决策；不得把重跑 R5/T3-B 当作推进。
