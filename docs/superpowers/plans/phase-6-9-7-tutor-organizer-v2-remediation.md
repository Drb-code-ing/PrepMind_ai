# Phase 6.9.7 Tutor / WrongQuestionOrganizer V2 Remediation Plan

**目标：** 在不重跑或改写 V1、不放宽安全/权限/质量门的前提下，修复 Tutor 与
WrongQuestionOrganizer 的 prompt/contract 对齐问题，完成 V2 静态/Mock checkpoint；随后只有在
新的精确授权下执行唯一 V2 controlled-Live，并仅在全门通过后进入产品验收。

**当前状态：** R1 bounded diagnostics、R2 Tutor prompt/contract、R3 Organizer precision、R4
held-out/metamorphic anti-overfit、R5 独立 V2 lineage 与 R6 static/Mock/生产极端边界均已完成。
R7 唯一 V2 branch controlled-Live run `67ce18dd-e2ed-4a05-8507-2a98898b8ede` 已执行并以
`quality_gate_failed` 封存：`24/24` zero-call 通过，但 `0/48` strict runtime、Tutor/Organizer
semantic `0/0`、verified usage `0`。V2 marker/evidence 已消费且不得重跑；V2 R8--R11 永久
不适用。后续 V3 R0 零 Provider 设计、R1 安全诊断/零网络 compatibility、R2 strict-gate
breaker/双 lane ledger/固定分母与 R3 crash-safe evidence 均已完成，后续 R4 已完成；唯一 V3 R5 又以 `quality_gate_failed` 封存，R6--R9 不得开始。

**设计 authority：**
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v2-remediation-design.md`

## 执行不变量

- 只在 `codex/phase-6-9-7-tutor-wrong-question-agents` 工作，不创建 worktree 或子分支；
- main agent 拥有全部编辑、决策、验证与提交；subagent 只读；
- 一个 R-task、一个聚焦目的、一次文档同步、一个提交；R10 的提交明确是
  `--no-ff` merge commit，其余适用 R-task 使用普通提交；
- 已通过的重验证不机械重复；只运行与风险匹配的 focused/full gates；
- V1 marker/evidence 不删除、不改名、不覆盖、不重建、不重跑、不拼接；
- dataset、SHA、baseline、threshold、分母、model、price、budget、timeout、retry、
  owner/write/Trace/default-off 边界全部不变；
- 不把 case ID、expected output、accepted topic labels 或 fixture 答案写入 prompt；
- 不保存 prompt、题目、active context、raw provider output/error、credential 或真实 ID；
- V2 静态/Mock checkpoint 完成后必须停止并申请新的明确授权；
- V2 Live 任一门失败即封存并停止，不继续产品验收；
- 禁止 Docker prune、`down -v`、volume/database reset、Redis flush、MinIO wipe。

## R0：冻结 V2 设计、失败边界与原子计划

**文件：**

- 新增 V2 remediation design；
- 新增本计划；
- 更新 `AGENTS.md`、`README.md`、`DEVLOG.md`、`docs/roadmap.md`；
- 更新 V1 acceptance 与原 Phase 6.9.7 spec/plan 的当前引用。

**验收：**

- [x] V1 数值、run/evidence/marker 与不可变边界准确；
- [x] Tutor/Organizer 的已证实事实与推断明确分开；
- [x] 新 identity、bounded diagnostics、anti-overfit 与停止条件完整；
- [x] 两个独立只读复审无未关闭 Critical/Important；
- [x] `git diff --check`、文档引用与冲突扫描通过；
- [x] 无 source code、credential、provider、Docker/API/browser 或业务数据操作。

**完成证据：** V1 evidence/marker SHA-256 复核仍为
`be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5` /
`7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb`。
contract/security 与 operations/acceptance 两路复审无 Critical/Important；Tutor 技术复审提出的
diagnostics 分层 RED matrix 已补齐后关闭，fresh reader 对 V1 边界、V2 变更、anti-overfit、
授权、失败/通过分支和 main/push 流程给出 `READER PASS`。`git diff --check`、目标文档存在性
与当前/历史冲突扫描通过；Git 变更仅为文档。

**提交：** `docs(agent): design phase 6.9.7 v2 remediation`

## R1：V2 bounded diagnostics 与 V1 report compatibility

**主要文件：**

- `packages/agent/src/evals/phase-6-9-tutor-wrong-question-paired-contract.ts`
- `packages/agent/src/evals/run-phase-6-9-tutor-wrong-question-paired.ts`
- candidate observation / matching tests
- V1/V2 report contract tests

**RED：**

- V2 无法区分 raw schema、dynamic contract、local merger 与 applied；
- 逐层 fixture 必须覆盖 schema-invalid、合法 schema+非法 evidence、合法 association+不兼容
  Tutor depth、Organizer projection association 失败、合法 applied；
- applied 必须 reason=null，zero-call 必须双 null，错误 stage/reason 组合必须拒绝；
- V1 report 若被自动补 V2 字段应失败；
- 自由文本或未知 diagnostic reason 应失败。

**GREEN：**

- 新增固定 `canonicalValidationStage` 与 `canonicalFailureReason`；
- Tutor/Organizer 通过 versioned bounded adapter 显式映射现有 contract/candidate reason；
- stage/reason 使用 strict discriminated union 与穷举组合测试，禁止自由字符串；
- zero-call 为 null，V1 字段必须 absent；
- 不保存 provider output、prompt 或用户正文；
- V1 evidence 继续验证且 hash 不变。

**验证：** focused contract/runner/candidate tests、Agent typecheck/lint、V1 bundle validator、
`git diff --check`。

**当前状态：已完成。** RED/GREEN focused `19/19`；Agent full `548/548`、`5643`
assertions；Agent typecheck/lint 通过。V1 bundle validator 返回
`{"ok":true,"filesChecked":1}`；既有 V1 evidence/marker SHA-256 仍为
`be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5` /
`7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb`。当前公共
runner 继续绑定 `phase-6.9.7-tutor-organizer-runner-v1`；future runner-v2 只有同时绑定
`tutor-model-candidate-v2` 与 `wrong-question-organizer-model-candidate-v2` 才能通过 report
contract，而本任务没有实现该 runner、发布 V2 evidence 或调用 provider/Docker/API/browser。
两路独立复审均为 `APPROVED`，无未关闭 Critical/Important。该 checkpoint 当时下一步为
R2，后续已完成。

**提交：** `feat(agent): add phase 6.9.7 v2 bounded diagnostics`

## R2：Tutor prompt/contract 单一规则源

**主要文件：**

- `packages/agent/src/model-candidates/tutor-model-contract.ts`
- `packages/agent/src/model-candidates/tutor-model-candidate.ts`
- Tutor contract/candidate/paired tests

**RED：**

- prompt 未描述每个 intent 的 primary/allowed evidence；
- prompt 未描述 compatible depth；
- `concept_bridge`、`explain_solution` 与相邻 intent 的通用区分不足；
- prompt/validator 可以各自漂移。

**GREEN：**

- 导出深冻结 readonly intent policy；
- validator 与稳定 prompt formatter 共用 policy；
- prompt version 升为 `tutor-model-candidate-v2`；
- 不改变 schema/projection、`answer_direct` 禁止或 local merger；
- 不包含 case ID、expected output 或 fixture 文本。

**验证：** Tutor focused、原 12 zero-call/24 runtime Mock、robustness precursor、Agent/AI
typecheck/lint、diff。

**当前状态：已完成。** 深冻结 policy 统一了五类 intent 的 primary/allowed
evidence、compatible depth 与通用选择语义；validator/prompt formatter/local merger
共用同一 authority。depth 仍由 local merger 最终 fail-closed，以保持 R1
`local_merger / incompatible_depth` 诊断。Tutor candidate 与 Web config 的 prompt
identity 已升为 `tutor-model-candidate-v2`，active public paired runner 仍为 V1，未提前
发布 V2 runner/marker/evidence。

Tutor/package focused `25/25`（`375` assertions）、Phase 6.9.7 兼容 `33/33`
（`656` assertions）、Web Tutor config `5/5`、Agent full `552/552`（`5827`
assertions）与 Web full `438/438` 通过；Agent/AI typecheck/lint、Web lint 与
`git diff --check` 通过。两路独立复审无未关闭 Critical/Important；其中一条
depth 意见经对照冻结设计后撤回为测试覆盖建议，已用逐 intent merger 矩阵补强。
V1 evidence/marker SHA-256 仍为
`be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5` /
`7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb`。未读取
credential、调用 provider、启动 Docker/API/browser 或修改业务数据。该 checkpoint 当时
下一步是 R3，后续已完成。

**提交：** `fix(agent): align tutor v2 prompt contract`

## R3：Organizer prompt/contract precision

**主要文件：**

- `packages/agent/src/model-candidates/wrong-question-organizer-model-contract.ts`
- `packages/agent/src/model-candidates/wrong-question-organizer-model-candidate.ts`
- Organizer contract/candidate/paired tests

**RED：**

- prompt 未完整描述 known/unknown subject authority；
- reuse/create evidence、high confidence、keep-local 规则缺失；
- topic label 允许过泛表达且 prompt 不要求单一 source-grounded concept；
- prompt 与 validator 关联规则可漂移。

**GREEN：**

- 导出深冻结 association policy，并由 validator/prompt formatter 共用；
- prompt version 升为 `wrong-question-organizer-model-candidate-v2`；
- 明确 subject taxonomy、same-subject deck、evidence/confidence 与 label precision；
- 不新增 canonical label 答案表，不扩大 accepted labels；
- 不改变 ordinal、owner、locked name、write isolation 或 local merger authority。

**验证：** Organizer focused、batch/ordinal/cross-subject/label tests、Agent/AI
typecheck/lint、diff。

**当前状态：已完成。** 单一深冻结 association policy 统一了 known/unknown subject
authority、same-subject deck、reuse/create evidence、confidence、六类 subject taxonomy 与
topic-label precision；validator 与稳定 prompt formatter 共用同一 authority。新增泛标签禁区
不包含 fixture 答案，也未扩大 accepted labels。Organizer candidate、Server config、Agent
Trace 与 future V2 report contract 共用
`wrong-question-organizer-model-candidate-v2` identity；active public runner/CLI 仍为 V1，
未提前发布 V2 marker/evidence。schema/projection v1、ordinal、owner、locked-name、写隔离与
local merger 均未改变。

R3/Phase 6.9.7 focused `40/40`（`582` assertions）、Agent full `554/554`（`6071`
assertions）、Server Organizer `30/30`（`162` assertions）、Agent/AI typecheck/lint、Server
lint/build 与 `git diff --check` 通过。两路独立复审无未关闭 Critical/Important；V1
evidence/marker SHA-256 仍为
`be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5` /
`7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb`。未读取
credential、调用 provider、创建 V2 evidence、启动 Docker/API/browser 或修改业务数据；
该 checkpoint 当时下一步为 R4，后续已完成。

**提交：** `fix(agent): align organizer v2 prompt contract`

## R4：Held-out / metamorphic anti-overfit suite

**主要文件：**

- 新增 V2 robustness fixtures/tests；
- prompt leakage scanner；
- paired/candidate metamorphic tests。

**覆盖：**

- Tutor 中英文同义改写、混合语言、context reorder、无关安全句；
- Organizer known/unknown subject、deck reorder、cross-subject、batch ordinal；
- duplicate/out-of-range、locked deck、prompt injection、credential；
- 语义不变变换保持 canonical decision，authority 变化时按规则变化或 fail-closed。

**边界：**

- robustness suite 不改变 72-case dataset/SHA/Live 分母；
- 不调用真实 provider；
- Mock/fixture 满分不成为 production authority；
- 0 个 frozen case ID/expected/canonical label 泄漏到 prompt。

**验证：** robustness focused、原 dataset identity tests、Agent full 或等价影响面、
typecheck/lint/diff。

**当前状态：已完成。** 新增独立深冻结
`phase-6.9.7-tutor-organizer-v2-robustness-v1` fixture，不进入冻结 72-case dataset、Live
分母或费用。Tutor suite 覆盖中英文同义改写、混合语言、上下文重排、无关安全句、context
authority 变化、incompatible depth、`answer_direct` 与注入/凭据 zero-call；Organizer suite
覆盖六类 held-out subject、known/unknown authority、same/cross-subject deck、deck/question
ordinal reorder、evidence 顺序/重复、越界 ordinal、locked-name 与 authority drift fail-closed。
实际 candidate request 的 prompt leakage scanner 同时扫描 frozen case ID、dataset identity、
oracle key、完整 expected object 与 canonical/accepted topic labels，并用故意污染反例证明 scanner
会报错；真实 V2 candidate prompt 命中为 0。

R4 focused `16/16`（`212` assertions）、Agent full `570/570`（`6283` assertions）、Agent
typecheck/lint、新增 TypeScript 文件的 Prettier check 与 V1 evidence validator 通过。冻结 dataset SHA-256 保持
`7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e`；V1
evidence/marker SHA-256 保持
`be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5` /
`7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb`，V2
marker/evidence 匹配为 0。Mock 满分仍由既有 paired runner 固定为
`quality_gate_failed`，不能成为真实语义质量 authority。没有读取 credential、调用 provider、
启动 Docker/API/browser 或修改业务数据；代码/安全与文档/历史边界两路独立复审均
`APPROVED`，无未关闭 Critical/Important。公共 runner/CLI 继续为 V1，下一步 R5。

**提交：** `test(agent): harden phase 6.9.7 v2 against overfit`

## R5：V2 runner/CLI/validator 与独立 one-shot evidence

**主要文件：**

- paired contract/runner identity；
- `packages/agent/scripts/phase-6-9-7-tutor-wrong-question-cli.ts`
- evidence validator 与对应 tests；
- package scripts。

**RED：**

- V1 marker 会错误阻塞 V2，或 V2 复用 V1 marker/evidence；
- V1 授权变量/确认词可以启动 V2；
- synthetic provenance 可以通过 production gate；
- V2 report 缺新 prompt/runner/diagnostic identity 仍被接受。

**GREEN：**

- runner `phase-6.9.7-tutor-organizer-runner-v2`；
- 新 approval env、确认词、marker 与 evidence prefix；
- exclusive-create 阻止第二次 V2；
- V1/V2 filename、runId、scope、mode、identity 和敏感字段分别验证；
- production gate 只接受 `deepseek_network`；
- V1 evidence/marker 兼容且 hash 不变。

**验证：** CLI/contract/runner/validator focused、Mock CLI、bundle validator、Agent
typecheck/lint、diff。

**当前状态：已完成。** legacy V1 `runPhase697TutorOrganizerPairedEval`、CLI、validator、确认词、
授权变量、marker 与 evidence filename 保持不变；新增独立
`runPhase697TutorOrganizerPairedEvalV2`、V2 CLI/validator entry 与 package scripts。V2 report 固定
`phase-6.9.7-tutor-organizer-runner-v2`、两个 v2 prompt identity，并要求 72 个 entry 都显式携带
bounded `canonicalValidationStage/canonicalFailureReason`；V1 entry 继续要求两个字段完全 absent。

V2 Live 只接受新确认词与 `PHASE_6_9_7_V2_CONTROLLED_LIVE_APPROVED=true`，使用独立
`.tmp/phase-6-9-7-tutor-organizer-v2-controlled-live.marker` 和
`phase-6-9-7-tutor-organizer-v2-{scope}-{mode}-{runId}.json`。marker 使用 `wx`、evidence 使用
临时文件 + hard-link exclusive-create；旧 V1 marker 不阻塞 V2，第二次 V2 marker 被拒绝。V1/V2
validator 双向拒绝对方 report/filename；`synthetic_test` 可用于无网络工程测试，但 production gate
仍固定为 `quality_gate_failed`，只有 `deepseek_network` 才可能通过。

RED 为缺少 V2 独立导出；GREEN 新增 V2 隔离测试 `5/5`（`40` assertions），相关 focused
`37/37`（`371` assertions），Agent full `575/575`（`6323` assertions），Agent typecheck/lint
通过。fresh V2 Mock run `d4fc9a3a-5825-47f2-a4d2-d0148c7ccaf4` 为 `24/24` verified
zero-call、`48/48` strict runtime、Tutor/Organizer semantic `1/1`、P95
`246/328/328/276ms`、usage `21948/5647`、estimated `0.099726 CNY`；V2 validator
`ok=true/filesChecked=1`，V1 validator 按设计拒绝。临时 Mock evidence 已精确删除，V2 Live
marker/evidence 仍不存在。V1 evidence/marker SHA-256 仍为
`be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5` /
`7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb`。本任务没有读取
credential、调用 provider、启动 Docker/API/browser 或修改业务数据。代码/合同/安全与 V1
历史不可变性两路独立复审均 `APPROVED`，无阻断项；hard-link 发布后的临时文件清理失败是
非阻塞低风险观察，不改变 R5 结论。下一步 R6。

**提交：** `feat(agent): isolate phase 6.9.7 v2 evidence`

## R6：分支静态/Mock checkpoint 与独立复审

**动作：**

- 运行 Tutor/Organizer/V2 focused；
- Agent/AI/Types/Server/Web 受影响 full gates；
- Organizer PostgreSQL E2E、Compose quiet config、build/lint/typecheck；
- 重跑冻结 deterministic baseline；
- 执行 fresh V2 Mock 和 evidence validator；
- 验证 V1 evidence/marker hash 不变、V2 Live marker/evidence 不存在；
- 验证产品 gates=false、无 credential/provider、无业务残留；
- 故障注入 V2 marker/evidence 的并发竞争、orphan temp、link/unlink 与 I/O 分类；
- 验证 Chat 最终流取消、Organizer provider abort、command 失败终态、normal/force 与
  single/batch 并发收敛、未组织题 batch 补偿和 final route/组件路由隔离；
- contract/security 与 operations/acceptance 两路独立复审。

**文档：**

- 新增 V2 static/Mock acceptance；
- 同步 `AGENTS.md`、`README.md`、`DEVLOG.md`、`docs/roadmap.md` 与本计划；
- 记录实际 counts/hash/results，不复制旧 checkpoint 数值。

**停止条件：** 全部通过后停止并向用户申请一次新的
“Phase 6.9.7 Tutor/Organizer V2 branch controlled-Live”精确授权。没有新授权不得继续。

**当前状态：已完成。** V2 evidence temp 改为随机唯一 ID，hard-link final 成功即成为发布
authority；orphan temp 与 unlink cleanup failure 不再阻断或误报已发布 evidence，`EEXIST` 与
普通 I/O 故障分开返回。V2 marker 的真实并发竞争只允许一个执行者，既有普通 marker 返回
`live_already_attempted`，目录/存储故障返回 `evidence_io_failed`。Chat 的 `req.signal` 已继续
传到最终 `streamText.abortSignal`；Organizer 补齐 in-flight abort 无 Trace/command、command
commit failure 的同 runId failed Trace、同题 normal/force 和 single/batch PostgreSQL 并发收敛。
同步 Organizer 不伪装为 durable background job；未写题仍由 `deckItems: none` batch 路径补偿，
跨多实例 provider exactly-once 明确不在本 checkpoint 的已完成声明内。

focused V2 为 `57/57`；Agent/AI/Types/Server/Web 分别 `578/194/42/2154/439`，Server
`227` suites passed、`30` tests skipped，Organizer PostgreSQL E2E `12/12`，相关
typecheck/lint/build、Compose quiet config、changed TypeScript Prettier 与 diff 门通过。未修饰 baseline
保持 `6/48`、Tutor/Organizer semantic `0.44186666666666674/0.278125`。fresh V2 Mock run
`593ee863-3743-4957-96e1-cb90e852a795` 为 `24/24` zero-call、`48/48` runtime、semantic
`1/1`、P95 `246/328/328/276ms`、usage `21948/5647`、estimated `0.099726 CNY`；V2
validator 通过、V1 validator 正确拒绝，临时 evidence 已精确删除。V1 evidence/marker SHA
保持不变，V2 Live marker/evidence 为 0，tracked gates=false、component credential 为空、测试
账号残留为 0。权威记录见
`docs/acceptance/2026-07-24-phase-6-9-7-tutor-organizer-v2-r6-static-mock.md`。R6 不读取真实
credential、不调用 provider、不执行产品 Docker/API/browser；两路最终复审均 `APPROVED`，
无未关闭 Critical/Important。R6 当时下一步是 R7；后续 R7 已执行并失败封存，见下文。

**提交：** `docs(agent): checkpoint phase 6.9.7 v2 remediation`

## R7：唯一 V2 controlled-Live

**前置：**

- 用户重新接受当时 DeepSeek 账号的数据保留/训练边界；
- 用户明确授权一次 V2 branch controlled-Live；
- R6 commit clean，V2 marker/evidence 不存在；
- V1 bundle、V2 Mock、gates/config/model/price/budget/timeout/credential isolation 全通过。

**顺序：**

1. zero-network preflight；
2. 独立 credential 进程级注入，不修改根 `.env`；
3. 执行唯一 72-case V2；
4. 无论结果如何立即验证并封存 marker/evidence；
5. 任一固定门失败则停止，创建失败 acceptance，不重跑 V2；
6. 只有 `quality_gate_passed` 才允许 R8。

**提交：**

- pass：`docs(agent): seal phase 6.9.7 v2 live authority`
- fail：`docs(agent): seal phase 6.9.7 v2 live failure`

**当前状态：失败封存。** zero-network preflight 在 clean `8a3073f0` 上通过；根 `.env` 未修改，
同一底层 secret 仅以进程级 Tutor/Organizer component credential 映射，其他 Agent gate 显式关闭。
唯一 run `67ce18dd-e2ed-4a05-8507-2a98898b8ede` 使用 runner-v2、冻结 dataset/prompt/schema 与
`deepseek_network` provenance。`24/24` guard zero-call 通过；48 个 runtime 全部为
`rawSchemaValid=false / fallback_runtime_error / canonical stage=null / reason=null`，最终
`0/48` strict runtime、semantic `0/0`、critical `1`、verified usage `0`、pricing/cost 不可验证。
evidence/marker SHA-256 为
`0c64506211d66570fdcf6a016a10885881985bdb0bc4628441c2e5b363d84c77` /
`ac65ac67bd155f448e498a2c1dd9d7762d1efb4cc720a3cf1153083299c98504`，V2 validator 通过。
证据没有保存原始异常，不能指定 credential、网络、模型、endpoint 或 prompt 为单一根因。
权威失败记录见
`docs/acceptance/2026-07-24-phase-6-9-7-tutor-organizer-v2-controlled-live-failure.md`。按本计划
停止条件，V2 不得重跑，R8 不启动；新问题只能另起 V3 identity 与新计划。

## R8：分支 Docker/API/headed-browser 产品验收（V2 失败后永久不适用）

**仅在 R7 pass 后执行；实际 R7 已失败，因此本节未执行。未来产品验收归属独立 V3 lineage。**

- Tutor-only Docker Chat：applied / explicit zero-call / forced fallback；
- Organizer-only API：single/batch、existing/high-confidence zero-call、owner、locked-name、
  Trace/usage/price、组织层唯一写入；
- headed `/chat` 与 `/error-book`，1440/510/390px，窗口保持可见；
- 精确清理 synthetic user/question/group/deck/item/Trace/session/storage；
- mock/live=false、目标 gates=false、component keys absent；
- 保留所有既有 Docker 容器、镜像、卷和非本轮数据；
- 两路独立产品/清理复审。

**提交：** `docs(agent): accept phase 6.9.7 v2 product path`

## R9：分支最终文档 checkpoint

- 同步所有当前文档、acceptance、AI behavior/checklist/dev-start 的真实结果；
- 明确 V1 failure 与 V2 authority 都保留；
- 确认工作区 clean、gates false、零 synthetic 残留；
- 记录回顾问题和后续 Phase 6.9.8，不提前进入 Phase 6.10。

**提交：** `docs(agent): complete phase 6.9.7 branch`

## R10：合并 main

- 切回最新 `main`，确认 `origin/main` parity；
- `git merge --no-ff codex/phase-6-9-7-tutor-wrong-question-agents`；
- 不重跑 V1/V2 Live 或 branch product authority。

**提交：** Git `--no-ff` merge commit。

## R11：main default-off 回放、文档与远程推送

- 在 main 运行 focused/static/Mock；
- 读取 committed V2/product authority，不重跑；
- default-off Docker API 与 headed `/chat` / `/error-book` 回放；
- 精确清理 main synthetic 资源，确认 gates=false/keys absent/volumes retained；
- 提交 main acceptance 文档；
- 推送 `main`，核对 `origin/main...HEAD = 0 0` 与远程 SHA；
- 不创建或遗留 worktree。

**提交：** `docs(agent): record phase 6.9.7 main acceptance`

## 完成定义

只有 R0--R11 的适用步骤全部完成、V2 Live 与分支产品验收通过、main default-off 回放通过且远程
同步，才能称 Phase 6.9.7 完成。完成后进入 Phase 6.9.8 Retriever/FinalResponse，不进入
Phase 6.10，也不开始两篇博客收尾。
