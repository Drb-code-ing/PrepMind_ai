# Phase 6.9.7 Tutor / WrongQuestionOrganizer V2 Remediation Design

日期：2026-07-24

状态：V2 R0--R5 已离线完成；legacy V1 与独立 V2 runner/CLI/validator/evidence lineage 均已
落地且相互拒绝。尚未创建 V2 Live marker/evidence、读取 credential、调用 provider、启动产品
Docker/API 或浏览器。下一步为 R6 分支静态/Mock checkpoint 与独立复审。

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

关联 V1 authority：
`docs/acceptance/phase-6-9-7-tutor-wrong-question-controlled-live.md`

实施计划：
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v2-remediation.md`

## 1. 决策摘要

Phase 6.9.7 唯一 V1 controlled-Live 已完成真实 DeepSeek 网络调用，但固定质量门失败。
V2 不重跑 V1、不放宽 validator、不修改冻结数据集或门槛，也不把 case 答案写进 prompt。
本次选择最小、可解释的修复路径：

1. 让 prompt 与 canonical validator 共享同一份受限决策表，消除“模型收到的规则少于本地执行的规则”；
2. 为新 V2 report 增加固定枚举的校验阶段与失败原因，不保存原始模型输出；
3. 增加独立的 held-out / metamorphic 离线测试，防止按 72 条 case 硬编码；
4. 使用新的 runner/prompt identity、授权变量、marker 和 evidence；V1 全部字节保持不可变；
5. 先完成静态/Mock checkpoint 并停止，只有新的精确用户授权才能执行唯一一次 V2 Live；
6. 只有 V2 所有原门槛通过，才进入 Tutor Chat、Organizer API 和 headed 浏览器产品验收。

这不是为了让模型绕过本地规则，而是让模型在同一组公开给它的受限规则内稳定输出，再由
本地代码继续掌握事实、权限、写入和最终策略。

## 2. 范围与非目标

### 2.1 本设计覆盖

- Tutor 的 intent、primary/secondary evidence 与 compatible depth 对齐；
- Organizer 的 subject authority、deck action、evidence、confidence 和 topic label 精度；
- V2 bounded diagnostics、report identity、one-shot marker/evidence；
- V1 validator 兼容与 immutable history；
- frozen 72-case authority 之外的 anti-overfit 测试；
- 静态/Mock、controlled-Live、产品验收与 main 回放的停止条件。

### 2.2 本设计不覆盖

- 不改变 Tutor 最终回答模型或现有 Chat streaming；
- 不让 Tutor 选择 `answer_direct`；
- 不让 Organizer 接触 userId、真实数据库 ID、JWT、工具或写命令；
- 不修改 WrongQuestion / Card / ReviewLog / ReviewTask / ReviewPreference 事实；
- 不改变 owner snapshot、三阶段 stale fence、Trace admission 或用户 locked-name authority；
- 不修改模型、价格、预算、timeout、重试、provider 数据边界或 component credential；
- 不开始 Phase 6.9.8、Phase 6.10、Phase 8、Phase 9 或两篇面试博客；
- 不把 Live 失败解释为可以绕过质量门直接做产品验收。

## 3. V1 不可变事实

V1 authority 固定如下：

| 项目 | V1 结果 |
| --- | --- |
| run ID | `39a62241-0f51-45be-a423-0d13b0b60ae4` |
| runner | `phase-6.9.7-tutor-organizer-runner-v1` |
| dataset | `phase-6.9-tutor-wrong-question-v1` |
| dataset SHA-256 | `7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e` |
| executor provenance | `deepseek_network` |
| zero-call | `24/24` |
| strict runtime | `27/48` |
| Tutor semantic | `0.3485119048` |
| Tutor improvement | `-0.0933547619` |
| Organizer semantic | `0.7000000000` |
| Organizer improvement | `0.4218750000` |
| critical / permission / mutation / broader fallback | 全部 `0` |
| verified usage | `48/48` |
| total cost | `0.086418 CNY` |
| final gate | `quality_gate_failed` |

V1 evidence：
`.tmp/phase-6-9-7-tutor-organizer-branch-live-39a62241-0f51-45be-a423-0d13b0b60ae4.json`

V1 marker：
`.tmp/phase-6-9-7-tutor-organizer-controlled-live.marker`

两者不得删除、改名、覆盖、重建、重新发布、拼接或以任何方式重跑。V2 的成功也只能成为新的
独立 authority，不能改写 V1 的失败结论。

## 4. 证据边界：能确认什么，不能确认什么

### 4.1 可以确认

- 48 个 runtime entry 都实际调用一次 executor；
- 48 个 provider object 都通过底层 strict JSON schema，`rawSchemaValid=true`；
- Tutor 24 条中只有 9 条 `candidate_applied`，15 条
  `fallback_schema_invalid`；
- Organizer 24 条中有 18 条 `candidate_applied`，6 条
  `fallback_schema_invalid`；
- 这 21 个 fallback 均发生在 raw schema 之后、candidate applied 之前；
- Tutor 当前 prompt 没有给出 intent 对 primary evidence、secondary evidence 和 compatible depth
  的完整映射，但 canonical validator / merger 会严格执行这些映射；
- Organizer 当前 prompt 没有完整给出 known/unknown subject authority、reuse/create evidence、
  high-confidence、keep-local 与 topic precision 规则，但 canonical validator 会执行其中的结构规则；
- 安全、权限、预算、延迟、usage 和费用门没有导致 V1 失败。

### 4.2 不能确认

V1 为了不保存用户文本和 provider 原文，没有落盘 raw output。因此不能从现有 evidence 反推出：

- 某个 Tutor invalid 一定是 evidence association 还是 incompatible depth；
- 某个 Organizer invalid 一定违反了哪一个 subject/evidence/confidence 规则；
- provider 返回的具体 topic label、完整 evidence array 或未落盘字段；
- “validator 错了”或“模型完全不懂语义”中的任一单一结论。

V2 文档必须继续使用“源代码证明 prompt/validator 存在规则差”和“report 证明失败阶段位于 raw
schema 之后”这两个分开的事实，不能把合理推断写成已证实原始输出。

## 5. V1 失败画像

### 5.1 Tutor

15 个 invalid case：

- `tutor-runtime-01,04,05`；
- `tutor-runtime-09,10`；
- `tutor-runtime-11..19`；
- `tutor-runtime-23`。

分组后最明显的信号是：

- `concept_bridge` 的 `11..15` 全部 invalid；
- `explain_solution` 的 `16..19` 全部 invalid；
- `socratic_hint`、`step_check` 与 `general_follow_up` 也有局部 invalid；
- 已通过 canonical contract 的 `runtime-03` 仍把 expected
  `socratic_hint` 分成 `general_follow_up`；
- `runtime-20` 把 expected `explain_solution` 分成
  `socratic_hint`。

这说明 V2 同时需要解决两件事：减少合法 JSON 在动态 contract/merger 的丢弃，并提高真正应用后
的意图语义准确度。只修 schema success 不能满足 Tutor `>=0.85` 的固定质量门。

### 5.2 WrongQuestionOrganizer

6 个 invalid case 是 `organizer-runtime-13..18`。V1 安全 report 只保留 fallback 后的本地结果，
因此不能把报告中的 subject/action 当作 raw provider output。

18 个已应用 case 仍暴露语义精度问题：

- subject accuracy `0.71875`；
- deck action accuracy `0.8125`；
- existing-deck precision `1`；
- topic-label macro-F1 `0.5`；
- evidence/confidence accuracy `0.0625`；
- 多个 expected `medium` 被输出为 `high`；
- 多个安全但过泛或不匹配 canonical concept 的 label 被计为 `__unexpected__`。

因此 Organizer V2 不能只追求 24/24 schema success；还必须让 subject、confidence、evidence 和
单一 source-grounded topic concept 更精确。

## 6. 不变的安全与产品边界

V2 保持以下约束原样：

- Tutor eligibility、五类明确教学指令 zero-call 与 `answer_direct` 双重禁止；
- Tutor `1 call / 1200 input / 300 output`、3000ms、`0.006 CNY` cap；
- Organizer 最多 12 题、20 个 deck、`1 / 3500 / 800`、5000ms、
  `0.016 CNY` cap；
- 两条 component-specific credential 和 web/server/worker/admin allowlist；
- `maxRetries=0`、无 tools、non-thinking JSON-object；
- full-field safety scan、ordinal-only projection、strict Zod 与动态关联；
- owner-scoped immutable snapshot、事务外双 fence、写事务内第三 fence；
- model-free command、Trace admission、locked deck 和用户操作权威；
- 所有失败 deterministic fallback，且不得扩大权限；
- tracked defaults 为 mock/live=false、两个产品 gate=false、credential 空；
- 禁止 Docker prune、`down -v`、volume/database reset、Redis flush 和 MinIO wipe。

## 7. V2 identity 与兼容策略

| 维度 | V1 | V2 |
| --- | --- | --- |
| dataset | `phase-6.9-tutor-wrong-question-v1` | 不变 |
| dataset SHA | `7ac2f4...2207e` | 不变 |
| runner | `phase-6.9.7-tutor-organizer-runner-v1` | `phase-6.9.7-tutor-organizer-runner-v2` |
| Tutor prompt | `tutor-model-candidate-v1` | `tutor-model-candidate-v2` |
| Organizer prompt | `wrong-question-organizer-model-candidate-v1` | `wrong-question-organizer-model-candidate-v2` |
| Tutor schema/projection | v1 | 不变 |
| Organizer schema/projection | v1 | 不变 |
| approval env | `PHASE_6_9_7_CONTROLLED_LIVE_APPROVED` | `PHASE_6_9_7_V2_CONTROLLED_LIVE_APPROVED` |
| confirmation | V1 固定确认词 | `I_ACCEPT_PHASE_6_9_7_TUTOR_ORGANIZER_V2_CONTROLLED_LIVE_ONCE` |
| marker | V1 marker | `.tmp/phase-6-9-7-tutor-organizer-v2-controlled-live.marker` |
| evidence prefix | V1 prefix | `.tmp/phase-6-9-7-tutor-organizer-v2-` |

V2 不改变 schema/projection version，因为输出 shape、ordinal 范围、字段安全和动态权限边界不变；
改变的是 prompt policy、runner diagnostics 与 evidence identity。若实施中必须改变 schema 或
projection，必须停止 R2/R3、修订本设计并单独说明兼容影响，不能静默借用 v1 identity。

V1 report 必须继续按原 contract 验证：V2 新字段对 V1 必须 absent，而不是 nullable 或自动补默认。
V1 evidence hash 与 marker hash 在每个 checkpoint 复核保持一致。

## 8. Tutor V2：prompt 与 validator 单一规则源

### 8.1 决策表

把当前 contract 中分散的 allowed evidence、primary evidence 与 candidate 中的 compatible depth
收敛为一个深冻结 policy table。validator 与 prompt formatter 都从该表读取：

| intent | primary evidence | 允许的附加 evidence | compatible depth |
| --- | --- | --- | --- |
| `explain_solution` | `full_explanation_request` | `contextual_reference`, `ambiguous_intent` | `standard`, `deep` |
| `socratic_hint` | `implicit_hint_request` 或 `contextual_reference` | `ambiguous_intent` | `brief`, `standard` |
| `step_check` | `submitted_step` | `contextual_reference`, `ambiguous_intent` | `brief`, `standard` |
| `concept_bridge` | `concept_gap` | `contextual_reference`, `ambiguous_intent` | `standard`, `deep` |
| `general_follow_up` | `contextual_reference` 或 `ambiguous_intent` | 无其它 code | `brief`, `standard` |

其中 `general_follow_up` 的 primary evidence 是二选一，不要求
`contextual_reference` 与 `ambiguous_intent` 同时出现；“无其它 code”仅表示这两个 code
之外没有额外允许项。

实现要求：

- policy 使用 readonly literal array，不把可变 `Set` 暴露为公共 authority；
- validator 可从 policy 构造内部 Set，但不能另写第二份映射；
- prompt formatter 使用稳定排序生成紧凑决策表；
- prompt 中只出现 enum/规则，不出现 case ID、expected output、canonical topic label 或评分答案；
- `answer_direct` 继续不在模型 schema 中，本地 merger 继续拒绝任何越界结果；
- depth compatibility 继续由本地 merger 最终确认，不因 prompt 更完整而放宽。

### 8.2 语义提示

V2 prompt 还应使用通用、非 case-specific 的最小区分规则：

- “想先得到提示/下一步”优先 `socratic_hint`；
- “检查我已提交的步骤”优先 `step_check`；
- “概念为什么成立/与什么知识连接”优先 `concept_bridge`；
- “完整讲解解法”优先 `explain_solution`；
- 只有上下文追问且没有更具体教学信号时使用 `general_follow_up`。

这些规则描述产品 intent 语义，不包含 72 条 fixture 的文本或答案。

### R2 实现状态（2026-07-24）

R2 已将 intent、primary/allowed evidence、compatible depth 与通用选择语义收敛到
一个深冻结 readonly policy。contract validator、稳定 prompt formatter 与本地 merger
共用该 policy；depth 仍按本设计在 local merger 最终拒绝，并保留
`local_merger / incompatible_depth` 诊断语义。Tutor candidate 和 Web server-only
config 的 prompt identity 已升为 `tutor-model-candidate-v2`，但公共 paired runner/CLI
仍只生成 V1；R5 前不存在 V2 evidence 入口。

Tutor/package focused `25/25`、原 12 zero-call + 24 runtime 冻结矩阵、逐 intent
depth fail-closed 矩阵、Phase 6.9.7 V1/diagnostics 兼容 `33/33`、Agent full
`552/552`、Web full `438/438` 均通过；Agent/AI typecheck/lint、Web lint 与
diff 门同步通过。dataset/SHA、schema/projection、质量门、预算和 V1
evidence/marker 均不变；本任务没有读取 credential、调用 provider、发布
V2 evidence 或启动 Docker/API/browser。该 checkpoint 当时下一步是 R3 Organizer
prompt/contract precision，后续已完成。

## 9. Organizer V2：关联规则与精度

### 9.1 共享关联 policy

contract validator 与 prompt formatter 共用深冻结 policy：

- question 的 `subjectHint != unknown` 时，输出必须是 `keep_local`；
- `subjectHint == unknown` 时，必须从六个 subject enum 选择，不能 `keep_local`；
- `keep_local` 必须包含 `structured_subject`；
- `reuse_existing` 只能引用 resolved subject 相同的 projected deck，并包含
  `existing_deck_overlap`；
- `create_topic` 至少包含 `semantic_topic`、`error_pattern`、
  `insufficient_signal` 之一；
- `high` 不能与 `insufficient_signal` 共存；
- 每个 projected question 恰好一条 decision，ordinal 唯一且在界内。

validator 仍是最终 authority。prompt formatter 只是把同一组规则准确提供给模型。

### 9.2 subject 与 topic label

V2 prompt 使用通用 taxonomy，不硬编码 fixture 答案：

- `computer`：通用计算机基础、软件、算法、网络、数据库、操作系统；
- `major`：明确的非通用计算机专业课或专业考试领域；
- `math / english / politics`：明确学科信号；
- `other`：没有足够考试学科信号或不属于以上分类。

topic label 要求：

- 单个、短、精确、来自 projected question 的概念或错误模式；
- 不返回“知识点”“综合题”“学习资料”“错题整理”等泛化教学标签；
- 不把多个无关概念拼成一个 label；
- 不复制 URL、Markdown、指令、凭据或解释句；
- 继续经过现有 2..24 Unicode scalar、安全字符与完整字段扫描；
- V2 不新增 dataset-specific alias map，也不扩大 `acceptedTopicLabels` 来美化分数。

如果后续确实需要通用 label normalizer，必须另做独立设计：只允许可证明的 NFKC/空白/大小写等
一般化变换，未知映射继续 fallback；V2 不引入语义同义词答案表。

### 9.3 confidence

prompt 明确：

- `high` 只用于投影中有强 subject/topic 或明确同 subject deck overlap 的情况；
- evidence 不足时使用 `medium + insufficient_signal`；
- 不得为了“看起来确定”默认输出 high。

本地 contract 继续拒绝 `high + insufficient_signal`，评测继续按原 expected confidence/evidence
计分。

### R3 实现状态（2026-07-24）

R3 已把本节的 subject、deck、evidence、confidence、taxonomy 与 topic-label 规则收敛为单一
深冻结 readonly association policy，contract validator 与稳定 prompt formatter 共用同一
authority。known subject 继续只允许 `keep_local + structured_subject`；unknown subject 继续必须
选择六类 subject；`reuse_existing` 只允许 same-subject deck 且必须包含
`existing_deck_overlap`；`create_topic` 必须有三类允许 evidence 之一；
`high + insufficient_signal` 继续 fail-closed。prompt 还明确 medium/high 选择、computer/major
边界、单一 source-grounded concept 与“知识点/综合题/学习资料/错题整理”等泛标签禁区。

Organizer candidate、Server config、Agent Trace 与 future V2 report identity 现在共用
`wrong-question-organizer-model-candidate-v2` 常量；active public runner/CLI 仍绑定 V1，R5 前
不存在 V2 marker/evidence 发布入口。schema/projection v1、ordinal-only、owner snapshot、
locked-name、写隔离、本地 merger、dataset/SHA、质量门、预算和 accepted labels 均未改变。

R3/Phase 6.9.7 focused `40/40`（`582` assertions）、Agent full `554/554`（`6071`
assertions）、Server Organizer `30/30`（`162` assertions）、Agent/AI typecheck/lint、Server
lint/build 与 diff 门通过；两路独立复审无未关闭 Critical/Important。V1 evidence/marker
SHA-256 保持 `be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5` /
`7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb`。没有读取
credential、调用 provider、创建 V2 evidence、启动 Docker/API/browser 或修改业务数据；
该 checkpoint 当时下一步为 R4 held-out/metamorphic anti-overfit，后续已完成。

## 10. V2 bounded diagnostics

V1 只有 `rawSchemaValid`、`candidateDisposition` 与
`canonicalSchemaSuccess`，无法区分动态 contract 和 local merger。V2 runtime entry 新增：

- `canonicalValidationStage`：
  `raw_schema | dynamic_contract | local_merger | applied`；
- `canonicalFailureReason`：nullable、versioned bounded adapter enum；只能由现有 contract/candidate
  reason code 显式映射，禁止直接落盘自由字符串。

组合规则：

| stage | failure reason |
| --- | --- |
| `raw_schema` | 只能是 `schema_invalid` |
| `dynamic_contract` | Tutor/Organizer 现有 dynamic validator reason |
| `local_merger` | `incompatible_depth` 或 `projection_association_invalid` |
| `applied` | 必须为 `null` |

若 provider/runtime/usage/abort 在 structured object 形成前失败，这两个 canonical 字段都为
`null`，现有 `candidateDisposition` 继续作为安全 authority；不得把 transport failure 伪装成
schema failure。zero-call entry 两个字段也都为 `null`。V1 entry 两个字段必须完全 absent。

R1 必须用一个固定 adapter 显式映射 contract 与 candidate reason：例如 Tutor candidate 的
`incompatible_depth` 和 Organizer candidate 的 `projection_association_invalid` 都属于
`local_merger`，即使它们不在各自 model-contract reason union 中。stage/reason 的允许组合由
strict discriminated union 和穷举测试约束，不能靠字符串拼接。

R1 最小 RED/GREEN 矩阵必须逐层注入并断言：

1. schema-invalid object -> `raw_schema / schema_invalid`；
2. schema-valid 但 evidence association 非法 ->
   `dynamic_contract / invalid_evidence_association`；
3. schema/association 合法但 Tutor depth 不兼容 ->
   `local_merger / incompatible_depth`；
4. schema/association 合法但 Organizer authority map 无法重建 ->
   `local_merger / projection_association_invalid`；
5. 合法应用 -> `applied / null`；
6. zero-call -> 两字段 `null`；
7. V1 report -> 两字段 absent；
8. 未知 stage/reason、错误组合和自由文本 -> strict reject。

报告仍不得保存：

- raw provider output、prompt、system/user message；
- question、answer、active context、topic 原文；
- owner、UUID、ordinal 到真实 ID 映射；
- provider body/header/error、base URL、credential、cookie、token、stack；
- 自由文本 diagnostic。

diagnostics 只用于回答“失败发生在哪一层”，不能绕过 contract，也不能成为重试 provider 的依据。

### R1 实现状态（2026-07-24）

R1 已按上述矩阵完成：versioned bounded adapter 分开约束 Tutor/Organizer dynamic reason，未知或
混合额外 reason fail-closed；`structuredObjectCaptured` 区分 schema-invalid object 与 structured
object 形成前的 transport/runtime 失败。V1 entry 仍要求两个新字段完全 absent；当前 runner/CLI
仍只生成 V1，V1 evidence validator 明确拒绝 V2 report。focused `19/19`、Agent full
`548/548`（`5643` assertions）、typecheck/lint 与 V1 bundle validator 通过；V1
evidence/marker SHA-256 仍为
`be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5` /
`7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb`。本任务没有读取
credential、调用 provider、发布 V2 evidence 或启动 Docker/API/browser；该 checkpoint 当时下一步
是 R2 Tutor prompt/contract 单一规则源，后续已完成。

## 11. Anti-overfit 设计

冻结 72-case 继续是唯一 Live quality authority，不能删 case、改 expected、扩大 accepted label 或改变
分母。V2 另建 `phase-6.9-tutor-organizer-v2-robustness` 离线测试集，不并入 Live 72-call 费用：

- Tutor：中英文同义改写、混合语言、上下文前后重排、无关安全句插入；
- Organizer：known/unknown subject 切换、deck 顺序重排、同 subject/跨 subject deck、
  confidence/evidence 组合、batch ordinal 重排；
- security：case ID/expected label 泄漏扫描、重复/越界 ordinal、locked deck、
  prompt injection 与 credential material；
- metamorphic：不改变语义的变换必须保持 canonical decision；改变 authority 的变换必须按
  本地规则改变或 fail-closed。

最低门：

- V2 prompt 不包含 72-case ID、expected output、canonical/accepted topic label 表；
- 同一 policy formatter 的输出字节稳定；
- held-out fixtures 全部通过 strict contract、merger 和安全不变量；
- 原 Task 2--11 测试不回归；
- Mock 满分仍必须是 `quality_gate_failed`，因为 synthetic output 不是语义 authority。

held-out 测试证明实现不是显式答案表，并不能证明真实模型质量；真实语义仍由唯一 V2 Live 判定。

### R4 实现状态（2026-07-24）

R4 已新增独立深冻结 `phase-6.9.7-tutor-organizer-v2-robustness-v1` fixture 与三组
离线 tests，不并入冻结 dataset、runner 或 Live 分母。Tutor 覆盖中文/英文/混合语言同义改写、
context reorder、无关安全句、context authority 变化和注入/凭据 fail-closed；Organizer 覆盖
六类新 subject、known/unknown authority、same/cross-subject deck、deck/question ordinal reorder、
evidence 顺序/重复、越界 ordinal、locked-name 与 authority drift。语义不变变换保持 canonical
decision；authority 改变时只能按本地规则变化或返回 null/safety fallback。

prompt leakage scanner 直接检查 Tutor/Organizer 实际 candidate request，而不是只扫描测试源码；
扫描范围包括 frozen case ID、dataset identity、oracle key、完整 expected object 和 Organizer
canonical/accepted topic labels。故意拼入 case ID、label 和 `acceptedTopicLabels` 的污染控制会被
命中，真实 prompt 命中为 0。formatter bytes 稳定，公共 runner/prompt identity 仍为 V1，冻结
dataset SHA 与 V1 evidence/marker SHA 均保持不变，V2 marker/evidence 不存在。focused
`16/16`（`212` assertions）、Agent full `570/570`（`6283` assertions）、typecheck/lint、
新增 TypeScript 文件的 Prettier check 与 V1 validator 通过；代码/安全与文档/历史边界两路
独立复审均 `APPROVED`，无未关闭 Critical/Important。该结果只证明没有显式答案表和本地
变形回归，不能替代 Live 语义质量；下一步 R5。

### R5 实现状态（2026-07-24）

R5 保留 legacy V1 public entry，不把默认常量切到 V2；新增显式
`runPhase697TutorOrganizerPairedEvalV2`，由同一冻结 72-case runner 在构造 entry 时按版本选择：
V1 完全省略 bounded diagnostic 字段，V2 对 zero-call 写 `null/null`，对 runtime 写 candidate
返回的受限 stage/reason。report runner/prompt identity 同时按版本绑定，schema、projection、dataset、
SHA、分母、质量门、价格、预算、timeout 和本地 authority 均不变。

CLI 通过只读 profile 复用配置安全门与 immutable publisher，但 V1/V2 分别拥有确认词、approval
env、marker path、evidence prefix、runner 与 validator。V2 marker `wx` 独占创建，evidence 采用
临时文件 `wx` 后 hard-link 到最终路径；旧 V1 marker 不参与 V2 reservation。V1/V2 validator
分别固定 runner identity 与 filename，任何 cross-version report、scope/mode/runId filename 不一致、
敏感字段或重复 runId 都 fail-closed。Live synthetic harness 继续只产生
`executorProvenance=synthetic_test`，共享 production gate 明确只接受 `deepseek_network`。

RED/GREEN、focused/full、Mock CLI/validator、V1 SHA 和零 V2 Live marker/evidence 的实际结果见实施
计划 R5 状态。代码/合同/安全与 V1 历史不可变性两路独立复审均 `APPROVED`，无阻断项；
hard-link 发布后的临时文件清理失败是非阻塞低风险观察。R5 只建立独立 evidence 能力，不发布
真实质量 authority，也不改变产品可用性结论；下一步 R6。

## 12. 质量门与停止条件

V2 继续使用原门槛：

- `24/24` verified zero-call；
- `48/48` strict runtime；
- critical / permission / mutation / broader fallback 全部 `0`；
- Tutor semantic `>=0.85`；
- Organizer semantic `>=0.85`；
- 两 lane 相对冻结 baseline 绝对提升均 `>=0.15`；
- Tutor / Organizer / paired candidate P95 分别
  `<=2500 / <=4500 / <=4500ms`；
- Tutor orchestration P95 `<=6500ms`，仍不冒充产品端到端 P95；
- 48 个 usage、价格、逐 case/aggregate CNY 与 caps 全部可验证；
- executor provenance 必须是 `deepseek_network`。

若任一门失败：

1. 封存 V2 marker/evidence；
2. 两个产品 gate 保持 false；
3. 不启动 Docker service/API/browser 产品验收；
4. 不重跑 V2；
5. 新问题另起 V3 identity 与设计，不修改 V1/V2 history。

## 13. 产品验收顺序

只有 V2 `quality_gate_passed` 后才执行：

1. Tutor-only Docker Chat：隐含/上下文/冲突样本
   `candidate_applied`，明确指令 zero-call，forced failure fallback；
2. Organizer-only API：single、batch、existing/high-confidence zero-call、owner isolation、
   locked-name、Trace/usage/price 与只写组织层；
3. headed 可见浏览器 `/chat`、`/error-book`，覆盖 1440/510/390px，窗口保持可见；
4. 精确清理本轮 synthetic user/question/group/deck/item/Trace/session/storage；
5. 恢复 mock、live=false、两个产品 gate=false、两条 component credential absent；
6. 保留容器、镜像、PostgreSQL、Redis、MinIO 与 volumes；
7. 分支完成后才允许 `--no-ff` 合并 main；
8. main 不重跑 V2 Live，只做 committed authority 校验、静态/Mock 和 default-off
   Docker/API/可见浏览器回放；
9. main 验收记录提交后推送远程并核对 SHA parity。

## 14. 文档与回顾

每个 R-task 同步实际结果到当前状态文档；历史 acceptance 只追加后续引用，不改写当时事实。
`docs/data-flow.md` 只有在产品数据流或字段真的变化时才更新，单纯 prompt/report 版本变更不伪造
数据流变化。

回顾时可以问：

- 为什么 48 个 raw schema 都合法，strict runtime 仍只有 27/48？
- 为什么不能从 V1 fallback 直接推断 provider 的具体 evidence array？
- 为什么 prompt 和 validator 应共享规则表，但 validator 仍是最终 authority？
- 为什么 held-out/metamorphic 测试不能替代 controlled-Live？
- 为什么 V2 继续使用 V1 dataset 和阈值，却必须换 runner/prompt/marker/evidence identity？
- 为什么 V2 通过也不能改写 V1 的失败记录？
- 为什么 Live 通过后仍需 Docker/API/可见浏览器产品验收？
