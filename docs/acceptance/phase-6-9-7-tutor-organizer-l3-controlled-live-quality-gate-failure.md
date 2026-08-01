# Phase 6.9.7 Tutor / Organizer Full-gate L3 Controlled-Live 失败验收

日期：2026-08-02

状态：唯一 L3 已以 `full_gate_quality_gate_failed` 正常封存；不得重跑，产品验收与后续阶段继续阻断

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

## 1. 结论

用户在本次 admission 中重新接受 DeepSeek 当前账号的数据保留/训练边界，并给出 L3 exact
authorization。唯一 controlled-Live run：

```text
runId: 2b0ac3a0-631f-4c7f-9781-ce0cda94149a
mode / provenance: live / deepseek_network
gate: full_gate_quality_gate_failed
qualityAuthority: none
evidenceSealed: true
```

本次不是 transport failure，也不是 runner 崩溃。前 22 条 runtime lane 均进入 executor、发起 Provider
dispatch 并收到 response；其中 21 条完成 strict schema 与 verified usage。`tutor-v2-runtime-11` 在 response
audit 和 JSON content parse 后未通过 strict schema，runner 以 `schema` 打开 quality breaker，剩余 26 条
runtime lane 没有启动。完整 48-lane 分母未完成，因此正式 semantic、P95、token 与 CNY aggregate 全部为
`null`，不能形成真实 Agent 质量 authority。

## 2. Admission 与 source authority

执行前完成并通过：

- tracked worktree clean；`.codex/` 仍是未跟踪本地目录，不属于交付；
- `HEAD == upstream == remote == approved tag commit`，均为
  `3c5cc6c57fdf6d3366ac695d3305e2cc85fd2599`；
- approved ref 为
  `refs/tags/phase-6-9-7-tutor-organizer-full-gate-s3-approved`，本地与远端一致；
- 七个 Tutor / Organizer / adapter source SHA 与 F1 冻结值完全一致；
- V1--V9 sealed artifact validators 均为 `ok=true / filesChecked=1`；
- Recovery R3、Provider Canary V2 L1、Small-sample L2 bundle validators 均为 `ok=true`；
- L3 正式 marker/journal/artifact/recovery claim 在 reservation 前为 `0/0/0/0`；
- fresh zero-provider proxy preflight 为
  `direct_ready / configuredProxyVariables=0 / listenerProbeCalls=0 / providerCalls=0`。

`direct_ready` 只证明当前进程没有配置受治理 proxy；它不证明 DNS、TLS、DeepSeek、账号、余额、模型权限、
限流或服务端健康。根 `.env` 的通用 DeepSeek credential 只在唯一独立进程内映射为 L3 专用变量，值没有
输出、写回、提交或进入 marker/journal/artifact。

## 3. 固定分母与实际执行

| 项目                                                | L3 结果                     |
| --------------------------------------------------- | --------------------------- |
| Guard zero-call                                     | `24/24`                     |
| Runtime reserved / terminal / orphan / not-started  | `22 / 22 / 0 / 26`          |
| Executor / dispatch / response / verified usage     | `22 / 22 / 22 / 21`         |
| Strict runtime success                              | `21/48`                     |
| Provider invocations / verified runtime cases       | `22 / 21`                   |
| Tutor / Organizer / Combined semantic               | `null / null / null`        |
| L2 anchor Tutor / Organizer / Combined              | `null / null / null`        |
| Tutor / Organizer / paired / orchestration P95      | `null / null / null / null` |
| Input / output token aggregate                      | `null / null`               |
| Estimated cost aggregate                            | `null`                      |
| Critical / permission / mutation / broader fallback | `0 / 0 / 0 / 0`             |
| Locked-name change / write-command leak             | `0 / 0`                     |

前 10 个 pair 的 Tutor 与 Organizer 共 20 条 lane 全部 strict success。Pair index `10` 中：

- `organizer-v2-runtime-11` 正常完成并观测 verified usage；
- `tutor-v2-runtime-11` 为 `attempted_failed / schema`，wire `1/1/1/0`，usage 与 semantic 为 `null`；
- journal 已记录 `provider_response_received -> response_audit_passed -> content_parsed`，没有进入
  `schema_validated / usage_verified / response_returned`；
- pair 关闭后 breaker 固定为 `opened=true / reason=schema`；
- pair index `11..23` 的 26 条 lane 固定为
  `not_started_quality_breaker / quality_breaker / wire 0/0/0/0`。

当前证据只把失败定位到 strict schema boundary，未保存可用于进一步归因的原始 Provider 内容。不得猜测为
prompt、某个字段、Provider 版本、网络、账号或服务端的唯一根因。

## 4. Durability 与不可变证据

正式文件：

```text
.tmp/phase-6-9-7-tutor-organizer-full-gate-l3-controlled-live.marker
.tmp/phase-6-9-7-tutor-organizer-full-gate-l3-controlled-live-2b0ac3a0-631f-4c7f-9781-ce0cda94149a.journal.jsonl
.tmp/phase-6-9-7-tutor-organizer-full-gate-l3-branch-controlled-live-2b0ac3a0-631f-4c7f-9781-ce0cda94149a.json
```

证据摘要：

```text
marker SHA-256: ed0648d3a69adeeb7974dfad9426990173ae83dbc471f45ff504a7704508ebb8
journal SHA-256: e8f9046ab2bea39c725b767102b2c753f258a917fa592758c95268f3455cd6ef
report logical SHA-256: 595e9fce929aa1cbfe3ed3982edd27fcf81f9672395ba070328b4c869f974683
physical artifact SHA-256: e081939bb7f4b17235b1d9afb61d78031879bb80b9d64c952e4b86531cd7dbe5
journal records: 296
terminal sequence: 294
final event: evidence_published
completion / publication mode: runtime / runtime
recovery claim: null / 0
```

`source.formalArtifactCount=0` 是 reservation 前 source reader 的准入事实，不表示运行后没有证据。运行后恰好
存在 marker、单条 journal 与单条 branch artifact，且没有 recovery claim。

只读复核命令：

```powershell
bun run --cwd packages/agent eval:phase-6-9-7:full-gate:validate
```

期望摘要：

```text
ok=true
runId=2b0ac3a0-631f-4c7f-9781-ce0cda94149a
gate=full_gate_quality_gate_failed
qualityAuthority=none
journalRecords=296
finalJournalEvent=evidence_published
physicalArtifactSha256=e081939b...d7dbe5
```

该命令只读现有 bundle，不读取 credential 或调用 Provider。禁止运行 `full-gate:live`、
`full-gate:seal`、production CLI、单 case、curl 或其它 Provider 探测。

## 5. 本次能够证明什么

本次能够证明：

- 固定 branch/tag/source/SHA/approval/credential/reservation 前门实际工作；
- 24 条 guard 实际保持 zero-call；
- 22 条真实 `deepseek_network` lane 完成 dispatch 和 response observation；
- 其中 21 条完成 strict runtime 与 verified usage；
- schema contract failure 在 pair close 后打开 breaker，剩余 26 lane 没有误启动；
- 固定 48-lane 分母、incomplete aggregate、no-orphan 与安全计数正确；
- 正常 runtime publication、hash-chain journal、hard-link artifact 与 strict validator 工作。

本次不能证明：

- TutorAgent / WrongQuestionOrganizerAgent 完整真实语义质量或项目内可用；
- full-gate semantic、L2 anchor、24-sample P95、SLA 或生产性能；
- 完整 token、费用或 Provider 账单；
- 产品 Docker/API/可见浏览器、Trace、业务写入或 main 可用；
- Provider/network/account/model 的整体健康或 schema failure 的更细根因。

S3 Mock 的 `48/48` 与本次 21 条 strict success 不能拼接成通过；Small-sample L2 的成功 authority 也不能替代
本次完整 full-gate failure。

## 6. 停止门与下一步

L3 一次性名额已经消费。永久禁止对本 identity 执行 retry、resume、replay、backfill、Live、seal、recovery、
删除、覆盖、移动或重建证据，以及任何追加 Provider 探测。

因为 `qualityAuthority=none`，以下任务继续阻断：

- R6 产品 Docker/API/可见浏览器与测试账号/Trace 验收；
- R7 main 合并、main replay 与远程 main 推送；
- Phase 6.9.8、6.9.9、6.9.10、Phase 6.10、Phase 8/9 与博客收尾。

若继续修复，只能先建立新的、独立的 zero-provider schema diagnostics / remediation 设计；它不得改写本 L3
证据或把同一 manifest 包装成重跑。任何未来 Provider 调用都需要新的 lineage、预算、source admission、运行时
数据边界接受与 exact authorization。

## 7. 回顾问题

- 为什么收到 Provider response 仍可能没有 verified usage？
- 为什么一条 schema failure 会让 semantic、P95、token 和 CNY aggregate 全部为 `null`？
- 为什么 Organizer sibling 成功后仍不能继续后续 pair？
- 为什么 `direct_ready` 不是 Provider health authority？
- 为什么 S3 Mock 与 L3 部分成功不能拼成 full-gate pass？
- 下一步为什么必须先做 zero-provider diagnostics，而不能直接重跑 L3？
