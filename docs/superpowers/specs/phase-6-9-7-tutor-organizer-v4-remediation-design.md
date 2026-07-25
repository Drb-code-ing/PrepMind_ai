# Phase 6.9.7 Tutor / WrongQuestionOrganizer V4 Remediation Design

日期：2026-07-26

状态：R0--R4 已完成；V4 bounded diagnostics、Tutor/Organizer 单一语义 policy、independent
robustness 与独立 crash-safe evidence lineage 已实现，但尚未调用 Provider、创建 V4 Live artifact 或
获得 V4 controlled-Live 精确授权。V1/V2/V3 三条唯一 Live 均已失败封存且不得重跑。下一步仅 R5
static/Mock checkpoint 与独立终审。

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

V3 failure authority：
`docs/acceptance/2026-07-25-phase-6-9-7-tutor-organizer-v3-controlled-live-failure.md`

实施计划：
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v4-remediation.md`

## 1. 决策摘要

V3 已证明一次性执行、Provider 调用计数、usage、首错熔断、固定分母、双 lane 隔离、durable
journal 与 evidence 封存都能按合同工作。唯一 V3 run 仍未证明 Tutor/Organizer 可用于产品：

- `24/24` guard zero-call；
- 28 个 runtime 启动且 usage verified，`27/48` strict runtime；
- 第 14 对 Organizer 在 `dynamic_contract` 命中 `subject_authority_violation`，随后 20 个 runtime
  按 breaker 合同不再启动；
- Tutor/Organizer semantic 分别为 `0.5280555556/0.4376201923`，都低于 `0.85`；
- Tutor 相对 baseline 只提升 `0.0861888889`，低于 `0.15`；
- 没有 Provider、权限、mutation、critical 或 broader fallback 故障。

因此 V4 不再改动已经成立的 V3 调度与耐久性原则，重点修复两件事：

1. **诊断真值**：不能再让一个粗粒度 reason code 掩盖 subject authority、topic label、evidence、
   confidence 或本地 merger 的不同失败；
2. **语义规则同源**：Tutor/Organizer 的 prompt formatter、dynamic validator、local merger 与测试
   必须从同一个深冻结 policy source 派生，并通过独立 held-out/metamorphic 测试防止只记住
   72-case 答案。

V4 不通过降低 threshold、删除 case、扩大模型权限、让本地 merger 静默修正非法输出或增加重试
来制造成功。

## 2. V3 bounded 复盘

### 2.1 Tutor 已执行样本

V3 只执行了前 14 个 Tutor runtime；它们全部 `rawSchemaValid=true`、
`candidate_applied`、usage verified：

| 维度                | 已执行 14 例结果 |
| ------------------- | ---------------- |
| strict runtime      | `14/14`          |
| intent 命中         | `11/14`          |
| depth 命中          | `14/14`          |
| context-use 命中    | `14/14`          |
| guiding policy 命中 | `11/14`          |
| final-answer 边界   | `14/14`          |
| answer structure    | `11/14`          |

三个可见失败簇为：

- 两个 `socratic_hint -> general_follow_up`；
- 一个 `step_check -> general_follow_up`；
- 三例都保留 active context，但由错误 intent 继续派生出 guiding/answer-structure 偏差。

报告中的 `invalidCases=10/24` 是 breaker 后 10 个未执行 Tutor case 占固定分母，并不表示前 14 个
已执行样本有 10 个 schema 失败。V4 文档、diagnostic 与聚合必须把“已执行但语义不匹配”和“未
执行”分开。

### 2.2 Organizer 已执行样本

V3 只执行了前 14 个 Organizer runtime：13 个 strict success，1 个 dynamic-contract failure。
对 14 个 bounded decision 的只读复盘为：

| 维度                     | 已执行 14 个 decision |
| ------------------------ | --------------------- |
| subject 命中             | `13/14`               |
| deck action 命中         | `14/14`               |
| accepted topic label     | `5/14`                |
| confidence 命中          | `12/14`               |
| required evidence 全满足 | `10/14`               |
| 使用 insufficient_signal | `7/14`                |

`organizer-runtime-14` 的 bounded evidence 同时显示：

- raw schema 已形成；
- canonical stage 为 `dynamic_contract`；
- reason 为 `subject_authority_violation`；
- semantic observation 的 subject/action/confidence 表面与 expected 一致；
- topic 被归为 `__unexpected__`，evidence observation 为空。

源码中 `subject_authority_violation` 只可能由以下 authority 条件产生：已知 `subjectHint` 没有使用
`keep_local`，未知 `subjectHint` 使用了 `keep_local`/越界 subject，或最终 subject 仍为
`unknown`。topic/evidence 检查在其后执行。因此不能把该 reason 改写成 Provider、JSON、网络或
topic 根因；也不能仅凭 semantic observation 断言原始模型字段。Evidence 按安全合同没有保存 raw
model output，所以当前无法确认是模型选择、prompt 理解、投影/序列化还是其它已删除内容造成。

### 2.3 质量结论

Organizer 的冻结 32-decision 固定分母指标为 subject `0.375`、deck action `0.40625`、existing
deck precision `1`、topic macro-F1 `0.1153846154`、evidence/confidence `0.0625`、semantic
`0.4376201923`。其中 18 个未执行 decision 和 1 个 executed failure 都保持 invalid，不能据部分
样本推断完整 24 runtime 的泛化质量。

V4 要解决的是真实语义与合同一致性，不是继续修 V3 的计数器或把 breaker 后的空样本解释为模型
错误。

## 3. 范围与非目标

### 3.1 V4 覆盖

- V4-only bounded dynamic diagnostic taxonomy 与逐轴 observation；
- Tutor intent precedence、depth、context、pedagogy 与 answer-structure 单一 policy source；
- Organizer subject authority、deck action、topic、evidence 与 confidence 单一 policy source；
- prompt formatter、validator、merger 和 fixtures 的同源性测试；
- 独立 held-out/metamorphic、authority drift、schema-negative 与 prompt leakage 测试；
- 独立 V4 runner/prompt/approval/marker/journal/evidence/validator identity；
- 继续使用固定分母、首错 breaker、双 lane、无 retry、crash-only seal 与敏感字段禁写原则；
- static/Mock 停止点、一次精确授权的 V4 Live，以及只有 Live 全门通过后的产品验收/main 路径。

### 3.2 V4 不覆盖

- 不修改冻结 dataset、SHA、expected、baseline、metric 权重、threshold 或分母；
- 不删除、覆盖、重建、拼接、重放或重新解释 V1/V2/V3 marker、journal、evidence；
- 不把 case ID、expected、oracle、accepted label 表或答案文本写入 prompt；
- 不改变 DeepSeek V4 Pro non-thinking JSON、价格、timeout、`maxRetries=0` 或单 case budget；
- 不让 Tutor 决定最终 Chat 路由、选择 `answer_direct`、生成最终答案或调用工具；
- 不让 Organizer 读取真实 ID/JWT/userId、直接写数据库、覆盖用户锁定名称或绕过 owner/stale fence；
- 不让 local merger 自动补齐模型缺失的 evidence、替换越权 subject 或把 unsafe topic 改成合法；
- 不新增自动 retry、补跑、跨 lane 预算借用或 Provider exactly-once 声明；
- 不在 V4 Live 通过前启动产品 Docker/API/headed-browser、Task 13/main、Phase 6.10 或博客收尾。

## 4. V4 identity 与历史隔离

V4 冻结以下独立 identity；R1--R5 只允许零网络 synthetic/Mock 使用：

| 维度                      | V4 冻结值                                                                   |
| ------------------------- | --------------------------------------------------------------------------- |
| dataset                   | `phase-6.9-tutor-wrong-question-v1`                                         |
| dataset SHA               | `7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e`          |
| runner                    | `phase-6.9.7-tutor-organizer-runner-v4`                                     |
| Tutor prompt identity     | `tutor-model-candidate-v4`                                                  |
| Organizer prompt identity | `wrong-question-organizer-model-candidate-v4`                               |
| runtime evidence          | `phase-6.9.7-v4-runtime-evidence-v1`                                        |
| model/mode                | `deepseek-v4-pro` / non-thinking JSON object                                |
| approval env              | `PHASE_6_9_7_V4_CONTROLLED_LIVE_APPROVED`                                   |
| confirmation              | `I_ACCEPT_PHASE_6_9_7_TUTOR_ORGANIZER_V4_CONTROLLED_LIVE_ONCE`              |
| marker                    | `.tmp/phase-6-9-7-tutor-organizer-v4-controlled-live.marker`                |
| journal                   | `.tmp/phase-6-9-7-tutor-organizer-v4-controlled-live-<runId>.journal.jsonl` |
| evidence                  | `.tmp/phase-6-9-7-tutor-organizer-v4-<scope>-<mode>-<runId>.json`           |

V4 validator 必须拒绝 V1/V2/V3；三版历史 validator 必须继续拒绝 V4。V4 字段对历史 report 保持
absent，不能自动填 `null`。R0 只冻结这些名称，不创建 Live artifact，也不把用户当前“继续”的许可
解释为未来一次网络运行的精确授权。

## 5. V4 bounded diagnostics

### 5.1 两层结果必须分开

每个 runtime 继续保留两个独立问题：

1. `runtimeContractSuccess`：调用、schema、dynamic contract、merger、usage、latency 与安全边界是否
   完整；它决定 breaker；
2. `semanticMatch`：在 runtime contract 成功后，各语义轴是否匹配冻结 expected；它只进入质量
   metric，不提前 breaker。

未执行 case 必须记录 `not_started_*`，不能归为 schema invalid、semantic mismatch 或 Provider
failure。

### 5.2 Organizer reason taxonomy

V4 不保存自由文本或 raw output，只把 dynamic contract 的第一失败轴投影为固定枚举：

- `known_subject_requires_keep_local`；
- `unknown_subject_requires_bounded_subject`；
- `subject_unresolved`；
- `deck_index_out_of_range`；
- `cross_subject_deck`；
- `topic_label_invalid`；
- `known_subject_evidence_missing`；
- `deck_action_evidence_missing`；
- `confidence_evidence_conflict`；
- 既有结构/index/context 类固定 reason。

validator 返回固定 `axis/stage/reason`；runner 只投影该 bounded chain。Merger 必须复用同一 validator，
不能再执行另一套隐式顺序。V1/V2/V3 旧 reason 保持原样。

### 5.3 Tutor diagnostics

Tutor V4 observation 分别记录 intent、depth、evidence association、context use、guiding policy、final
answer 与 answer structure 的 bounded match；`general_follow_up` 的选择还需记录是否有更具体 primary
evidence 被压过。不得保存用户原文、active context、prompt 或模型原文。

## 6. Tutor 语义规则

Tutor V4 深冻结 policy 增加显式优先级，而不是只写“choose most specific”：

1. `submitted_step -> step_check`；
2. `full_explanation_request -> explain_solution`；
3. `concept_gap -> concept_bridge`；
4. `implicit_hint_request -> socratic_hint`；
5. 仅在没有以上 primary signal 且存在 contextual/ambiguous signal 时，才允许
   `general_follow_up`。

规则必须同时派生：

- prompt 中的 intent table 与 precedence/counterexample 说明；
- validator 的 primary/allowed evidence 与 depth compatibility；
- local `buildTutorStrategyFromIntent` 的 context/guiding/final-answer/answer-structure invariants；
- held-out/metamorphic fixtures。

若投影没有足够 primary signal，模型不能凭空选择更具体 intent；若已有 primary signal，active
context 不能把它降级为 `general_follow_up`。Tutor 仍只返回分类决策，最终教学内容由本地策略与 Chat
链路控制。

### 6.1 R2 实现状态（2026-07-26）

R2 已按本节落地 `tutor-model-candidate-v4` 深冻结 policy。V4 formatter、validator、evidence
precedence resolver、depth compatibility、candidate merger 和本地 strategy invariants 共用该
authority；active context downgrade 与否定式 direct-answer 权限边界均有零网络回归。冻结
deterministic detector/baseline 不按 V4 model precedence 重排；历史 paired eval 显式走 V2 policy，
从而保持 V2 prompt bytes、V3 prompt SHA 和旧 evidence 不变。R2 未实现 V4 runner/lineage 或调用
Provider；该检查点当时下一步仅第 7 节 Organizer R3，后续已完成。

## 7. Organizer 语义规则

Organizer V4 保持本地 authority，并把 prompt/validator 的必要条件写成同一决策矩阵：

- 已知 `subjectHint`：必须输出 `keep_local`，并包含 `structured_subject`；
- 未知 `subjectHint`：必须从六类 bounded subject 选择，禁止 `keep_local`；
- `reuse_existing`：必须引用同 subject 的 ordinal deck，并包含 `existing_deck_overlap`；
- `create_topic`：必须输出 2--24 Unicode scalar 的单一精确概念/错误模式；禁止通用标签；
- 有具体题意依据时包含 `semantic_topic`，有明确错误模式时包含 `error_pattern`；
- `insufficient_signal` 只允许 medium confidence，不能与 high confidence 共存，也不能代替已知
  subject 的 `structured_subject` 或 reuse 的 overlap evidence；
- high confidence 只允许由结构化 knowledge/category/error 或明确 same-subject overlap 支撑。

Topic label 的语义评测继续使用冻结 accepted-label authority；该答案表不得进入 policy formatter 或
prompt。Local merger 只应用已通过 validator 的 ordinal decision，仍以本地 subject/deck/name authority
为准。

### 7.1 R3 实现状态（2026-07-26）

R3 已按本节落地 `wrong-question-organizer-model-candidate-v4` 深冻结 policy。Formatter、dynamic
validator 与 merger 共用 known/unknown subject、keep/create/reuse、same-subject deck、topic、
evidence 与 confidence 决策矩阵；merger 不补 evidence、不修正越权 subject、不清洗 unsafe topic。
Owner、ordinal、locked name、三阶段 stale fence、single call、独立预算、abort 与 no-retry 不变。
历史 paired eval 显式走 Organizer V2 candidate，保持 V2 prompt bytes、V3 prompt SHA 与旧 evidence
不变。R3 当时未实现 V4 runner/lineage 或调用 Provider；后续第 8--9 节 R4 已完成。

## 8. Anti-overfit 与测试隔离

V4 不修改冻结 72-case dataset。另建独立 versioned fixtures，至少覆盖：

- Tutor 五 intent 的中英/混合改写、否定、干扰句、active-context 重排与 primary-signal 冲突；
- Organizer known/unknown subject、computer/major/other 边界、create/reuse、topic/evidence omission、
  confidence conflict、batch/question/deck reorder；
- authority drift、locked name、cross-subject deck、重复/越界 ordinal 与 unsafe projected content；
- 对实际 candidate system/user prompt 做 oracle/case ID/expected/accepted-label 泄漏扫描；
- mutation 只改变一个语义变量时，decision 只在 policy 允许的轴变化；
- negative fixtures 必须 fail-closed，不能由 merger 修复。

独立 fixture 只验证规则泛化与合同，不计入冻结 Live semantic 分数，也不能复制 V3 失败 case 的题目
或答案。

## 9. 调度、并发、预算与证据

V4 继承并重新版本化 V3 已通过的工程原则：

- 24 guard 全先行；任一 guard 失败则 runtime 零调用；
- 24 个 pair 顺序推进，每 pair Tutor/Organizer 最多双并发；
- lane 独立 credential、budget、timeout、AbortController、ledger 与 failure attribution；
- Tutor `1/1200/300`，Organizer `1/3500/800`，不借预算；
- 首个 runtime contract failure 打开 `quality_gate_impossible`，有界收口 sibling，后续 runtime
  保留固定分母并标 `not_started_quality_breaker`；
- semantic-only mismatch 不提前 breaker，仍完整执行；
- 无 retry、补跑、resume 或 replay；崩溃后只允许零网络 seal；
- marker/journal/evidence 保持 `wx`、fsync、hash chain、hard-link final 与 same-byte idempotency；
- unknown usage、incomplete latency、incomplete pricing 都 fail-closed。

复用实现不等于复用 V3 identity 或 artifact。V4 journal/evidence 必须是新的 lineage。

### 9.1 R4 实现状态（2026-07-26）

R4 已落地与冻结 72-case authority 隔离的 `phase-6.9.7-v4-independent-robustness-v1` fixture。
Tutor 覆盖中英/混合改写、否定、干扰、active-context reorder 与 primary-signal conflict；Organizer
覆盖 authority drift、question/deck reorder、locked name、cross-subject deck、ordinal/topic/evidence/
confidence/schema-negative。Fixture 只描述 relation 与变形，不导入 dataset expected、accepted-label
表或 V3 失败题目；测试对实际 V4 candidate system/user prompt 执行 case ID、expected、accepted-label、
oracle 泄漏扫描。Abort、lane budget、single dispatch、no retry 与 write isolation 均保持 fail-closed。

V4 runner lifecycle 可以在内存中复用 V3 已通过的 scheduler 原则，但调度结果立即转换为 V4
entry/report，所有持久化回调只接收 V4 identity。V4 另有独立 terminal projection、evidence envelope、
CLI/validator、journal schema/parser 与 durability I/O：

- marker 使用 `wx` 单胜者，路径与 V1/V2/V3 双向拒绝；
- journal 在 executor/dispatch 前 append + fsync，以 sequence、previous SHA、record SHA 验证固定
  72/24/48 状态机；
- live owner 存活时拒绝恢复；dead owner 由 recovery claim 单胜者接管，并用 owner token 阻止 ABA；
- dispatch 无 terminal 只可零网络 seal 为 attempted orphan；从未 dispatch 保持 not-started，不做
  resume/replay/retry；
- evidence 使用随机 temp `wx`、fsync 与 hard-link final，same bytes 幂等，different bytes/tamper
  冲突 fail-closed；
- V4 Live CLI 在 R6 前固定返回 `live_not_available_before_r6`，R4 不会创建 Provider executor。

R4 durability `6/6`、R4/V3 focused `68/68`、Agent full `674/674`、typecheck/lint，以及
V1/V2/V3 validator 与七个历史 artifact SHA 均通过。R4 没有读取 credential、调用 Provider、启动
Docker/API/browser、创建 V4 Live artifact 或修改业务数据；下一步仅 R5 static/Mock checkpoint。

## 10. 质量门与停止条件

质量门不变：

- `24/24` verified zero-call；
- `48/48` strict runtime；
- critical / permission / mutation / broader fallback 全部 `0`；
- Tutor/Organizer semantic 均 `>=0.85`；
- 两 lane 相对冻结 baseline 提升均 `>=0.15`；
- Tutor/Organizer/paired P95 `<=2500/4500/4500ms`；
- Tutor orchestration P95 `<=6500ms`；
- 48 个 usage、价格、逐 case与 aggregate CNY 全部可验证；
- `executorProvenance=deepseek_network`；
- marker/journal/evidence/ledger/validator 完整。

R1--R5 只做零网络/static/Mock。Checkpoint 全通过后必须停止并取得新的精确 V4 Live 授权。
V4 Live 任一门失败则永久封存 V4，不重跑且不进入产品验收；只有全部通过才允许产品
Docker/API/headed-browser、分支终审、`--no-ff` 合并 main、main default-off 回放和远程推送。

## 11. 回顾问题

- 为什么 Tutor `invalidCases=10` 不能解释为已执行 14 例里有 10 个 schema 错误？
- 为什么 `organizer-runtime-14` 的 semantic subject 表面命中，仍可能违反本地 subject authority？
- 为什么 topic/evidence 很弱不能通过 merger 自动补齐？
- V4 如何让 prompt、validator、merger 和 tests 使用同一个 policy source？
- 为什么 held-out fixture 不能复制冻结 72-case 的 expected labels？
- 为什么 V4 可以复用 V3 breaker/durability 实现，却不能复用 V3 marker 或授权？
- 哪些失败触发 breaker，哪些 semantic mismatch 必须继续完整运行？
- 为什么当前“继续”的许可仍不是未来 V4 controlled-Live 的一次性精确授权？
