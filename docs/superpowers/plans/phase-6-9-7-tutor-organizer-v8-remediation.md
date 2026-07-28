# Phase 6.9.7 Tutor / WrongQuestionOrganizer V8 实施计划

日期：2026-07-28

当前状态：R0/R1 已完成；下一原子任务仅 R2 zero-provider robustness/anti-overfit。V7 一次性名额已消费，不得重跑。

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

状态：[ ] 当前下一原子任务，zero-provider。

- 独立 schema-negative、metamorphic、held-out 与常见 Provider JSON 变体；
- responder 不得读取 expected/oracle 或复用 production validator 生成答案；
- 覆盖 reorder、bilingual、unknown keys/type drift、fence/prose/wrapper 与递归 no-leak；
- 保持 strict reject，不做隐式 coercion 或自动修复 Provider output。

## R3：独立 V8 runner / lineage / durability

状态：[ ] 仅 R2 通过后开始。

- 新 runner/report/CLI/approval/marker/journal/evidence/recovery/validator identity；
- 固定 `72/24/48/24/32`、guard-first、pair 串行、single dispatch/no retry；
- V1--V7 双向 lineage 拒绝、exclusive-create、hash-chain、hard-link evidence、crash-only recovery；
- 不创建正式 Mock/Live artifact，不读取 credential。

## R4：reviewed Mock 与全量 checkpoint

状态：[ ] 仅 R3 通过后开始。

- fresh baseline、reviewed Mock、fault matrix；
- Agent/AI/Types/Server/Web 全量与 typecheck/lint/build；
- Organizer PostgreSQL concurrency、Compose default-off、历史 SHA/validators；
- 两路独立复审、Mock evidence 精确删除、V8 Live artifact=0。

## R5：唯一 V8 branch controlled-Live

状态：[ ] 未授权，R4 前不得申请。

必须由用户在运行当时重新接受 DeepSeek 数据保留/训练边界，并明确授权唯一一次 V8 branch Live。
普通“继续”不构成 R5 授权。无论通过或失败都只 seal 一次，不 retry/resume/replay/backfill。

## R6：产品 Docker / API / 可见浏览器

状态：[ ] 仅 R5 全门通过后允许。

覆盖 Tutor Chat、Organizer single/batch、default-off/forced-failure/owner/stale/Trace、可见
`/chat`/`/error-book` 与精确清理；保留 Docker 容器、镜像和卷。

## R7：main 合并与回放

状态：[ ] 仅 R6 与独立复审通过后允许。

在当前功能分支完成文档与提交推送；随后从最新 main 执行 `--no-ff` 合并，main 不重跑已消费 Live，
只做 committed static/Mock 与 default-off Docker/API/可见浏览器回放，精确清理后推送并核对远程 SHA。
