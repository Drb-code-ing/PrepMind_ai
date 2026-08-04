# Phase 6.9.8 Task 2 Canonical Principal / Chat Access 验收

日期：2026-08-04

分支：`drb/phase-6-9-8-retriever-final-response-contract`

起始提交：`50f04b82a3cb1f2ce6c24ac75ce9378885f22463`

状态：Task 2 canonical principal / Chat access 完成；尚未实现正式 Retriever/FinalResponse node、query rewrite、
evidence projector、structured citation/terminal Trace、Mock/Live 质量门或产品验收

Authority：`zero_provider_retriever_final_response_chat_access`

## 1. 结论

Task 2 已把 NestJS `/auth/me` 的认证结果投影为 `/api/chat` 唯一的
`AgentExecutionContextV1.principal`。固定 `web-chat-user` 已删除；authenticated owner 只取经
`authUserSchema` 校验的 `AuthUser.id`，客户端 request body、Bearer token 文本、query、model output 和环境变量都
不能提供或覆盖 owner。

本任务同时把 raw bearer 收敛为 server-only、WeakMap-backed capability，并把 access、原始 `Request`、
`AgentExecutionContextV1` 与 Task 1 receipt 的 auth response/request/bearer reference 绑定。RAG、Conversation
prepare 与 owner Trace 只能读取这一份绑定 token；引用被 clone、替换或跨请求串用时 fail-closed。

## 2. 交付文件

| 文件                                                              | 作用                                                                        |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `apps/web/src/lib/chat-agent-access.ts`                           | canonical auth projection、opaque bearer capability、引用绑定与固定失败终态 |
| `apps/web/src/lib/chat-agent-access.test.mts`                     | token/owner/binding/concurrency/abort/no-leak 回归                          |
| `apps/web/src/app/api/chat/route.ts`                              | auth-first Chat composition 与 canonical token/context 接线                 |
| `apps/web/src/lib/chat-api-policy.ts`                             | 身份注入拒绝、token 有界解析与 authenticated-only RAG policy                |
| `apps/web/src/lib/chat-context-orchestration.ts`                  | 已授权 token 的独立 context prepare seam                                    |
| `apps/web/src/lib/chat-model-agent-orchestration.ts`              | 只接收 immutable execution context，不再接收可替换 userId/runId/signal      |
| `apps/web/src/app/api/chat/route.tutor-model-wiring.test.mts`     | route 顺序、canonical bearer、runtime 延迟构造与取消传播静态接线回归        |
| `apps/web/src/lib/chat-api-policy.test.mts` 等受影响 Web 测试文件 | request boundary、context、Router/Verifier/Tutor 兼容回归                   |

## 3. Canonical access 与权限边界

### 3.1 Token/owner 状态机

| 输入                                  | 结果                                           | `/auth/me` | Agent/Provider 边界    |
| ------------------------------------- | ---------------------------------------------- | ---------- | ---------------------- |
| Mock，无 token                        | anonymous immutable context                    | `0`        | 普通本地 Mock 可继续   |
| Live，无 token                        | 固定 `401 / login_required`                    | `0`        | runtime 前终止         |
| Mock 或 Live，任意非空 token          | 必须恰好一次 `/auth/me`                        | `1`        | 成功后才能继续         |
| invalid/expired/malformed auth result | 固定 `401 / invalid_session`                   | `1`        | runtime 前终止         |
| pre-auth / auth-time abort            | 固定 `499 / request_aborted`，不保留 raw error | `0..1`     | 无 Agent/Provider 调用 |
| binding clone/cross-request           | 固定 `500 / principal_binding_invalid`         | 已完成     | 不降级为 anonymous     |

带 token 的 Mock 不再绕过认证；token 的命名、文本或潜在 claim 与后端 user 不一致时，owner 仍只取
`AuthUser.id`。`authUserSchema` 异常、hostile getter 或 owner 不符合 Task 1 contract 都 fail-closed，不记录 raw
认证错误。

### 3.2 Opaque bearer 与同一引用

- raw token 只存在 `WeakMap<BearerTokenCapability, string>`；public access/context JSON 不包含 token。
- authenticated receipt 和 execution context 使用同一个 parsed auth response、原始 `Request` 与 bearer capability
  对象引用。
- `readCanonicalChatBearerToken()` 同时验证 access、request、executionContext 三个引用；spread clone、context
  clone、跨 owner request/context 或 forged access 都不能读取 token。
- 每个请求独立创建 runId、requestId、principal、signal 和 capability；两 owner 即使认证反序完成也不会串
  principal/token。

### 3.3 Route 顺序与 downstream 使用

```text
parse bounded request
  -> resolve provider mode/config metadata（不创建 runtime）
  -> canonical /auth/me projection
  -> bound bearer read
  -> provider configured gate
  -> Conversation context prepare（同一 parent AbortSignal）
  -> create Router/Verifier/Tutor runtime bundle
  -> orchestration / authenticated-only RAG / owner Trace
  -> Mock 或现有 Live response
```

- `orchestrateChatModelAgents()` 只接收 `AgentExecutionContextV1`。authenticated 兼容 state ID 取
  `principal.ownerId`；anonymous 使用 request-scoped `anonymous_${requestId}`，不再共享全局占位 identity。
- `/knowledge/search` 只有 canonical principal 为 authenticated 时才 eligible，并继续让 Nest
  `JwtAuthGuard + CurrentUser` 从同一 bearer 解析 owner；Chat body 不新增 `userId`。
- request body 显式拒绝 `userId/ownerId/principal`，accessToken 限制为最多 8192 个可见 ASCII 字符；空白 token
  只视为 missing。
- ownerId/raw token 不进入 model prompt、public response header 或 Agent Trace payload。Trace API 仍只把 bearer
  作为后端认证 capability；Trace 的 stream-terminal 重构和 parent-abort 完整闭环属于 Task 7。

## 4. 并发、取消与 zero-call

- pre-aborted request 不触发认证；认证期间 abort 固定收口为 499，raw transport/auth error 不传播。
- auth 与 Conversation prepare 均传播原始 request signal；Router、Verifier、Tutor 与最终现有 Live stream 使用
  execution context 上的同一 signal。
- invalid token、无 token Live、principal binding failure 都发生在 `createChatModelAgentRuntimeBundle()` 前。
- anonymous Mock 不触发 owner RAG、Verifier 或 Trace；它只保留无 owner 数据的普通本地 Mock Chat。
- 没有全局 mutable current principal/current bearer；WeakMap 绑定只随对象可达性存在。

## 5. 验证

| 验证                            | 结果                                 |
| ------------------------------- | ------------------------------------ |
| Task 2 focused Web              | `53/53`                              |
| Web full                        | `457/457`                            |
| Web 非测试源码 typecheck        | `158 source files / 0 diagnostics`   |
| 受影响 Web lint                 | 通过                                 |
| Server Auth focused             | `6/6`                                |
| 受影响 TS/Markdown Prettier     | 通过                                 |
| `git diff --check`              | 通过                                 |
| 仓库 Markdown 相对链接          | `missing=0`                          |
| identity/security 独立只读复审  | 无 blocking findings                 |
| tests/concurrency 独立只读复审  | 主矩阵覆盖；产品 POST 运行证据未形成 |
| docs/current-state 独立只读复审 | 无状态冲突                           |

Web 仓库级 `tsc -p apps/web/tsconfig.json` 会继续检查历史 `.test.mts`，当前仍包含与本任务无关的既有测试类型债；
本任务使用同一 compiler options 对全部 158 个非测试 Web 源文件建立 TypeScript program，结果为 0 diagnostics，
并由 457 条运行测试补充测试文件验证。该区分不能写成全仓库测试源码 typecheck 已清零。

本任务全程没有读取 `.env`/credential，没有调用 Qwen/DeepSeek Provider，没有启动 Docker/API/browser，没有
创建 marker/journal/artifact，也没有修改数据库、Redis、MinIO 或业务数据。`.codex/` 保持未跟踪且不进入提交。

## 6. 没有形成的 Authority

Task 2 不证明：

- RetrieverAgent node、hybrid-search adapter、query rewrite candidate 或 deterministic baseline 已实现；
- VerifiedEvidenceBundle projector、FinalResponseAgent、structured stream citation 或 terminal Trace 已接入；
- current Chat Live 等于 Phase 6.9.8 FinalResponse controlled-Live；
- Qwen/DeepSeek Provider health、真实模型语义、Recall/nDCG、grounded/citation、P95、token/CNY 或 SLA；
- Docker/API/可见浏览器、产品权限、业务写入、main 或生产可用；
- Phase 6.9.8、6.9.9、6.9.10、6.10、8、9 或两篇博客已经完成。

本 Task 的 route 证据由纯 access/context 行为测试、受影响 Web full regression 与 route source-wiring 回归组成；
没有执行产品 `POST /api/chat`、Docker 或浏览器，因此不能把静态接线写成产品运行 authority。

## 7. 唯一下一原子任务

Task 2 只解锁 Task 3 RetrieverAgent node 与 deterministic baseline：通过 composition port 复用现有
authenticated `/knowledge/search` / `KnowledgeSearchService`，建立 strict `RetrieverResultV1` 和 original-query
baseline。Task 3 仍为 zero-provider，embedding/search 测试必须使用 fixed/fake embedding port，不调用 Qwen，
也不提前实现 query rewrite 或 FinalResponse runtime。

完整设计与计划见：

- [Phase 6.9.8 RetrieverAgent / FinalResponseAgent 正式化设计](../superpowers/specs/phase-6-9-8-retriever-final-response-agents-design.md)
- [Phase 6.9.8 RetrieverAgent / FinalResponseAgent 实施计划](../superpowers/plans/phase-6-9-8-retriever-final-response-agents.md)

回顾时可以问：

- “为什么带 token 的 Mock 也必须经过 `/auth/me`？”
- “为什么 owner 只能来自 `AuthUser.id`，不能从 JWT 文本或 Chat body 推断？”
- “WeakMap bearer capability 和三引用绑定分别防什么？”
- “为什么 anonymous Mock 可以继续，而 Live/RAG/Verifier/owner Trace 必须 zero-call？”
- “为什么 Task 2 删除了 `web-chat-user`，仍不能说 Retriever/FinalResponse Agent 已完成？”
- “为什么 Task 2 不做 Docker/API/浏览器验收，Task 11 又必须做 main default-off 回放？”
