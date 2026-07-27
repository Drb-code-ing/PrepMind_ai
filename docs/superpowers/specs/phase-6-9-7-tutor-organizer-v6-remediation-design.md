# Phase 6.9.7 Tutor / WrongQuestionOrganizer V6 Remediation Design

日期：2026-07-27

状态：R0--R4 已完成且均为 zero-provider。V6 source contracts、两条 bounded candidate、独立
robustness、runner/CLI/approval、marker/hash-chain journal/hard-link evidence、validator lineage 与
reviewed Mock checkpoint 已冻结；尚未实现产品 composition 或 Live。当前没有新的 Provider 调用
授权，下一步仅 R5 branch controlled-Live。

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

实施计划：
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v6-remediation.md`

V5 failure authority：
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v5-controlled-live-failure.md`

R0 acceptance：
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r0-zero-provider-design.md`

R1 acceptance：
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r1-source-contracts.md`

R2 acceptance：
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r2-bounded-candidates.md`

R3 acceptance：
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r3-runner-lineage.md`

R4 acceptance：
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v6-r4-static-mock.md`

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

### 7.1 R1 已冻结的 source contracts

R1 已将本设计中的 source-level 约束实现并冻结：

- dataset binding SHA：`3306cc399730f85b3281c90f226f629873d9755325415b69a0263a0f57b96153`；
- eval policy SHA：`5066decfc88e3d36671a60b3d269ae9e93e061207d44927bca9e0d2551973d89`；
- Tutor preferred-depth rules SHA：
  `b57a828e14294f712a6547be2ac168b1d58b79cdc5b9aecbb071304f4e5ae7af`；
- Organizer confidence rules SHA：
  `a46eda402e8c39cdc965277375e8a2aeea27e41c98cda7fd4ba513a9cb520475`。

固定 24 样本 nearest-rank P95 不允许调用方覆盖；任一 lane 缺 terminal/timeout/NaN/越界时四个 P95
全部为 `null`。model-owned scorer 固定 Tutor `21/24` 与 Organizer 三轴各 `28/32`，hostile input
不会向外抛 raw error。V5 `3000ms` timeout 与 V6 policy `3500ms` 保持隔离。

R1 的 Organizer authority 只建立输入/输出合同，并未把 fingerprint 字符串绑定到实际 owner shortlist。
actual shortlist/fingerprint、pre/post stale fence、ABA、locked name 与真实 ordinal association 必须由 R2
candidate composition 完成。R1 也没有 runtime factory、runner、Mock 或 Live，不能据此声称 Agent 已
接入新的模型路径。

### 7.2 R2 已冻结的 candidate composition

R2 已把 R1 source contracts 接入两个独立 package candidate，但仍没有产品 wiring：

- Tutor prompt/strict schema 只允许 `{ intentIndex }`；projection 仅暴露安全文本、context availability、
  authority SHA 与 eligible intent ordinal。本地 preferred-depth authority 重建 depth、context use、
  guiding/final-answer boundary、answer structure 与最终 TutorStrategy；
- Organizer 复用 V5 实际 owner shortlist。模型只能返回 shortlist fingerprint、每题 ordinal 与
  subject/deck/topic ordinal；真实 ID、locked name、confidence、reason/description、command binding 与
  写权限不进入模型；
- Organizer 在 runtime 前后分别重新派生实际 shortlist，并验证 owner domain、snapshot version/
  fingerprint 与 shortlist fingerprint。stale、ABA、cross-subject、duplicate/out-of-range ordinal、
  locked-name collision 或 association drift 整批 fail-closed，不 retry；
- confidence 只由本地 structured/knowledge-point/category/error-type/same-subject overlap evidence 重建；
  跨语言阅读 overlap 只接受有界等价组，不能由任意 reuse 自动升级；
- public Organizer merger 不信任 validated-shaped 调用者，先还原 raw ordinal decision 再执行完整
  validator；hostile accessor/proxy 不被调用；
- actual prompt 递归 leakage scanner 不允许 V1--V5 identity、frozen case ID、expected/oracle、source ID
  或完整 label authority，且以 deliberate contamination 证明 scanner 有效。

冻结 identity：

| Contract                       | SHA-256                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| Tutor V6 prompt                | `4f73ae60e708ed9ba08bc5533cc489626543ca09e0396777ef4d725c9656a169` |
| Organizer V6 prompt            | `c5f1f662ba380283aa08ffe2dc194874c9420b1c6b34ffc86107e476101f3450` |
| independent robustness fixture | `314543fe1694c0caa2b8fc48fa79a1bfcd751eb0431664ffafb9ceee3103904b` |

R2 focused `24/24`、Agent full `792/792`、typecheck/lint 与独立复审通过。V2 dataset/baseline SHA
保持不变。R2 没有 runtime factory、product gate/Trace、runner、Mock 或 Live；expected-driven
no-network executor 只证明工程 contract，不能作为模型语义质量 authority。

### 7.3 R3 已冻结的 runner、lineage 与 durability contract

R3 新增独立 V6 report/case/evidence schema、paired runner、CLI/approval、marker/hash-chain journal、
hard-link evidence、recovery claim 与 validator：

- report 固定 `72 cases / 24 guards / 48 runtime / 24 pairs / 32 Organizer decisions`，24 guard
  全部先行；pair 串行、pair 内最多双 lane，首个 runtime contract failure 收口当前 pair 后熔断；
- dispatch ledger 在 executor 前 append+fsync；attempted orphan、sibling abort、usage unknown、未启动项
  都保留在固定分母，任一 lane 不完整时 semantic/P95/token/CNY 全部为 `null`；
- runner 使用 R1 deadline contract：Tutor hard timeout `3500ms`、Organizer `5000ms`，四类 P95 仍须
  各自恰好 24 个样本；Tutor intent 与 Organizer 三个 model-owned axes 不能被本地派生字段抵消；
- marker 独占创建，journal 使用 sequence/previous hash/record hash 链与串行 append queue；live owner
  不得误封，dead owner 只允许一个 recovery claimant，ABA/tail drift/旧 appender 均 fail-closed；
- evidence 通过随机 temp 文件 fsync 后 hard-link 到 final path；同字节幂等，不同字节拒绝覆盖；recovery
  只 seal，不 resume/replay/retry Provider；
- V6 validator 递归拒绝 V1--V5 runner、candidate/projection/prompt、policy、marker/journal/evidence/
  recovery identity；五版历史 validator 也拒绝 V6 envelope；
- `synthetic_test` 仅供临时目录中的故障/lineage 回归，quality gate 强制要求
  `executorProvenance=deepseek_network`，因此 synthetic Live 永远不能成为质量 authority；
- 公共 CLI 已注册；该 R3 检查点当时没有正式 Mock factory，无注入运行 `mock` 会返回
  `mock_harness_unavailable_before_r4`。后续 R4 已发布 reviewed factory；R3 没有创建仓库真实
  marker/journal/evidence/recovery claim。

Durability 的已知范围必须如实保留：当前实现对文件执行 fsync，但没有父目录 fsync，因此不证明突然
断电后的目录项持久性；recovery claim 获取时不直接重读 journal tail，后续 appender/seal 会再次校验；
当前没有专门覆盖 stale claim rename 后立刻再次崩溃的测试。这些是 R3 的已知边界，不影响当前
zero-provider contract checkpoint，也不能被表述为已经解决的生产级跨主机 lease。

R3 focused `32/32`（225 assertions）、Agent full `824/824`（10727 assertions）、typecheck/lint/
Prettier 与独立复审通过。R3 没有正式 Mock checkpoint、Provider、产品 composition、Docker/API/browser
或业务数据操作；R3 在 R4 前完成，后续 R4 已完成。

### 7.4 R4 已冻结的 static/Mock checkpoint

R4 新增 reviewed V6 Mock factory 与 baseline/Mock CLI。Mock 真实经过 V6 Tutor/Organizer candidates、
strict validators、本地 authority mergers 与正式 runner；24 guard 不构造 runtime，48 runtime 各执行
一次 synthetic invocation，无重试。Mock duration 来自单调时钟，output token 为正且受 cap 校验，
费用固定 `0 CNY`，不冒充 Provider telemetry。

Fresh V2 baseline 保持 `12/48`、semantic `0.6629642857/0.278125/0.4705446429`；fresh V6 Mock 为
`24/24` zero-call、`48/48` strict runtime、semantic/model-owned `1/1/1`，gate 固定
`mock_quality_not_evidence`。受影响全量静态、Organizer PostgreSQL `12/12`、Compose default-off、
V1--V5 validators 与 V6 Live artifact=0 均通过；Mock evidence 已按精确路径删除。

R4 没有读取 credential、调用 Provider、启动产品 Docker/API/browser、接产品 composition 或把 V6
`3500ms` 接入产品 executor。Mock 满分、本机 P95、synthetic token 与 `0 CNY` 只证明工程合同，不
证明真实模型语义、网络 P95、Provider 账单或产品可用性。R3 的无父目录 fsync、claim tail 延后复核、
缺 stale-rename 后二次崩溃专测三项边界继续保留。

## 8. 原子实施路线

1. **R0**：本文件、计划、acceptance 与仓库状态文档；全程零 Provider。（已完成）
2. **R1**：deadline/eval-policy、单调计时与两条 local authority contract；零 Provider。（已完成）
3. **R2**：Tutor intent-only bounded candidate、Organizer ordinal-only candidate、独立 held-out/
   metamorphic 与 prompt-leakage；零 Provider。（已完成）
4. **R3**：独立 V6 runner/CLI 与 marker/journal/evidence/validator contract、fixed denominator、breaker、
   crash seal、V1--V5 双向隔离；只实现 contract，不创建 Live marker，零 Provider。（已完成）
5. **R4**：fresh baseline/Mock、focused/full/static、PostgreSQL concurrency、Compose default-off、历史
   SHA/validator 与两路终审；零 Provider。（已完成）
6. **R5**：只有新的 static/Mock checkpoint 通过且用户重新接受当时 DeepSeek 数据边界、明确授权唯一
   一次 V6 branch controlled-Live，并且 zero-network preflight 通过后，才允许在首次 Provider 调用前
   创建实际 marker/journal 并进入 Live。（当前未授权）
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
