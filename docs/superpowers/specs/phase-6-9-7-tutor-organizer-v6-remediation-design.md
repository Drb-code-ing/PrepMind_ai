# Phase 6.9.7 Tutor / WrongQuestionOrganizer V6 Remediation Design

日期：2026-07-27

状态：R0 零 Provider 复盘与设计已冻结；尚未实现 V6 contract、candidate、runner、marker、Mock 或
Live。当前没有新的 Provider 调用授权。

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

实施计划：
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v6-remediation.md`

V5 failure authority：
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v5-controlled-live-failure.md`

R0 acceptance：
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r0-zero-provider-design.md`

## 1. 决策摘要

V6 不是 V5 retry。V5 唯一 run `aa637d3a-f7c4-4549-a724-9cdbefdd89c8` 保持
`quality_gate_failed`，其 marker、58 条 journal、evidence、SHA、固定分母与全部 `null` 聚合均不可
修改。V6 使用新的 runner、eval policy、prompt/authority、授权、marker、journal、evidence 与
validator identity；V1--V5 validators 和 V6 validator 必须双向拒绝。

V5 已执行证据暴露三个相互独立的问题：

1. `3000ms` 是 Tutor executor 的硬取消上限，不是 `2500ms` candidate P95 质量门。第 6 条 Tutor
   trace duration 为 `3021ms`、candidate orchestration 为 `3022.3072ms`、paired duration 为
   `3025.385ms`；当前证据不能把 21ms overshoot 唯一归因到 Provider、SDK、事件循环或本地代码。
2. 前 5 条 Tutor strict result 的 intent/context/guiding/final-answer/structure 均 `5/5`，depth 只有
   `2/5`。冻结 expected 对每个 intent 有一个 exact depth，但 V5 authority 允许模型在多个兼容 depth
   中选择，属于 authority 与评分合同不一致，不能直接归因于模型能力。
3. 前 6 条 Organizer strict result 的 subject/deck 为 `6/6`、topic 为 `5/6`、confidence 为 `0/6`。
   V5 validator 只验证模型 confidence enum，没有按本地 shortlist authority 重算；confidence 是本地
   证据强度，不应由模型拥有最终权威。Topic 的 `5/6` 仍是真实模型选择弱点，不能被本地 confidence
   修正掩盖。

因此 V6 只做三项有界修复：分离硬取消与质量 SLA、把 Tutor depth 收回本地教学策略 authority、把
Organizer confidence 收回本地证据 authority；模型继续负责 Tutor 歧义 intent 与 Organizer
subject/deck/topic ordinal 的真实语义选择。

## 2. V5 只读取证

### 2.1 不可变终态

- run：`aa637d3a-f7c4-4549-a724-9cdbefdd89c8`；
- guard：`24/24` verified zero-call；
- Provider invocation：12；strict runtime：`11/48`；
- breaker：`tutor-v2-runtime-06 / runtime_timeout`；后续 36 runtime 未启动；
- semantic、四类 P95、aggregate token/CNY：全部 `null`；
- evidence SHA：`84487b448acd7bd5e65cd523eb7556cd9b3175bc9ba44572e06a78157c45b70a`；
- journal SHA：`a8b8bcbfbbce9b5d8e62919edf24c71d2440cd94c74737d01fccb5c6204e8506`；
- marker SHA：`c3a3eb063677303591b858f0667c94bd8d30f993cf060736e54f1bf3b18c9e75`。

### 2.2 延迟事实

前 5 条 Tutor strict latency 为 `1084/1592/899/1138/887ms`，范围 `887--1592ms`、均值
`1120ms`。前 6 条 Organizer strict latency 为 `2025/2221/1859/2607/2123/2224ms`，范围
`1859--2607ms`、均值 `2176.5ms`。只有 Tutor runtime-06 触碰硬取消边界。

Evidence 只保存 runtime trace duration、candidate orchestration duration 和 paired duration，没有
独立 Provider response latency、SDK parsing latency 或 event-loop lag。V6 不从现有数据声称“Provider
慢了 21ms”或“客户端多算了 21ms”。

### 2.3 只读 subtotal

11 条 verified result 的 `9761/902 tokens`、`0.034695 CNY`、Tutor executed-subset axis mean `0.9`
与 Organizer `0.7083333333` 只用于定位下一版设计，不是正式质量、延迟或账单聚合，不能与 V6
结果拼接。

## 3. V6 deadline policy

V6 把两个概念显式拆开：

- **executor hard timeout**：单次 Provider 调用的取消和资源上限；触发即
  `runtime_timeout / unknown_after_attempt`，不 retry；
- **quality latency gate**：完整 24 个 paired request 的 nearest-rank P95 质量门；只有 48/48 strict、
  每条延迟和 usage 可验证时才计算，否则全部保持 `null`。

nearest-rank P95 固定按 `sortedDurations[ceil(0.95 * n) - 1]` 计算；Tutor candidate、Organizer
candidate、paired candidate 与 Tutor orchestration 各自都有 24 个完整样本，因此都取升序后的第 23
个值。不得插值、删除 timeout、把未启动项移出分母或用其它 lane 的样本补位。

冻结值：

| Lane / metric               | V5         | V6                           |
| --------------------------- | ---------- | ---------------------------- |
| Tutor executor hard timeout | `3000ms`   | `3500ms`                     |
| Tutor candidate P95         | `<=2500ms` | 不变，`<=2500ms`             |
| Organizer hard timeout      | `5000ms`   | 不变，`5000ms`               |
| Organizer candidate P95     | `<=4500ms` | 不变，`<=4500ms`             |
| paired candidate P95        | `<=4500ms` | 不变，`<=4500ms`             |
| Tutor orchestration P95     | `<=6500ms` | 不变，且不冒充产品端到端 P95 |

`3500ms` 不是把 V5 的 `3021ms` 向上取整，也不是为单个 case 开后门；它由独立策略
`2500ms quality SLA + 1000ms cancellation margin` 得出。这样单个尾部请求可以形成可验证终态，完整
P95 仍决定性能是否达标。Organizer 已执行最大值 `2607ms`，没有证据支持同时放宽其 `5000ms` 上限。

R1 必须新增单调时钟下的安全阶段计时：executor dispatch-to-terminal、runtime trace、candidate
orchestration、paired duration 与 deadline overshoot。字段只保存有限非负 duration/failure code，不保存
时间戳、prompt、模型原文、URL、credential、stack 或用户数据。NaN、负数、回退时钟、overflow、缺失
terminal 和不一致 duration 全部 fail-closed。

## 4. Tutor depth authority

V2 dataset/expected 不修改。V6 冻结新的 `tutor-preferred-depth-authority-v1`：

- 本地 signal authority 继续产生 eligible intents 与 precedence；
- 模型只在本地 eligible intent ordinal 中做真实选择，不再拥有最终 depth；
- 本地 authority 根据选中的 intent、active-context availability 与现有教学策略生成唯一
  `preferredDepth`，merger 只接受该绑定；
- `answer_direct`、final-answer boundary、guiding policy、answer structure 与 context use 仍由本地
  authority 重建；
- 模型不能自由生成答案、evidence、prompt、route、tool action 或权限。

Exact depth 指标继续按冻结 expected 评分，不改成“compatible 即通过”。为防止本地派生字段掩盖模型
质量，V6 report 额外冻结 Tutor model-owned intent accuracy：在固定 24 个 Tutor runtime case 上，将模型
选择的 eligible intent ordinal 解析后与 `expected.intent` exact-match，分母固定为 24，必须独立达到
`>=0.85`，即至少 `21/24`。缺失、非法、fallback 或 breaker 后未启动都计 false；该门不能被 depth、
structure 等本地字段抵消。

Held-out/metamorphic 至少覆盖每个 intent、双语/混合、active context 有无、否定、引用式干扰、
reorder、单变量 mutation、互斥 signal、未知 signal 与 authority SHA 漂移。禁止根据 V5 前 5 个 case
ID、原文或 expected 写特例。

## 5. Organizer confidence authority 与 topic 选择

V2 dataset/expected 不修改。V6 冻结新的
`wrong-question-organizer-confidence-authority-v1`：

- 模型继续选择 subject decision、deck action、existing-deck/topic ordinal；
- 模型不再拥有最终 confidence；
- 本地 authority 仅根据已冻结的 structured subject、同 subject deck overlap、shortlist provenance 与
  evidence strength 生成 `high | medium`；
- report 可记录脱敏的 `modelOwnedDecision` 与 `authorityConfidence`，但最终 suggestion、semantic 与
  command binding 只使用 authority confidence；
- merger 不静默修复非法 subject、deck/topic ordinal、cross-subject、stale/ABA 或 locked-name 违规。

Topic `5/6` 不归因于 confidence。V6 Organizer prompt 只增加通用、无 case 文本的 ordinal tie-break：
structured signal > knowledge point overlap > category/error type > generic topic；existing deck 与 topic
shortlist 仍由本地 authority 生成。V6 report 在固定 32 个 Organizer decision units 上分别计算三个
model-owned exact-match 门：subject decision 的 action/ordinal、deck action、target ordinal（按 action
分别为 `deckIndex` 或 `topicIndex`）。三项分母都固定为 32，且每项都必须 `>=0.85`，即至少
`28/32`；action 错误时对应 target ordinal 同时计 false，缺失、非法、fallback 或未启动也计 false。
本地 confidence 不能掩盖任一模型 ordinal 质量门。

## 6. Dataset、质量门与 anti-overfit

V6 复用 V5 已冻结且 coherence 通过的 V2 dataset bytes，不复制或改写：

- dataset version：`phase-6.9-tutor-wrong-question-v2`；
- dataset SHA：`42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b`；
- deterministic baseline SHA：
  `0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca`。

V6 新建 eval-policy identity，把 deadline、model-owned axes、local authority 与完整聚合规则纳入新 SHA。
固定 `72 cases / 24 guards / 48 runtime / 24 pairs / 32 Organizer decision units`，Tutor、Organizer、
combined semantic `>=0.85`、两个 lane 相对 baseline absolute improvement `>=0.15`、48/48 strict、
24/24 zero-call、安全/权限/mutation/broader fallback/provider failure 为 0、usage/价格/CNY 可验证等门
保持不变。新增 model-owned axis 门，不能降低既有门。

Timeout、abort、schema、usage unknown、dynamic contract failure 或 breaker 后未启动 case 都留在固定
分母。只要缺一个 strict terminal，正式 semantic/P95/token/CNY 即保持 `null`，不能删除慢样本、补跑、
重试后只计成功或把 Mock/历史局部结果拼入。

## 7. V6 identity 与历史隔离

R1/R2 实现时冻结完整 SHA；R0 先冻结 namespace：

| 维度                    | V6 namespace                                       |
| ----------------------- | -------------------------------------------------- |
| dataset binding         | `phase-6.9.7-v6-dataset-binding-v1`                |
| eval policy             | `phase-6.9.7-v6-eval-policy-v1`                    |
| runner                  | `phase-6.9.7-tutor-organizer-runner-v6`            |
| Tutor prompt            | `tutor-model-candidate-v6`                         |
| Tutor depth authority   | `tutor-preferred-depth-authority-v1`               |
| Organizer prompt        | `wrong-question-organizer-model-candidate-v6`      |
| Organizer confidence    | `wrong-question-organizer-confidence-authority-v1` |
| runtime evidence        | `phase-6.9.7-v6-runtime-evidence-v1`               |
| approval env            | `PHASE_6_9_7_V6_CONTROLLED_LIVE_APPROVED`          |
| marker/journal/evidence | 独立 `v6` 前缀                                     |

V6 confirmation token、marker schema、journal version、evidence envelope、validator 和 recovery claim 都必须
独立。V6 validator 递归拒绝 V1--V5 runId、marker/artifact path、partial metrics/usage/cost、旧 runner/
prompt/policy SHA 与 source case ID；历史 validators 必须拒绝 V6。V5 artifacts 不复制进 V6 report。

## 8. 原子实施路线

1. **R0**：本文件、计划、acceptance 与仓库状态文档；全程零 Provider。（已完成）
2. **R1**：deadline/eval-policy、单调计时与两条 local authority contract；零 Provider。
3. **R2**：Tutor intent-only bounded candidate、Organizer ordinal-only candidate、独立 held-out/
   metamorphic 与 prompt-leakage；零 Provider。
4. **R3**：独立 V6 runner/CLI 与 marker/journal/evidence/validator contract、fixed denominator、breaker、
   crash seal、V1--V5 双向隔离；只实现 contract，不创建 Live marker，零 Provider。
5. **R4**：fresh baseline/Mock、focused/full/static、PostgreSQL concurrency、Compose default-off、历史
   SHA/validator 与两路终审；零 Provider。
6. **R5**：只有新的 static/Mock checkpoint 通过且用户重新接受当时 DeepSeek 数据边界、明确授权唯一
   一次 V6 branch controlled-Live，并且 zero-network preflight 通过后，才允许在首次 Provider 调用前
   创建实际 marker/journal 并进入 Live。
7. **R6**：R5 全门通过后才做产品 Docker/API/可见浏览器与精确清理。
8. **R7**：R6 通过后才做分支收尾、main `--no-ff` 合并、main default-off 回放与远程 parity。

每个 R-task 单独提交并推送当前功能分支，不创建 worktree 或子分支。任何失败立即按该版本终态封存，
不跨任务偷跑后续步骤。

## 9. 非目标与禁止事项

- 不重跑、恢复、删除或改写 V1--V5；
- 不把本次“允许重新评估 Tutor 时延”解释为 Provider、Docker 或产品验收授权；
- 不修改 V2 dataset/expected、删除慢 case、降低 semantic/P95/安全门或动态适配 Live 结果；
- 不让模型拥有最终回答、真实 ID、owner、locked name、写库、route、tool 或 FSRS 权限；
- 不保存 raw prompt/model output、credential、真实用户文本/ID 或自由文本错误；
- 不启动产品 Docker/API/browser，不修改业务数据；
- 不进入 Task 13/main、Phase 6.9.8、Phase 6.10、Phase 8/9 或两篇博客收尾。
