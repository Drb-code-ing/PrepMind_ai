# Phase 6.9.7 Tutor / Organizer Full-gate Schema Recovery SR4 Reviewed Mock / Static 验收

日期：2026-08-02

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

结论：SR4 已完成并通过 zero-provider reviewed Mock/static checkpoint。该结论只具有
`schema_recovery_mock_quality_not_evidence / qualityAuthority=none`，不证明 DeepSeek Provider、真实模型语义、
产品 API、可见浏览器或生产可用。该 checkpoint 当时只解锁 SR5 fresh admission；本任务没有创建
admission、approved tag、正式 marker/journal/artifact，也没有授权或启动 SR5。其后 SR5 已独立通过并封存，
但不改写本页 Mock-only authority；该 checkpoint 当时只解锁 SR6。SR6 后续已以 `providerCalls=0` 完成，
SR7 main/default-off 验收也已完成；Phase 6.9.7 已收口，当前下一阶段仅 Phase 6.9.8。

## 1. 为什么需要 SR4

SR1 证明新的 Tutor envelope/parser、selection projection 与 strict local merger 可以工作；SR2 证明它能在
Provider-like、held-out、metamorphic、schema-negative、abort/fault 矩阵下 fail-closed；SR3 证明新的固定分母
runner、schema-stage journal、artifact 与 validator 可以 durable 收口。但三者仍未把完整 72-case full gate
从输入、candidate、第一方 adapter、本地 authority/merger 一直走到 SR3 publication。

SR4 的职责是补齐这条 zero-provider 端到端证据，并回答：

- 24 个 guard 是否仍然实际 zero-call；
- 48 条 runtime lane 是否全部进入唯一一次 synthetic dispatch、response 与 verified usage；
- extension field 是否被透明计数并丢弃，而不是被隐藏或扩大模型权限；
- Tutor Schema Recovery 与 Organizer V9 能否在同一 pair/fixed denominator runner 中安全协作；
- fault、abort、sibling settlement、breaker、durability 与历史 lineage 是否仍 fail-closed；
- Mock 满分是否仍被 authority 阻止冒充真实模型质量。

## 2. 本次交付

新增：

- `packages/agent/src/evals/phase-6-9-tutor-organizer-schema-recovery-mock.ts`；
- `packages/agent/tests/phase-6-9-tutor-organizer-schema-recovery-sr4-reviewed-mock.test.ts`。

固定身份：

| 项目                | 值                                                                 |
| ------------------- | ------------------------------------------------------------------ |
| Factory version     | `phase-6.9.7-tutor-organizer-schema-recovery-reviewed-mock-v1`     |
| Factory SHA-256     | `8f18c1c2a73790818f63b64e0da67852900d341c99b9f599e9838eba41c93d44` |
| Checkpoint SHA-256  | `03bb81a65b0ae838646191fb58abf2dcf0af73f5e720812b5789a185afcb6960` |
| Executor provenance | `mock_synthetic`                                                   |
| Gate                | `schema_recovery_mock_quality_not_evidence`                        |
| Quality authority   | `none`                                                             |

Tutor extension-field cases 固定为 `04/08/12/16/20/24`。这些 case 只能形成
`extension_fields_discarded` diagnostic；extension sentinel、原始字段名和值都不能进入 candidate result、report、
journal、Trace 或产品数据。

## 3. 端到端路径

```text
72-case frozen full-gate manifest
  -> 24 guards：本地 guard authority，runtime/provider counter = 0
  -> 24 runtime pairs / 48 lanes
       -> Tutor：Schema Recovery envelope/parser
          -> canonical integer intentIndex selection projection
          -> strict projected decision
          -> Tutor V6 local signal / preferred depth / permission / merger
          -> first-party DeepSeek V4 Pro direct adapter + sealed synthetic fetch
       -> Organizer：V9 local legal option authority
          -> exact questionIndex + optionIndex selection
          -> V6 validator / merger / locked-name / no-write authority
          -> first-party synthetic adapter
       -> SR3 fixed-denominator runner
          -> schema-stage lifecycle + eight-stage wire lifecycle
          -> local semantic scorer / L2 anchor / P95 / verified usage / CNY
          -> isolated temporary durability publication + strict bundle recomputation
```

Expected/oracle 只进入运行完成后的 scorer。Synthetic responder 只读取实际 bounded request，不导入 expected、
oracle、scorer、dataset answer table 或 production validator 来生成答案。

## 4. Reviewed Mock 固定结果

| 维度                                                             | 结果                                        |
| ---------------------------------------------------------------- | ------------------------------------------- |
| cases / guards / runtime lanes / pairs / Organizer decisions     | `72 / 24 / 48 / 24 / 32`                    |
| runtime reserved / terminal / orphan / not-started               | `48 / 48 / 0 / 0`                           |
| executor / dispatch / response / verified usage                  | `48 / 48 / 48 / 48`                         |
| schema canonical / extension-discarded / rejected / not-observed | `42 / 6 / 0 / 0`                            |
| Tutor semantic                                                   | `1`                                         |
| Organizer semantic                                               | `0.9968750000000001`                        |
| Combined semantic                                                | `0.9984375000000001`                        |
| L2 anchor combined                                               | `1`                                         |
| input / output tokens                                            | `17732 / 654`                               |
| estimated cost                                                   | `0.05712 CNY`                               |
| safety / permission / mutation / broader fallback                | `0 / 0 / 0 / 0`                             |
| locked-name changes / write-command leaks                        | `0 / 0`                                     |
| breaker                                                          | `closed / null`                             |
| final gate                                                       | `schema_recovery_mock_quality_not_evidence` |
| quality authority                                                | `none`                                      |

四项 24-sample nearest-rank P95 均通过 P2 frozen threshold；Mock 不产生产品/API/最终流式 Chat SLA authority。

## 5. Schema Recovery 与权限边界

- Tutor 最多一次 runtime invocation；`maxCalls=1` 与 single-invoke guard 双重约束，不 retry；
- 只有 canonical own-data safe integer `intentIndex` 获得 selection authority；missing、alias、string、fraction、
  null、range、duplicate、wrapper、fence、BOM、trailing 与结构超限仍拒绝；
- extension scalar/object/array 只形成 fixed stage/reason/type/count/shape diagnostic，随后丢弃；
- Tutor depth、answer structure、`answer_direct`、route、tool 与 permission 继续由本地 authority 重建；
- Organizer 只返回本地预枚举 option ordinal；owner、真实 ID、subject、deck、locked name、stale fence 与写命令
  继续由本地掌握；
- global `fetch` 被测试替换为失败 canary 后仍保持 `0` 次调用，证明 production/global network delegate 未被触碰；
- prompt scan 证明 case id、expected intent/depth、accepted labels、pair index 与未来 SR5 credential name 均未进入
  request bytes。

## 6. Fault、Abort 与固定分母

SR4 覆盖 malformed completion JSON、missing usage、fetch reject 与 Organizer ordinal type drift：

- 当前 pair 两条 sibling lane 都恰好收口一次；
- failed lane 使用固定 failure category，raw error/provider body 不进入 report；
- breaker 在 pair terminal 后打开，其余 46 lane 固定 `not_started`；
- runtime accounting 保持 `2/2/0/46`，不会丢失或伪造 denominator；
- schema/semantic/P95/CNY 在完整性不足时回到 `not_observed/null`；
- pre-abort 保持 reservation/dispatch `0`、48 条 schema `not_observed`，不创建 executor。

临时目录 publication 复用 SR3 durability：24 guard terminal、48 reservation、48 schema started/succeeded、
384 wire stage、48 lane terminal、24 pair terminal，最后严格以
`run_terminal -> publication_started -> evidence_published` 收口。Strict validator 重新计算 artifact SHA、journal
hash-chain、schema/wire/usage/semantic/breaker 与 publication；测试结束后临时目录精确删除。

## 7. 历史与 Lineage 不变性

- 旧 F1/F2/S3/L3 contract、runner、validator、sealed bytes 与 source identity 未修改；
- old full-gate report 不能被 Schema Recovery parser 接受，Schema Recovery report 也不能被旧 schema 接受；
- 旧 L3 bundle 继续为 `ok=true / journalRecords=296 / evidence_published`，physical artifact SHA 保持
  `e081939b...dbe5`；
- `.tmp` 下正式 `phase-6-9-7-tutor-organizer-schema-recovery-sr5-*` 文件为 0；
- `phase-6-9-7-tutor-organizer-schema-recovery-sr4-approved` tag 为 0；
- 没有 retry/resume/replay/backfill、seal/recovery 或追加 Provider 探测。

为恢复 Web 静态门，先以独立提交 `2f649a96` 将 Architecture Recovery 的 Node-only diagnostic/durability
模块从共享 `@repo/ai` root barrel 移除；原文件、package scripts、直接导入测试与 sealed contract/SHA 均保留。
该修复不改变任何历史 evidence，只阻止 Next ES2017 build 扫描 server-only BigInt/Node contract。

## 8. 验证证据

| 验证                                           | 结果                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| SR4 focused                                    | `9/9`，`506` assertions                                               |
| SR1--SR4、F1/F2/S3、small-sample compatibility | `201/201`，`5734` assertions                                          |
| Agent full / typecheck / lint                  | 通过                                                                  |
| AI full / typecheck / lint                     | 通过                                                                  |
| Types test / typecheck                         | 通过                                                                  |
| Web full test / lint / production build        | `439/439`，通过                                                       |
| Server full test                               | `227` suites passed / `3` skipped；`2154` tests passed / `30` skipped |
| Server operator-audit PostgreSQL integration   | `1/1`，通过                                                           |
| Organizer PostgreSQL concurrency E2E           | `12/12`，通过                                                         |
| Server build / lint                            | 通过                                                                  |
| Compose quiet config + default-off boundary    | `24/24`，通过                                                         |
| Reader Testing                                 | `APPROVED`，无 Critical/Important/Minor                               |
| Contract/Security review                       | `APPROVED`，无 Critical/Important/Minor                               |

只启动既有 Docker Desktop、PostgreSQL 与 Redis 容器完成数据库回归；没有 build/start `server/web/worker/admin`，
没有 Docker product API 或可见浏览器验收，也没有执行 `down`、prune、volume reset、数据库重置、Redis flush 或
MinIO wipe。

## 9. Zero-provider 与副作用清单

- `.env` / credential read：`0`；
- global fetch / Provider call：`0`；
- production network delegate：`0`；
- 正式 SR5 approval/confirmation/marker/journal/artifact/recovery claim：`0`；
- approved tag：`0`；
- 产品 Docker service / API / browser：`0`；
- 正式业务写入：`0`；
- `.codex/`：保持既有本地未跟踪状态，不进入提交。

## 10. 后续状态与停止门

SR4 完成时只解锁 SR5 fresh admission。开始 SR5 前当时必须另行证明：

1. SR4 commit 已推送，tracked clean，HEAD/upstream/remote parity；
2. 新 approved source tag 精确绑定同一 commit 并完成 remote parity；
3. source manifest、factory/checkpoint 与全部 frozen SHA 一致；
4. 历史 sealed validators/SHA parity；
5. 正式 SR5 marker/journal/artifact/recovery claim 为 0；
6. fresh zero-provider proxy preflight ready；
7. 用户重新接受当次 DeepSeek 数据保留/训练边界；
8. 用户给出新 lineage 的 exact authorization；
9. 专用 credential 只在上述门之后进入唯一独立进程。

这些条件随后已独立满足。唯一 SR5 run `63f8a76b...04cb` 已以
`schema_recovery_quality_gate_passed / schema_recovery_full_gate_semantic_gate` durable seal；它不改写本 SR4
Mock-only authority、旧 L3 或任何历史 evidence，也不形成产品 authority。SR5 一次性名额已消费，禁止任何
重跑或追加 Provider 探测。该 checkpoint 当时只解锁 SR6；SR6 随后已以 `providerCalls=0` 完成分支产品验收
且不提升 SR5 semantic authority。SR7 main/default-off 验收随后完成且未重跑 SR5 或启用 SR6 replay；
Phase 6.9.7 已收口，当前下一阶段仅 Phase 6.9.8，Phase 6.10/8/9 与博客收尾继续阻断。
最新验收见
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-r5-controlled-live-quality-gate-pass.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-sr6-product-acceptance.md` 与
`docs/acceptance/phase-6-9-7-tutor-organizer-full-gate-schema-recovery-sr7-main-acceptance.md`。

回顾时可以问：

- 为什么 extension fields 可以丢弃，但 missing/alias/type/range 仍必须 fail-closed？
- 为什么 `42 canonical + 6 extension discarded` 比笼统的 `48 schema pass` 更有审计价值？
- 为什么 synthetic adapter 也要经过第一方 request/response/usage wire contract？
- 为什么 SR4 semantic 接近满分仍然只能是 `qualityAuthority=none`？
- 为什么 fault 后要先收口 sibling，再打开 breaker 并保留固定 48-lane denominator？
- 为什么 SR4 完成后仍必须另做 SR5 fresh admission，而不能把“继续”当成 Provider 授权？
