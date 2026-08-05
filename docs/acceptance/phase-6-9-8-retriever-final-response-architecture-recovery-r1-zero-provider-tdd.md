# Phase 6.9.8 Retriever / FinalResponse Architecture Recovery R1 验收

## 1. 结论

R1 已以
`zero_provider_retriever_final_response_architecture_recovery_tdd / qualityAuthority=none`
完成 strict bounded diagnostic contract、opaque rewrite session、第一方 wire snapshot 只读投影与 rewrite
zero-provider TDD。

本阶段解决的是“以后怎样把 rewrite 的失败定位到固定 stage/reason，同时不保存 raw”，不是 Qwen/FinalResponse
robustness、runner/durability、评测质量或产品完成。R1 收口时的下一原子任务仅为 R2 zero-provider Qwen /
FinalResponse robustness；R2 后续已独立完成，未改写本验收的 R1 authority。

## 2. 实现范围

R1 新增：

- `phase-6.9.8-retriever-final-response-bounded-diagnostic-v1` strict schema；
- rewrite 专属的 module-owned WeakMap session/capability；
- admission -> request -> Provider dispatch/response/envelope -> runtime result -> candidate projection -> local
  authority -> Trace -> usage -> cost -> call result -> applied 单调阶段机；
- transport、HTTP、envelope、usage、runtime、candidate、local authority、Trace、cost 与 result 的固定失败分类；
- exact-object、deep-freeze、hostile getter/Proxy/symbol/non-plain 与 no-raw/no-hash 测试；
- `@repo/ai` 的只读 `readPhase697V7WireSnapshot()` 公共出口。

R1 没有新增 CLI、source admission、marker、journal、artifact、validator、approved tag、授权文本、环境变量或产品
gate。

## 3. Provider authority 修复

早期 R1 草案允许调用方传入 Provider dispatch/response/envelope/usage 状态，独立安全复审指出这会伪造
`response_observed`。最终实现已删除这组 caller-supplied 状态：

1. rewrite session 创建时必须绑定一个真实、尚未使用且未被其它 session 绑定的 V7 wire capability；
2. forged/version-only、duplicate/reused 与已经开始执行的 capability 均 fail-closed；
3. Provider observation 只能读取第一方 direct adapter 的 terminal frozen snapshot；active snapshot 不推进阶段；
4. dispatch/response/verified-usage counter、failure category、stage prefix 与 usage disposition 必须互相一致；
5. `providerBoundary` 只能由该 snapshot 单调推进为 `dispatched_no_response`、`response_observed` 或
   `response_and_usage_observed`；
6. `claim/advance/fail/abort/complete` mutation 仍不从 `@repo/ai` barrel 导出。

Synthetic success/fault TDD 真实穿过第一方 DeepSeek V4 Pro direct adapter 的 injected fetch；它不访问网络，adapter
provenance 固定为 `synthetic_test`。

## 4. Diagnostic contract

最终 diagnostic 只允许：

- `diagnosticVersion`；
- fixed `callPhase / stage / reasonCode / providerBoundary`；
- fixed `topLevelTypeBucket / fieldCountBucket / terminalCountBucket`；
- `rawDataRetained=false`。

它禁止 unknown field、free text、raw、raw-derived hash、Provider body、query/prompt、rewrite value、credential、URL、
raw error、stack、Zod path/value 与 hostile accessor 结果。`applied` 是唯一成功 terminal reason，但只表示当前 call
完成 R1 strict 本地合同，不表示整份 gate、产品或 main 通过。

## 5. 当前诚实边界

R1 的 Provider dispatch/response/usage authority 已绑定第一方 wire snapshot；但包内 runtime result、candidate、local
authority、Trace、cost 与 call-result mapper 仍由 recovery 模块内调用方提交 fixed status。它们：

- 不进入 `@repo/agent` 公共 barrel；
- 不携带 Provider/model/price/token/CNY、Trace body 或业务值；
- 不能单独形成数值 Provider authority、durability authority 或质量 authority；
- 必须在未来 R3 由 source-admitted runner、strict result/Trace/cost validator 与 durability lifecycle 绑定后，才可能
  进入正式 evidence。

因此 R1 不能被描述为 runner 已可信、正式 evidence 已建立或真实 Agent 已可用。

## 6. Task 9C 不可变性

本阶段只读重放原 validator，未运行 Task 9C CLI/seal/recovery，也未写入旧 namespace。结果保持：

- run：`28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2`；
- gate：`task9_quality_gate_failed / qualityAuthority=none`；
- journal：`134 / evidence_published`；
- report logical SHA：`c612d6f7164d5491e54422abb2e8504cbb707aeea3b641e8c57285d957b8b4a4`；
- physical artifact SHA：`7d45329debde6def4c5bc8bbda28609b507a71766ae06e00806e44eaf7b3614c`；
- validator：`ok=true`。

R1 不恢复 Task 9C 的 Provider response，不改变 `schema_invalid / wire 1/1/0/0` 事实，也不将其归因到具体 JSON、
transport、账号或服务端。

## 7. Authority 与副作用计数

| 项目                                          |   R1 结果 |
| --------------------------------------------- | --------: |
| External Provider calls                       |       `0` |
| DeepSeek/Qwen network calls                   |     `0/0` |
| Credential reads                              |       `0` |
| Task 9C evidence writes                       |       `0` |
| Recovery formal marker/journal/artifact/claim | `0/0/0/0` |
| New CLI/tag/admission                         |   `0/0/0` |
| Docker/API/browser                            |   `0/0/0` |
| Business/BackgroundJob/Outbox writes          |   `0/0/0` |
| Quality authority                             |    `none` |

测试中的 injected fetch invocation 是 `synthetic_test`，不是外部 Provider call，也不读取真实 credential。

## 8. 验证结果

| 检查                                   | 结果                                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| R1 focused + public barrel isolation   | `11/11`；3 files；152 assertions                                                                                     |
| First-party V7 wire + AI export parity | `25/25`；2 files；361 assertions                                                                                     |
| Agent full                             | `1289/1289`；159 files；23185 assertions                                                                             |
| Agent typecheck / source lint          | 通过 / 通过                                                                                                          |
| AI typecheck / lint                    | 通过 / 通过                                                                                                          |
| Task 9C sealed bundle validator        | `ok=true`；run `28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2`；journal `134 / evidence_published`；两个 SHA 与封存值完全一致 |
| Prettier                               | 通过                                                                                                                 |
| 仓库 Markdown 相对链接                 | `349 files / 184 links / missing=0`                                                                                  |
| stale / secret / raw 扫描              | 无命中                                                                                                               |
| `git diff --check`                     | 通过                                                                                                                 |
| CodeGraph                              | `Already up to date`                                                                                                 |
| 独立安全复审                           | Provider boundary 无 blocker；记录包内 mapper 尚待 R3 runner/validator 绑定的 non-blocking 诚实边界                  |

## 9. R1 收口时明确未完成

- R2 Qwen embedding/ranking 与 FinalResponse stream/terminal/citation robustness（后续已独立完成）；
- R3 source admission、report/runner/CLI、marker/journal/artifact/validator/crash-only seal（后续已独立完成）；
- R4 64-call reviewed Mock/static；
- R5 controlled-Live、R6 产品验收、R7 main；
- Task 10/11、Phase 6.9.8 收口与后续阶段。

## 10. 停止边界

- 禁止重跑、resume、replay、backfill、seal 或修改 Task 9C；
- 禁止 curl、单 case、产品 API 或其它 Provider 探测；
- 不读取 `.env`/credential，不创建 approved tag 或正式 Recovery evidence；
- 不启动 Docker/API/browser，不修改产品 gate、业务数据、BackgroundJob 或 Outbox；
- R1 提交并推送后，当时下一步只能开始 R2 zero-provider Qwen / FinalResponse robustness；R2/R3 现已完成，
  当前下一步仅 R4 zero-provider reviewed Mock/static。

## 11. 回顾时可以问

- 为什么 caller-supplied `response_observed` 会破坏 Provider authority？
- 为什么只读 snapshot 可以公开，而 wire mutation transition 仍必须留在包内？
- active、forged 和 reused capability 分别怎样 fail-closed？
- 为什么 `applied` 只代表单 call contract 成功，不代表质量门或产品成功？
- 为什么 R1 的包内 mapper 仍不能算 runner/durability authority？
- 为什么 Task 9C validator 可以只读重放，但 CLI/seal 绝不能再执行？

## 12. 后续状态（2026-08-06）

R2 已以
`zero_provider_retriever_final_response_architecture_recovery_robustness / qualityAuthority=none` 完成 Qwen /
FinalResponse 第一方 wire diagnostics 与 zero-provider robustness；R3 又以
`zero_provider_retriever_final_response_architecture_recovery_runner_durability_admission / qualityAuthority=none`
完成独立 runner/durability/admission。R1 的 source、authority、测试结果和 Task 9C 不可变性均未重写；当前只
解锁 R4 reviewed Mock/static。证据见
[R2 zero-provider Qwen / FinalResponse robustness](./phase-6-9-8-retriever-final-response-architecture-recovery-r2-zero-provider-robustness.md)
与 [R3 zero-provider runner/durability/admission](./phase-6-9-8-retriever-final-response-architecture-recovery-r3-runner-durability-admission.md)。
