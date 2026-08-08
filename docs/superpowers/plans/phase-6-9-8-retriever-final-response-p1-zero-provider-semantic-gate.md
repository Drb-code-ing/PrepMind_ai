# Phase 6.9.8 Retriever / FinalResponse P1 zero-provider semantic-gate 实施计划

> 设计来源：[P1 zero-provider semantic-gate 设计](../specs/phase-6-9-8-retriever-final-response-p1-zero-provider-semantic-gate-design.md)
> 日期：2026-08-08
> 当前状态：P1 设计、G1 zero-provider contract/baseline/scorer、G2 one-shot runner/durability、S2 reviewed Mock/static 与
> L2 zero-provider admission contract 均已完成；唯一 L2 controlled-Live 已在 fresh authorization 后执行并以
> `p1_l2_quality_gate_failed / qualityAuthority=none` durable seal。证据已以 `f4fac048` 合并，文档 parity 再以 `613cc772`
> 合并推送到 `main`；最终 `main == origin/main` 的 zero-provider 回归已完成；不得重跑本 run。下一功能任务只能从最新 `main`
> 新开独立 schema
> recovery/diagnostic lineage。
> 分支：`drb/phase-6-9-8-p1-semantic-gate-design`
> 基线：`main` merge `3fdb9908`
> Lineage：`phase-6.9.8-retriever-final-response-p1-v1`

> 状态更新（2026-08-08）：本计划的 P1 设计步骤保持为历史冻结记录；G1 已合并到 `main` `a12db738`，G2 在独立
> 分支 `drb/phase-6-9-8-g2-runner-durability` 完成并通过 focused `5/5`、Agent full `1419/1419`，authority=
> `zero_provider_retriever_final_response_p1_g2_runner_durability / qualityAuthority=none`。G2 结果见
> `docs/acceptance/phase-6-9-8-retriever-final-response-p1-g2-runner-durability.md`。随后 S2 在独立普通分支完成，验收见
> `docs/acceptance/phase-6-9-8-retriever-final-response-p1-s2-reviewed-mock-static.md`。

> 当前执行状态（2026-08-09）：L2 implementation 修复提交 `146d2107` 与 canonical tag source `fa502925...` 已被唯一
> controlled-Live 使用。run `ff035203-500f-4744-b33c-3c375ae4c785` 在 `rewrite_03/schema` 后封存；8/8 guards、
> Provider/credential/Qwen calls=`2/2/0`、usage=`343/40`、aggregate cost=`null`、journal=`41`、validator=`ok=true`。
> 终态验收见 `docs/acceptance/phase-6-9-8-retriever-final-response-p1-l2-controlled-live-quality-gate-failure.md`。

## 1. 执行原则

- P1 是独立 lineage，不是 V2 L1 retry、recovery、replay、backfill 或产品接线。
- P1/G1/G2/S2 均 zero-provider：不读真实 `.env`/credential，不构造真实 adapter，不启动 Docker/API/browser，不写
  Trace、BackgroundJob、Outbox 或业务数据。
- 先完成文档和输入身份冻结，再按一个阶段一个提交推进；不从功能分支再开分支、不使用 worktree。
- 所有 actual 必须穿过 production node/port/projector/merger；expected/oracle 只能在后置 scorer 读取。
- 任何不完整分母、未知 usage、权限漂移、stale、schema/terminal/journal 错误都 fail-closed；不得用 fallback 修补
  语义分数。

## 2. P1：设计冻结（本提交）

- [x] 固定 lineage、manifest/policy/baseline anchor SHA 与不可复用边界；
- [x] 固定 `8 guard + 6 rewrite + 6 FinalResponse` 选择和顺序；
- [x] 固定 strict/wire/usage/semantic/safety/latency 质量门；
- [x] 固定 owner、Router、Retriever、projector、FinalResponse、ledger 的通信和权限矩阵；
- [x] 固定最大并发 1、12 次 synthetic candidate invocation 上限、abort/stale/丢失任务/首错 breaker/no-retry；
- [x] 固定 G1/G2/S2/L2 交付顺序、authority 与停止门；
- [x] 同步仓库入口文档和本 acceptance 记录。

P1 交付只包含 Markdown；正式 marker/journal/artifact/recovery claim 必须为 `0`。

## 3. G1：manifest、subset baseline 与 strict scorer（已完成，zero-provider）

### 3.1 实现责任

1. 新增独立 P1 manifest/policy 模块，从 Task 8 manifest 与 Retriever baseline 只读导出选择的 case；
2. 在源码中重新计算并校验 manifest/policy SHA，拒绝 CLI 或环境变量覆盖；
3. 生成 deterministic original-query subset baseline，记录 baseline authority、case entries、metric eligibility、
   no-hit 和 critical target，不导入 candidate/Mock/Provider；
4. 实现 strict report/scorer/gate：所有 aggregate 从 entries 重算，缺项、重复、旧 lineage、expected 注入和自报
   aggregate 均拒绝；
5. 实现 anti-oracle 测试：candidate/responder 看不到 expected、baseline report、答案正文或质量阈值。

### 3.2 G1 验收证据

- `8/8` guard 预期 zero-call；6 rewrite 与 6 FinalResponse 的 baseline entry 可复算；
- scorer 强制全部冻结阈值：`Recall@5 >= 0.90`、`nDCG@5 >= 0.85`、eligible subset uplift `>=0.08`、critical
  recall `=1`、intent preservation `>=0.95`、unsafe rewrite `=0`、grounded rubric `>=0.90`、citation precision `=1`、
  required citation recall `>=0.90`、critical notice recall `=1`，以及 false tool success/false citation/safety failure
  全为 `0`；
- strict/runtime/wire/verified usage 分母必须分别为 guard `8/8`、rewrite `6/6`、FinalResponse `6/6`，而不是只检查
  semantic aggregate；
- formal Provider/credential/marker/journal/artifact/recovery claim 均为 `0`；
- focused、Agent full、typecheck、lint、Prettier、`git diff --check` 通过；
- G1 acceptance 文档记录实际 SHA、命令、未做事项和下一停止门。

G1 已完成并通过 focused `5/5`、Agent full `1414/1414`、typecheck、lint、Prettier；不允许在该分支执行任何 Live 或
产品 API 探测。G1 authority 固定为 `zero_provider_retriever_final_response_p1_g1_contract_baseline /
qualityAuthority=none`，正式 evidence 与业务写入均为 `0`。独立验收见
`docs/acceptance/phase-6-9-8-retriever-final-response-p1-g1-contract-baseline-scorer.md`。

## 4. G2：one-shot runner 与 durability（已完成，zero-provider）

### 4.1 运行顺序

```text
source/manifest admission
  -> 8 guard zero-call
  -> rewrite_01,03,05,09,12,15（每条 baseline -> candidate 串行）
  -> final_01,07,09,11,13,15（每条 projector -> candidate 串行）
  -> strict recomputing scorer
  -> synthetic publication/validator
```

最大并发 `1`，candidate responder 最多 12 次；baseline fake search 不计 Provider call。

### 4.2 Durability 与丢失任务

- 每条 lane 在 dispatch 前 reservation 并 fsync；状态前缀使用 `not_started/reserved/dispatched/response_observed/
strict_validated/terminal/published`；
- 首个 contract/permission/budget/transport/schema/usage failure 打开 breaker，未启动 lane 固定为
  `not_started_quality_breaker`；
- 普通 `semantic_mismatch` 不打开 breaker，保留完整 lane 分母并继续评测；质量门最终失败也只 durable seal，不能以
  deterministic fallback 或重试改写 actual。
- parent abort 固定为 `not_started_parent_aborted`，stale/cross-owner 固定为 fail-closed terminal；
- crash-only recovery 只能发布已持久化 terminal 的同一 report，不能构造 adapter、补发 call 或恢复语义；
- exclusive marker、hash-chain journal、hard-link artifact 和 strict validator 只在隔离 synthetic temp root 使用，
  case 结束精确清理，正式 evidence 仍为 `0`。

### 4.3 G2 验收（已完成）

focused durability/fault matrix、source admission、validator、crash prefix、multiple marker、stale/abort/预算和旧
lineage 双向拒绝全部通过；focused `5/5`、Agent full `1419/1419`、typecheck/lint/Prettier/`git diff --check` 通过。
synthetic CLI 形成 `12` candidate invocations、`72` journal records、`evidence_published` 与 validator `ok=true`，
而 `providerCalls=0 / credentialReads=0 / formalEvidence=0`。完整回执见独立 G2 acceptance 文档。

## 5. S2：reviewed Mock/static（已完成，zero-provider）

- 使用 reviewed responder，只读取实际 bounded prompt；不得读取 expected/oracle 或逐字复用 L1/SR5 response；
- 真实穿过 Retriever original/candidate、rewrite candidate、Qwen synthetic port、evidence projector、FinalResponse、
  strict validator 与本地 merger；
- 覆盖 success、schema/usage/transport/timeout/abort、unknown citation、false tool success、cross-owner 和 stale；
- gate 固定 `p1_mock_quality_not_evidence / qualityAuthority=none`，formal marker/journal/artifact/recovery claim=0；
- S2 只决定是否具备申请 L2 的工程准入，不是 L2 授权，不启动 Docker/API/browser。

S2 实际结果：`8/8` guard、`16/16` strict/wire/synthetic usage、semantic `1/1/1`，candidate invocation `12`，最大并发
`1`，synthetic Qwen port calls `17`；`providerCalls=0`、`credentialReads=0`、approved tag/formal evidence/业务写入=`0`。
`usageAuthority=synthetic_estimate` 不代表 Provider 计量或账单；`verifiedProviderUsageSamples=0`、
`verifiedProviderCostCny=null`。focused `4/4`、G1+G2 `10/10`、Agent full `1423/1423`、typecheck/lint 通过。
factory/report/final_11 compatibility SHA 已冻结；后者只提供 bounded diagnostic，不改写 G1/G2 gate。完整记录见
`docs/acceptance/phase-6-9-8-retriever-final-response-p1-s2-reviewed-mock-static.md`。

## 6. L2：独立 semantic canary（已执行一次并失败封存）

zero-provider admission contract 已独立完成；随后在 S2 source 已推送、已合并并完成 `main` 二次回归、重新接受当次
DeepSeek/Qwen 数据边界并给出 exact authorization 后，唯一 L2 controlled-Live 已执行并失败封存：

1. 重新接受当次 DeepSeek/Qwen 数据保留边界；
2. 给出新的、精确到 lineage/source/confirmation 的一次性 authorization；
3. 重新冻结 provider price profile、总预算、marker/journal/artifact 路径和 data-boundary reader；
4. 仅执行一次 bounded run；本次在 `rewrite_03/schema` 打开 breaker 并 durable seal，禁止 retry/resume/replay/backfill；
5. L2 不自动接入 `/api/chat`；本次 quality gate failure 使产品 Docker/API/browser/main semantic authority 继续阻断。

普通“继续/好的/所有权限”不替代上述 exact authorization；本次 authorization 已消费，后续必须建立全新
zero-provider recovery/diagnostic lineage，不能重复本 run。
Admission contract 验收见 `docs/acceptance/phase-6-9-8-retriever-final-response-p1-l2-admission-zero-provider.md`。
Controlled-Live 失败封存见
`docs/acceptance/phase-6-9-8-retriever-final-response-p1-l2-controlled-live-quality-gate-failure.md`。

## 7. 文档、分支与交付协议

- 当前 P1 文档提交后推送 `drb/phase-6-9-8-p1-semantic-gate-design`；
- G1/G2/S2 各自从最新 `main` 新建普通 `drb/` 分支，不从功能分支派生；
- 每阶段完成后同步 `AGENTS.md`、`README.md`、`DEVLOG.md`、`docs/roadmap.md`、`docs/data-flow.md`、
  `docs/ai-behavior-acceptance.md`、`docs/acceptance-checklist.md` 与对应 acceptance；
- feature 完成后合并 `main`、推送 `origin/main`，在 `main` 上执行不访问 Provider 的回归/validator/文档检查；
- 已封存 L1/T3/R5/Task 9C artifacts 不格式化、不删除、不移动；Docker 容器、镜像、卷保持原状。

## 8. 预期读者问题

- P1 的 semantic gate 与 Task 8 reviewed Mock、V2 L1 transport authority 有什么不同？
- 为什么 `ragIncluded=false` 会清空 citation，而不是让模型自行决定？
- 为什么一个 lane 失败后不补发未启动 lane？
- 如何证明 responder 没有读取 oracle？
- 什么时候可以从 G2/S2 申请 L2，L2 又为什么不能直接解锁产品？
