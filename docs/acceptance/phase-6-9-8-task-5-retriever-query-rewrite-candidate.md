# Phase 6.9.8 Task 5 — Retriever query rewrite candidate 验收

> 日期：2026-08-04
> 分支：`drb/phase-6-9-8-retriever-final-response-contract`
> 基线：`c6705897f51462bbe438911a839b77b4cd71d96a`
> Authority：`zero_provider_retriever_query_rewrite_candidate`
> Provider calls：`0`

## 1. 验收结论

Task 5 已完成 Retriever query rewrite 的可执行候选、独立 Web server-only 配置/runtime、Retriever node 接口与
Compose web-only allowlist。复杂多轮 RAG 问题现在可以在受控依赖注入下请求一次 DeepSeek V4 Pro non-thinking
strict JSON 候选；是否调用、是否接受改写、以什么 owner/filter 检索，仍全部由本地 authority 决定。

本次只完成 zero-provider reviewed Mock 与工程合同验收：没有读取根 `.env` 或任何 credential，没有调用
DeepSeek/Qwen/其它 Provider，没有启动产品 Docker/API/browser，也没有接入 `/api/chat`。Mock observation 固定
`qualityAuthority=none`，因此不能把本结果写成真实模型质量、query rewrite uplift、产品可用性或 SLA 证据。

## 2. 为什么需要这个任务

原 Task 3 Retriever 已有可复现的 original-query hybrid-search baseline，但“这一步为什么成立”“why does that
follow”一类多轮指代问题可能缺少可独立检索的实体。Task 5 只让模型建议一条更完整的 query，同时保留三层本地
权威：

1. 认证、owner、是否需要 RAG、deadline、abort 与安全 eligibility 决定能否调用模型；
2. 实体、公式、数字、约束与上下文锚点决定候选能否被接受；
3. `topK=8`、`minScore=0.72`、`knowledge_document/DONE` filter 与实际 search port 永远由本地代码决定。

这样既为后续 paired eval 留出真实语义路径，也避免模型扩大权限、改变检索范围或把失败伪装成成功。

## 3. 实现范围

| 层              | 交付                                                                                             | 边界                                         |
| --------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Agent candidate | `retriever-query-rewrite-model-candidate-v1`、strict `{ rewrittenQuery }`、本地 validator/merger | 单次调用、no retry、失败回 original query    |
| Retriever node  | applied query 进入既有 search port；结果与 Trace 继续使用本地冻结 policy                         | 模型不能修改 owner/topK/minScore/filter      |
| AI runtime      | 新增 `retriever_query_rewrite` task allowlist                                                    | 复用既有 budget/timeout/abort/usage contract |
| Web config      | default-off DeepSeek V4 Pro non-thinking config、惰性 credential/runtime factory                 | server-only；generic/sibling key 不可借用    |
| Docker config   | gate/timeout/独立 key 只投影给 `web`                                                             | `server/worker/admin` 不接收该能力           |
| Export          | root export 与 `@repo/agent/retriever-query-rewrite` subpath                                     | 尚未接产品 composition                       |

涉及的运行配置：

```dotenv
RETRIEVER_QUERY_REWRITE_MODEL_ENABLED=false
RETRIEVER_QUERY_REWRITE_MODEL_TIMEOUT_MS=4000
RETRIEVER_QUERY_REWRITE_DEEPSEEK_API_KEY=
```

Tracked default 始终为关闭。完整 Live conjunction 还要求 `AI_PROVIDER_MODE=live`、
`AI_ENABLE_LIVE_CALLS=true`、精确 `AI_BASE_URL=https://api.deepseek.com/v1`、精确 4000ms 与组件专用 key；任一
条件不满足都 fail-closed。

## 4. 调用顺序与零调用门

正式候选固定执行：

```text
strict request/context binding
  -> requiresRag + authenticated principal
  -> original/recent turns/active question/goal 分段安全扫描
  -> 多轮指代/省略 + context eligibility
  -> abort/deadline
  -> non-secret config gate
  -> prompt projection + local token preflight
  -> fresh isolated budget
  -> lazy component credential/runtime factory
  -> at most one structured invocation
  -> strict schema + trace/usage/config parity
  -> entity/formula/number/constraint/context-anchor validator
  -> local original/rewritten selection
```

以下路径在 runtime factory 前零调用：standalone/no-context、明确不需改写、anonymous、`requiresRag=false`、
unsafe/credential/instruction、gate-off、invalid config、pre-abort、expired deadline 与超预算 prompt。缺少组件 key或
executor factory 失败时也不会形成模型 attempt。

## 5. 预算、失败与观测

- 模型：`deepseek-v4-pro`，non-thinking strict JSON；
- hard timeout：`4000ms`；
- budget：`1 call / 1200 input / 160 output`；
- price profile：input/output `3/6 CNY / 1M tokens`，理论上限 `0.00456 CNY`，低于 `0.005 CNY` cap；
- runtime/schema/usage/abort/validator 失败：无 retry，执行 original query；
- observation 只含固定 version/provenance/disposition、budget、usage 与脱敏 trace；不含 original/rewritten query、
  recent turn、prompt、owner、credential、endpoint 或 raw error；
- reviewed Mock provenance 不会升级为 Live authority；所有 Task 5 observation 的 `qualityAuthority` 固定为
  `none`。

## 6. 安全、权限与并发结论

- request 的 run/request/deadline 必须与同一个 canonical execution context 精确绑定；cross-context 在 runtime/search
  前 fail-closed；
- 安全扫描覆盖完整 original query、每一条 recent turn、active question 与 active goal，而不是只扫描截断后的
  prompt；
- candidate 只返回 query 文本，不接收 owner、document ID、filter、topK、minScore、write/tool capability；
- 每次调用创建独立 budget；两次请求的 budget 不共享、也不污染 Router/Tutor/Verifier；
- parent abort 传播到 runtime 与 search；调用失败或 schema 不可信均只执行一次，不创建后台 retry、
  `BackgroundJob` 或 Outbox；
- Retriever result/Trace 的既有安全替换、稳定去重/排序、query SHA 和 no-raw 边界保持不变。

三路独立只读复审均未发现 blocker/high。复审提出的 standalone exact no-context、跨调用预算隔离、后续 turn/
active question/goal 分段扫描和普通 runtime throw no-retry 覆盖已补齐。

## 7. 验证证据

| 验证                                      |                                         结果 |
| ----------------------------------------- | -------------------------------------------: |
| Task 5 candidate + Retriever node focused |                      `18/18`，`223 expect()` |
| Web config/runtime focused                |                                        `6/6` |
| Agent full（串行）                        |                `1234/1234`，`22730 expect()` |
| AI full                                   |                                    `325/325` |
| Web full                                  |                                    `468/468` |
| Types full                                |                                      `21/21` |
| Agent / AI typecheck                      |                                 exit `0 / 0` |
| Agent / AI lint                           |                                 exit `0 / 0` |
| Web 受影响文件 lint                       |                                     exit `0` |
| Compose safe example config               | `docker compose ... config --quiet` exit `0` |

首次把 Agent/AI/Web/Types 四套全量并行运行时，Agent 中一个历史 Phase 6.9.7 S3 文件发布测试恰好超过其
`5000ms` test timeout；Task 5 新用例当时全部通过。该历史文件随后独立复跑 `14/14`，发布用例约
`1277ms`；Agent 全量再以单进程串行运行得到 `1234/1234`。因此最终门采用串行全量结果，不把并行资源竞争
误判为 Task 5 回归。

全量 Web `tsc` 仍包含仓库既有测试类型债；本任务新增 Web 文件错误为 0，受影响 lint、Web full runtime tests 与
Agent/AI typecheck 均通过。Types lint 仍受仓库既有 Bun/PATH eslint 问题影响，不属于 Task 5 回归。

## 8. 明确未完成

- 未把 query rewrite runtime bundle 注入 `/api/chat`；这属于 Task 7 composition；
- 未实现 Task 6 FinalResponseAgent、DeepSeek streaming adapter 或 structured terminal；
- 未完成 Task 8 的 48-case strict report/reviewed Mock/static checkpoint；
- 未形成 rewrite uplift、真实 Qwen/DeepSeek usage/cost/P95 或 controlled-Live authority；
- 未执行分支 Docker/API/可见浏览器/Trace/业务数据清理，也未合并或验收 `main`；
- Phase 6.9.9/6.9.10/6.10/8/9 与博客收尾继续阻断。

Task 5 只解锁 Task 6 FinalResponseAgent 与 stream contract。

## 9. 回顾时可以问

- 为什么 query rewrite 模型只能建议 query，不能决定 owner、topK 或 document filter？
- 为什么 standalone/no-context 必须 zero-call，而不是每次 RAG 都先调用模型？
- 为什么 original、每条 recent turn 和 active context 要分段扫描？
- 为什么 Mock candidate 满分仍不能证明 query rewrite uplift？
- 为什么 Task 5 已有 Web runtime/config，却仍没有接入 `/api/chat`？
- 为什么同步 query rewrite 失败不需要 BackgroundJob/Outbox，也禁止后台自动重试？
