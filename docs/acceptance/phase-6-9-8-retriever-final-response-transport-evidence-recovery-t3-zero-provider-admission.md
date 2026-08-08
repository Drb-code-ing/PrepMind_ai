# Phase 6.9.8 Retriever / FinalResponse Transport Evidence Recovery T3-A

## Zero-provider admission / runner 验收记录

> 日期：2026-08-06
> 分支：`drb/phase-6-9-8-retriever-final-response-contract`
> 工作树基线：`87afbd68`（T2 checkpoint）
> authority：`zero_provider_transport_evidence_t3_admission`
> qualityAuthority：`none`
> gate：`transport_evidence_t3_admission_ready`

## 1. 这一步为什么存在

T2 证明了三条第一方链路的 transport/evidence 诊断 contract 可以在零网络条件下稳定工作，但它没有为真实调用建立一套可审计的入口。R5/Task 9C 的历史终态仍然只说明“进入 dispatch 后在 response 前失败”，不能反向归因 DNS、TLS、代理、账号、余额、模型权限或服务端。

因此先增加 T3-A：只实现真实 canary 之前的 admission、权限和调度边界，并用本地 synthetic signal 验证这些边界。这样可以在不读取 credential、不调用 Provider、不创建正式 evidence 的前提下，确认未来一次性 canary 的入口顺序、预算和失败收口是可重算的。T3-A 不是 R5 retry，也不是 Provider health 或 Agent 语义验收。

## 2. 实现范围

| 文件                                                                                                | 责任                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t3-admission.ts`  | T3 source schema、branch/HEAD/upstream/origin parity、T2 gate binding、source bundle、双 opaque capability、fresh proxy nonce、数据边界与 exact authorization reader |
| `packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t3-runner.ts`     | 三槽位 zero-provider runner、固定分母、首错 breaker、abort/timeout/budget 分类、双 wire 与 no-raw report                                                             |
| `packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t3-cli-core.ts`   | fail-closed CLI core；只接受 zero-provider argv 和 `args + AbortSignal`，不暴露 credential/provider/fetch port                                                       |
| `packages/agent/tests/phase-6-9-8-retriever-final-response-transport-evidence-t3-admission.test.ts` | admission、capability、proxy nonce、gate 顺序、runner accounting 与 hostile input focused tests                                                                      |

### 2.1 Admission 边界

正式 source admission 只有在以下条件同时满足时才会返回：

- 当前 branch、HEAD、tracking upstream、`origin/<branch>` 和 approved source ref 完全一致；
- working tree clean，`.tmp` 中 T3 formal artifact 数为 `0`；
- T2 report 重新通过 `30/30` case、`15/15` classifier、`providerCalls=0`、`credentialReads=0`、`qualityAuthority=none` 校验；
- source bundle 由固定 source path 的 Git blob SHA 重算，且不读取工作树中的未提交内容；
- admission capability 与 reservation capability 由模块私有 `WeakMap` 签发，均为 single-consume，伪造、复制、复用、跨 authority 或 source drift 均 fail-closed；
- proxy preflight 必须使用新的 opaque UUID nonce，receipt 只能是 `direct_ready` 或 `loopback_proxy_ready`，并固定 `providerCalls=0`。

T3-A 的测试使用 `synthetic_fixture` source 和内存 capability；它不会创建正式 marker、journal、report、artifact 或 recovery claim。

### 2.2 Runner 边界

runner 只模拟如下固定顺序，每个槽位最多一次：

```text
rewrite (DeepSeek) -> qwen (Qwen embedding) -> final_response (DeepSeek stream)
```

- 最大 Provider slot：`3`；总预算上限：`0.024096 CNY`（`0.005 + 0.004096 + 0.015`，每个 slot 各一次）；该值不复用 Task 9 的 32-call Qwen cap；
- 首个 synthetic failure/timeout/abort 打开 breaker，后续槽位以固定分母记为 `not_started_quality_breaker` 或 `not_started_external_abort`；
- `providerWire`、`runnerWire`、credential、raw retention、formal evidence、product write、Trace write 均由本地 schema 重算；
- `globalThis.fetch`、`.env`、模型 executor、数据库、Docker、API、浏览器和 Outbox/BackgroundJob 均不在 runner 依赖图中。

### 2.3 CLI gate 顺序

```text
argv
  -> source admission
  -> T2 gate + admission capability
  -> fresh proxy preflight (1s watchdog)
  -> DeepSeek/Qwen data-boundary acceptance
  -> exact authorization
  -> zero-provider runner
```

任一 gate 失败都会输出 bounded code 并在后续 mutation/provider port 之前停止。输出不含 URL、raw error、prompt、query、chunk、answer、token、cookie、credential 或 unknown key。

## 3. 验收证据

| 检查                                                 | 结果                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| T3-A focused                                         | `12/12` tests，`49` 个 `expect()` assertions                            |
| Agent full regression                                | `1360/1360` tests，`23805` assertions，`169` files，`101.52s`，exit `0` |
| `bun --filter @repo/agent typecheck`                 | 通过                                                                    |
| `bun --filter @repo/agent lint`                      | 通过                                                                    |
| Prettier / `git diff --check`                        | 通过                                                                    |
| Provider calls / credential reads / global fetch     | `0 / 0 / 0`                                                             |
| formal marker/journal/report/artifact/recovery claim | `0 / 0 / 0 / 0 / 0`                                                     |
| product writes / Trace writes                        | `0 / 0`                                                                 |

focused tests 特别覆盖：三槽位顺序、首错 breaker、父取消、预算超限、exact own-data descriptor、hostile accessor、T2 gate 绑定、source parity/cleanliness/artifact/bundle drift、fresh proxy nonce、capability forged/reused/cross-authority，以及 CLI 在 source、proxy、data boundary、approval 失败时的停止位置。

## 4. Authority 与未完成项

本记录只证明 T3-A 的 zero-provider admission/runner contract 和本地 durability 前置条件可被验证。它不证明：

- DeepSeek 或 Qwen 当前网络、账号、余额、模型权限或服务端健康；
- rewrite、Retriever 或 FinalResponse 的真实语义质量、P95、verified usage/CNY；
- `/api/chat`、Docker、可见浏览器、Trace、BackgroundJob/Outbox、生产部署或 main authority。

T3-B controlled canary 仍然是 optional、未实现、未授权状态。若要执行，用户必须在新的运行时再次明确接受数据边界并发送以下两行（一次性、最多三个 slot、首错即停）：

```text
I_ACCEPT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_EVIDENCE_T3_DEEPSEEK_AND_QWEN_DATA_BOUNDARY
I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_EVIDENCE_T3_CONTROLLED_CANARY_ONCE
```

在收到这两行之前，禁止读取 `.env` credential、启动 Live CLI、curl/单 case 探测、创建正式 marker/journal/artifact、进入产品验收或合并 `main`。

## 5. 回顾问题

1. 为什么 source parity 和 clean tree 必须在 credential 读取前完成？
2. 为什么 T3-A 的三次 synthetic slot 全通过，仍不能写成 Provider health？
3. 首错 breaker 如何保证未启动 suffix 不被补跑或伪造为成功？
4. admission capability 与 reservation capability 为什么要分开并 single-consume？
5. T3-B 通过后，为什么仍要另做 Docker/API/browser 与产品语义验收？
