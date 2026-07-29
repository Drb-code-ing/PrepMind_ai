# Phase 6.9.7 Tutor / WrongQuestionOrganizer V9 实施计划

日期：2026-07-29

当前状态：R0 zero-provider 复盘与设计、R1 option authority/selection contract TDD、R2 Provider-like
robustness 已完成；下一原子任务仅 R3 runner/lineage/durability。V1--V8 一次性 Live 历史均不可重跑，V9 尚未读取 credential、调用
Provider、执行正式 Mock/Live 或创建正式 artifact。

设计 authority：
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v9-remediation-design.md`

## R0：V8 复盘与 V9 设计

状态：[x] 完成，zero-provider。

交付：

- 冻结 V8 run `7ff09c36-50f2-445a-b309-dc9500e5e13c` 的 stage/counter/SHA/禁止边界；
- 区分 fixed-shape static success 与后续 dynamic shortlist authority failure；
- 明确 sealed evidence 不能确定 fingerprint、coverage、subject、action 或 target 的具体失败项；
- 冻结本地合法 option authority，以及模型 exact `{questionIndex,optionIndex}` selection contract；
- 冻结 fingerprint 不由模型回显、V6 validator/merger 二次校验、三阶段 stale/write authority；
- 冻结 bounded no-raw diagnostic、option cap/token allocator、R1--R7 与独立 V9 lineage。

验收：
`docs/acceptance/2026-07-29-phase-6-9-7-tutor-organizer-v9-r0-zero-provider-postmortem.md`

## R1：Option Authority 与 Selection Contract

状态：[x] 完成，zero-provider。

- 新增 V9 option policy/builder/projection/version/SHA；
- 从 validated V5 shortlist 确定性枚举完整合法 option，canonical 去重、稳定排序、bucket coverage、
  `24/question`、`144/request` 与 `3500` input-token fail-closed；
- 冻结 zero-option 终态：有效 shortlist 但任一题无 option 时
  `attempted=false / not_eligible / candidate_option_authority_empty`，保留 binding 与逐题 deterministic
  suggestions；cap/token 无法保留 mandatory bucket 时使用
  `fallback_budget_exceeded / candidate_option_authority_budget_exceeded`；
- prompt-safe projection 只接受 validated V5 authority；V5 允许的 model-facing 文本先完整安全扫描再
  裁剪，`status/updatedAt` 不投影，并固定递归 key allowlist 与 `80` Unicode-scalar option label cap；
  `answer/userNote` 是 V5 strict schema 的未知额外字段，出现即 `invalid_input`，不会扩展历史 schema；真实
  ID/owner/fingerprint map/credential/permission 永不进入 prompt；
- 新增 exact schema/prompt：模型只返回 `decisions[{questionIndex,optionIndex}]`，不回显 fingerprint；
- 本地将 selection 映射为 V6 decision，注入本地 fingerprint，再执行 V6 validator 与 merger；
- 冻结 `phase-6.9.7-v9-candidate-input-estimator-v1`：
  `64 + ceil(utf8Bytes([system, canonical projection, schema].join('\n')) / 3)`；candidate/adapter 共用同一
  parts builder，version/helper SHA 与 prompt/policy/option rules 一起绑定；
- 新增 bounded selection/option diagnostic，不保存原始值；
- 保持 Tutor、dataset、预算、timeout、Trace、owner/stale/locked-name/write authority 不变。

通过门：focused TDD、Agent/AI typecheck/lint/Prettier、V1--V8 validators/SHA；无 Provider、正式
Mock/Live、Docker/API/browser。

验收：
`docs/acceptance/phase-6-9-7-tutor-organizer-v9-r1-option-authority.md`

## R2：Provider-like Robustness 与 Anti-overfit

状态：[x] 完成，zero-provider。

- 独立 held-out/metamorphic/schema-negative/Provider-like fixture；
- 覆盖 option reorder、question reorder、cap/token boundary、Unicode/canonical duplicate、no-option、
  optionIndex negative/fraction/string/out-of-range、duplicate/partial question、wrapper/prose/fence/type drift；
- 覆盖 ASCII/CJK/emoji/combining 与 `3499/3500/3501` estimator fixture、candidate/adapter estimate 漂移、
  先裁剪后藏 credential、Unicode `Cf`/control、递归额外 sensitive key 与 strict allowlist；
- 覆盖 pre/in-flight/post abort、pre/post/final stale fence、owner/locked-name/concurrent rename/move/remove；
- synthetic responder 只读实际 bounded prompt，不读 expected/oracle，不调用 production validator/builder
  生成答案；
- hostile getter/proxy/cycle/deep/wide 与递归 sensitive-key scan 全部 fail-closed。

通过门：focused + Agent/AI full、typecheck/lint/Prettier、历史 validators、独立 source scan 与复审；无
Provider、正式 Mock/Live、Docker/API/browser。

验收：
`docs/acceptance/phase-6-9-7-tutor-organizer-v9-r2-provider-robustness.md`

## R3：独立 V9 Runner / Lineage / Durability

状态：[ ] 当前下一原子任务，仅 R2 通过后允许，zero-provider。

- 新 report/runner/CLI/approval/marker/journal/evidence/recovery/validator identity；
- 固定 `72/24/48/24/32`、guard-first、pair 串行、双 lane、single dispatch/no retry；
- V1--V8 双向 lineage rejection、exclusive marker、dispatch-before-call hash-chain journal、hard-link
  evidence、crash-only single-owner recovery；
- 复用 V7 8-stage wire 必须显式记录 alias，不伪造新的 AI wire export；
- selection/static/dynamic failure 必须携带 bounded diagnostic；guard/not-started/transport/abort/orphan 不
  伪造 option 原因；
- `lane_reserved` 在 executor 前 durable；reserved-but-no-terminal 只 seal 为
  `attempted_orphaned/orphaned/fallback_runtime_error`，未 reserved 按 journal 映射为
  `not_started_case_guard/not_started_quality_breaker/not_started_orphaned`；
- transport/HTTP/abort/schema/usage failure 必须有显式 runtime terminal 与真实 wire stage；报告重算
  reserved/terminal/orphaned/not-started、pair、breaker 与 executor/dispatch/response/usage 计数；
- breaker 后固定分母，incomplete semantic/P95/token/CNY 全 `null`；
- 正式 V9 Mock/Live artifact 保持 0。

## R4：Reviewed Mock 与全量 Checkpoint

状态：[ ] 仅 R3 通过后允许，zero-provider。

- fresh deterministic baseline 与 reviewed Mock/fault matrix；
- Mock 穿过正式 V6 Tutor candidate、V9 option authority/selection candidate、V6 merger 与第一方 direct
  adapter，只有 fetch delegate 为 synthetic；
- 24/24 guard zero-call、48/48 strict runtime、48/48/48/48 wire/usage 完整；
- Agent/AI/Types/Server/Web 全量、Organizer PostgreSQL concurrency、Compose default-off、历史 SHA/
  validators；
- Mock evidence 精确删除、V9 Live artifact=0、Reader Testing 与双路独立复审。

Mock 满分只允许 `mock_quality_not_evidence`，不能写成真实模型或产品通过。

## R5：唯一 V9 Branch Controlled-Live

状态：[ ] 未授权。

只有 R4 clean/pushed、local/tracking/GitHub SHA 一致、历史 validators 与 V9 artifact=0 全门通过，且用户在
运行当时重新接受 DeepSeek 数据保留/训练边界并精确授权唯一 V9 branch Live，才允许执行一次。普通
“继续”“好的”或此前对 V8 的授权都不构成 V9 R5 授权。任一终态只 seal，不
retry/resume/replay/backfill。

## R6：产品 Docker / API / 可见浏览器

状态：[ ] 仅 R5 全门通过后允许。

覆盖 Tutor Chat、Organizer single/batch、default-off/forced-failure/owner/stale/Trace、可见
`/chat`/`/error-book` 与精确 synthetic 清理；保留 Docker 容器、镜像和卷。

## R7：Main 合并与回放

状态：[ ] 仅 R6 与独立复审通过后允许。

从最新 main 使用普通 git 分支流程执行 `--no-ff` 合并；main 不重跑已消费 Live，只复验 committed
static/Mock authority 与 default-off Docker/API/可见浏览器，精确清理后推送并核对远程 SHA。
