# Phase 6.9.7 Tutor / WrongQuestionOrganizer V4 R0 零 Provider 复盘验收

日期：2026-07-26

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

起点：`487a270f`

状态：V4 R0 已完成 bounded 失败复盘、设计与原子计划；本轮没有修改 Agent 源码，没有读取真实
credential、调用 Provider、创建 V4 Live artifact 或启动产品 Docker/API/browser。

## 1. 为什么需要 V4

唯一 V3 Live `ff2e1a54-0cbd-494c-96b7-a0f366c6c3dc` 已证明调度、调用记录、usage、熔断、固定
分母和 durable seal 正常，但质量门失败：`27/48` strict runtime，Tutor/Organizer semantic
`0.5280555556/0.4376201923`，最终 `quality_gate_failed`。

V3 一次性名额已消费。继续不能删除失败 case、重跑 V3、降低 `0.85/0.15` 质量门或让本地规则
替模型补答案，只能另立 V4 identity，先在零网络环境修复语义与诊断合同。

## 2. Evidence 复盘结果

本轮只读取 V3 已封存的 bounded evidence，不读取或输出 prompt、模型原文、Provider body/error、
credential、真实 ID 或业务数据。

提交前重新计算历史文件 SHA-256，V1 evidence/marker 仍为 `be044871...f34b5` /
`7cb443f1...ecffb`，V2 evidence/marker 仍为 `0c645062...84c77` /
`ac65ac67...98504`，V3 marker/journal/evidence 仍为 `b18a7688...be412` /
`df141874...d6cff` / `e24f4e6d...2d25c`；与各自 authority 一致。

### Tutor

- 前 14 个 runtime 全部 strict success、usage verified；
- intent/depth/context/guiding/final-answer/structure 命中分别为
  `11/14、14/14、14/14、11/14、14/14、11/14`；
- 三个可见偏差是两个 `socratic_hint -> general_follow_up` 和一个
  `step_check -> general_follow_up`；
- 报告的 10 个 invalid case 来自 breaker 后未执行项，不是前 14 个 schema failure。

### Organizer

- 前 14 个 runtime 为 13 success + 1 dynamic-contract failure；
- 14 个 bounded decision 的 subject/action/accepted-topic/confidence/required-evidence 命中分别为
  `13/14、14/14、5/14、12/14、10/14`；
- 7 个 decision 使用 `insufficient_signal`；
- `organizer-runtime-14` raw schema 成功，但在 `dynamic_contract` 返回
  `subject_authority_violation`，随后 breaker 阻止剩余 20 个 runtime；
- semantic observation 同时显示 unexpected topic 与空 evidence，但 validator 的执行顺序不能把
  后置 topic/evidence observation 改写成首个 subject-authority failure 的根因。

## 3. 可以确认与不能确认

可以确认：

1. Tutor 当前主要可见失败簇是具体 intent 被降级成 `general_follow_up`；
2. Organizer 的 topic/evidence/confidence 质量不足，subject/action 相对更稳定；
3. V3 首错是本地 subject authority dynamic contract，不是已记录的 Provider/网络/JSON failure；
4. 固定分母、首错 breaker、lane 隔离与 durable evidence 都按 V3 设计工作；
5. V3 未达到真实模型质量门，不能进入产品验收。

不能确认：

- `organizer-runtime-14` 的 raw model 字段或原始解释；
- 是模型选择、prompt 理解、投影/序列化还是其它被安全删除的内容导致首错；
- 未执行 20 个 runtime 的实际输出、完整 P95、完整 usage/CNY 或泛化质量；
- 只靠一处 prompt 文案能否达到质量门。

## 4. 源码与合同抽样

主代理与两路只读审查确认：

1. Tutor policy 只有 primary/allowed evidence、compatible depth 与文字 guidance；虽然 prompt 写了
   “choose most specific”，但没有深冻结 pairwise precedence；
2. Tutor merger 从模型 intent 派生 guiding/answer structure，所以 intent 降级会扩散到教学策略；
3. Organizer 已有深冻结 association policy，但 known subject、topic、evidence/confidence 是顺序检查，
   当前只返回第一条粗粒度 reason；
4. Organizer 已知 subject 必须返回 `keep_local`，这与 semantic evaluator 最终解析后的 subject 命中
   是两个不同维度；
5. 现有 held-out/metamorphic 测试覆盖 authority/reorder/安全与静态 contract，但不足以证明真实
   candidate 对 intent precedence、topic specificity 和 evidence matrix 的泛化质量。

## 5. V4 冻结方案

| 维度        | 决策                                                                                    |
| ----------- | --------------------------------------------------------------------------------------- |
| history     | V1/V2/V3 artifact 永久不可变，V4 validator 与历史版本双向隔离                           |
| diagnostics | V4-only 固定 axis/stage/reason；执行失败、语义 mismatch、未执行分开                     |
| Tutor       | primary-signal intent precedence；prompt/validator/strategy/fixtures 同一 policy source |
| Organizer   | subject/deck/topic/evidence/confidence 决策矩阵同源；merger 不修非法输出                |
| robustness  | 独立 held-out/metamorphic/schema-negative 与实际 prompt leakage scan                    |
| safety      | Tutor 无 answer/tool/route 权，Organizer 无 ID/JWT/DB command/write authority           |
| runtime     | 24 guard、单 pair 双并发、lane 隔离、首错 breaker、固定分母、无 retry                   |
| evidence    | 新 V4 runner/prompt/marker/journal/evidence/validator lineage                           |
| gate        | `0.85/0.15`、P95、usage/pricing、安全门全部不变                                         |

详细设计：
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v4-remediation-design.md`。

原子计划：
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v4-remediation.md`。

## 6. 安全与操作边界

本轮：

- 没有修改冻结 dataset、V1/V2/V3 artifact 或 Agent runtime 源码；
- 没有读取根 `.env`、API key 或 Provider 账号数据；
- 没有调用 DeepSeek 或其它外部 Provider；
- 没有创建 V4 marker/journal/evidence/recovery claim；
- 没有启动、停止、重建或清理 Docker；
- 没有创建账号、错题、deck、Trace、session 或浏览器数据；
- 没有合并 main 或推送远程；
- tracked gates 的 default-off 结论没有改变。

用户允许继续工程工作，使 R1--R5 零 Provider/static/Mock 任务可继续；它不替代 R5 后针对 V4
controlled-Live 的一次性精确授权。

## 7. 当前结论与下一步

Phase 6.9.7 仍未完成；Tutor/Organizer 真实模型产品可用性仍未确认。本 R0 检查点当时下一步是
R1 V4-only bounded diagnostics 与历史兼容测试；后续 R1 已保持 zero-network 完成，见
`2026-07-26-phase-6-9-7-tutor-organizer-v4-r1-bounded-diagnostics.md`；后续 R2--R5 也已完成。R5
static/Mock checkpoint 与独立终审见
`2026-07-26-phase-6-9-7-tutor-organizer-v4-r5-static-mock.md`。该 R0 后续状态段在 R5 时停在 R6
精确一次性 V4 Live 授权门前，本段对 R0 当时范围的记录不作改写。

回顾时可以问：

- V3 哪些工程边界已经证明成立，V4 为什么不再重做它们？
- Tutor 三个已执行语义偏差如何扩散到 guiding/answer structure？
- 为什么 Organizer semantic subject 命中仍可能违反 `keep_local` authority？
- V4 如何区分 dynamic contract failure、semantic mismatch 和 breaker 未执行？
- 为什么 merger 不允许自动补 evidence 或修正 subject？
- 为什么当前继续许可不能直接执行未来 V4 Live？

## 后续 R6 终态

上述是 R0 当时的零 Provider 设计记录，不作改写。后续唯一 V4 R6 run
`0fb47591-5ff4-4e46-bcf3-2cd267d1fb2f` 已以 `10/48` strict runtime、`quality_gate_failed` 失败封存，
一次性名额已消费且不得重跑。R7--R9、产品 Docker/API/浏览器、Task 13/main、Phase 6.10 与博客收尾
均不得开始；若继续只能建立与 V1--V4 双向隔离的零 Provider remediation。详见
`2026-07-26-phase-6-9-7-tutor-organizer-v4-controlled-live-failure.md`。
