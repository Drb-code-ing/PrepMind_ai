# Phase 6.9.8 Retriever / FinalResponse Architecture Recovery R5

## 1. 当前状态（Live 前）

更新时间：2026-08-06

R5 的实现、独立复审和 zero-provider 回归已经完成，当前处于“已获授权、待 clean-source admission”的唯一 controlled-Live 执行前窗口。本文件在 Live 前只记录准备事实；Provider、credential、marker、journal、artifact 和业务数据此时均为 0。

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
- 此阶段尚未创建 approved tag、marker、journal、artifact 或 recovery claim；没有调用 DeepSeek/Qwen，也没有启动 Docker/API/browser。

## 5. Live 执行后的收口规则

1. 在本分支 clean commit 创建并推送 approved tag，重新执行 source admission、proxy preflight 与 formal evidence=0 检查。
2. 执行唯一一次 R5 CLI；无论 gate pass 或 fail，都只运行一次 strict validator。
3. 成功或失败都要把 runId、gate、双 wire、usage、费用、P95、semantic、journal、artifact SHA 和 validator 结果补入本文件及 DEVLOG、README、roadmap、acceptance checklist、dev-start、data-flow、AGENTS。
4. `quality_gate_failed` 或异常终态均永久封存，不 retry/resume/replay/backfill、不追加 Provider 探测；只有完整 `controlled_live` gate pass 才能进入 R6 产品 Docker/API/可见浏览器验收。

## 6. 复盘问题

- 为什么 reservation 必须在 dispatch 前 durable？
- 为什么 runnerWire 与 providerWire 必须分开计数？
- 为什么缺 citation、超预算和未知 Provider 次数都必须 fail-closed？
- 为什么 R5 pass 仍不能直接声称产品或 main 已验收？
