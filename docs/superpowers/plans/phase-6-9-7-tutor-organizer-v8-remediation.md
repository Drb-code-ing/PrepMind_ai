# Phase 6.9.7 Tutor / WrongQuestionOrganizer V8 实施计划

日期：2026-07-28

当前状态：R0--R4 已完成；唯一 R5 V8 branch controlled-Live 已以 `quality_gate_failed` 封存。V7/V8 一次性名额均已消费，不得重跑；R6/R7 被阻断。后续 V9 R0 zero-provider 设计已完成，当前下一原子任务仅 V9 R1。

设计 authority：
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v8-remediation-design.md`

## R0：V7 复盘与 V8 设计

状态：[x] 完成，zero-provider。

交付：

- 冻结 V7 run `81529c2c-79f5-4c21-9cee-e536a2fe78e3` 的 stage/counter/SHA/禁止边界；
- 区分静态 Zod shape failure 与后续 dynamic authority failure；
- 记录 `json_object`、V6 nested conditional union 与 ideal Mock responder 的覆盖缺口；
- 冻结 V8 fixed-shape ordinal-only 输出、脱敏字段级 diagnostic 和 anti-overfit matrix；
- 冻结 V8 R1--R7 路线、独立 identity 和逐级 gate。

验收：
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v8-r0-zero-provider-postmortem.md`

## R1：固定形状合同与脱敏诊断

状态：[x] 完成，zero-provider。

- 新增 V8 Organizer fixed-shape Zod schema、prompt policy/SHA、dynamic validator 与 V6 merger adapter；
- 新增 bounded schema diagnostic reason/count/type-shape fingerprint；
- 保持 V2 dataset、V6 authority/merger、预算、timeout、owner/stale/write 边界不变；
- TDD 覆盖 canonical success、所有固定 reason、hostile input/no-leak 与历史 SHA。

通过门：focused tests、Agent/AI typecheck/lint/Prettier、V1--V7 validators/SHA；无 Provider、Mock、Live。

验收：
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v8-r1-fixed-shape-diagnostic.md`

## R2：Provider-like robustness 与 anti-overfit

状态：[x] 完成，zero-provider。

- 独立 schema-negative、metamorphic、held-out 与常见 Provider JSON 变体；
- responder 不得读取 expected/oracle 或复用 production validator 生成答案；
- 覆盖 reorder、bilingual、unknown keys/type drift、fence/prose/wrapper 与递归 no-leak；
- 保持 strict reject，不做隐式 coercion 或自动修复 Provider output。

实现补充：V8 schema identity 要求 Provider content 为原生 JSON；V7 exact fence 兼容保持不变。独立
fixture 的冻结合同/content SHA 为
`sha256:f0a93a83000cb1f3515057482eca7ebbbb0ce0ef441cfd1cb7075073e000793f`，不是物理文件 SHA；
覆盖 static malformed decision 首/中/尾、动态 authority、双 stale fence 与 synthetic direct adapter。

通过门：focused `24/24`、Agent `878/878`、AI `226/226`、typecheck/lint/Prettier、V1--V7
validators 与独立复审通过；无 Provider、正式 Mock/Live、Docker/API/browser。

验收：
`docs/acceptance/2026-07-28-phase-6-9-7-tutor-organizer-v8-r2-provider-robustness.md`

## R3：独立 V8 runner / lineage / durability

状态：[x] 完成，zero-provider；未执行正式 Mock/Live。

- 新 runner/report/CLI/approval/marker/journal/evidence/recovery/validator identity；
- 固定 `72/24/48/24/32`、guard-first、pair 串行、single dispatch/no retry；
- V1--V7 双向 lineage 拒绝、exclusive-create、hash-chain、hard-link evidence、crash-only recovery；
- V8 复用 V7 已冻结的 8-stage wire protocol，只独立版本化 report/runtime/artifact lineage，不伪造新的
  `@repo/ai` wire export；
- Organizer static/dynamic contract failure 必须携带 bounded diagnostic，guard/not-started/纯 transport
  failure 保持 `null`；
- 完成态 recovery 按 journal breaker 终态重建未调度项，区分 `not_started_case_guard`、
  `not_started_quality_breaker` 与真正 crash orphan；
- 不创建正式 Mock/Live artifact，不读取 credential。

通过门：R3 focused `24/24`（`215` assertions）、V8 focused `46/46`（`888` assertions）、Agent
`902/902`、AI `226/226`、typecheck/lint/Prettier、V1--V7 validators、artifact=0 与独立复审通过。

验收：
`docs/acceptance/phase-6-9-7-tutor-organizer-v8-r3-runner-lineage-durability.md`

## R4：reviewed Mock 与全量 checkpoint

状态：[x] 完成，zero-provider。

- fresh baseline、reviewed Mock、fault matrix；
- Agent/AI/Types/Server/Web 全量与 typecheck/lint/build；
- Organizer PostgreSQL concurrency、Compose default-off、历史 SHA/validators；
- 两路独立复审、Mock evidence 精确删除、V8 Live artifact=0。

实现结果：fresh baseline 保持 `12/48` 与 semantic
`0.6629642857/0.278125/0.4705446429`；reviewed Mock run
`c8635a6a-0fbe-4d03-a7c9-9dd41c612d7c` 为 `24/24` zero-call、`48/48` strict
runtime、semantic/model-owned `1/1/1`、wire `48/48/48/48`，gate 固定
`mock_quality_not_evidence`。Mock evidence 已精确删除，V8 Live artifact=0；全量静态、PostgreSQL
`12/12`、Compose default-off 与 V1--V7 validators 通过。Types 真实口径为 `42/42 + typecheck`，
package 没有独立 ESLint 工具，未伪称 Types lint 通过。

验收：
`docs/acceptance/phase-6-9-7-tutor-organizer-v8-r4-static-mock.md`

## R5：唯一 V8 branch controlled-Live

状态：[x] 失败封存。

必须由用户在运行当时重新接受 DeepSeek 数据保留/训练边界，并明确授权唯一一次 V8 branch Live。
普通“继续”不构成 R5 授权。无论通过或失败都只 seal 一次，不 retry/resume/replay/backfill。

唯一 run `7ff09c36-50f2-445a-b309-dc9500e5e13c` 为 `24/24` guard zero-call、前两对
dispatched/completed、4 次 executor/dispatch/response/verified usage、`3/48` strict runtime。第二条
Organizer 已通过完整 wire、fixed-shape schema 与 usage，但在本地 dynamic shortlist authority 成为
`fallback_schema_invalid / dynamic_contract`，bounded reason 为 `dynamic_authority`；后续 44 runtime 未
启动，正式 semantic/P95/token/CNY 全 `null`，gate `quality_gate_failed`。Artifact 已 durable seal，bundle
validator `ok=true / filesChecked=1`，无 recovery claim。

验收：
`docs/acceptance/2026-07-29-phase-6-9-7-tutor-organizer-v8-controlled-live-failure.md`

## R6：产品 Docker / API / 可见浏览器

状态：[ ] 被阻断；R5 未通过质量门，不得开始。

覆盖 Tutor Chat、Organizer single/batch、default-off/forced-failure/owner/stale/Trace、可见
`/chat`/`/error-book` 与精确清理；保留 Docker 容器、镜像和卷。

## R7：main 合并与回放

状态：[ ] 被阻断；R6 不得开始，因此不能合并 main。

在当前功能分支完成文档与提交推送；随后从最新 main 执行 `--no-ff` 合并，main 不重跑已消费 Live，
只做 committed static/Mock 与 default-off Docker/API/可见浏览器回放，精确清理后推送并核对远程 SHA。
