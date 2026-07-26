# Phase 6.9.7 Tutor / WrongQuestionOrganizer V4 Remediation Plan

**目标：** 在保持 V1/V2/V3 历史、冻结质量门、安全权限和无重试边界不变的前提下，修复
Tutor/Organizer 的 bounded diagnostic 真值与语义单一规则源；完成独立 held-out/metamorphic、
V4 runner/evidence 和 static/Mock checkpoint 后停止，只有新的精确授权才执行一次 V4
controlled-Live，只有全门通过才进入产品与 main 路径。

**当前状态：** R0--R5 已完成；唯一 R6 run `0fb47591-5ff4-4e46-bcf3-2cd267d1fb2f` 已以
`10/48` strict runtime、`quality_gate_failed` durable seal。V4 一次性名额已经消费且不得重跑；后续
独立 V5 R0 已完成零 Provider 根因取证，不改变本 V4 authority。R7--R9、产品 Docker/API/浏览器验收、
Task 13/main、Phase 6.10 与博客收尾均不得开始。

**设计 authority：**
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v4-remediation-design.md`

## 执行不变量

- 只在 `codex/phase-6-9-7-tutor-wrong-question-agents` 工作，不创建 worktree 或子分支；
- main agent 拥有编辑、决策、验证和提交，subagent 只读；
- 一个 R-task、一个聚焦交付、一次相关文档同步、一个原子提交；
- 不机械重跑未受影响的全量门，验证与改动风险匹配；
- V1/V2/V3 marker/journal/evidence 不删除、不改名、不覆盖、不重建、不重跑、不拼接；
- dataset/SHA/expected/baseline/metric/threshold/分母/model/price/budget/timeout/retry 不变；
- 不保存 prompt、题目/答案、active context、raw model/provider output、credential、URL/header、
  stack、真实 ID 或自由文本失败原因；
- R0--R5 不读取真实 credential、不调用 Provider、不启动产品 Docker/API/browser；R6 只在授权进程内
  映射 component credential，且同样没有启动产品 Docker/API/browser；
- 24 guard 先行、单 pair 最多双并发、lane 独立、首个 runtime contract failure 熔断、固定分母；
- semantic-only mismatch 不提前 breaker；无 retry、补跑、resume 或 replay；
- 禁止 Docker prune、`down -v`、volume/database reset、Redis flush、MinIO wipe；
- V4 Live 授权已在 R5 后单独精确取得并消费；不得重跑、补跑、resume、replay 或复用该授权。

## R0：V3 bounded 复盘与 V4 设计

**状态：** [x] 已完成。

**文件：**

- 新增 V4 remediation design；
- 新增本计划；
- 新增 V4 R0 zero-provider acceptance；
- 更新 `AGENTS.md`、`README.md`、`DEVLOG.md`、`docs/roadmap.md`、`docs/data-flow.md`、
  `docs/ai-behavior-acceptance.md`、`docs/acceptance-checklist.md` 与总 Phase 6.9.7 计划/设计入口。

**验收：**

- [x] 复核 V3 immutable authority、bounded evidence 与 clean branch 起点；
- [x] 区分 executed semantic mismatch、dynamic contract failure 和 breaker 未执行项；
- [x] 定位 Tutor 三个可见 intent precedence 失败与 Organizer topic/evidence 弱项；
- [x] 不把粗粒度 `subject_authority_violation` 猜成 Provider/topic/raw-output 根因；
- [x] 冻结 V4 identity、diagnostic taxonomy、语义规则、anti-overfit、工程复用与停止条件；
- [x] 明确不改 dataset/门槛/权限，不让 merger 修正非法模型输出；
- [x] 无 credential、Provider、Docker/API/browser 或业务数据操作。

**提交：** `docs(agent): design phase 6.9.7 v4 remediation`

## R1：V4 bounded diagnostics 与历史兼容

**状态：** [x] 已完成。2026-07-26，zero-network；当时下一步为 R2，后续 R2 已完成。

**主要文件：**

- Tutor/Organizer V4 diagnostic contract；
- Organizer dynamic validator V4 reason chain；
- paired entry/report V4-only projection；
- V1/V2/V3 absent-field 与 cross-version tests。

**GREEN：**

- Organizer 的 subject/topic/evidence/confidence/deck failure 使用互斥固定 reason，不保存原文；
- Tutor 区分 intent/depth/context/guiding/final-answer/structure mismatch；
- executed semantic mismatch、dynamic contract failure 和 not-started 不再混为 invalid；
- merger 复用相同 validator result，不创建第二套 reason 顺序；
- V1/V2/V3 report 不出现 V4 字段，历史 validator 与 SHA 不变；
- 全部 synthetic/no-network。

**完成证据：** 新增独立 `phase-6.9.7-v4-bounded-diagnostics-v1` case/report contract；固定
not-started、contract failure、semantic mismatch/match 四类终态和七类 contract stage；Organizer
validator 以唯一 `context/index -> subject -> deck -> topic -> evidence -> confidence` 链返回精确
`stage/axis/reason`，legacy API 只映射同一结果，产品 merger 复用已通过 validation。72-case report
重新计算 execution/stage/axis/reason aggregate 并拒绝篡改；V1/V2/V3 V4-field absent、双向 strict
validator 隔离和 synthetic SHA 不变测试通过。Agent 全量 `635 passed / 6759 expect()`，typecheck、
lint、Prettier、diff check 通过；未读取 credential、调用 Provider 或实现 V4 runner/Live artifact。
详见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r1-bounded-diagnostics.md`。

**提交：** `feat(agent): add phase 6.9.7 v4 bounded diagnostics`

## R2：Tutor V4 语义单一规则源

**状态：** [x] 已完成。2026-07-26，zero-network；当时下一步仅 R3，后续 R3 已完成。

**GREEN：**

- 深冻结 intent precedence：step/explain/concept/hint 优先于 general follow-up；
- prompt formatter、validator、depth compatibility 与 local strategy invariants 同源；
- active context 不能压过更具体 primary evidence；
- 不新增 answer_direct、最终答案、route/tool/permission 能力；
- 合成冲突/否定/双语/上下文重排测试通过，prompt 无 oracle 泄漏。

**完成证据：** 新增深冻结 `tutor-model-candidate-v4` policy，显式固定
`step_check > explain_solution > concept_bridge > socratic_hint > general_follow_up`；当前 Tutor
candidate 的 formatter、validator、depth、merger precedence 与本地 strategy invariants 共用该
authority。`general_follow_up` 不再能仅凭 active context 压过具体 intent，否定式“不要直接给答案”
不会误开 `answer_direct`。冻结 deterministic detector/baseline 保持原字节和原指标；历史 V2/V3
eval harness 改走只读 V2 policy path，V3 prompt SHA 仍为原值，避免新 V4 prompt 冒充旧 evidence。
全程未读取 credential、调用 Provider、启动 Docker/API/browser 或修改业务数据。详见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r2-tutor-semantics.md`。

**提交：** `feat(agent): align phase 6.9.7 v4 tutor semantics`

## R3：Organizer V4 语义单一规则源

**状态：** [x] 已完成。2026-07-26，zero-network；当时下一步仅 R4，后续 R4 已完成。

**GREEN：**

- 已知 subject 强制 `keep_local + structured_subject`，未知 subject 禁止 `keep_local`；
- create/reuse、topic、evidence、confidence 使用同一决策矩阵；
- computer/major/other、topic specificity 与 insufficient-signal 边界明确；
- validator fail-closed，merger 不补 evidence、不替换越权 subject、不改 unsafe topic；
- owner、ordinal、locked name、deck subject 与 stale authority 不变。

**完成证据：** 新增深冻结 Organizer V4 policy，产品默认 candidate 使用
`wrong-question-organizer-model-candidate-v4`。Known/unknown subject、keep/create/reuse、同学科 deck、
精确 topic、required evidence 与 confidence 共用同一矩阵；merger 只应用已通过 validation 的 ordinal
decision，不补 evidence、不修正越权 subject、不清洗 unsafe topic。owner、locked-name、三阶段
stale authority、single call、独立预算、abort/no-retry 保持不变。历史 paired harness 显式走 V2
candidate，V2 formatter SHA 与 V3 Organizer prompt SHA 不变；冻结 dataset/baseline 与 V1/V2/V3
artifacts 未改写。全程未读取 credential、调用 Provider、启动 Docker/API/browser 或修改业务数据。
详见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r3-organizer-semantics.md`。

**提交：** `feat(agent): align phase 6.9.7 v4 organizer semantics`

## R4：Independent robustness 与 V4 lineage

**状态：** [x] 已完成。2026-07-26，zero-network；当时下一步仅 R5，后续 R5 已完成。

**GREEN：**

- [x] 新建与 72-case dataset 隔离的 versioned held-out/metamorphic/schema-negative fixtures；
- [x] 实际 candidate prompt 做 case ID/expected/accepted-label/oracle 泄漏扫描；
- [x] authority drift、batch/question/deck reorder、abort、预算与写隔离回归通过；
- [x] 新 V4 runner/prompt/approval/confirmation/marker/journal/evidence/validator identity；
- [x] 保留 V3 调度原则但使用独立 V4 terminal projection/hash-chain/recovery/evidence，与 V1/V2/V3 artifact 双向隔离；
- [x] 无真实 credential、Provider 或 Live artifact。

**完成证据：** `phase-6.9.7-v4-independent-robustness-v1` fixture 覆盖 Tutor 跨语言改写、否定、
context reorder 与 Organizer authority/schema drift；测试扫描实际 candidate prompt，并验证 lane 独立
abort/预算、single-call/no-retry 和写隔离。独立 V4 runner/report/CLI/validator 与
marker/journal/recovery/evidence durability 已落地：marker `wx` 单胜者、dispatch-before-call fsync、固定
72/24/48 hash-chain、breaker、orphan seal、ABA fence、hard-link final、same-byte idempotency 与
cross-version/tamper fail-closed 均有回归。Live CLI 在 R6 前硬拒绝。Durability `6/6`、R4/V3
focused `68/68`、Agent full `674/674`、typecheck/lint 与三版历史 validator/SHA 通过；未读取
credential、调用 Provider、启动 Docker/API/browser 或创建 V4 Live artifact。详见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r4-robustness-lineage.md`。

**提交：** `feat(agent): prepare phase 6.9.7 v4 evidence lineage`

## R5：分支 static/Mock checkpoint 与 Reader/安全终审

**状态：** [x] 已完成。2026-07-26，zero-network；该条记录 R5 当时停在 R6 精确授权门前，后续 R6 已失败封存。

**动作：**

- V4 focused、Agent/AI/Types/Server/Web 受影响门、typecheck/lint/build；
- Organizer PostgreSQL E2E 与 Compose quiet/default-off boundary；
- 冻结 deterministic baseline 与 dataset SHA；
- fresh V4 Mock：`24/24` zero-call、`48/48` strict runtime、semantic `1/1`；
- breaker/failure Mock：固定分母、单 pair 双并发、后续真实 0-call；
- V1/V2/V3 artifact SHA/validator 不变，V4 Live artifact/recovery claim 为 0；
- gates=false、component credential example empty、无 synthetic 产品残留；
- contract/security/concurrency 与 docs/operations/history 两路独立终审；
- fresh-reader 问题能从设计/计划/acceptance 得到一致答案。

**停止条件：** 全部门通过后停止。没有新的精确 V4 branch controlled-Live 授权不得进入 R6。

**完成证据：** fresh V4 Mock run `c1bdf998-6fae-4c32-a4e3-bd6bea053454` 为 `24/24` verified
zero-call、`48/48` strict runtime、Tutor/Organizer/combined semantic `1/1/1`，P95
`246/328/328/276ms`、usage `21948/5647`、estimated `0.099726 CNY`；V4 validator 通过。
`mock_synthetic` provenance 使 Live-only gate 按设计保持 `quality_gate_failed`。V4/V3 focused
`68/68`、Agent `674/674`、AI `199/199`、Types `42/42`、Server `2154 passed / 30 skipped`、Web
`439/439`、Organizer PostgreSQL E2E `12/12`、Compose quiet、历史 SHA/validator、V4 artifact=0、测试
账号零残留与两路终审通过。未读取 credential、调用 Provider 或启动产品 Docker/API/browser。详见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-r5-static-mock.md`。

**提交：** `docs(agent): checkpoint phase 6.9.7 v4 remediation`

## R6：唯一 V4 branch controlled-Live

**状态：** [x] 已执行并失败封存；不得重跑。

**已完成前置：**

- 用户重新接受当时 DeepSeek 账号的数据保留/训练边界；
- 用户明确写出一次 V4 branch controlled-Live 授权；
- R5 clean commit，V4 marker/journal/evidence 不存在；
- 历史 SHA、V4 Mock、gates/config/model/price/budget/timeout/credential isolation 全通过。

**执行结果：** zero-network preflight -> 进程级 component credential 映射 -> reserve V4 marker/journal ->
24 guard -> breaker-aware pair -> evidence seal/validator。唯一 run 为 `24/24` guard zero-call、6 对完成、
12 executor started、`10/48` strict runtime。第 6 对 Tutor 在 `dynamic_contract` 命中
`invalid_evidence_association`，Organizer sibling 为 attempted-aborted/usage unknown；剩余 36 runtime
按 breaker 没有启动。Tutor/Organizer semantic 为
`0.14410714285714285/0.10372596153846154`，最终 `quality_gate_failed`。

11 个 verified usage 的部分费用为 `0.032247 CNY`；完整费用与 P95 因样本不完整保持 `null`。Evidence、
58 条 hash-chain journal 与一次性 marker authority 已 durable seal，file/bundle validator 通过。完整证据见
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-controlled-live-failure.md`。

**提交：** pass 使用 `docs(agent): seal phase 6.9.7 v4 live authority`；fail 使用
`docs(agent): seal phase 6.9.7 v4 live failure`。

## R7：V4 分支产品 Docker/API/headed-browser 验收

**状态：** 阻断；R6 未通过，永久不得按 V4 lineage 执行。

- Tutor-only Docker Chat：specific intent applied、explicit zero-call、forced fallback；
- Organizer-only API：single/batch、known/unknown subject、create/reuse、owner/locked-name、Trace、
  usage/price 与唯一写 authority；
- headed `/chat` 与 `/error-book`，1440/510/390px，窗口保持可见；
- 精确清理本轮 synthetic user/question/group/deck/item/Trace/session/storage；
- 恢复 mock/live=false、目标 gates=false、component keys absent；
- 保留所有既有 Docker 容器、镜像、卷、PostgreSQL、Redis 与 MinIO 数据。

**提交：** `docs(agent): accept phase 6.9.7 v4 product path`

## R8：分支最终文档 checkpoint

**状态：** 阻断；R6 未通过，永久不得按 V4 lineage 执行。

- 同步所有当前文档、acceptance、AI behavior/checklist/dev-start；
- 精确区分 V1/V2/V3 failures、V4 authority 与 product lineage；
- gates=false、工作区 clean、零 synthetic 残留；
- 两路最终复审无 Critical/Important。

**提交：** `docs(agent): complete phase 6.9.7 branch`

## R9：合并 main、main 回放与远程推送

**状态：** 阻断；R6 未通过，不合并 main、不做产品回放。

1. 切回最新 `main` 并核对 `origin/main` parity；
2. `git merge --no-ff codex/phase-6-9-7-tutor-wrong-question-agents`；
3. 不重跑 V1/V2/V3/V4 Live，只读 committed authority；
4. main focused/static/Mock 与 default-off Docker API/headed-browser 回放；
5. 精确清理 main synthetic 资源，确认 gates=false/keys absent/volumes retained；
6. 提交 main acceptance；
7. 推送 `main` 并核对远程 SHA parity；
8. 不创建或遗留 worktree。

## 完成定义

原完成定义要求 R0--R9 的适用步骤完成、V4 Live 与产品验收通过、main 回放通过且远程同步。唯一
R6 已失败，因此该定义未满足，Phase 6.9.7 未完成。R7--R9 不再是待办而是当前 V4 lineage 的
禁止项；R1--R5 的零网络/static/Mock 工程质量不能替代真实模型或产品可用性证据。
