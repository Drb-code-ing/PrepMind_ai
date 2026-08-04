# Phase 6.9.8 Task 6 — FinalResponseAgent / stream contract 验收

> 日期：2026-08-04
> 分支：`drb/phase-6-9-8-retriever-final-response-contract`
> 基线：`5c778b7711ad2187b43a5daf03edb73492d934d9`
> Authority：`zero_provider_final_response_stream_contract`
> Quality Authority：`none`
> Provider calls：`0`

## 1. 验收结论

Task 6 已完成正式 FinalResponseAgent、独立 DeepSeek V4 Pro non-thinking streaming adapter、严格 stream event/
server ledger、本地 citation authority，以及 Web server-only default-off config/runtime。它把“最终回答正文生成”从
旧 Chat transport 中拆成了一个可单测、可取消、可计费约束、可安全降级的 Agent 节点。

本次只形成 zero-provider 工程合同 authority：没有读取根 `.env` 或任何 credential，没有调用 DeepSeek/Qwen/
其它 Provider，没有把 runtime 注入 `/api/chat`，也没有执行产品 Docker/API/browser、48-case、controlled-Live 或
main 验收。因此它不能证明真实 FinalResponse 语义质量、产品可用性、P95、SLA 或生产部署。

## 2. 为什么需要这个任务

Task 1 已冻结 FinalResponse request/event schema，Task 4 已冻结本地 evidence/citation authority，但旧 Chat 流仍不能
证明以下约束：

1. DeepSeek 请求是否精确使用 approved endpoint、non-thinking streaming 与 verified usage；
2. 首 token 前后失败是否诚实区分不可用与 partial/incomplete；
3. citation、tool success、usage/cost 和 terminal 是否仍由本地权威生成；
4. abort、deadline、预算和客户端断连竞态是否始终只产生一个服务端 terminal；
5. 模型或 transport 是否可能通过 retry、tools、reasoning 或未知扩展扩大权限。

Task 6 先把这些能力封装并验证，再由 Task 7 接入实时 Chat 与持久化 terminal Trace，避免把“能流式输出文本”误写成
“完整 Agent 产品链路已完成”。

## 3. 实现范围

| 层                 | 交付                                                                          | 本地边界                                  |
| ------------------ | ----------------------------------------------------------------------------- | ----------------------------------------- |
| AI stream adapter  | DeepSeek V4 Pro non-thinking `streamText` adapter、strict finish/usage parser | exact endpoint；no retry/tools/reasoning  |
| FinalResponse node | authenticated-only、prompt projection、timeout/abort/budget、partial failure  | 一次 executor；模型只生成正文             |
| Stream ledger      | started/delta/citations/completed/failed、连续 sequence、唯一 terminal        | 本地 ledger 权威；不承诺网络 exactly-once |
| Citation authority | 从 Task 4 `allowedCitationIds` 与 bundle entries 生成 structured citations    | 模型不能创建或修改 citation/sourceLabel   |
| Web config/runtime | default-off DeepSeek config、专用 credential、single-consume executor factory | server-only；generic/sibling key 不可借用 |
| Docker config      | FinalResponse gate/timeout/key 只投影到 `web`                                 | `server/worker/admin` 不接收该 capability |
| Shared contract    | 模型字段完整安全扫描、failure retry/abort invariant                           | unknown/hostile/unsafe 输入 fail-closed   |

新增运行配置：

```dotenv
FINAL_RESPONSE_AGENT_MODEL_ENABLED=false
FINAL_RESPONSE_AGENT_MODEL_TIMEOUT_MS=20000
FINAL_RESPONSE_AGENT_DEEPSEEK_API_KEY=
```

Tracked default 始终关闭。即使本地存在通用 `DEEPSEEK_API_KEY` 或其它 Agent key，也不能替代该组件专用 credential。

## 4. Provider 与调用合同

Adapter 固定以下请求边界：

- endpoint：`https://api.deepseek.com/v1/chat/completions`；
- model：`deepseek-v4-pro`；
- `stream=true`、`stream_options.include_usage=true`、`thinking.type=disabled`；
- `max_tokens=1200`、`maxRetries=0`、`maxSteps=1`；
- 禁止 `tools/tool_choice/functions/function_call/json_schema/parallel_tool_calls`；
- stream 必须出现且只出现一个 step，step finish 与 final finish 的 reason/usage 必须完全一致；
- warnings、reasoning、reasoningDetails、toolCalls、toolResults、sources、files 必须为空；
- transport rejection、HTTP/stream error、mid-stream abort、unknown part/usage/finish 全部 fail-closed，无 retry。

工具状态由“请求不允许工具 + 返回 `toolCalls/toolResults` 必须为空 + stream contract 不存在 tool-success event”三层
约束表达。Task 6 没有新增 ToolAgent、工具执行或后台任务。

## 5. Node 前置门与预算

正式节点顺序为：

```text
strict responseId/modelCallId/traceAvailable
  -> exact FinalResponseRequest + execution-context binding
  -> authenticated principal
  -> complete-field safety projection
  -> strict default-off config + executor presence
  -> parent abort + deadline
  -> bounded prompt + local input-token preflight
  -> linked parent/deadline/20000ms signal
  -> one streaming executor
  -> strict delta/finish/verified usage
  -> local cost cap
  -> local citation + terminal ledger
```

固定预算为 `1 call / 2500 input / 1200 output / 0.015 CNY`。价格 profile 为 input/output
`3/6 CNY / 1M tokens`，理论 token 上限费用为 `0.0147 CNY`，低于 request cap。任何输入、输出、usage 或费用越界都
不能形成 completed authority。

Anonymous、cross-context、unsafe input、invalid/disabled config、pre-abort、expired deadline 与 input budget failure
均在 executor 前 zero-call。Executor 最多调用一次，不创建自动 retry、BackgroundJob 或 Outbox。

## 6. Stream、citation 与断连语义

- 成功顺序固定为 `response_started -> text_delta* -> citations? -> response_completed`；
- 失败顺序固定以唯一 `response_failed` 收口，并区分 `before_first_token / after_first_token / aborted`；
- 首 token 前失败不伪造正文；首 token 后失败保留已产生的 `partialText`，但不发送 citation 或 tool success；
- no-RAG 与 insufficient 不产生 citations；conflict 只允许保守正文与本地允许的 citation；
- citation 只从 request 的本地 bundle 与 `allowedCitationIds` 交集生成，模型输出不能添加 citation identity；
- server ledger 校验 sequence 从 0 连续、terminal-last、恰好一个 terminal、terminal 后无 delta/citation；
- parent abort、timeout、duplicate callback 与 client disconnect 竞态只能确定一次本地 terminal。

复审发现 citation 已准备成功、completed 网络投递失败时，如果再追加 aborted terminal，会让本地 ledger 自相矛盾。
修复后 citation 与 completed 先进入 authoritative ledger，再做 best-effort delivery。投递失败保留 completed，
observation 标记 `reasonCode=client_disconnected`、`deliveryFailed=true`；不会追加第二个 terminal。

该设计只保证服务端本地 ledger exactly-one terminal，不保证客户端网络恰好收到一次。客户端断连不会自动 replay；
未来若异步化，必须另行设计 `BackgroundJob + Durable Outbox + idempotency key`。

## 7. 配置、凭据与权限

- 非 secret gate、global Live、exact base URL 与 20000ms 全部通过后，才允许读取专用 credential；
- config/runtime 文件以 `server-only` 约束，credential 不进入 public config、浏览器 bundle、header、event 或
  observation；
- executor factory 为 single-consume capability；同一个 bundle 不允许重复构造 executor；
- Compose 只向 Next `web` 注入三项 FinalResponse 变量，Nest `server`、`worker`、`admin` 均不接收；
- FinalResponse model input 只包含安全的 latest/recent/Tutor guidance 与
  `citationId/sourceLabel/excerpt/trustLabel`；不包含 owner、token、真实 document/chunk/source ref、credential 或
  endpoint；
- 模型没有写入、工具、重试、计划、保存或 Trace finalization 权限。

## 8. 验证证据

| 验证                                          |                          结果 |
| --------------------------------------------- | ----------------------------: |
| FinalResponse Agent/contract/AI focused       |       `30/30`，`263 expect()` |
| Web config/runtime focused                    |                         `6/6` |
| Agent full                                    | `1244/1244`，`22851 expect()` |
| AI full                                       |    `330/330`，`2433 expect()` |
| Web full                                      |                     `474/474` |
| Agent / AI typecheck                          |                  exit `0 / 0` |
| Agent / AI lint                               |                  exit `0 / 0` |
| Web 受影响文件 lint                           |                      exit `0` |
| Compose safe-example `config --quiet`         |                      exit `0` |
| Prettier / `git diff --check` / Markdown link |                      exit `0` |

三路只读 architecture/security/test 复审未发现 blocker。复审提出的 provider transport rejection/mid-stream abort、
`max_tokens=1200`、parent-abort + duplicate timeout race，以及 completed 投递断连 ledger 均已有回归覆盖。

完整 Web `tsc` 仍会命中仓库既有 `.test.mts` 类型债；Task 6 新增 Web 文件的 focused runtime tests 与 lint 通过，
Agent/AI typecheck 全绿，因此未扩大修复到无关历史测试类型债。

## 9. 明确未完成

- 未把 Retriever query rewrite、evidence projector 或 FinalResponse runtime bundle 注入 `/api/chat`；
- 未实现 Task 7 的 route-level composition、持久化 terminal Trace、全链路 request abort/concurrency 与
  `modelCallId` 全局单次计费；
- 未执行 Task 8 的 48-case deterministic baseline、reviewed Mock/static checkpoint；
- 未形成真实 DeepSeek/Qwen usage、grounded/citation quality、P95、CNY aggregate 或 controlled-Live authority；
- 未执行分支产品 Docker/API/可见浏览器/Trace/业务数据清理，也未合并或验收 `main`；
- Phase 6.9.9/6.9.10/6.10/8/9 与两篇博客收尾继续阻断。

Task 6 只解锁 Task 7 Chat composition 与 terminal Trace。

## 10. 回顾时可以问

- 为什么 FinalResponseAgent 不能直接复用旧 Chat `streamText` 后就宣称完成？
- 为什么模型只能生成正文，citation、tool success、usage/cost 与 terminal 必须由本地生成？
- 为什么首 token 前失败和首 token 后失败必须采用不同产品语义？
- 为什么 citation/completed 要先封存本地 ledger，再做 best-effort 网络投递？
- 为什么 server terminal exactly-once 不等于客户端网络 exactly-once？
- 为什么 FinalResponse 必须使用独立 credential、预算和 single-consume executor？
- 为什么 Task 6 通过后仍不能启动 controlled-Live，而必须先完成 Task 7/8？
