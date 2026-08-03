# Phase 6.9.7 Architecture Recovery Provider Canary V2 C1 Zero-network Contract 验收

日期：2026-07-30

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

状态：C1 已完成；zero-network / zero-provider；下一原子任务仅 C2

Authority：`synthetic_test / qualityAuthority=none / providerHealth=unknown`

## 1. 结论

C1 已建立独立的 Provider Canary V2 request、proxy attestation、budget、report、fault matrix 与 CLI identity。
它只组合已经验收的本地 proxy preflight，不读取模型 credential 或 source，不创建 marker、journal、artifact、
recovery claim 或 reservation，也没有 fetch、Provider transport、产品 API、Docker 或浏览器入口。

Preflight 成功只会在当前进程内铸造一个空对象 capability；有效性保存在模块私有 `WeakMap`，调用方不能通过
plain object、clone、旧 R2/R3 report 或旧 identity 伪造。消费在任何异步边界前同步完成，第一次成功后永久
标记 consumed；replay 和并发的其余消费者全部 fail-closed。Preflight 失败或 abort 时不铸造 capability。

C1 report 固定为：

```text
authority=synthetic_test
qualityAuthority=none
providerHealth=unknown
zeroNetwork=true
credentialReads/sourceReads/markerWrites/providerDelegates/providerCalls=0
wire=not_started / executor-dispatch-response-usage=0/0/0/0
budget reserved=0 / actual usage and cost=null
```

因此 C1 只证明 V2 的本地准入、能力隔离和零调用合同成立，不证明代理转发、DNS/TLS、DeepSeek HTTP、
账号、余额、模型权限、verified usage、真实费用、Tutor/Organizer 语义或产品可用。

## 2. 固定 contract 与权限边界

- 顶层 namespace：`phase-6.9.7-architecture-recovery-provider-canary-v2`；
- request：DeepSeek V4 Pro、non-thinking JSON、strict `{ "ok": true }`、5000ms、no tools/stream/retry；
- 预算：最多 `1 call / 512 input / 16 output / 0.00200000 CNY`，C1 内不 reservation；
- attestation：模块私有 `WeakMap` + 进程内 opaque object + synchronous single-consume；
- report：strict own-key schema、深冻结、V7 wire 固定 `not_started`、usage 固定 `null`；
- CLI：只允许单参数 `mock` 或 `fault-matrix`，拒绝 Live、credential、URL、proxy override、retry 和 output；
- 隔离：C1 V2 schema 拒绝有效 R2/R3 report，R2/R3 report schema 也拒绝 V2 report；
- 数据：不保存 proxy URL/host/port、credential、raw error、message、stack、response 或模型输出。

## 3. Closed synthetic fault matrix

固定命令：

```powershell
bun --filter @repo/ai test:phase-6-9-7:recovery:provider-canary-v2:c1
```

15 个模块内场景覆盖：

- direct ready、loopback ready、loopback unavailable、probe throw 与 never-settle watchdog；
- abort before / during；
- hostile accessor、hostile descriptor、非空 `NO_PROXY` 与 proxy authority 冲突；
- capability replay、8 个并发消费者、clone 与 legacy identity；
- 每个 case 都固定 `providerCalls=0`、`rawDataRetained=false`。

Fresh CLI 结果：`scenarioCount=15 / passed=15 / failed=0`，credential/source/marker/provider 计数均为 0。

## 4. 验证证据

- C1 focused：`13/13`，`117` assertions；
- contract focused：`8/8`，`39` assertions；
- Architecture Recovery regression：`59/59`，`566` assertions；
- AI full：`291/291`，`2152` assertions；
- AI typecheck、lint、Prettier 与 `git diff --check` 均通过；
- 独立实现、安全与测试缺口复审均为 `APPROVED`，无未关闭 Critical/Important/Minor。

## 5. R3 sealed parity

C1 只读复核既有 R3 bundle，未删除、覆盖、重写、seal、恢复或拼接任何证据：

| Artifact | SHA-256                                                            |
| -------- | ------------------------------------------------------------------ |
| marker   | `6eef1a3244b162e42fb784f7601e3518653fc40297735cfeb8ed2c2eb0c89b6a` |
| journal  | `426d64622ef71b88aa4154ca479fcc823d0d23a90c6f7daae0bb4a3cebcb7f7b` |
| artifact | `56fb5b1d196d2af9cc4aab5476d766d87ca9d794896e3c93df9268d13e62e6c4` |

Bundle validator：`ok=true / runId=253a5df5-c443-4950-b517-849efb941728 / journalRecords=7 /
finalJournalEvent=evidence_published`。R3 一次性名额仍已消费且不得重跑。

## 6. 本次明确没有做什么

- 没有读取、打印、修改或提交 `.env`/credential；
- 没有调用 Provider、curl、DNS/TLS、产品 API、Tutor/Organizer 或其它模型；
- 没有创建 V2 source、approval、credential reader、marker、journal、artifact、validator 或 recovery claim；
- 没有运行 R3/V1--V9 retry/resume/replay/backfill/Live/seal/recovery；
- 没有启动 Docker/API/browser，没有修改 PostgreSQL、Redis、MinIO 或业务数据；
- 没有执行小样本、48-case、产品验收、main 合并或后续 Phase。

## 7. 下一停止门

下一原子任务仅 C2：实现独立 V2 source、one-shot CLI、approval/credential gate、marker、hash-chain journal、
artifact/validator 与 crash-only seal，并且只使用 fake ports/synthetic transport 验证。C2 仍必须
`providerCalls=0`，正式 V2 marker/journal/artifact/recovery claim 保持 0，R3 与 V1--V9 sealed evidence 不变。

C2 完成后还要执行 S1 branch static checkpoint。只有 S1 提交、推送并终审通过后，才停止并向用户展示 L1
运行时数据边界与新的 exact confirmation；普通“继续”“开始”“同意”不能授权 L1。

回顾时可以问：

- 为什么 proxy ready 只能铸造进程内 capability，不能写成 Provider health？
- WeakMap capability 为什么能阻止 plain object、clone、replay 和并发二次消费？
- 为什么 C1 的 budget 是已冻结但未 reservation，wire 也必须保持 `not_started`？
- 为什么 C1/C2/S1 全部成功仍不能执行 L1？
