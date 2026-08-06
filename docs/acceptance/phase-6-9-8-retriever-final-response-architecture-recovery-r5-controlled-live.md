# Phase 6.9.8 Retriever / FinalResponse Architecture Recovery R5

## 1. 当前状态（Live 已封存）

更新时间：2026-08-06

R5 的实现、独立复审、zero-provider 回归和用户授权后的唯一 controlled-Live 已完成。Run 已正常 runtime durable seal，
但质量门失败；一次性名额已消费，不得 retry/resume/replay/backfill、seal/recovery 或追加 Provider 探测。

R5 是独立于 Task 9C、R3、R4 的新 lineage。它不会修改或重跑历史 sealed evidence，也不会把 R4 Mock authority 当成真实模型质量证据。

## 2. 目标与固定分母

一次 R5 run 固定为：

| 部分                | 数量 | Provider 行为                                                                              |
| ------------------- | ---: | ------------------------------------------------------------------------------------------ |
| critical guards     |   16 | zero-call，必须先全部通过                                                                  |
| rewrite pairs       |   16 | 每 pair 依次执行 DeepSeek query rewrite、Qwen original retrieval、Qwen candidate retrieval |
| FinalResponse       |   16 | DeepSeek streaming response                                                                |
| Provider call slots |   64 | 任一首个失败打开 breaker，剩余未启动，不补跑                                               |

质量门继续要求完整分母、双层 `runnerWire/providerWire`、verified usage/cost、semantic、P95、预算和安全门全部满足；分母不完整时正式聚合指标保持 `null`。单次预算、超时、no-retry 与 abort 规则来自冻结的 R5 eval policy。

## 3. 实现边界

- R5 CLI 只接受一个 exact authorization argv：
  `I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_ARCHITECTURE_RECOVERY_R5_CONTROLLED_LIVE_ONCE`。
- 执行顺序固定为：exact argv → source admission → DeepSeek/Qwen 数据边界 → approval → 三项专用 credential late-bind → reservation/marker → guards → 64-slot runtime → publication → validator。
- 三项 credential 只在授权 CLI 子进程内读取：
  `PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_ARCHITECTURE_RECOVERY_R5_REWRITE_DEEPSEEK_API_KEY`、
  `PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_ARCHITECTURE_RECOVERY_R5_FINAL_RESPONSE_DEEPSEEK_API_KEY`、
  `PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_ARCHITECTURE_RECOVERY_R5_QWEN_API_KEY`。主代理不读取或回显 key。
- Qwen endpoint 固定为北京区 `https://dashscope.aliyuncs.com/compatible-mode/v1`；不接受调用方替换 endpoint、fetch、transport、scorer、prompt、clock 或 expected/oracle。
- 检索 target corpus 是固定 fixture，不从 `retrievalAnchor`、`requiredTerms`、turn 或 active context 动态生成，避免评测泄漏。
- FinalResponse 的 citation ledger 严格拒绝缺失、多余、重复和重复 required citation；`suspicious + verifier unavailable` 保持保守状态，不强制升级为 trusted。
- Provider wire/runner observation 由三个模块私有 single-use capability 签发；诊断只保存固定 stage/reason/type/count，不保留 raw、URL、credential、prompt、用户正文或 raw-derived hash。
- Provider wire 成功但 usage/cost 超预算时形成 bounded budget diagnostic；reservation 后任何 runtime/publication/validation 异常都输出 `providerCalls=null` 并要求进程结束后 crash-only seal，禁止把未知调用数报告为 0。

## 4. 已完成的非 Live 证据

- R5/FinalResponse/Qwen focused：`18 pass / 0 fail / 233 assertions`。
- R5 CLI focused：`6 pass / 0 fail / 48 assertions`。
- `bun --filter @repo/agent test`：`1329 pass / 0 fail`，166 files，23645 assertions。
- `bun --filter @repo/agent typecheck`、`lint` 与 changed-files Prettier 检查通过。
- approved source commit/tag 为 `6570ce0599a519888a025192f593cd1c44b14728`；source admission 为 clean，tracking/remote/tag
  完全一致，source bundle SHA 为 `eea2377124f72e32e76aa6ae562dcae7ecddd85d7b1f76adb3e4673970440ad6`，Live 前 formal artifact=0。
- Live 前 proxy preflight 为 `loopback_proxy_ready / configured=4 / probe=1 / providerCalls=0`；三个 credential 只在授权
  子进程读取（`credentialReads=3`），没有进入产品 gate、Docker、API、browser、BackgroundJob 或 Outbox。
- 正式 CLI 启动前曾因 `.env` UTF-8 BOM 发生一次环境加载退出；它没有进入 source admission/reservation、没有
  Provider call，也不计为 controlled-Live。随后执行并封存的 run 是唯一 R5 Live。

## 5. 唯一 controlled-Live 结果

Run：`34eb99be-bdeb-41e5-85cf-3c651ecefc68`

最终状态：`architecture_recovery_quality_gate_failed`（`qualityAuthority=none`）。失败发生在第二个 rewrite pair 的
DeepSeek candidate rewrite `provider_dispatch`，bounded diagnostic 为 `stage=provider_dispatch / reasonCode=unknown /
providerBoundary=unknown / rawDataRetained=false`。sealed evidence 不能把它归因到 DNS、TLS、代理、账号、余额、模型
权限或服务端；也不能证明真实 Provider 的唯一根因。

| 维度 | 封存值 |
| --- | --- |
| guards | `16/16` pass，`16/16` zero-call |
| runner | dispatch `5`，provider executions `4`，external calls `4`，Qwen embedding invocations `3` |
| Qwen wire | runner `3/3/3/3`，provider `3/3/3/3` |
| DeepSeek wire | runner `2/2/1/1`，provider `1/1/1/1` |
| runtime terminal | `5` terminal，`4` applied，`1` failed，`59` not-started breaker |
| strict/semantic/P95 | rewrite `1/16`，FinalResponse `0/16`；正式 semantic、P95 全为 `null` |
| verified aggregate | DeepSeek/Qwen usage、费用和总费用全为 `null`（分母不完整） |
| observed completed usage | Qwen `326` input tokens / `0.000163 CNY`；DeepSeek `178/23` input/output / `0.000672 CNY`；仅为已观察前缀，不是 run aggregate |
| safety | critical/permission/cross-owner/credential/injection/false-execution/citation failure 均 `0` |
| durability | journal `237` records，final `evidence_published`，recovery claim `null`，validator `ok=true / bundle_valid` |
| artifact | SHA-256 `423e3f2e4dcb442a71a346334624642ca7c14ed898c894b5180910d04943b1e5` |

该结果只证明 R5 进入真实第一方 dispatch 后，在一个 bounded Provider dispatch 点失败并由 breaker 安全收口；不形成
Retriever/FinalResponse 语义质量、产品可用性、SLA、Docker/API/browser 或 main authority。R6 产品验收继续阻断。

## 6. Live 执行后的收口规则

1. 已完成 approved tag、source admission、proxy preflight、唯一 Live 和一次 strict validator。
2. `quality_gate_failed` 已永久封存，不 retry/resume/replay/backfill、不追加 Provider 探测、不修改 artifact。
3. 只有完整 `controlled_live` gate pass 才能进入 R6；本次失败不解锁 R6/R7、产品 Docker/API/browser、main 或后续 Phase。

## 7. 复盘问题

- 为什么 reservation 必须在 dispatch 前 durable？
- 为什么 runnerWire 与 providerWire 必须分开计数？
- 为什么缺 citation、超预算和未知 Provider 次数都必须 fail-closed？
- 为什么 R5 pass 仍不能直接声称产品或 main 已验收？
