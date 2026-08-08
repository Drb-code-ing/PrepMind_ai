# Phase 6.9.8 Task 3 RetrieverAgent Node / Deterministic Baseline 验收

日期：2026-08-04

分支：`drb/phase-6-9-8-retriever-final-response-contract`

起始提交：`9cc15eddad926d0aa45609a354018162a7e6cba9`

状态：Task 3 正式 Retriever node、authenticated hybrid-search composition port 与 original-query deterministic
baseline 完成；尚未实现 query rewrite、VerifiedEvidenceBundle projector、FinalResponse runtime、structured
citation/terminal Trace、Mock/Live 质量门或产品接线

Authority：`zero_provider_retriever_original_query_deterministic_baseline`

Quality authority：`deterministic_baseline_only`

## 1. 结论

Task 3 已把原先抛出 `Not implemented` 的 `packages/rag` Retriever stub 替换为 request-scope opaque
composition port，并在 `@repo/agent` 建立正式 `RetrieverAgent` node。Node 固定执行
`topK=8 / minScore=0.72 / source=knowledge_document / status=DONE`，Task 3 只使用 original query；query rewrite
固定 `gate_off / attempted=false`，不构造模型 runtime。

Web server-only adapter 复用既有 authenticated `POST /knowledge/search`。owner 不进入 request body，而是继续由
Nest `JwtAuthGuard + CurrentUser` 从 canonical bearer 解析；bearer 在每次执行时从 Task 2 的 access/request/context
三引用绑定临时读取，不保存在公开 port 或长期 executor capability 中。端点只来自可信 server env 配置，响应
envelope 若携带 `requestId` 则必须与当前请求精确一致。

32-case deterministic baseline 完整通过：16 个 guard 都在 search 前 zero-call，16 个 runtime 使用固定 fake
search port；Qwen embedding、DeepSeek query rewrite、FinalResponse 与其它 Provider 调用均为 0。该结果是
original-query 可复现基线，不是 query rewrite uplift、真实检索质量、产品可用性或 SLA 结论。

## 2. 交付文件

| 文件                                                               | 作用                                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `packages/rag/src/retriever.ts`                                    | WeakMap opaque port、exact scope binding 与固定 failure contract   |
| `packages/rag/tests/retriever.test.ts`                             | clone/forge/cross-scope/throw 与 ESM/CJS export 回归               |
| `packages/agent/src/nodes/retriever.ts`                            | 正式 Retriever node、guard、deadline、排序/去重、安全降级与 Trace  |
| `packages/agent/tests/retriever-node.test.ts`                      | policy、single-search、safety、tie、abort/deadline 与 no-leak 回归 |
| `apps/web/src/lib/retriever-search-port.ts`                        | canonical bearer 到 `/knowledge/search` 的 server-only adapter     |
| `apps/web/src/lib/retriever-search-port.test.mts`                  | owner/token 隔离、policy drift、hostile envelope 与并发回归        |
| `packages/agent/src/evals/phase-6-9-8-retriever-baseline.ts`       | 16 guard + 16 runtime manifest、scorer 与 canonical report         |
| `packages/agent/scripts/run-phase-6-9-8-retriever-baseline.ts`     | zero-provider baseline CLI                                         |
| `packages/agent/tests/phase-6-9-8-retriever-baseline.test.ts`      | frozen SHA、指标、脱敏与可复现性回归                               |
| `packages/agent/src/contracts/realtime-chat.ts` 及 package exports | capability 校验、Retriever reason code 与 root/subpath export      |

## 3. Runtime 与权限边界

### 3.1 Opaque composition port

- `RetrieverSearchPortV1` 的 public value 只有 schema version；真实 executor 与 execution scope 只存在 WeakMap。
- port 只能由创建它的同一个 `AgentExecutionContextV1` 引用调用；spread clone、伪造 port、clone scope 和跨 owner
  scope 均在 executor 前 fail-closed。
- `AbortSignal` 继续作为不可枚举进程内字段传播，不进入 JSON DTO 或 Trace。
- `@repo/rag` 同时维持 ESM/CJS export；`@repo/agent` 只依赖 composition contract，不依赖 Nest、Prisma 或 SQL。

### 3.2 Web adapter 与后端 authority

```text
authenticated AgentExecutionContextV1
  -> exact access/request/context reference binding
  -> read canonical bearer for this execution only
  -> POST trusted-base-url/knowledge/search
       body = { query, topK: 8, minScore: 0.72 }
       no ownerId / token / filter override in body
  -> Nest JwtAuthGuard + CurrentUser resolves owner
  -> Qwen embedding + PostgreSQL vector/keyword hybrid search
       Chunk.userId + Document.userId + Document.status=DONE
  -> strict response envelope + optional exact requestId correlation
  -> RetrieverAgent normalization
```

真实后端仍拥有 owner、`DONE` 文档过滤和数据库查询 authority。Task 3 没有复制 SQL，也没有允许客户端、模型或
Retriever node 传入另一个 owner。任意匿名 principal、binding drift、非法 policy、401/403、HTTP、transport、
schema 或 requestId mismatch 都使用固定失败结果，不保留 raw response/error。

### 3.3 Node policy、排序与降级

- 本地固定 `topK=8`、`minScore=0.72`、`knowledge_document`、`DONE`；request policy 漂移在 search 前拒绝。
- `requiresRag=false`、anonymous、unsafe/credential input、pre-abort、expired deadline 均在 search 前终止。
- eligible path 最多调用 search port 一次；真实 deadline 由 parent abort 与分段 timer 控制，`120000ms` 只用于
  Trace latency 展示上限，不替代 deadline。
- 同一 document/chunk 重复项只在正文一致时合并，并取更严格 safety 和最高 score；同一 chunk 跨 document 或
  重复正文冲突固定 `schema_invalid`。
- 稳定排序依次比较 total score、keyword score、vector score、documentId、chunkId；score tie 不依赖输入顺序。
- blocked chunk 正文被替换为固定安全占位符；Trace 只记录 original/executed query SHA、policy、hit count、
  latency 和固定 reason，不保存 query、chunk body、owner 或 token。

## 4. Deterministic Baseline

### 4.1 固定身份

| 项目          | 值                                                                 |
| ------------- | ------------------------------------------------------------------ |
| Dataset       | `phase-6.9.8-retriever-final-response-v1`                          |
| Cases         | `16 guards + 16 original-query runtime`                            |
| Manifest SHA  | `8a1788aa8973507555931ce358c08dcd739dd166636376f6ddcc2eff3a33654d` |
| Report SHA    | `a1478f22a4a2fad154496c4ffbfd761532c102fe3ae9453d1916a10ba2c26442` |
| Search        | `fixed_fake_composition_port`                                      |
| Embedding     | `not_invoked`                                                      |
| Query rewrite | `not_invoked`                                                      |
| FinalResponse | `not_invoked`                                                      |

完整 manifest 内容进入 canonical SHA；公开 report 只保存 case identity、opaque candidate ref、指标和固定计数，
不保存 query/context/chunk 正文、owner 或 token。

### 4.2 结果

| 指标                      | 结果             |
| ------------------------- | ---------------- |
| Guards                    | `16/16`          |
| Guard fake-search calls   | `0`              |
| Runtime                   | `16/16`          |
| Runtime fake-search calls | `16`             |
| Relevance metric cases    | `14`             |
| Expected no-hit cases     | `2`              |
| Recall@5                  | `1`              |
| nDCG@5                    | `0.813219437888` |
| Top1 accuracy             | `0.571428571429` |
| Expected no-hit accuracy  | `1`              |
| Critical target recall    | `1`              |
| Qwen embedding calls      | `0`              |
| Query rewrite model calls | `0`              |
| FinalResponse model calls | `0`              |
| Total Provider calls      | `0`              |

`nDCG@5=0.813219437888` 和 Top1 `0.571428571429` 是未修饰 original-query baseline，不应被润色成正式质量门已通过。
Task 5 的 rewrite candidate 必须在同一冻结 dataset 上独立证明 uplift；后续 Task 9 拆分后，只有 9C 才可能在
fresh admission 下形成正式 Provider/质量 authority，9A/9B 的 zero-provider 工程不能替代它。

## 5. PostgreSQL Owner-Isolation E2E

仅启动/复用 PostgreSQL、Redis 与 MinIO 基础设施，没有启动产品 Web/Server Docker 服务，也没有清理 volume。
Prisma `17` 个 migration 均已应用且无 pending migration。`knowledge-documents.e2e-spec.ts` 使用固定 fake 1536 维
embedding，通过 `12/12`：覆盖未认证 401、A/B owner 隔离、只检索当前 owner 的 `DONE` 文档、prompt-injection
safety metadata、empty/minScore 与清理。

该 E2E 证明现有后端 owner/search boundary 在测试基础设施中成立；它不是产品 Docker/API/浏览器、真实 Qwen、
生产数据库或生产部署 authority。

## 6. 验证

| 验证                                    | 结果                                    |
| --------------------------------------- | --------------------------------------- |
| Retriever baseline CLI                  | `complete=true`；SHA/指标与冻结值一致   |
| Agent baseline/node + RAG port focused  | `15/15`                                 |
| Agent full                              | `1215/1215`                             |
| RAG full                                | `19/19`                                 |
| Agent/RAG typecheck                     | 通过                                    |
| Web adapter focused                     | `5/5`                                   |
| Web full                                | `462/462`                               |
| Web 非测试源码 TypeScript program       | `165 source files / 0 diagnostics`      |
| Server knowledge search service focused | `7/7`                                   |
| PostgreSQL knowledge documents E2E      | `12/12`，fixed fake 1536 embedding      |
| Prisma migration status                 | `17 migrations / no pending migrations` |
| 受影响 TS/JSON/Markdown Prettier        | 通过                                    |
| `git diff --check`                      | 通过                                    |
| 仓库 Markdown 相对链接                  | `158 links / missing=0`                 |
| 独立 security review（最终）            | 无 blocker/high/medium                  |
| 独立 baseline/test review（最终）       | 无 blocker/high/medium                  |

Web 测试必须使用仓库脚本的 Node `--experimental-transform-types` runner；直接用 Bun 执行该 `.mts` 会被
`server-only` package 的运行器边界阻断，这不是 adapter 逻辑失败。完整 Web `tsc -p apps/web/tsconfig.json` 仍会命中
既有测试文件类型债；本任务只能声明同一 compiler options 下 165 个非测试源码 `0 diagnostics`，不能写成 Web
全仓测试源码 typecheck 清零。

本任务未读取 `.env`/credential，未调用 Qwen/DeepSeek，未创建 controlled-Live marker/journal/artifact；E2E 合成
数据已清理且未修改产品业务数据，也未执行产品 Docker/API/可见浏览器验收。`.codex/` 保持未跟踪且不进入提交。

## 7. 没有形成的 Authority

Task 3 不证明：

- query rewrite candidate、rewrite uplift 或 DeepSeek/Qwen 真实 Provider health/usage/cost；
- KnowledgeVerifier 到 `VerifiedEvidenceBundle` 的本地 projector 已完成；
- FinalResponseAgent、structured citation、tool status、terminal stream/Trace 或 verified usage 已接入；
- 现有 legacy Chat RAG 已切换到本 Task Retriever node；
- 48-case baseline/Mock/controlled-Live、P95、token/CNY、SLA 或生产质量门通过；
- 产品 Docker/API/可见浏览器、main、Phase 6.9.8/6.9.9/6.9.10/6.10/8/9 或两篇博客完成。

## 8. 唯一下一原子任务

Task 3 只解锁 Task 4 `VerifiedEvidenceBundle` 与结构化 citation：由 deterministic SafetyGuard 与
KnowledgeVerifier 共同收紧证据，blocked body 必须在 projector 前删除，citation identity/allowlist 继续由本地
authority 生成。Task 4 仍为 zero-provider，不得提前实现 query rewrite、FinalResponse runtime、Live 或产品验收。

完整设计与计划见：

- [Phase 6.9.8 RetrieverAgent / FinalResponseAgent 正式化设计](../superpowers/specs/phase-6-9-8-retriever-final-response-agents-design.md)
- [Phase 6.9.8 RetrieverAgent / FinalResponseAgent 实施计划](../superpowers/plans/phase-6-9-8-retriever-final-response-agents.md)

回顾时可以问：

- “为什么现有 `/knowledge/search` 已可用，仍要增加 opaque Retriever composition port？”
- “为什么 owner 不进入 search body，port 又必须绑定 exact execution context？”
- “为什么 blocked chunk 仍可保留 metadata，但正文必须先替换为固定占位符？”
- “为什么 original-query Recall@5=1 仍不能说明 query rewrite 或产品质量门通过？”
- “为什么 PostgreSQL E2E 通过不能写成产品 Docker/真实 Qwen 验收？”
- “为什么 Task 3 完成后先做 evidence projector，而不是直接让 FinalResponse 模型消费 raw hits？”
