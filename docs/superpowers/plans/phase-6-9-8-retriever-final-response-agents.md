# Phase 6.9.8 RetrieverAgent / FinalResponseAgent 实施计划

> 设计来源：
> [Phase 6.9.8 RetrieverAgent / FinalResponseAgent 正式化设计](../specs/phase-6-9-8-retriever-final-response-agents-design.md)
> 当前状态：Task 3 RetrieverAgent node / original-query deterministic baseline 完成；下一任务 Task 4 VerifiedEvidenceBundle/evidence projector
> 当前分支：`drb/phase-6-9-8-retriever-final-response-contract`

## 执行原则

- 每个 Task 只处理一个可独立验证的关注点，并形成一个提交。
- 当前分支始终来自已推送的最新 `main`；不创建 worktree，不从功能分支再开分支。
- Task 0--8 全部 zero-provider；禁止读取或输出 `.env`、credential，禁止调用 Qwen/DeepSeek。
- Task 9 必须在静态/Mock checkpoint、source parity、fresh 数据边界接受和精确一次性授权后单独执行。
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

### 停止点

Task 8 完成后必须停下。只有 fresh 数据边界接受和 exact Phase 6.9.8 authorization 才能执行 Task 9。

## Task 9：唯一 controlled-Live paired eval

### Admission

- branch/upstream/remote/source tag SHA 完全一致；
- working tree clean；
- exact DeepSeek/Qwen model/endpoint/price profile；
- dedicated credential 只存在于受限 runtime；
- all unrelated Agent gates=false；
- unique marker 不存在；
- fresh data-retention acceptance + exact authorization。

### 正式运行

- 16 Retriever guard；
- 16 query-rewrite paired runtime；
- 16 FinalResponse runtime；
- max DeepSeek calls=32、run cap `0.32 CNY`；
- original/rewrite paired search 的 Qwen embedding 最多 32 次，attempt/usage/cost 独立记录；Qwen price profile 与
  cap 未冻结时禁止 admission；
- no retry/resume/replay/backfill；
- strict terminal/evidence publication。

### Gate

完全复用设计文档 `12.3`。任一分母、usage、price、Trace terminal 或 critical safety 不完整时 aggregate
为 null，gate fail-closed；失败后先封存和复盘，不得盲目重跑。

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

Task 3 完成后只允许开始 Task 4。当前已有 shared contracts、Chat canonical principal/access、正式 Retriever
node、opaque hybrid-search port 与 original-query deterministic baseline，但仍没有：

- 正式 FinalResponse node；
- query rewrite candidate；
- VerifiedEvidenceBundle projector；
- terminal FinalResponse Trace；
- 48-case baseline/Mock/Live authority；
- Docker/API/browser/main authority。

不得把 Task 3 的 fake-search baseline、PostgreSQL fake-embedding E2E、旧 Chat live、Qwen hybrid search、Markdown
citation 或 graph descriptor 写成上述能力已完成。
