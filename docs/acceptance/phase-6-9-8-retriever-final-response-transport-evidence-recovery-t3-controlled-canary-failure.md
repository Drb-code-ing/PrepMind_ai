# Phase 6.9.8 Retriever / FinalResponse Transport Evidence Recovery T3

## Controlled canary 终态与 durable seal

> 日期：2026-08-07
> 分支：`drb/phase-6-9-8-retriever-final-response-contract`
> 执行时 source commit：`2423baf3768c245d2e4d6ea0038c6fb1bf8f9bc7`
> runId：`075e2d5f-682b-426d-847e-f5a6ce5b97c6`
> authority：`controlled_live_transport_evidence_t3`
> qualityAuthority：`none`
> gate：`transport_evidence_t3_controlled_canary_failed`

## 1. 授权与不可变边界

本次运行收到新的、精确的一次性授权：

```text
I_ACCEPT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_EVIDENCE_T3_DEEPSEEK_AND_QWEN_DATA_BOUNDARY
I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_EVIDENCE_T3_CONTROLLED_CANARY_ONCE
```

T3 只回答“三个第一方 adapter 是否能进入受限 transport/evidence 边界”，不回答 Agent 语义质量。固定调度为：

```text
DeepSeek rewrite -> Qwen embedding -> DeepSeek FinalResponse stream
```

每个 slot 最多一次，最多 3 个 Provider slot，总预算上限 `0.024096 CNY`。首个失败打开 breaker，后续 suffix
只按固定分母记录为 `not_started_quality_breaker`；禁止 retry、resume、replay、backfill、curl、单 case 或追加
Provider 探测。T3 不接入 `/api/chat`，不写业务表、Trace、BackgroundJob 或 Outbox，不解锁 Docker/API/browser、
`main`、Task 10/11 或后续阶段。

## 2. Gate 顺序

生产 CLI 的 gate 顺序保持不变：

```text
argv
  -> source admission
  -> T2 gate binding
  -> fresh proxy preflight
  -> DeepSeek/Qwen data-boundary acceptance
  -> exact authorization
  -> durable reservation
  -> late-bound credential gate
  -> Provider slots
```

本次 source admission 在 credential 读取前通过：branch、HEAD、tracking、origin、approved ref 完全一致，工作树干净，
formal artifact count 为 `0`，T2 gate 为 `transport_evidence_t2_zero_provider_passed`，source bundle SHA 为
`98978b0e7022bf95e7ac8b615a68d9e5fa0edeb0007e2e246738cb762e187622`。Fresh proxy receipt 为
`direct_ready`（`listenerProbeCalls=0`）；nonce 只以 SHA-256 保存：
`9446c4c76cbbba0bee3bccb11131c2605232f7ce9e0034232dcc0528d09dec51`。

## 3. 实际结果

| 指标                                | 结果                                                      |
| ----------------------------------- | --------------------------------------------------------- |
| gate / breaker                      | `transport_evidence_t3_controlled_canary_failed` / `open` |
| breaker reason                      | `configuration`                                           |
| planned / started / completed slots | `3 / 0 / 0`                                               |
| suffix                              | `notStartedQualityBreaker=3`，`notStartedExternalAbort=0` |
| Provider calls                      | `0`                                                       |
| credential reads                    | `0`                                                       |
| verified usage slots / cost         | `0 / null`                                                |
| semantic / P95 / token authority    | 全部 `null`                                               |

三个 slot 均以同一 bounded 终态收口：`disposition=not_started_quality_breaker`、
`failureCode=configuration_invalid`，没有 dispatch、response 或 usage。

## 4. 失败定位与影响

已封存的事实是：失败发生在 durable reservation 之后、首个 Provider slot 之前的 late-bound credential gate，
终态为 `configuration_invalid`，没有 slot 启动。静态复盘把“执行入口未显式绑定仓库根 `.env`”列为待修复的
CLI/configuration composition 风险，但这不是由本次 sealed evidence 唯一证明的根因；因此不能把它写成确定的环境、
凭据或 Provider 诊断，也不能将该结果归类为 Provider transport 失败。

因此本次证据不能推测 DNS、TLS、代理、账号、余额、模型权限或服务端根因，也不能证明 DeepSeek、Qwen、Retriever 或
FinalResponse 的真实可用性。一次性 reservation 已消费，但由于没有 slot 启动，实际 Provider 成本为 `0`。

随后补充了生产脚本的显式环境边界（提交 `3d903055`，已推送）：受控脚本使用
`bun --env-file=../../.env`（从 `@repo/agent` 包目录解析仓库根 `.env`），并增加了只允许 crash-only seal 的独立 CLI。
这是未来新 lineage 的防回归措施，不是对本次根因的追溯证明；该修复不能、也不会用于重跑本次 T3。

## 5. Durable evidence

运行进程退出后，按 crash-only 规则封存了“配置失败且未启动 slot”的固定报告；没有重建成功结果，没有读取 raw response，
也没有执行 Provider recovery。

| 证据                      | 值                                                                 |
| ------------------------- | ------------------------------------------------------------------ |
| marker / journal / report | `.tmp/` 下同一 runId 的三份文件                                    |
| journal                   | `7` 条，最终事件 `evidence_published`                              |
| report logical SHA-256    | `8d529bb78ce2fc18129e5561f1306855bbdaa6a40f8007921c3ffa0bd14875d1` |
| physical artifact SHA-256 | `50beb053475f8bb6b652624ec533347728740c60c5a3902757fa71f3a247ee9c` |
| validator                 | `ok=true`，`providerCalls=0`，`credentialReads=0`                  |
| raw retention             | `rawDataRetained=false`                                            |

根目录 hard-link artifact 由 `.gitignore` 忽略，但不删除、不改写；`.tmp` marker/journal/report 与根 artifact 必须保持
字节不可变。后续只允许验证封存包，不允许再次 seal、recovery、重放或补写。

验证命令（只读，不访问 Provider）：

```powershell
bun --filter @repo/agent eval:phase-6-9-8:transport-evidence:t3:validate
```

## 6. 阶段结论

T3 controlled canary 已完成一次性尝试并以失败终态 durable seal。它形成的是
`controlled_live_transport_evidence_t3` transport/evidence authority，`qualityAuthority=none`；Phase 6.9.8
Retriever/FinalResponse 的 semantic、产品、Docker/API/browser、Trace、SLA 与 `main` authority 仍未形成。

本 run 不得重跑。若未来需要新的真实模型证据，必须另立独立 lineage、重新做 source/data-boundary/authorization/admission，
不能复用本次 runId、marker、journal、artifact、credential 或授权；这不属于本任务的后续自动动作。

## 7. 回顾问题

1. 为什么 source admission 与 durable reservation 要早于 credential 读取？
2. 为什么 `configuration_invalid` 不能写成 DNS、代理或账号根因？
3. 为什么 `providerCalls=0` 仍不能说明 Agent 可用？
4. 为什么失败后的 crash-only seal 只能封存固定失败报告，不能恢复成功结果？
5. 为什么给 package script 增加 `--env-file` 后仍不能重跑已消费的一次性 T3？
