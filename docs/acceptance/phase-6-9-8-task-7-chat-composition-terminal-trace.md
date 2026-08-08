# Phase 6.9.8 Task 7 — Chat composition / terminal Trace 验收

> 日期：2026-08-05
> 分支：`drb/phase-6-9-8-retriever-final-response-contract`
> 基线：`415c31e2f09acbff2099547121cfd3b6ffbac34d`
> Authority：`zero_provider_chat_composition_terminal_trace`
> Quality Authority：`none`
> Provider calls：`0`

## 1. 验收结论

Task 7 已在源码 composition 层把 Phase 6.9.8 Task 0--6 的 canonical principal、Retriever/query rewrite、Verifier、
evidence projector 与 FinalResponse stream 串联到 `/api/chat`，并新增与流式 terminal 对齐的 realtime Trace 三阶段
生命周期。该结论由 focused composition/stream/Trace 测试与静态门支撑，不等于已经启动真实 `POST /api/chat` 或
完成产品 API 验收。

本 checkpoint 只形成 zero-provider composition/Trace 工程 authority。两个模型 gate 保持 default-off，没有调用
Qwen、DeepSeek 或其它 Provider；没有执行 48-case、controlled-Live、产品 Docker/API/可见浏览器或 main 验收。
因此它不能证明真实模型语义质量、RAG uplift、grounded/citation 指标、P95、CNY、SLA 或生产可用性。

数据库 E2E 已更新，但执行时本地 Redis `localhost:6379` 与 PostgreSQL `127.0.0.1:5433` 均未运行，Nest 重连后
命令被 120 秒工具上限终止。本验收把该项记录为 `environment_blocked`，不把未运行的数据库迁移/API E2E 写成
通过证据。

## 2. 为什么需要这个任务

Task 3--6 已分别完成 Retriever、evidence、query rewrite 与 FinalResponse contract，但“节点可单测”不等于“源码
Chat composition 已经正确组合”，更不等于产品 API 已运行验收。Task 7 关闭以下工程缺口：

1. canonical auth、owner-scoped retrieval 和同一 execution context 是否贯穿整个 request；
2. Trace 是否在流前保持 RUNNING，并且只在本地 stream terminal 后完成；
3. Retriever/Verifier/FinalResponse 的失败是否保留既有可用 Chat，而不伪造 RAG/citation authority；
4. browser/request abort 是否真正终止底层 reader，而不是只停止外层 Response；
5. 并发、重试 ACK、legacy Trace 写入与重复 terminal 是否可能覆盖同一 run 或重复计费；
6. 同步流是否错误引入 BackgroundJob/Outbox 或后台重放。

## 3. 源码 composition

```text
canonical auth
  -> minimal realtime Trace start
  -> conversation/context prepare
  -> RouterAgent / TutorAgent
  -> RetrieverAgent + optional default-off query rewrite
  -> KnowledgeVerifierAgent
  -> local evidence projector
  -> realtime Trace prepare
  -> FinalResponseAgent stream
  -> realtime Trace finalize
```

关键边界：

- authenticated path 只使用 `/auth/me` 的 strict `AuthUser.id` 与同一 opaque bearer capability；
- anonymous Mock 在 Provider config、credential factory 与所有 Agent runtime 前直接返回；
- Retriever 只能使用同一 execution context 的 search port，模型不能提供 owner、`topK/minScore` 或 filter；
- Verifier 只允许维持或收紧 evidence，不能恢复 SafetyGuard 已删除的正文；
- FinalResponse 只看到本地 model projection，citation identity/sourceLabel/usage/cost/terminal 均由本地生成；
- route/runtime/Trace helper failure 按固定状态收口，不把 raw error、prompt 或用户正文写进公共响应。

## 4. Realtime Trace 生命周期

新增 API：

```text
POST  /agent-traces/realtime/start
PATCH /agent-traces/realtime/:id/prepare
PATCH /agent-traces/realtime/:id/finalize
```

### Start

- 只写 `runId/modelCallId/conversationId/mode/startedAt`；
- 数据库使用 `route=null`、provider/model=`pending`、token/cost/RAG/steps 全零或空；
- `inputHash/inputPreview` 为 `null`，不提前持久化 query 或模型信息；
- 相同 identity 的 exact retry 幂等，冲突 identity 返回 409；
- `modelCallId` 全局唯一，legacy POST 不能覆盖 realtime run。

### Prepare

- 只写固定 Agent node/status/reason/count summary、model/estimate/RAG metadata 与 preparation digest；
- 相同 preparation retry 幂等，不同 digest 冲突；
- step summary 不保存 query、chunk、owner、token、prompt、回答正文、credential、endpoint 或 raw error；
- RUNNING/terminal realtime run 都拒绝 legacy POST overwrite。

### Finalize

- 使用 compare-and-set，只有一个并发请求能把 RUNNING 推进到 completed/failed/aborted；
- prepare ACK 不确定时，finalize 可原子补写完全相同的 preparation；
- completed terminal 必须存在 preparation 和唯一 FinalResponse completed step；
- 认证/上下文等早期 failed/aborted 允许无 preparation，steps 保持为空；
- terminal 后 late prepare、第二个 finalize 或 conflicting retry 返回 409；
- realtime 内部 `preparedAt/digest` 不进入公共 DTO。

数据库 migration 的 CHECK 与 service 写入保持同一状态机：未 prepare 的 RUNNING 只允许 pending/zero placeholder；
prepare 后允许实际 route/model/estimate/RAG/step；terminal 只允许符合 completed/failed/aborted 不变量的记录。

## 5. Stream、citation 与取消

- AI SDK text channel 只映射正文、本地 citation Markdown 与固定诚实失败提示；
- sequence 必须连续，citation 与本地 allowlist lockstep，terminal 必须唯一且最后；
- 首 token 前失败不伪造正文；首 token 后失败保留 partial text，但不追加 citation/tool success；
- 本地 completed terminal 一旦封存，网络投递失败只记录 delivery failure，不改写为第二个 aborted terminal；
- `Response.body.cancel()` 先 abort 当前 request scope，再取消底层 reader；
- parent `Request.signal` abort 也会主动取消同一 reader；single-cancel 与 listener cleanup 防止竞态重复取消；
- 不声明客户端网络 exactly-once，不在断连后自动 replay 或二次计费。

## 6. Retriever、RAG 与错误语义

- query rewrite ineligible/gate-off/runtime/schema/validator failure 使用 original query；
- knowledge transport/schema failure 安全降级为 no-RAG，FinalResponse 可继续生成无引用回答；
- 只有 Retriever `completed` 且存在实际 evidence/knowledge prompt 时才允许 `ragIncluded=true`；
- `ragIncluded=false` 会同时清空 bundle、allowlist、structured citation 与 Markdown fragment；
- cross-scope `principal_binding_invalid` 不降级为普通检索失败，HTTP 返回 403；
- request/parent abort 返回 499；其它非法 composition 返回 400；
- 失败响应与 Trace 只暴露固定 status/reason，不返回 bearer、query、chunk、prompt、回答或 raw error。

## 7. 权限、持久化与任务不丢失边界

- 每个 request 拥有独立 execution context、runId、modelCallId、budget、AbortSignal 与 reader；
- Trace 所有读写都由 JWT userId 限定，跨 owner 查找/更新不可见；
- `modelCallId` 唯一与 finalize CAS 约束本地单次 attribution；它不冒充 Provider 网络 exactly-once；
- 当前 FinalResponse 是同步 request/stream，不创建 `BackgroundJob` 或 `Outbox`，也不调度后台 retry；
- 因为没有异步接受后再处理，当前不存在“必须同时写 BackgroundJob + Outbox”的双写窗口；
- 未来若改成异步生成，必须一起设计 `BackgroundJob + Durable Outbox + idempotency key`，不能只加队列或 job。

## 8. 主要实现文件

| 层                   | 文件                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat composition     | `apps/web/src/app/api/chat/route.ts`、`apps/web/src/lib/chat-realtime-composition.ts`                                                       |
| FinalResponse bridge | `apps/web/src/lib/chat-final-response-runtime.ts`、`apps/web/src/lib/final-response-data-stream-adapter.ts`                                 |
| Abort/reader         | `apps/web/src/lib/response-abort-bridge.ts`                                                                                                 |
| Trace client         | `apps/web/src/lib/chat-realtime-trace.ts`、`apps/web/src/lib/agent-trace-api.ts`                                                            |
| Trace API/service    | `apps/server/src/agent-traces/agent-traces.controller.ts`、`apps/server/src/agent-traces/agent-traces.service.ts`                           |
| Shared contract      | `packages/types/src/api/agent-trace.ts`                                                                                                     |
| Database             | `packages/database/prisma/schema.prisma`、`packages/database/prisma/migrations/20260805090000_realtime_agent_trace_lifecycle/migration.sql` |

## 9. 验证证据

已通过：

| 验证                                              |                                           结果 |
| ------------------------------------------------- | ---------------------------------------------: |
| Web composition/stream/abort/Trace/wiring focused |                                        `17/17` |
| Server AgentTracesService focused                 |                                        `17/17` |
| Types test                                        |                                        `42/42` |
| Types `tsc`                                       |                                       exit `0` |
| Server build                                      |                                       exit `0` |
| 受影响 Web/Server lint                            |                                       exit `0` |
| 完整 Web `tsc`                                    | 既有 `.test.mts` 类型债；Task 7 新增文件无诊断 |

Focused Web 命令：

```bash
node --experimental-transform-types --test \
  apps/web/src/lib/chat-realtime-composition.test.mts \
  apps/web/src/lib/final-response-data-stream-adapter.test.mts \
  apps/web/src/lib/response-abort-bridge.test.mts \
  apps/web/src/lib/agent-trace-api.test.mts \
  apps/web/src/app/api/chat/route.tutor-model-wiring.test.mts
```

Server/Types 命令：

```bash
bun --filter @repo/server test agent-traces.service.spec --runInBand
bun --cwd packages/types test
```

数据库 E2E `apps/server/test/agent-traces.e2e-spec.ts` 已覆盖 minimal start、prepare 幂等/冲突、RUNNING/terminal
legacy POST 409、late prepare 409 与 concurrent finalize 单胜者。实际运行被缺失 Redis/PostgreSQL 阻断；没有重试、
没有为本任务启动 Docker，也没有据此宣称数据库 migration/API 已通过真实环境验收。

四路只读审计分别检查 Chat route、security/concurrency、stream/UI compatibility 与 Trace/domain。旧快照曾报告
`startRealtimeTrace` 写入真实 route/model 导致 CHECK 冲突；主线程按当前实时源码复核后确认 start 实际写
`route=null`、provider/model=`pending`、token/cost/RAG 全零，与 migration CHECK 一致，因此没有按过时结论放宽
数据库约束。

## 10. 环境与凭据事实

- Task 7 Provider calls=`0`，没有执行 Qwen/DeepSeek 网络调用；
- 早期 Prisma wrapper 曾加载根 `.env` 到进程环境，但没有读取、输出或使用模型 credential；后续直接 CLI 未再次
  加载；因此本验收不写“从未接触根 `.env`”的过度声明；
- 两个模型 gate 始终 default-off，未为测试修改 tracked safe defaults；
- 未启动 Docker、PostgreSQL、Redis、API 或浏览器；
- 未创建正式 evaluation marker/journal/artifact，未修改业务数据；
- `.codex/` 保持未跟踪且不进入提交。

## 11. 明确未完成

- Task 8 的固定 48-case dataset/manifest、deterministic baseline、reviewed Mock/static checkpoint；
- 完整 `/api/chat` POST route runtime integration 与真实数据库/API 产品验收；
- query rewrite uplift、FinalResponse grounded/citation 指标、P95、verified token/CNY aggregate；
- fresh admission 下的唯一 controlled-Live；
- 分支 Docker/API/可见浏览器/Trace/权限/精确清理；
- main 合并、main default-off 回放与远程 main SHA 对齐；
- Phase 6.9.9/6.9.10/6.10/8/9 与两篇面试学习博客收尾。

Task 7 只解锁 Task 8；不能跳过 Task 8 直接执行 controlled-Live、产品或 main。

## 12. 回顾时可以问

- 为什么 realtime Trace 必须拆成 minimal start、prepare 和 CAS finalize，而不能在流前直接写 completed？
- 为什么 prepare ACK 不确定时允许 finalize 原子补写同一 preparation，却不允许普通 retry 覆盖 run？
- 为什么 `modelCallId` 唯一只能证明本地 attribution，不能证明 Provider 网络 exactly-once？
- 为什么 Retriever transport/schema failure 可以 no-RAG 降级，而 principal binding failure 必须 403？
- 为什么 `ragIncluded=false` 必须同时清空 bundle、citation allowlist 与 Markdown？
- 为什么 `Response.body.cancel()` 还必须显式取消底层 reader？
- 为什么同步 stream 不写 BackgroundJob/Outbox，未来异步化时却必须把两者和幂等键一起设计？
- 为什么 focused/静态门通过、数据库 E2E environment-blocked 后，Task 7 仍可形成工程 checkpoint，但不能形成产品
  或质量 authority？
