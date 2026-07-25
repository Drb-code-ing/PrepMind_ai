# Phase 6.9.7 Tutor / WrongQuestionOrganizer V4 R2 Tutor 语义验收

日期：2026-07-26

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

状态：R2 已完成；该检查点当时下一步仅为 R3，后续 R3 已完成。

## 1. 为什么需要本轮

V3 Live 暴露的 Tutor 失败并不只是“模型回答不好”：模型 prompt 的 intent 顺序、本地
deterministic detector、validator 的 evidence/depth 规则、merger 和最终 `TutorStrategy` 之前分散在
多个文件。active context 又同时可作为 Hint/General 的 evidence，模型可能把已有具体教学意图降级
成 `general_follow_up`。如果继续只改 prompt，测试、产品 merger 与历史 evidence 会继续漂移。

R2 的目标是建立一份可执行语义 authority，同时保留两条不能混淆的边界：

1. V4 模型决策使用新的明确 precedence 与本地 fail-closed merger；
2. 冻结 deterministic baseline 及 V1/V2/V3 prompt/evidence 继续保持原样，不用新逻辑改写历史。

## 2. 本轮实现

### 2.1 单一深冻结 policy

`packages/agent/src/policies/tutor-strategy-policy.ts` 现在统一定义：

- 模型可选 intent、evidence、depth 与 answer section 枚举；
- precedence：`step_check > explain_solution > concept_bridge > socratic_hint > general_follow_up`；
- 每个 intent 的 primary/allowed evidence 与 compatible depth；
- default/active-context depth；
- guiding question、final answer 与 answer structure 本地不变量。

`tutor-model-contract.ts` 的 V4 prompt formatter、validator、depth compatibility 和 evidence precedence
resolver，以及 `nodes/tutor.ts` 的 `buildTutorStrategyFromIntent` 都从该 policy 派生，不再各自维护
另一份 strategy 表。

### 2.2 active context 与降级边界

- `general_follow_up` 只有在不存在四类更具体 primary evidence 时才允许；
- active context 只能补充条件，不能改变或压过具体 intent；
- merger 拒绝模型把本地已识别的具体 intent 降级到更低 precedence；
- `answer_direct` 仍是本地零调用权限边界，不进入模型 schema；
- 中英文否定式“不要/Don't just give me the answer”不会误判成 direct-answer authority；
- Hint/Concept/Step 的 final-answer 与 guiding/structure 边界继续由本地代码生成，模型不能输出答案、
  route、tool、permission 或写操作。

### 2.3 历史隔离

当前产品 Tutor candidate 使用 `tutor-model-candidate-v4` policy；历史通用 paired eval harness 显式走
只读 `runTutorModelCandidateV2`，因此不会用 V4 prompt 伪装成 V2/V3 evidence。已验证：

- deterministic baseline 仍是 `6/48`，Tutor semantic 仍为 `0.4418666667`；
- V3 Tutor prompt content SHA 仍为
  `sha256:91be509194de33c8d99d7a09fa6ef387c6f31aa06d19d8fd970800731047fc6a`；
- V1/V2/V3 report/marker/journal/evidence 没有被重建、重跑或改写；
- 冻结 72-case dataset、SHA、expected、metric、threshold、预算与 no-retry 均未修改。

## 3. 验证证据

| 验证项                                    | 结果                            |
| ----------------------------------------- | ------------------------------- |
| Tutor R2 + baseline + V3 identity focused | `56 passed / 533 expect()`      |
| Agent 全量                                | `647 passed / 6856 expect()`    |
| Web Tutor 配置/编排                       | `18 passed`                     |
| 冻结 deterministic baseline               | 原计数、指标与 byte-stable 通过 |
| V3 prompt identity/SHA compatibility      | 通过                            |
| Agent TypeScript                          | `tsc --noEmit` 通过             |
| Agent / Web 相关 lint                     | 通过                            |
| Prettier / `git diff --check`             | 通过                            |
| Markdown 相对链接                         | `65 checked / 0 missing`        |
| Provider / Docker / API / browser         | 未执行                          |

最终轻量复验还使用 Web 规定的 Node test 入口重跑两个受影响文件，`11/11` 通过；此前记录的 Web
Tutor 配置/编排完整 focused 结果仍为 `18/18`。

## 4. 本轮明确没有做什么

- 未读取 `.env` 或任何 component credential；
- 未调用 DeepSeek 或其他 Provider；
- 未创建 V4 runner、CLI、approval、marker、journal、evidence 或 Live artifact；
- 未启动 Docker、API 或浏览器；
- 未修改 PostgreSQL、Redis、MinIO、Docker volume 或业务数据；
- 未改 Organizer V4 policy；该工作属于 R3；
- 未执行 R4 robustness/lineage、R5 static/Mock checkpoint 或 R6 controlled-Live。

## 5. 下一步与停止条件

该检查点当时下一步仅执行 R3：把 WrongQuestionOrganizer 的 subject、deck、topic、evidence 与
confidence 收敛为单一 V4 决策矩阵；R3--R5 后续均已以 zero-network 完成。R4 证据见
`2026-07-26-phase-6-9-7-tutor-organizer-v4-r4-robustness-lineage.md`，R5 static/Mock checkpoint 与
独立终审见 `2026-07-26-phase-6-9-7-tutor-organizer-v4-r5-static-mock.md`。当前已停在 R6 精确一次性
V4 Live 授权门前，仍不能启动产品验收。

R5 checkpoint 已全部通过并停止；用户当前“继续/所有权限”不替代新的、精确的一次 V4 branch
controlled-Live 授权。
