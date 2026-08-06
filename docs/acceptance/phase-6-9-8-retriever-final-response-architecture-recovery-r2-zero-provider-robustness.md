# Phase 6.9.8 Retriever / FinalResponse Architecture Recovery R2 验收

## 1. 结论

R2 已以
`zero_provider_retriever_final_response_architecture_recovery_robustness / qualityAuthority=none`
完成 Qwen retrieval 与 DeepSeek FinalResponse stream 的第一方 wire diagnostics、recovery stage projection 和
zero-provider robustness TDD。

本阶段解决的是“Qwen/FinalResponse 调用失败时，怎样由第一方适配器证明 Provider 边界，并落入互斥、有限、
不保存 raw 的 stage/reason”，不是 runner/durability、64-call reviewed Mock、controlled-Live、产品或 main
验收。R2 完成后当时只解锁 R3 source admission / runner / durability；R3 后续已独立完成。

## 2. 实现范围

R2 新增或补强：

- 独立 `phase-6.9.8-provider-wire-diagnostics-v1`，固定 `qwen_retrieval` 与
  `final_response_stream` 两个 wire family；
- 两个 family 各自的严格单调 stage sequence、固定 failure category、shape bucket 与 0/1 counter；
- Qwen `text-embedding-v4` 第一方 diagnostic provider，以及 Qwen recovery session/projection；
- FinalResponse 第一方 diagnostic streaming provider，以及 stream/terminal/citation/Trace/usage/cost/delivery/result
  recovery session/projection；
- forged、reused、active、cross-family 与 out-of-order capability fail-closed；
- transport、HTTP、envelope、embedding、usage、stream event、terminal、false-tool 与 abort 的 synthetic fault
  coverage；
- bounded FinalResponse `terminalCountBucket` 单次 setter。

R2 没有新增 production CLI、source manifest、approved tag、marker、journal、artifact、validator、recovery claim、
环境变量、产品 gate 或业务写入。

## 3. Provider wire authority

### 3.1 公共能力面

`@repo/ai` 只公开：

- wire diagnostics 的 create/read；
- frozen capability/snapshot/type/enum；
- Qwen/FinalResponse 第一方 provider factory。

`claim/advance/fail/complete/set-shape` mutation 只供包内第一方 adapter 使用，不从公共 barrel 导出。Snapshot 的
executor/dispatch/response/usage counter 全由已完成 stage 推导，调用方不能直接提交或覆盖。

每个 recovery session 只能绑定一个真实、尚未使用、family 匹配且未被其它 session 绑定的 wire capability。
伪造对象、重复绑定、已经 active/terminal 的 capability、Qwen 与 FinalResponse 交叉绑定均在 admission
fail-closed。

### 3.2 两个 family 的阶段

Qwen wire 固定为：

```text
executor_entered -> request_validated -> provider_dispatch_started
  -> provider_response_received -> provider_envelope_validated
  -> embedding_validated -> usage_validated
```

FinalResponse wire 固定为：

```text
executor_entered -> request_validated -> provider_dispatch_started
  -> provider_response_received -> stream_events_validated
  -> provider_terminal_validated -> usage_validated
```

跳阶段、重复 terminal、跨 family stage 或不完整 success 都不能完成 capability。故障 terminal 只能使用与当前
family 和已观察阶段相容的固定类别；不相容输入收敛为 `unknown`，不会提升 authority。

## 4. Qwen robustness

Qwen diagnostic provider 继续保持 Task 9A 的边界：北京区 `text-embedding-v4 / 1536`、单次 direct fetch、
no-retry、`credentials=omit`、严格 status/content-type/JSON/exact envelope/index/vector/usage 校验。R2 额外把结果
投影为：

- transport、未观察到 Response 与 401/403、429、4xx、5xx 分域；
- Provider envelope invalid；
- embedding count/index、dimension、finite/non-zero value 分域；
- `prompt_tokens == total_tokens` verified usage；
- verified usage 后的 cost、ranking 与 call-result 独立本地阶段。

Provider `data` 顺序变化不改变按 index 重建的 embedding authority。缺失、重复或越界 index 均是
`embedding_count_invalid`，不会靠排序、默认值或修复继续执行。

Cost、ranking 与 call-result 在 R2 checkpoint 仍只接收包内 fixed status；R2 没有把它们写成数值 authority。
后续 R3 已由 source-admitted runner、冻结价格/ranking/result validator 与 durability lifecycle 完成绑定，但仍只
形成 zero-provider runner/durability authority，不形成真实数值或质量 authority。

## 5. FinalResponse robustness

FinalResponse diagnostic provider 保留正式 streaming contract：最多一个 step、无 tool、唯一 finish、terminal-last、
strict verified usage 与 no-retry。R2 将以下边界分开：

- transport、HTTP 与 response-not-observed；
- malformed/unknown stream event；
- terminal missing、duplicate 与 not-last；
- tool call/result 伪装成功；
- usage invalid；
- citation/grounding/critical notice；
- Trace、cost、delivery 与 call-result。

Citation、Trace、cost、delivery 和 result 仍是包内 fixed-status mapper；R2 只证明 stage/reason 合同和隔离，不证明
这些本地事实已经由正式 runner 重算或 durable 保存。

### 5.1 首个畸形 stream event 的诚实分类

第一条实际 stream event 一旦到达，就表示第一方 adapter 已观察到 Provider 事件。因此即使该事件随后因 hostile
getter/Proxy 或 shape 不合法而失败，也必须记录：

```text
providerBoundary=response_observed
reasonCode=stream_event_invalid
```

它不是成功，也不是 `response_not_observed`。只有 full stream 为空、Response/事件确实未被观察时，才使用
`response_not_observed`。Diagnostic 不保存畸形 event、getter 结果或 sentinel 文本。

## 6. Bounded diagnostic 与数据最小化

R2 沿用 R1 的 exact diagnostic：只允许 version、call phase、stage、reason、provider boundary、top-level type /
field-count / terminal-count bucket 和 `rawDataRetained=false`。

禁止保存或派生：

- Provider response、embedding、stream delta、prompt、query、chunk、answer或业务 ID；
- credential、URL、header、cookie、proxy 或 env value；
- raw error、stack、cause、Zod path/value、unknown key 名；
- getter/Proxy/toJSON/coercion 返回值、对象 dump、截断 raw、base64 或 raw-derived hash；
- expected/oracle、scorer 中间答案或模型选择提示。

Synthetic/injected transport 只用于 zero-provider 测试，provenance 不会升级为外部 Provider 或 Live authority。

## 7. Task 9C 不可变性

R2 只读运行旧 validator；没有运行 Task 9C CLI/seal/recovery，也没有写入 sealed namespace。结果保持：

- run：`28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2`；
- gate：`task9_quality_gate_failed / qualityAuthority=none`；
- journal：`134 / evidence_published`；
- report logical SHA：`c612d6f7164d5491e54422abb2e8504cbb707aeea3b641e8c57285d957b8b4a4`；
- physical artifact SHA：`7d45329debde6def4c5bc8bbda28609b507a71766ae06e00806e44eaf7b3614c`；
- validator：`ok=true`。

R2 的新分类只验证未来 recovery lineage 的 bounded behavior，不能反向恢复 Task 9C 的 Provider response、具体字段
或 raw，也不能把旧失败归因到 transport、账号、余额、模型权限或服务端。

## 8. Authority 与副作用计数

| 项目                                          |   R2 结果 |
| --------------------------------------------- | --------: |
| External Provider calls                       |       `0` |
| DeepSeek/Qwen network calls                   |     `0/0` |
| Credential reads                              |       `0` |
| Task 9C evidence writes                       |       `0` |
| Recovery formal marker/journal/artifact/claim | `0/0/0/0` |
| New production CLI/tag/admission              |   `0/0/0` |
| Docker/API/browser                            |   `0/0/0` |
| Business/BackgroundJob/Outbox writes          |   `0/0/0` |
| Quality authority                             |    `none` |

测试中的 injected fetch/stream 是 `synthetic_test`，不访问外部 Provider，也不读取真实 credential。

## 9. 验证结果

| 检查                                  | 结果                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| R2 post-format focused                | `23/23`；4 files；258 assertions                                                                                     |
| R1/R2 + affected Task 9 compatibility | `58/58`；10 files；522 assertions                                                                                    |
| AI full                               | `345/345`；28 files；2651 assertions                                                                                 |
| Agent full                            | `1301/1301`；161 files；23364 assertions                                                                             |
| Agent typecheck / source lint         | 通过 / 通过                                                                                                          |
| AI typecheck / lint                   | 通过 / 通过                                                                                                          |
| Task 9C sealed bundle validator       | `ok=true`；run `28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2`；journal `134 / evidence_published`；两个 SHA 与封存值完全一致 |
| Prettier / `git diff --check`         | 通过 / 通过                                                                                                          |
| 仓库 Markdown 相对链接                | `365 files / 189 links / missing=0`                                                                                  |
| current-status / secret / field 扫描  | 无冲突；secret candidate files=0；forbidden diagnostic field files=0                                                 |
| CodeGraph                             | `Already up to date`                                                                                                 |
| 独立安全复审                          | 无 blocking/high；opaque capability、单次 claim、阶段序列和 no-raw 边界通过                                          |
| 独立测试/文档复审                     | 关键 HTTP 分类与 mid-stream abort 补强完成；首个畸形 event 的 response-observed 语义已明确                           |

## 10. 明确未完成

- R3 source admission、report/runner/CLI、双 wire accounting、marker/journal/artifact/validator/crash-only seal；
- R4 16-guard/64-call reviewed Mock/static；
- R5 controlled-Live、R6 产品 Docker/API/可见浏览器、R7 main；
- Task 10/11、Phase 6.9.8 收口与后续阶段；
- Qwen/DeepSeek 外部健康、真实语义、P95、verified aggregate token/CNY、产品、SLA 或生产 authority。

## 11. 停止边界

- 禁止重跑、resume、replay、backfill、seal 或修改 Task 9C；
- 禁止 curl、单 case、产品 API 或其它 Provider 探测；
- 不读取 `.env`/credential，不创建 approved tag 或正式 Recovery evidence；
- 不启动 Docker/API/browser，不修改产品 gate、业务数据、BackgroundJob 或 Outbox；
- R2 独立提交并推送后，当时下一步只能开始 R3 zero-provider runner / durability / admission；R3/R4 后续已完成，
  当前下一步仅 R5 fresh admission（未授权、未开始）；
- 不得提前执行 R5--R7、Task 10/11、main 或后续 Phase。

## 12. 回顾时可以问

- 为什么 Qwen 与 FinalResponse 必须使用不同 wire family 和阶段序列？
- 为什么调用方不能直接上报 `response_observed` 或 verified usage？
- 为什么 embedding 的 count/index、dimension 与 finite/non-zero value 要分别分类？
- 为什么第一条畸形 stream event 是 `response_observed + stream_event_invalid`？
- 为什么 empty stream 才是 `response_not_observed`？
- 为什么 citation/Trace/cost/delivery mapper 在 R2 通过后仍不是 durability 或数值 authority？
- 为什么测试中的 synthetic first-party adapter 不能证明 Provider、真实语义或产品可用？
- 为什么 R2 新诊断不能反向补全 Task 9C 的 sealed failure？

## 13. 后续状态（2026-08-06）

R3 已以
`zero_provider_retriever_final_response_architecture_recovery_runner_durability_admission / qualityAuthority=none`
完成独立 report/runner、三个模块私有 observation authority、source admission、durability、strict validator 与
zero-provider maintenance CLI；正式 approved tag/marker/journal/artifact/recovery claim 均为 0。R2 的 source、
authority 与测试结论未被改写。R3 证据见
[R3 zero-provider runner/durability/admission](./phase-6-9-8-retriever-final-response-architecture-recovery-r3-runner-durability-admission.md)。
