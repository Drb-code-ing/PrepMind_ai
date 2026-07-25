# Phase 6.9.7 Tutor / WrongQuestionOrganizer V4 R1 有界诊断验收

日期：2026-07-26

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

状态：R1 已完成；该检查点当时下一步为 R2，后续 R2/R3 已完成，当前下一步仅 R4。

## 1. 本轮解决了什么

V3 的安全 evidence 能区分 Provider、结构化输出、调度与未执行状态，但 Organizer 的本地动态合同
仍把多个错误压成粗粒度 `subject_authority_violation` 或 `invalid_evidence_association`；同时固定
semantic 分母会把 breaker 后未执行 case 反映为 invalid，容易被误读为“已经调用模型但 schema
失败”。R1 新增独立的 `phase-6.9.7-v4-bounded-diagnostics-v1`，只记录枚举和布尔值，不记录题目、
上下文、prompt、模型原文、Provider 原始错误、真实 ID 或凭据。

每个 V4 case 现在互斥地属于：

- `not_started`：`case_guard / quality_breaker / parent_abort / orphaned`；
- `executed_contract_failure`：必须明确失败阶段为 `provider_runtime / raw_schema /
dynamic_contract / local_merger / usage / latency / safety`；
- `executed_semantic_mismatch`：runtime contract 已完整通过，但至少一个冻结语义轴不匹配；
- `executed_semantic_match`：runtime contract 与全部语义轴均通过。

因此未执行 case 不再被包装成 schema invalid、semantic mismatch 或零成本 Provider failure；语义
偏差也不会提前打开 runtime contract breaker。

## 2. Organizer 单一校验链

`validateWrongQuestionOrganizerModelDecisionV4` 先做完整字段安全 clone 与 strict Zod，再按以下唯一
顺序返回第一个 `stage / axis / reasonCode`：

```text
context / question index
  -> subject
  -> deck
  -> topic
  -> evidence
  -> confidence
```

V4 固定 reason 包括：

- `known_subject_requires_keep_local`；
- `unknown_subject_requires_bounded_subject`；
- `subject_unresolved`；
- `deck_index_out_of_range` / `cross_subject_deck`；
- `topic_label_invalid`；
- `known_subject_evidence_missing`；
- `deck_action_evidence_missing`；
- `confidence_evidence_conflict`；
- 既有 schema、context 与 question-index reason。

旧 `validateWrongQuestionOrganizerModelDecision` 不复制第二套判断，而是把同一 V4 结果映射回 V1/V2
历史 reason。产品 candidate 已把这次成功 validation 原样交给 merger；merger 只做本地
projection/ID/name authority 重建，不重新排序 reason，也不补 evidence、不修正越权 subject、不清洗
非法 topic。公开纯 merger 入口仍先执行同一 validator，保持既有测试与安全边界。

## 3. V4 case/report 合同

Tutor semantic observation 只保存七个布尔轴：`intent / depth / evidenceAssociation / contextUse /
guidingPolicy / finalAnswerBoundary / answerStructure`，以及 nullable 的
`moreSpecificPrimaryEvidenceSuppressed`。若更具体 primary evidence 被压过，`intent` 不得同时冒充
匹配。

Organizer semantic observation 只保存 `subject / deck / topic / evidence / confidence` 五个布尔轴。
Organizer 的 `raw_schema` 或 `dynamic_contract` 失败必须携带精确的细粒度 diagnostic；Provider、usage
等前置/后置失败只记录其真实 contract stage，继续由既有 V3 runtime evidence 承担原因 authority，
不会伪造本地动态 reason。

72-case report 绑定冻结 dataset version/SHA，校验 canonical case ID、agent、24 个真实 guard 与 48 个
runtime case，并由 case entries 重新计算 execution、contract stage、semantic mismatch axis 与 Organizer
dynamic reason 计数。重复 case、手改 aggregate、跨 agent、guard/runtime 错配、自由文本、额外字段和
raw model output 都 fail-closed。projection 先拒绝 accessor/proxy 类 hostile input，再深冻结输出。

## 4. 历史兼容

- V1 的 V2/V3/V4 字段继续完全 absent；
- V2 只拥有原 canonical diagnostics，不出现 V3/V4 字段；
- V3 只拥有独立 runtime evidence，不出现 V4 字段；
- V1/V2/V3 strict validator 均拒绝注入 V4 字段；
- V4 validator 拒绝 V1/V2/V3 report；
- synthetic 生成的三版 report 在 V4 projection 前后 SHA-256 一致。

提交前又只读计算七个历史 artifact：V1 evidence/marker 仍为 `be044871...f34b5` /
`7cb443f1...ecffb`，V2 evidence/marker 仍为 `0c645062...84c77` / `ac65ac67...98504`，V3
marker/journal/evidence 仍为 `b18a7688...be412` / `df141874...d6cff` / `e24f4e6d...2d25c`，与 R0
记录完全一致。

V1/V2/V3 的 marker、journal、evidence、reason、runner、prompt 与 validator 源文件均未修改；三次 Live
终态仍不可重跑、删除、覆盖或解释为 V4 证据。

## 5. 验证证据

| 检查                                                             | 结果                                                                                                  |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| V4 diagnostics + Organizer contract/candidate/robustness focused | `32 passed / 510 expect()`                                                                            |
| V4 R1 专项                                                       | `6 passed / 46 expect()`                                                                              |
| Agent 全量                                                       | `635 passed / 6759 expect()`                                                                          |
| Agent TypeScript                                                 | `tsc --noEmit` 通过                                                                                   |
| Agent ESLint                                                     | `eslint src/ scripts/` 通过                                                                           |
| Prettier                                                         | 本地 workspace Prettier 通过                                                                          |
| `git diff --check`                                               | 通过                                                                                                  |
| V1/V2/V3 历史 artifact SHA                                       | 7/7 与 R0 一致                                                                                        |
| 两路只读复审                                                     | history/cross-version `APPROVED`；contract Important 修复后复审 `RESOLVED`，无剩余 Critical/Important |

全部命令均为本地 synthetic/Mock/static。未读取 `.env` 或 component credential，未调用 Provider，未
创建 V4 runner/CLI/授权/marker/journal/evidence，未启动 Docker/API/浏览器，未修改 PostgreSQL、
Redis、MinIO、Docker volume 或业务数据。

## 6. 交付边界与下一步

R1 只证明诊断真值、聚合防伪和历史隔离，不证明 V4 prompt 质量、真实模型质量或产品可用性。
下一任务 R2 只实现 Tutor 的 intent precedence、depth/context/pedagogy/answer-structure 单一 policy
source 与独立测试，仍保持 zero-network。R3 才处理 Organizer 语义 policy，R4/R5 才建立独立
robustness、runner/lineage 与 static/Mock checkpoint。

R5 完成后必须停止并重新取得一次精确 V4 controlled-Live 授权；当前用户的“继续”不替代该未来
授权。V4 Live、产品 Docker/API/可见浏览器、Task 13/main 合并、Phase 6.10 与博客收尾均未开始。

## 7. 回顾时可以问

- 为什么 `executed_semantic_mismatch` 不能触发 runtime contract breaker？
- 为什么 Organizer 的 Provider 失败不能伪装成 subject/topic/evidence reason？
- 为什么旧 validator 必须拒绝 V4 字段，而不是自动填 `null`？
- 为什么 merger 要复用已通过的 validator result，同时仍保留本地 ID/name/write authority？
- 为什么 24 个 guard case 必须是 `not_started/case_guard`，而不能记成成功的模型调用？
