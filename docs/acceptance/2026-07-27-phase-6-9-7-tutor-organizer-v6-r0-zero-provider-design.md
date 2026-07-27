# Phase 6.9.7 Tutor / WrongQuestionOrganizer V6 R0 零 Provider 复盘与设计验收

日期：2026-07-27

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

基线提交：`13a8a526`

## 1. 结论

V6 R0 已完成，范围仅为只读 V5 evidence postmortem、边界决策、独立 V6 设计与原子计划。没有修改
业务源码、V2 dataset/expected 或 V1--V5 artifact，没有读取 credential、调用 Provider、启动产品
Docker/API/browser 或修改业务数据。

V5 仍是不可变失败：唯一 run `aa637d3a-f7c4-4549-a724-9cdbefdd89c8` 为 `24/24` guard、12 次
Provider invocation、`11/48` strict runtime；第 6 对 Tutor `3021ms > 3000ms` timeout 后熔断，正式
semantic/P95/token/CNY 均为 `null`。V6 不 retry、resume、replay 或改判 V5。

用户允许下一独立版本重新评估 Tutor 时延边界。该许可只用于 R0 设计，不是 Provider Live、Docker、
产品验收或 main 合并授权。

## 2. 只读取证

三份 artifact SHA 重新核对：

| artifact    | SHA-256                                                            |
| ----------- | ------------------------------------------------------------------ |
| V5 evidence | `84487b448acd7bd5e65cd523eb7556cd9b3175bc9ba44572e06a78157c45b70a` |
| V5 journal  | `a8b8bcbfbbce9b5d8e62919edf24c71d2440cd94c74737d01fccb5c6204e8506` |
| V5 marker   | `c3a3eb063677303591b858f0667c94bd8d30f993cf060736e54f1bf3b18c9e75` |

V1--V5 validators 在 V5 R6 收尾时均返回 `ok=true`；本任务不重写或重新发布 evidence。

### 2.1 延迟

- Tutor strict：`1084/1592/899/1138/887ms`，范围 `887--1592ms`、均值 `1120ms`；
- Organizer strict：`2025/2221/1859/2607/2123/2224ms`，范围 `1859--2607ms`、均值
  `2176.5ms`；
- Tutor runtime-06：runtime trace `3021ms`、candidate orchestration `3022.3072ms`、paired
  `3025.385ms`。

共享 runtime 在 executor 周围使用 `setTimeout + AbortController + Promise.race`；trace 从
`invokeStructured` 入口计时并包含预算校验、executor 与 schema parse。Evidence 没有独立 Provider/
SDK/event-loop stage，因此不能把 21ms overshoot 唯一归因到任何一层。

### 2.2 语义

- Tutor 前 5 条：intent/context/guiding/final-answer/structure `5/5`，depth `2/5`；
- Organizer 前 6 条：subject/deck `6/6`、topic `5/6`、confidence `0/6`。

这些是 executed-subset diagnostics，不是正式 semantic。代码复核确认 V5 Tutor authority 允许多个
compatible depth，但 evaluator 使用 exact expected；Organizer 则接受并直接应用模型 confidence，没有
本地 authority 重算。两处都属于 contract ownership 问题，不能靠修改 expected 解决。

## 3. 冻结决策

1. V6 Tutor executor hard timeout 为 `3500ms`；Tutor candidate P95 继续 `<=2500ms`。
2. Organizer hard timeout/P95 继续 `5000/4500ms`；paired P95 `<=4500ms`、Tutor orchestration
   P95 `<=6500ms` 均不变。nearest-rank P95 固定按 `sorted[ceil(0.95 * n) - 1]` 计算，四类 24-sample
   gate 均取升序第 23 个值。
3. V6 增加安全的 executor/runtime/orchestration/paired duration 与 overshoot 证据，所有 clock 异常
   fail-closed。
4. Tutor 模型只负责 eligible intent 选择；preferred depth 与最终策略字段由本地 authority 重建。
5. Organizer 模型只负责 subject/deck/topic ordinal；confidence 由本地 evidence authority 重建。
6. 新增 model-owned axes 质量门：Tutor intent 在固定 24 case 上 exact-match `>=0.85`（至少
   `21/24`）；Organizer subject decision action/ordinal、deck action、target ordinal 在固定 32 decision
   units 上分别 exact-match `>=0.85`（每项至少 `28/32`）。缺失、非法、fallback 或未启动均计 false。
7. V2 dataset/expected/baseline bytes/SHA 不变；V6 新建 eval policy、candidate、runner、approval、
   marker/journal/evidence/validator identity。

`3500ms` 来自 `2500ms quality SLA + 1000ms cancellation margin`，不是针对 `3021ms` case 的特例。
超时仍立即失败且无 retry；只要 48 runtime 不完整，正式聚合仍全部为 `null`。

## 4. 文档与实施路线

新增：

- `docs/superpowers/specs/phase-6-9-7-tutor-organizer-v6-remediation-design.md`；
- `docs/superpowers/plans/phase-6-9-7-tutor-organizer-v6-remediation.md`；
- 本 acceptance。

路线冻结为 R1 deadline/local authority contract、R2 bounded candidate/robustness、R3 runner/lineage、R4
static/Mock、R5 唯一 controlled-Live、R6 产品 Docker/API/browser、R7 main 收尾。每个任务独立提交并
推送；任一前置失败都停止后续。

## 5. 当前停止点

- V6 没有 source implementation、runner、CLI、marker、journal、evidence 或 validator；
- 没有 V6 Mock/Live 结果，也没有质量 authority；
- 没有读取根 `.env` 或任何 component key；
- 没有 Provider、Docker/API/browser、账号、Trace、数据库、Redis 或 MinIO 操作；
- V5 历史路线中的 R7/R8 永久被 V5 R6 失败阻断；V6 R6/R7、Task 13/main、Phase 6.9.8、Phase
  6.10、Phase 8/9 与博客收尾也仍被各自前置门阻断。

下一原子任务仅 V6 R1。任何未来 Provider 调用都必须在 R4 static/Mock checkpoint 通过后，重新接受
运行当时 DeepSeek 数据边界并取得新的 V6 精确授权；只有授权后的 R5 zero-network preflight 通过，
才可在首次 Provider 调用前创建 V6 marker/journal。

## 6. 回顾问题

- 为什么把 Tutor hard timeout 放宽到 3500ms，不等于放宽 2500ms P95 质量门？
- 为什么 V5 的 3021ms 不能直接归因于 Provider？
- 为什么 Tutor depth 和 Organizer confidence 应由本地 authority 拥有，模型仍然是 Agent 的大脑？
- 新增 model-owned axes 怎样防止本地派生字段把模型质量“刷高”？
- 为什么 V6 可以复用 V2 dataset bytes，却必须使用新的 eval/runner/evidence identity？
