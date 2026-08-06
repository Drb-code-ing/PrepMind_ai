# Phase 6.9.8 Retriever / FinalResponse Architecture Recovery 实施计划

> R5 结果（2026-08-06）：唯一 controlled-Live run `34eb99be-bdeb-41e5-85cf-3c651ecefc68` 已正常 runtime seal，
> 但 gate=`architecture_recovery_quality_gate_failed / qualityAuthority=none`。第二个 rewrite pair 的 DeepSeek 在
> `provider_dispatch / unknown` 失败，external calls `4`，剩余 `59` slots breaker not-started；rewrite strict `1/16`、
> FinalResponse `0/16`，semantic/P95/verified aggregate 全为 `null`；journal `237`、validator `ok=true`、artifact
> SHA=`423e3f2e...43b1e5`。一次性名额已消费，R6 继续阻断。

> R5 后续不重跑；当前已转入独立
> [Transport Evidence Recovery 计划](./phase-6-9-8-retriever-final-response-transport-evidence-recovery.md)，T0/T1
> zero-provider 设计与 strict contract/TDD 已完成；下一步完成 T2 robustness/durability，再决定是否申请新的极小
> canary。

> - 设计来源：
>   [Phase 6.9.8 Retriever / FinalResponse Architecture Recovery 设计](../specs/phase-6-9-8-retriever-final-response-architecture-recovery-design.md)
> - 当前状态：R0--R4 zero-provider 完成；R5 唯一 controlled-Live 已失败封存，禁止重跑；R6 阻断
> - 当前分支：`drb/phase-6-9-8-retriever-final-response-contract`
> - 当前 authority：`architecture_recovery_mock_quality_not_evidence / qualityAuthority=none`

## 1. 总体规则

- Task 9C run `28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2`、approved tag、marker、journal、artifact 与 validator
  保持不可变；
- Recovery 使用独立 lineage `phase-6.9.8-retriever-final-response-architecture-recovery-v1`；
- R0--R4 全程 zero-provider，不读取 `.env` 或 credential，不创建正式 evidence；
- 三类调用分别建模：DeepSeek rewrite、Qwen retrieval、DeepSeek FinalResponse stream；
- 保持 16 guards、64 calls、双 Provider 预算/usage/CNY、质量阈值与 no-retry 不变；
- diagnostic 只允许固定 enum/bucket 和 `rawDataRetained=false`，禁止 raw 与 raw-derived hash；
- 每个阶段单独提交并推送；不使用 worktree，不创建嵌套分支；
- 上述提交/推送仅指普通 Git source/doc commit；R0--R2 不得创建正式 marker/journal/artifact，R3 也只用临时
  synthetic evidence 验证合同，不能把 Git push 写成 formal evidence publication；
- 任一阶段出现 contract、安全、泄漏、durability 或 parity failure，立即停止在当前 zero-provider 阶段。

## 2. R0 — 设计冻结

状态：已完成，zero-provider。

### 交付

- [x] 只读复盘 Task 9C sealed facts 与不可推导结论；
- [x] 定位 `schema_invalid` 在 live harness 与 runner 的聚合点；
- [x] 区分 Provider wire 与 runner lifecycle；
- [x] 冻结三类调用的独立阶段机；
- [x] 冻结 bounded diagnostic 字段、stage、reason 和禁止数据；
- [x] 冻结独立 lineage、source admission、durability 与 validator 方向；
- [x] 冻结 R1--R7 原子路线；
- [x] 同步 spec、plan、acceptance、AGENTS、DEVLOG、roadmap 与相关索引文档。

### R0 不做

- 不修改 TypeScript 生产代码或测试；
- 不运行 Provider、Task 9C CLI/seal、Docker/API/browser；
- 不创建新 approved tag、marker、journal、artifact 或 recovery claim；
- 不放行 Task 10/11、main 或后续 Phase。

## 3. R1 — Diagnostic Contract / Rewrite TDD

状态：已完成，zero-provider。

### 目标文件

- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-diagnostic.ts`
- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-contract.ts`
- `packages/agent/tests/phase-6-9-8-retriever-final-response-architecture-recovery-diagnostic.test.ts`
- `packages/agent/tests/phase-6-9-8-retriever-final-response-architecture-recovery-rewrite.test.ts`

实际文件可在不改变 namespace/职责的前提下按模块长度拆分，但禁止改写旧 Task 9C evidence contract。

### 实施结果

1. [x] RED/GREEN：exact-object、hostile getter/Proxy、unknown field、raw/hash leakage、非法 stage/reason；
2. [x] 实现 strict diagnostic schema、deep-freeze plain projection 与 module-owned opaque capability；
3. [x] Rewrite session 一次绑定未使用的真实 V7 wire capability，foreign/reuse/active snapshot fail-closed；
4. [x] 删除 caller-supplied Provider dispatch/response/envelope/usage status，以只读 terminal wire snapshot 确定性
       推导 `providerBoundary`、schema bucket 与 verified usage；
5. [x] Synthetic TDD 真实穿过第一方 DeepSeek direct adapter injected fetch；不读取 credential、不访问网络；
6. [x] 冻结 transport/HTTP/envelope/usage 与 runtime/candidate/local authority/Trace/cost/result 的最早失败 precedence；
7. [x] R1 transitions 不进入 `@repo/agent` 公共 barrel；`@repo/ai` 只新增 snapshot read，mutation transitions 仍
       不导出；
8. [x] 完成 focused、Agent/AI compatibility、typecheck/lint 与 Task 9C legacy validator parity；
9. [x] 同步 R1 acceptance 与所有当前状态文档，单独提交并推送。

### R1 验收

- `providerCalls=0`、`credentialReads=0`、formal evidence=0；
- 所有 rewrite failure 精确落入一个 stage/reason 或 `unknown`；
- diagnostic JSON 不含 raw、raw hash、query、prompt、credential、URL、error、unknown key；
- 只读运行 Task 9C validator 并比对 artifact SHA；旧 namespace 无写入且 bytes 不变；
- 不存在新 CLI、Live admission 或产品 gate。

验收见
[R1 zero-provider diagnostic contract / rewrite TDD](../../acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r1-zero-provider-tdd.md)。

## 4. R2 — Qwen / FinalResponse Robustness

状态：已完成，zero-provider。

### 目标

- Qwen：response envelope、embedding count/index/dimension/value、usage/price、ranking、result contract；
- FinalResponse：stream event、terminal ledger、citation ledger、Trace、usage/cost、delivery、result contract；
- provider-like、held-out、metamorphic、hostile input 与 fault matrix；
- 三类 call-family stage 子图互斥，不能使用另一 family 的 stage/reason；
- 所有 actual 只读取实际 bounded request，expected 只进入后置 scorer。

### 必测故障

- malformed/truncated/multiple/duplicate/oversized/deep/wide Provider-like payload；
- hostile getter、Proxy、symbol、cycle、toJSON/coercion/iterator；
- abort-before/in/post-dispatch、timeout、transport、bounded HTTP failure；
- Qwen vector/usage/price/ranking drift；
- FinalResponse terminal 0/2+、not-last、citation drift、false tool success、usage/cost/latency drift；
- caller fake wire/Trace/usage/cost/diagnostic；
- secret/oracle/raw/hash leakage scan。

### R2 验收

- [x] 全部测试使用 synthetic/injected transport，external Provider/credential=0；
- [x] 新增 `qwen_retrieval` 与 `final_response_stream` 两个互斥 wire family；只有第一方 adapter 能推进
      dispatch/response/usage，公共 barrel 只导出 create/read；
- [x] Qwen 覆盖 transport/HTTP/envelope、embedding count/index/dimension/value、usage 与本地
      cost/ranking/result 独立阶段；
- [x] FinalResponse 覆盖 transport/HTTP/stream、terminal 0/1/2+ 与 not-last、false-tool、usage，以及本地
      citation/Trace/cost/delivery/result 独立阶段；
- [x] forged/reused/active/cross-family/out-of-order capability、hostile getter/Proxy 与 abort 均 fail-closed；
- [x] 首个畸形 stream event 明确为 `response_observed + stream_event_invalid`，不冒充 success，也不误写为
      `response_not_observed`；
- [x] fault case 只产生 fixed diagnostic，不保存 raw/error/unknown key/hash；success 不靠 coercion、repair 或
      extension discard；
- [x] focused compatibility `58/58`、AI full `345/345`、Agent full `1301/1301`、typecheck/lint 与 Task 9C
      sealed validator parity 通过；
- [x] 单独同步 R2 acceptance 与当前状态文档，提交并推送当前功能分支。

验收见
[R2 zero-provider Qwen / FinalResponse robustness](../../acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r2-zero-provider-robustness.md)。

## 5. R3 — Runner / Durability / Admission

状态：已完成，zero-provider。

### 交付结果

- [x] 独立 report/gate 与固定 16-guard/64-call scheduler；
- [x] `providerWire` 与 `runnerWire` 双层 accounting；
- [x] 新 source manifest、source admission 与 admission/reservation 双 opaque capability；
- [x] Rewrite/Qwen/FinalResponse 各自用模块私有 WeakMap 单次签发 runner observation；不存在共享可调用 issuer；
- [x] exclusive marker、reservation-before-dispatch、fsynced hash-chain journal；
- [x] diagnostic stage journal、exclusive temp + hard-link artifact；
- [x] strict replay/recomputing validator 与 crash-only seal；
- [x] `run_terminal` 后和 `publication_started` 后的 terminal publication recovery；
- [x] 只允许 validate/seal 两个 zero-provider maintenance argv 的 CLI；不存在 Live/retry/replay/resume/backfill argv。

### Durability 断言

- reservation durable 后才允许 dispatch；
- provider response/usage 必须由第一方 capability 证明；
- diagnostic stage 单调且每 call 恰好一个 terminal；
- 每个 sibling/call 的 usage、cost、wire、diagnostic 与 terminal 隔离，禁止跨 Qwen original/candidate、rewrite/
  FinalResponse 复用；
- failure 后当前 pair 有界收口，后续 schedule 全为 not-started breaker；
- incomplete denominator 时 semantic/P95/token/CNY 全 `null`；
- crash recovery 只解释 durable prefix，不继续调用；
- active owner、duplicate claim、tail drift、publication conflict、old lineage 全部 fail-closed。
- old Task 9C namespace 使用显式 read-only write guard；任何 marker/journal/artifact 写入尝试都 fail-closed。

### R3 验收

- [x] 正式 approved tag/marker/journal/artifact/recovery claim 仍为 0；
- [x] synthetic runner/durability/fault matrix 全通过；
- [x] validator 能从 journal/artifact 独立重算 gate、wire、usage、cost 与 diagnostic；
- [x] recovery claim 严格绑定 `recovery_claimed.previousHash`，claim-tail drift 与后续 hash 重算攻击仍拒绝；
- [x] CLI 未读取 credential，未调用 Provider，也未执行正式 R3 validate/seal；
- [x] 旧 Task 9C report/artifact SHA 与 validator 结果保持不变；
- [x] R3 acceptance 与全部当前状态文档同步，单独提交并推送当前功能分支。
- [x] 独立 Reader Testing 能从三份核心文档准确回答 authority、recovery、Task 9C 与下一阶段边界；安全复审无
      blocker。R3 仍不声称 hostile same-user 文件系统 race、跨主机 lease 或 Provider exactly-once authority。

验收见
[R3 zero-provider runner / durability / admission](../../acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r3-runner-durability-admission.md)。

## 6. R4 — Reviewed Mock / Static Checkpoint

状态：已完成，zero-provider；形成 Mock-only checkpoint，不形成 Provider、产品或 main authority。

### 目标

- [x] 16 guards + 16 rewrite pairs + 16 FinalResponse 的完整 64-call reviewed Mock；
- [x] Task 8 production node/ledger 路径先行，再进入 R3 runner；
- [x] rewrite、retrieval、FinalResponse、安全、P95 与预算门完整通过；
- [x] providerWire/runnerWire/usage 均按 64-call 完整，diagnostic `applied=64`；
- [x] anti-oracle、source/Task 9C SHA parity、canonical bytes 与 single-use capability 通过；
- [x] formal approved tag/marker/journal/artifact/recovery claim 保持 0；
- [x] Reader Testing 与独立安全复审无 blocker。

Gate 必须固定为 recovery Mock-only authority，例如
`architecture_recovery_mock_quality_not_evidence / qualityAuthority=none`；不得写成真实 Provider 或产品质量。

验收见
[R4 reviewed Mock / static](../../acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r4-reviewed-mock-static.md)。

## 7. R5 — Controlled-Live（已执行，失败封存）

状态：实现与 zero-provider 回归完成；用户已接受 DeepSeek/Qwen 数据边界并给出 exact authorization，唯一 run 已
durable seal 为 `quality_gate_failed`，credential/Provider 名额已消费，禁止重跑。

R5 固定 `16 guards + 16 rewrite pairs + 16 FinalResponse = 64 slots`，并已完成 citation coverage、固定 corpus、
保守 verifier 投影、usage/cost budget 与 reservation 后 crash-only 异常处理。执行前已完成：

1. clean tree、HEAD/upstream/origin/new approved tag parity；
2. source manifest 与 Task 9C sealed evidence parity；
3. 新 lineage formal evidence=0；
4. fresh proxy preflight；
5. 已接受的 DeepSeek + Qwen 数据边界保持在授权 CLI 子进程；
6. 已给出的新 lineage 精确一次性授权已使用且不可重复；
7. 三项专用 credential late-binding，主代理不读取或回显 key。

任何 R5 失败都先正常 durable seal、strict validate 和复盘；禁止重跑或用单 case/curl/产品 API 补证。

## 8. R6 / R7 — 产品与 Main

- R6 只在 R5 形成完整 quality authority 后，执行分支 Docker/API/可见浏览器/Trace/权限/forced-failure/精确清理；
- R7 只在 R6 通过后，从最新 main 创建普通 merge 分支或按仓库规范合并，推送 main 后再次 default-off 回放；
- R5 pass 不等于 R6/R7 pass，R6 pass 也不等于 SLA 或生产部署。

## 9. 每阶段固定验证

根据修改范围至少执行：

```powershell
bun test packages/agent/tests/<focused-recovery-tests>
bun --filter @repo/agent test
bun --filter @repo/agent typecheck
bun --filter @repo/agent lint
bun --filter @repo/agent eval:phase-6-9-8:task9:validate
bunx prettier --check <changed-files>
git diff --check
```

再执行 Markdown 相对链接、stale/current-status、secret/raw/hash 禁止字段与 formal evidence 计数检查。测试失败时只
修当前原子任务，不提前运行下一阶段。

## 10. 当前停止边界

R0--R4 只形成设计、三链路 diagnostic/robustness、runner/durability/admission 与 reviewed Mock checkpoint authority。
R5 已补齐真实第一方 adapter 的 Live 边界并形成一次失败 sealed evidence；该 evidence 仍不形成：

- 产品、Docker/API/browser、Trace 或 main authority；
- 对 Task 9C 具体失败字段或 Provider 根因的结论。

R5 已完成唯一 Provider run；下一步不得执行 R6/R7、Task 9C CLI/seal、Task 10/11、Phase 6.9.9/6.9.10/6.10、
Phase 8/9 或博客收尾，除非用户基于新的架构决策重新授权一条全新 lineage。
