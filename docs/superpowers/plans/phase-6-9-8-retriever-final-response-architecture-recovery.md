# Phase 6.9.8 Retriever / FinalResponse Architecture Recovery 实施计划

> - 设计来源：
>   [Phase 6.9.8 Retriever / FinalResponse Architecture Recovery 设计](../specs/phase-6-9-8-retriever-final-response-architecture-recovery-design.md)
> - 当前状态：R0 zero-provider 设计冻结完成；下一步仅 R1 diagnostic contract / TDD
> - 当前分支：`drb/phase-6-9-8-retriever-final-response-contract`
> - 当前 authority：`zero_provider_retriever_final_response_architecture_recovery_design / qualityAuthority=none`

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

状态：未开始；R0 提交并推送后才允许开始。

### 目标文件

- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-diagnostic.ts`
- `packages/agent/src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-contract.ts`
- `packages/agent/tests/phase-6-9-8-retriever-final-response-architecture-recovery-diagnostic.test.ts`
- `packages/agent/tests/phase-6-9-8-retriever-final-response-architecture-recovery-rewrite.test.ts`

实际文件可在不改变 namespace/职责的前提下按模块长度拆分，但禁止改写旧 Task 9C evidence contract。

### 实施顺序

1. RED：exact-object、hostile getter/Proxy、unknown field、raw/hash leakage、非法 stage/reason；
2. 实现 strict diagnostic schema、deep-freeze plain projection 与 module-owned opaque capability；
3. RED：rewrite runtime result、candidate disposition、provenance、Trace、usage、wire、result schema 分支；
4. 实现 rewrite 阶段机与 bounded mapper，不改写现有 product fallback；
5. 冻结 deterministic failure precedence，验证 external caller 不能选择或伪造 diagnostic、provider/model/usage/
   cost；
6. 验证 anonymous/cross-owner/abort 在 dispatch 前 zero-call；
7. 运行 focused tests、Agent full/typecheck/lint、Task 9C legacy validator parity；
8. 同步 R1 acceptance 与所有当前状态文档，单独提交并推送。

### R1 验收

- `providerCalls=0`、`credentialReads=0`、formal evidence=0；
- 所有 rewrite failure 精确落入一个 stage/reason 或 `unknown`；
- diagnostic JSON 不含 raw、raw hash、query、prompt、credential、URL、error、unknown key；
- 只读运行 Task 9C validator 并比对 artifact SHA；旧 namespace 无写入且 bytes 不变；
- 不存在新 CLI、Live admission 或产品 gate。

## 4. R2 — Qwen / FinalResponse Robustness

状态：未开始；仅 R1 完成后解锁。

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

- 全部测试使用 synthetic/injected transport，global fetch/credential/Provider=0；
- fault case 只产生 fixed diagnostic，不抛出 raw error；
- success case 通过本地 strict authority，不靠 coercion、repair 或 extension discard；
- 旧 Task 9C 与 Phase 6.9.7 evidence parity 保持。

## 5. R3 — Runner / Durability / Admission

状态：未开始；仅 R2 完成后解锁。

### 交付

- 独立 report/gate 与固定 16-guard/64-call scheduler；
- `providerWire` 与 `runnerWire` 双层 accounting；
- 新 source manifest、source admission 与双 opaque capability；
- exclusive marker、dispatch-before-call fsynced hash-chain journal；
- diagnostic stage journal、exclusive temp + hard-link artifact；
- strict recomputing validator 与 crash-only seal；
- 只允许固定 argv 的未来 production CLI，默认关闭且无当前授权。

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

- 正式 approved tag/marker/journal/artifact/recovery claim 仍为 0；
- synthetic durability/fault matrix 全通过；
- validator 能从 journal/artifact 独立重算 gate、wire、usage、cost 与 diagnostic；
- CLI 未读取 credential，未调用 Provider。

## 6. R4 — Reviewed Mock / Static Checkpoint

状态：未开始；仅 R3 完成后解锁。

### 目标

- 16 guards + 16 rewrite pairs + 16 FinalResponse 的完整 64-call reviewed Mock；
- rewrite、retrieval、FinalResponse、安全、P95 与预算门完整通过；
- providerWire/runnerWire/usage 均按 64-call 完整；
- diagnostic 全部到 `applied`，同时覆盖单独 fault matrix；
- anti-oracle、source SHA、legacy evidence parity 与 Reader Testing 通过。

Gate 必须固定为 recovery Mock-only authority，例如
`architecture_recovery_mock_quality_not_evidence / qualityAuthority=none`；不得写成真实 Provider 或产品质量。

## 7. R5 — 未来可选 Controlled-Live

状态：未授权、未开始。

R4 完成、提交、推送和独立复审不自动授权 R5。若用户未来决定继续，必须重新完成：

1. clean tree、HEAD/upstream/origin/new approved tag parity；
2. source manifest 与 Task 9C sealed evidence parity；
3. 新 lineage formal evidence=0；
4. fresh proxy preflight；
5. fresh DeepSeek + Qwen 数据边界接受；
6. 新 lineage 的精确一次性授权；
7. 三项专用 credential late-binding。

本计划不预写 exact authorization 文本。任何 R5 失败都先正常 durable seal、strict validate 和复盘；禁止重跑或
用单 case/curl/产品 API 补证。

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

R0 只形成设计 authority。当前没有：

- diagnostic TypeScript contract 或 TDD 证据；
- rewrite/Qwen/FinalResponse recovery integration；
- recovery runner、CLI、marker/journal/artifact/validator；
- reviewed Mock、controlled-Live、产品或 main authority；
- 对 Task 9C 具体失败字段或 Provider 根因的结论。

下一步只能开始 R1 zero-provider diagnostic contract / rewrite TDD。不得执行 R2--R7、Task 9C CLI/seal、Task
10/11、Phase 6.9.9/6.9.10/6.10、Phase 8/9 或博客收尾。
