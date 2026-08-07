# Phase 6.9.8 Transport Re-entry V2 L1 实现与 zero-provider 验收

> 日期：2026-08-08
> 状态：L1 runner/launcher 已完成实现与 zero-provider 回归；唯一 controlled-Live 尚未在本验收记录中执行。
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

- focused L1：`12/12` tests、`44` assertions；C1+C2+S1+L1：`44/44` tests、`218` assertions。
- Agent full：`1406/1406` tests、`24063` assertions、`174` files。
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
