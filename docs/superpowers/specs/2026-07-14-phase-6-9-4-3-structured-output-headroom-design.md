# Phase 6.9.4.3 Structured Output Headroom 设计

> 状态：已实施并完成 Mock/历史 evidence 验收；后续 Attempt D 达到 Router 15/16 strict success 后仍 `structured_output`，阶段继续 fail-closed

## 1. 问题与证据

2026-07-14 Attempt C 在第一个 Router eligible case 以 `PROVIDER_ERROR / structured_output` 停止。该分类由共享 Provider diagnostics 在默认 AI SDK executor 边界产生，排除了本次故障属于 auth、rate-limit、HTTP、transport 或普通 invalid-response 分类；安全合同不保存 raw output，因此不能精确断言是截断、JSON parse 还是 schema validation。

历史 Attempt A 的两条 Router strict success 分别使用 `61/120` 与 `108/120` provider-reported output tokens。第二条达到当前上限的 90%，只剩 12 tokens 余量。结合 Attempt C 的固定分类，可以形成可复核的高置信假设：120-token Router 上限对 `deepseek-v4-flash` 的真实 JSON structured output 缺少稳定余量。Verifier 尚未在 Live 中运行到，保留 180-token 上限会把同类风险推迟到整轮后半段。

## 2. 方案比较与决策

1. 直接重跑：不改任何合同，最快，但属于盲目重试，无法降低同类失败概率，拒绝。
2. 只提高 Router：改动最少，但 Verifier 仍保留未经 Live 验证的 180-token 上限，可能在第 17 个 provider attempt 后重复失败，拒绝。
3. Router / Verifier 统一提高到 400，并同步所有本地、Provider、全局与成本合同：采用。400 与已完成真实验收的 Conversation Summary 输出上限一致；它只是最大允许量，不要求模型生成满额。

## 3. 固定合同

| 边界 | Router | Verifier | 全局 |
| --- | ---: | ---: | ---: |
| local input reservation | 800 | 1,600 | 32,000 |
| local output reservation | 400 | 400 | 11,200 |
| provider input ceiling | 2,400 | 4,800 | 96,000 |
| provider output ceiling | 400 | 400 | 11,200 |
| calls | 1 | 1 | 28 |

其余合同不变：

- dataset 仍为 `phase-6.9-router-verifier-v1`，100 条固定 case；
- 只允许 16 条 Router ambiguous 与 12 条 Verifier semantic case 调用模型；72 条继续零调用；
- provider/model/prompt version 不变；
- 单 case timeout 仍为 10 秒，串行执行，`maxRetries=0`；
- Zod strict schema、reason/evidence 枚举与安全 gate 不放宽；
- Router/Verifier 继续 `enabled=false`，修复不接入 `/api/chat`；
- 历史 Attempt A/B/C evidence 不覆盖、不重算、不改写。

## 4. 成本与安全

沿用操作者已确认的 pricing snapshot：input `USD 0.147119403/1M`，output `USD 0.294238805/1M`。新 worst-case 为：

```text
96,000 × 0.147119403 / 1,000,000
+ 11,200 × 0.294238805 / 1,000,000
= USD 0.017418937304
```

它低于 `effectiveMaxCostUsd=USD 0.10`。CLI preflight 必须使用 11,200 provider output cap 重新计算成本；strict evidence contract 必须拒绝 aggregate output usage 超过 11,200，单 case 必须分别拒绝超过 400。`MAX_LIVE_RESERVATION_COST_USD` 从 4,980 调整为 5,200，以覆盖允许的最高单 case `4,800 input + 400 output` 与 CLI 单价语法上界；它不是实际预算。

## 5. 验收

- TDD：先把 candidate request、paired runner、contract 与 CLI 测试改为 400/11,200/5,200，并观察旧实现因 120/180/4,080/4,980 而失败；再修改生产常量。
- Router 与 Verifier candidate 必须向 runtime 传入 `maxOutputTokens=400`，reservation 与 sanitized Trace 同步为 400。
- complete Mock 仍为 `100/28/0/28/72`，deterministic baseline 仍为 `74/100、critical=2`。
- Agent 全量 test/typecheck/lint 与 strict Mock/历史 Live validator 通过；隐私扫描无新增正文或凭据。
- 本任务不调用真实模型。合并 main、main 复验并推送后，下一独立任务才从新的 main 发起 controlled-Live。

## 6. 回顾时可以问

- 为什么 `structured_output` 不能直接证明一定是 token 截断？
- 为什么 Router 和 Verifier 要统一到 400，而不是只修第一个失败的 Router？
- 11,200 global output cap 如何从 28 个 eligible case 推导？
- 为什么提高最大输出量没有放宽 strict schema、安全 gate 或自动重试？

## 7. 后续运行结论

Attempt D 在本设计合并后的最新 main 上执行：16 次 Router provider attempt 中有 15 次 strict success，成功 output 为 59~341，最后 `router_ambiguous_mixed_chat_16` 仍为 `PROVIDER_ERROR / structured_output`。这证明 headroom 修复显著改善了真实成功深度，但成功 output 未触及 400，不能据此继续盲目提高 cap。下一任务转为零网络 prompt/schema/provider compatibility 韧性设计，不直接重跑 Live。
