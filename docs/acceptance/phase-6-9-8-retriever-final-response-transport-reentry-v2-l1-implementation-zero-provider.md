# Phase 6.9.8 Transport Re-entry V2 L1 实现与 zero-provider 验收

> 日期：2026-08-08
> 状态：Live 前 implementation checkpoint（历史）；L1 runner/launcher 的 zero-provider 回归与 root `.env` 首次
> `unknown_key` configuration-only 阻断记录保持不可变。随后唯一 controlled-Live 已成功封存，当前状态见独立 sealed
> 验收：`phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-controlled-live-sealed.md`。
> Branch：`drb/phase-6-9-8-retriever-final-response-contract`
> Lineage：`phase-6.9.8-retriever-final-response-transport-reentry-v2`
> 当前 checkpoint authority：`zero_provider_transport_reentry_v2_l1_implementation / qualityAuthority=none`

## 1. 本次交付

L1 在 V2 C1/C2/S1 之后增加独立的 production-shaped launcher、三槽 runtime、严格 report/artifact contract、
hash-chain journal、hard-link publication、validator 与 crash-only recovery。固定顺序仍为：

```text
exact argv
  -> source/remote parity
  -> loopback-only proxy preflight
  -> data-boundary
  -> exact authorization
  -> root .env projection
  -> capability shape preflight
  -> exclusive marker/reservation
  -> adapter construction
  -> rewrite -> qwen -> final_response
  -> publication/validation
```

真正的 dedicated key handoff 延后到 durable reservation 之后；marker 前只检查 module-owned capability 的
lineage/family/call 绑定，不把 raw key 写入 runtime、report、journal、artifact 或 diagnostic。

## 2. 固定 contract

| 项目                | 固定值                                                                   |
| ------------------- | ------------------------------------------------------------------------ |
| slots               | `rewrite -> qwen -> final_response`                                      |
| Provider            | DeepSeek V4 Pro、Qwen `text-embedding-v4`、DeepSeek FinalResponse stream |
| 最多 Provider calls | `3`                                                                      |
| 总预算              | `0.024096 CNY`                                                           |
| timeout             | `4000 / 5500 / 20000 ms`                                                 |
| 失败策略            | 首错 breaker、suffix 不 dispatch、无 retry/resume/replay/backfill        |
| 当前 checkpoint     | `zero_provider_transport_reentry_v2_l1_implementation`                   |
| 未来 Live authority | `controlled_live_transport_reentry_v2`（仅实际执行并封存后成立）         |
| qualityAuthority    | `none`                                                                   |

任何 configuration、transport、schema、usage、abort、timeout、publication 或 durability failure 都只形成
bounded diagnostic；即使三槽成功，也不能形成 Retriever/FinalResponse semantic、产品、SLA、Docker/API/browser 或
`main` authority。

## 3. Zero-provider 证据

- focused L1：`13/13` tests、`44` assertions；C1+C2+S1+L1：`47/47` tests、`224` assertions。
- Agent full：`1409/1409` tests、`24069` assertions、`174` files。
- targeted ESLint（L1 source/launcher）通过；Prettier 与 Bun build 通过。
- 覆盖：错误 argv/source gate ordering、capability deferred handoff、固定 slot/breaker、abort、reserved-only
  recovery、dispatch-only crash、hash-valid journal 乱序、lineage temp file、existing-artifact recovery、recovery
  claim tamper/orphan 与 CLI fail-closed。
- 当前未读取真实 `.env`、未读取 credential、未调用 DeepSeek/Qwen、未创建正式 marker/journal/report/artifact/
  recovery claim、未启动 Docker/API/browser，业务/Trace/BackgroundJob/Outbox 写入均为 `0`。

`tsc --noEmit -p packages/agent/tsconfig.json` 仍受仓库既有 Bun/Node/DOM 类型与 monorepo `rootDir` 环境问题阻断；
新增 L1 文件没有排除环境错误之外的类型错误，production script 可用 `bun build` 验证。

## 4. Sealed boundary 与下一步

本记录不是 controlled-Live 证据，也不消费一次性 L1 marker。执行唯一真实 canary 前必须重新确认当前已推送
source commit 的 exact authorization，并再次通过 fresh proxy preflight；CLI 只接受：

```text
I_ACCEPT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_REENTRY_V2_DEEPSEEK_AND_QWEN_DATA_BOUNDARY
I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_REENTRY_V2_CONTROLLED_CANARY_ONCE
```

执行后无论成功或失败都必须 durable seal，禁止重跑或追加探测。成功仅解锁 P1 zero-provider semantic-gate
设计；失败则保留 bounded evidence 并重新做架构决策。旧 T3/R5/Task 9C 的 marker、journal、artifact、SHA 与
一次性名额不可读取、改写或复用。

## 5. 相关实现

- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-contract.ts`
- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1.ts`
- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-cli-core.ts`
- `packages/agent/scripts/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1.ts`
- `packages/agent/tests/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1.test.ts`

## 6. Checkpoint 后的 root `.env` admission 诊断

在本 checkpoint 推送后，唯一受控入口曾在 root `.env` composition 返回
`credential_configuration_invalid / unknown_key`。根因是共享 `.env` 含正常项目配置字段，并使用宿主兼容
`Qwen_API_KEY`；这不是 Provider/network/account 结论。该尝试 `providerCalls=0`、`credentialReads=0`，没有 marker、
journal、report、artifact 或 recovery claim，因此没有消费一次性 marker，也不是 T3 retry。后续 production selective root
profile 的修复规则与脱敏证据见：

`docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-root-env-diagnosis-zero-provider.md`。

修复完成后仍必须在新的 source commit 上重新通过 clean/parity、fresh proxy、DeepSeek/Qwen data-boundary 与两条 exact
authorization；在新授权前不得继续调用 Provider。

> 以上“仍必须授权”是本文件所记录的 Live 前历史停止门；唯一授权已随后在 source `ee3dbf91` 上消费并以 run
> `ce0c3257-a5d9-4389-90ec-814d5e9cde34` durable seal。请勿把本历史 checkpoint 当作当前未执行状态。
