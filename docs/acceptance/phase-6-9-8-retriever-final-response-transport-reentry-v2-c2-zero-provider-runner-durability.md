# Phase 6.9.8 Transport Re-entry V2 C2 Zero-provider Runner / Durability 验收

> 日期：2026-08-07
> 分支：`drb/phase-6-9-8-retriever-final-response-contract`
> lineage：`phase-6.9.8-retriever-final-response-transport-reentry-v2`
> authority：`zero_provider_transport_reentry_v2_c2`
> qualityAuthority：`none`

## 1. 任务范围与停止边界

C2 把 C1 的三个 dedicated capability 收口为一个 module-owned、single-use 的 opaque configuration capability，
并在 synthetic root 中落地固定三槽 runner 与 crash-only durability。C2 全程只使用 synthetic source、configuration、
ports 和临时目录：不读取真实根 `.env` 或 credential，不调用 DeepSeek/Qwen/其它 Provider，不创建正式 evidence，
不启动 Docker/API/可见浏览器，不写 Chat、Trace、BackgroundJob、Outbox 或业务表。

旧 T3、R5、Task 9C 的 marker/journal/report/artifact、SHA、validator 和一次性授权保持只读；C2 不是 retry、resume、
replay、backfill、seal 或 recovery。C2 只解锁 S1 reviewed Mock/static，不解锁 V2 L1、产品验收或 `main`。

## 2. 实现与安全边界

### 2.1 Admission、configuration 与 reservation

- C2 使用独立 source version、lineage、marker、journal、artifact 和 recovery claim；source parity/旧 lineage/旧
  formal file 均 fail-closed。
- `preparePhase698TransportReentryV2C2Configuration()` 只接受完整的 C1 `lineage + rewrite + qwen + final_response`
  projection；缺字段、错误 lineage、伪造对象、复用对象或跨边界对象均返回 `configuration_invalid`。
- synthetic reservation 的顺序固定为：synthetic-root fence → configuration capability consume → reservation capability
  consume → source/marker schema → exclusive formal-file fence → marker/journal fsync。配置失败发生在 marker 前，
  不创建 marker、journal、report、artifact 或 recovery claim。
- marker 是一次性 exclusive winner；第二个 fresh capability 也不能替换已存在的 marker。

### 2.2 Runner、账本与 breaker

- 三个 slot 固定为 `rewrite -> qwen -> final_response`，每个 slot 最多一次 synthetic dispatch；不接受 CLI 覆盖，不 retry。
- 首个 `missing / invalid / conflict / abort / timeout / transport / schema / usage` fault 打开 breaker；后续 suffix
  固定记录为 `not_started_quality_breaker` 或 `not_started_external_abort`，不补发调用。
- runner wire 与 synthetic port-call accounting 分离：本次 synthetic CLI 的 `syntheticPortCalls` 可以为 `3`，但正式
  `providerCalls=0`，避免把测试 seam 误报为 Provider 证据。

### 2.3 Durability、validator 与 recovery

- dispatch-before-call 的每个阶段先追加并 fsync hash-chain journal；sequence、previousHash、recordHash、stage 顺序和
  terminal 唯一性由 strict validator 重新计算。
- report 使用 canonical JSON；artifact 通过 hard link 发布，包含 `rawDataRetained=false` 和固定 `0/0/0` 的
  provider/credential/formal 计数。
- validator 拒绝 journal 尾篡改、意外 root formal file、foreign/old lineage、额外正式文件、artifact/report/hash
  不一致和不完整 terminal。
- crash-only recovery 只读取同一 marker 的 durable prefix：reserved-only 会补齐固定失败 suffix；dispatch-before-call
  只收口为 bounded failure；publication interruption 只恢复同一 terminal 的 publication，不重放任何 port call。
- 活跃 owner 仍返回 `process_active`，不会创建 recovery claim 或 artifact；已发布 bundle 不允许二次 recovery。

## 3. 验收命令与结果

```text
bun test packages/agent/tests/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2.test.ts
  15 pass / 0 fail / 88 expect()

bun --filter @repo/agent eval:phase-6-9-8:transport-reentry:v2:c2
  9 synthetic cases（success + 8 first-failure faults）全部 bundleValid=true
  publicationRecovery=terminal_publication_recovered
  providerCalls=0 / credentialReads=0 / formalEvidence=0

bun --filter @repo/agent typecheck
  passed

bun --filter @repo/agent lint
  passed

bunx prettier --check <C2 files>
  passed

bun test packages/agent/tests
  1387 pass / 0 fail / 23957 expect() / 172 files

bun --filter @repo/agent eval:phase-6-9-8:transport-evidence:t3:validate
  ok=true / runId=075e2d5f-682b-426d-847e-f5a6ce5b97c6 / journal=7
  report SHA=8d529bb7...4875d1 / artifact SHA=50beb053...7ee9c

bun --filter @repo/agent eval:phase-6-9-8:architecture-recovery:r5:validate
  ok=true / code=bundle_valid / providerCalls=0 / qualityAuthority=none

bun --filter @repo/agent eval:phase-6-9-8:task9:validate
  ok=true / runId=28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2 / journal=134
  gate=task9_quality_gate_failed / qualityAuthority=none
```

Focused tests additionally cover invalid C1 projection before marker creation, second reservation through the exclusive marker
fence, foreign/old marker rejection, all eight bounded fault classes, active-owner refusal, reserved-only and
dispatch-before-call recovery, publication recovery, journal-tail tamper, unexpected formal root file and package/source
credential-port isolation.

## 4. Evidence counts and authority

| 项目                                        |                           C2 结果 |
| ------------------------------------------- | --------------------------------: |
| 真实 Provider calls                         |                               `0` |
| 真实 credential reads                       |                               `0` |
| synthetic port calls                        | 仅内存 seam；不属于 Provider 证据 |
| 正式 marker/journal/artifact/recovery claim |                               `0` |
| Docker/API/browser/Trace/业务写入           |                               `0` |
| quality / semantic / P95 / SLA authority    |                            未形成 |
| product / `main` authority                  |                            未形成 |

C2 的 gate 是 `transport_reentry_v2_c2_zero_provider_passed`，authority 固定为
`zero_provider_transport_reentry_v2_c2 / qualityAuthority=none`。它只证明配置能力消费、固定调度、故障收口和
durability contract 在 zero-provider synthetic 条件下成立；不能证明 Provider health、真实模型语义、成本、延迟、
`/api/chat` 可用或生产部署。

## 5. 下一步与授权边界

下一原子任务为 S1 reviewed Mock/static：让三个第一方 adapter 通过同一 V2 runner 的 synthetic ports，并再次验证
strict/wire/usage/no-raw 账本。S1 仍不读取 credential、不调用 Provider、不启动 Docker/API/browser。

V2 L1 只有在 S1 source parity、clean tree、formal artifact=0、全新的 DeepSeek/Qwen 数据边界接受和新的 exact
authorization 同时通过后才能执行，且最多三次 Provider call、首错即 durable seal；不得 retry/resume/replay/backfill、
curl、单 case 或追加探测。L1 即使成功也只解锁后续 zero-provider semantic gate，不直接进入产品或 `main`。

## 6. 回顾问题

1. 为什么 configuration capability 必须在 marker 前消费，且不能由调用方伪造？
2. 为什么 `syntheticPortCalls` 不能写成 `providerCalls`？
3. 为什么 publication recovery 可以补发布，却不能重放 dispatch？
4. 为什么 C2 通过后仍不能把 V2 L1 或 `/api/chat` 写成可用？
