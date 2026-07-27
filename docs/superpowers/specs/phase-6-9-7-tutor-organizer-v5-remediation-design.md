# Phase 6.9.7 Tutor / WrongQuestionOrganizer V5 Remediation Design

日期：2026-07-27

状态：R0--R5 已完成且均为 zero-provider。独立 V2 dataset/coherence、eval policy/baseline、Tutor
local-signal candidate、Organizer owner-snapshot ordinal shortlist、原生 runner/lineage 与 R5
static/Mock 均已冻结。唯一 V5 R6 run `aa637d3a-f7c4-4549-a724-9cdbefdd89c8` 已使用
`deepseek_network` 执行并以 `quality_gate_failed` 封存：`24/24` guard、12 次 Provider invocation、
`11/48` strict runtime，第 6 对 Tutor `3021ms > 3000ms` timeout 后熔断，正式聚合均为 `null`。
V5 R6 不得重跑，R7/main/Phase 6.10 被阻断。后续 V6 R0 已完成零 Provider 复盘与独立设计；V5
identity、artifact 与授权不在 V6 中复用。

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

实施计划：
`docs/superpowers/plans/phase-6-9-7-tutor-organizer-v5-remediation.md`

V4 failure authority：
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v4-controlled-live-failure.md`

R0 acceptance：
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r0-zero-provider-root-cause.md`

R1 acceptance：
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r1-dataset-authority.md`

R2 acceptance：
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r2-tutor-local-signal-authority.md`

R3 acceptance：
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r3-organizer-ordinal-shortlist.md`

R4 acceptance：
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r4-runner-lineage.md`

R5 acceptance：
`docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r5-static-mock.md`

R6 failure authority：
`docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v5-controlled-live-failure.md`

## 1. 决策摘要

唯一 V4 Live 失败不是单一的“验收脚本误判”，而是三个可以分别验证的问题叠加：

1. 冻结 V1 dataset 的 Tutor runtime fixture 存在真实缺陷：`tutor-runtime-06` 把中文代数步骤与
   英文微积分 active context 拼在一起，并按数组奇偶错误标记为 `en`；同类跨题 context 和语言
   tag 错位不只一例。
2. V4 product candidate 对模型 JSON 的拒绝是按当前合同真实发生的。合法
   `step_check + submitted_step` 会应用；缺少 primary evidence 或使用不允许 evidence 会在产品路径
   返回 `fallback_schema_invalid / invalid_evidence_association`。V4 adapter 只是投影该结果，没有把
   合法 product result 凭空改成失败。
3. Live 已执行样本仍显示真实语义弱点：前三个中文 hint 请求均落到 `general_follow_up`，相邻两个
   英文 hint 请求均命中；Organizer 前五例只有两个 canonical topic 命中，第五例还出现
   `major -> computer`。即使移除坏 fixture，也不能据此把 V4 改判为通过。

因此 V5 必须同时修复 benchmark 真实性、Tutor 双语决策与 Organizer 有界选择，不能只改验收脚本，
也不能只换 prompt 后再次碰运气。

## 2. R0 已确认事实与证据边界

### 2.1 V4 历史保持不可变

- 唯一 run：`0fb47591-5ff4-4e46-bcf3-2cd267d1fb2f`；
- `24/24` guard zero-call、6 对完成、12 executor started、`10/48` strict runtime；
- breaker：`tutor-runtime-06 / invalid_evidence_association`；
- sibling Organizer：`attempted_aborted / unknown_after_attempt`；
- 最终：`quality_gate_failed`，不得重跑、补跑、resume、replay 或改写。

发现 dataset fixture 缺陷只说明 V4 benchmark 不足以继续作为下一轮 authority，不会修改 V4 marker、
journal、evidence、SHA 或失败结论。

### 2.2 确认是 fixture 的部分

冻结 V1 `tutor-runtime-06`：

- latest text：中文代数步骤 `2x=6`；
- active context：英文微积分 derivative step；
- tag：`en`，不是 `zh`；
- expected：`step_check`；
- dataset SHA 仍为
  `7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e`。

根因是 `tutorContext(pairedRunIndex)` 独立轮转题目上下文，而语言 tag 使用
`pairedRunIndex % 2` 推导；definition 没有显式绑定 language、题目族和 coherent context。

### 2.3 确认不是 adapter 误判的部分

paired runner 与产品 Chat 编排都调用 `runTutorModelCandidate()`。Raw structured object 先经过产品
schema、dynamic contract、intent precedence 和 merger，之后 runner 才生成 bounded diagnostic。

零网络差分回归已证明：

| synthetic output                                     | product disposition                                      |
| ---------------------------------------------------- | -------------------------------------------------------- |
| `step_check + submitted_step`                        | `candidate_applied`                                      |
| `step_check + submitted_step + contextual_reference` | `candidate_applied`                                      |
| `step_check + contextual_reference`                  | `fallback_schema_invalid / invalid_evidence_association` |
| `step_check + concept_gap`                           | `fallback_schema_invalid / invalid_evidence_association` |

相同 product rejection 进入 canonical diagnostic 后得到
`dynamic_contract / invalid_evidence_association`。这排除了“V4 adapter 单独把合法结果判错”的假设。

### 2.4 当前不能确认的部分

V4 evidence 按安全合同没有保存 raw model JSON、prompt 或用户原文。因此不能确认第 6 个 Tutor
到底返回了哪组 evidence codes，也不能把它进一步归因为某个具体 token、Provider 字段或网络问题。
V5 不通过恢复敏感原文来补这个证据缺口。

## 3. V5 核心设计

### 3.1 新 dataset identity，不修补 V1

V5 新建 `phase-6.9-tutor-wrong-question-v2` dataset。每个 Tutor runtime definition 显式包含：

- `language: zh | en | mixed`；
- `exerciseFamily`；
- `latestUserText`；
- 与同一道题、同一语言一致的 `activeStudyContext`；
- expected strategy 与必要的 local signal assertions。

构建阶段执行 fail-fast coherence validator：

- language 不能由数组位置推断；
- latest/context 必须共享 exercise family；
- 中英/混合比例显式冻结；
- case ID、expected、accepted label 仍不得进入 prompt；
- 新 dataset 使用新 SHA，V1 bytes/SHA 不变。

Organizer fixture 同样显式区分 structured subject authority、无 subject 的 taxonomy case、topic
candidate 来源与 batch relation，避免把“专业课数字电路”和“计算机学科”写成无上下文的模糊分类题。

### 3.2 Tutor：本地 evidence authority，模型只做有界选择

V4 让模型同时选择 intent 并复述 evidence code，造成了冗余的自证合同：本地 projection 已经知道
`submitted_step`，模型却可能因为漏写同名 code 被拒绝。V5 将 authority 分离：

1. 本地 detector/projection 产生深冻结 `eligibleIntents`、primary signals 与 intent precedence；
2. 模型只返回 `intent/depth/confidence`，不再自报本地已经知道的 evidence code；
3. dynamic validator 检查模型 intent 是否属于本地 `eligibleIntents`，且不得压过更具体 primary
   signal；
4. merger 仍只构建策略，不生成答案、不决定 route、不调用工具、不扩大权限；
5. fallback 继续使用 deterministic strategy，不能比 deterministic 更宽。

System prompt 使用中英双语的短规则表、正反例和 precedence，明确中文“卡住、先提示、这一步、
算偏、完整捋一遍、背后联系”等语义；不写入 case ID、expected 或 benchmark 答案。

本地 detector 不能因为升为 evidence authority 就免于评测。V5 必须冻结独立
`tutor-local-signal-authority-v1` schema/version/content SHA 与 provenance；projection 只消费该版本的
深冻结输出。Held-out oracle 要分别测误报、漏报、中英/混合语言、否定、干扰、context reorder 和
单变量 mutation；同一输入须比较 detector -> eligible intents -> validator -> merger 的差分结果。
无法验证 authority version/SHA、出现互斥 primary signal 或 detector/policy 映射缺口时，必须在
Provider 前 fail-closed，不能把错误 eligible intents 交给模型。

R2 已按该设计落地：rules/prompt/独立 held-out SHA 分别冻结为 `a1e9a3b...f4892`、
`7c7442ff...c5f87`、`d08e8ed5...8ab55`；32 条 held-out 与冻结 V2 Tutor runtime `24/24`
detector 对照通过。模型 output 仅 `intent/depth/confidence`，没有接 product/provider/gate。

### 3.3 Organizer：local candidate shortlist + ordinal-only output

V4 让模型自由生成 topic label，再用 exact accepted-label authority 评分，既容易产生合理同义词误差，
也让产品命名权与评测标签耦合。V5 改为：

1. 本地从 subject/category/knowledgePoints/errorType/question excerpt 生成有界 topic candidates；
2. existing deck 与 topic candidates 都只以 ordinal 暴露给模型；
3. 模型返回 `subjectDecision/deckAction/deckIndex|topicIndex/confidence`；
4. subject、deck、topic 最终值由本地 authority 解析，模型不能自由写名称；
5. candidate 不足或 taxonomy 冲突时 fail-closed，回本地 deterministic suggestion，不做 mutation；
6. `computer/major/other` 使用中英双语定义和边界例，structured subject 仍优先。

这让 semantic metric 评估“是否选择了正确的本地候选”，而不是惩罚一个意思正确但字符串不同的
自由文本，同时保持 Organizer 只读 suggestion 和用户最终写权限。

Shortlist 必须在 owner snapshot 上稳定排序、规范化去重并生成包含 owner domain、question/deck/topic
候选完整序列和版本的 fingerprint。Projection、模型 request、decision validation、Trace pending 与
最终 model-free command 必须绑定同一 fingerprint；模型返回的 ordinal 只能在该快照中解析。候选
重排、分页漂移、重复折叠变化、owner/snapshot 变化或 ordinal 指向变化一律视为 stale/ABA，Provider
后不重调模型，command 前 fail-closed。现有事务外双 fence 与 advisory-lock 第三 fence 继续覆盖该
shortlist fingerprint，不能只校验错题 ID。

R3 已按该设计落地：shortlist rules/prompt/24 条独立 held-out SHA 分别冻结为
`9747383...1299d3`、`915084a8...ac69ab`、`49336b12...ee097`。同 subject/规范化名称的 deck
按最低 ID 折叠，完整 folded ID、owner、snapshot、question/deck/topic 序列进入 fingerprint；模型只
返回 subject/deck/topic ordinal 与 confidence，merger 只从本地 authority 解析真实值和 command
binding。Pre/post source revalidation、reorder、分页、去重、ordinal ABA、cross-subject 与 locked-name
均以 no-network 测试 fail-closed。本任务没有接产品、Provider、gate、Trace persistence 或 runner。

## 4. 通信、权限与生产边界

- Tutor 仅在 Router final route 为 `tutor`、目标 gate 开启且 projection 安全时获得一次调用；
- Organizer 继续使用 owner-scoped `REPEATABLE READ + READ ONLY` snapshot、事务外 stale fence、
  advisory-lock fence 和 single/batch request-level single dispatch；
- 两个 Agent 使用独立 credential、budget、timeout、AbortController、ledger 与 Trace step；
- Tutor `1/1200/300`、Organizer `1/3500/800`，不借预算、无 retry；
- lane-specific failure attribution 必须保留：一条 lane 的 schema/provider/budget/abort 不得复制给
  sibling；post-dispatch abort 为 attempted/usage unknown，不能伪装 zero-call 或零费用；
- aggregate usage、pricing、P95 只有在固定分母所需样本完整且每条 usage 可验证时才可生成，否则
  保持 `null` 并关闭质量门；
- Agent 输出只进入受治理 merger；不能写数据库、改 route、调用 tool 或取得额外权限；
- Organizer mutation 仍由用户确认后的本地 command authority 执行；
- worker/admin 不获得 Tutor/Organizer model executor；
- gates、live calls 和 component credentials 默认关闭/空。

## 5. V5 identity 与历史隔离

R1 已冻结 dataset/policy/baseline 最终字节；后续继续使用以下 namespace，不得复用 V1–V4 artifact：

| 维度                    | V5 namespace                                  |
| ----------------------- | --------------------------------------------- |
| dataset                 | `phase-6.9-tutor-wrong-question-v2`           |
| runner                  | `phase-6.9.7-tutor-organizer-runner-v5`       |
| Tutor prompt            | `tutor-model-candidate-v5`                    |
| Organizer prompt        | `wrong-question-organizer-model-candidate-v5` |
| runtime evidence        | `phase-6.9.7-v5-runtime-evidence-v1`          |
| approval env            | `PHASE_6_9_7_V5_CONTROLLED_LIVE_APPROVED`     |
| marker/journal/evidence | 独立 `v5` 前缀                                |

V5 validator 必须拒绝 V1–V4；历史 validators 必须拒绝 V5。V5 strict schema 与递归 leakage scan
必须拒绝 V1–V4 runId、partial metrics/usage/cost、`sourceV1CaseId`、旧 dataset/prompt SHA、旧 marker/
journal/evidence path 或任何历史结果嵌入。任何 V5 报告都不得把 V4 run、usage、semantic score 或
partial cost 拼入新结论。

## 6. 质量门与停止条件

V5 使用 R1 冻结的新 dataset authority，固定 72 cases、24 guard、48 runtime、24 paired requests 与 32 个 Organizer decision units。Dataset/policy/baseline SHA 分别为 `42803d45...b437b`、`b3913403...f009d`、`0ce7c3ca...116ca`。Tutor、Organizer、combined semantic 均须 `>=0.85`，两个 lane 的 absolute improvement 均须 `>=0.15`；strict runtime `48/48`，critical/provider/permission/mutation/broader-fallback 均为 0。延迟、usage、费用与 fixed-denominator incomplete-null 规则已同步冻结。不得在看到 Mock/Live 结果后降低门槛。

Live 前至少证明：

- dataset coherence validator、双语覆盖和新 SHA；
- Tutor local-signal/model-choice differential、中文 held-out 与 metamorphic；
- Organizer shortlist ordinal、taxonomy/subject drift、batch reorder 与 locked-name；
- 24/24 guard 实际 zero-call、48/48 Mock strict runtime；
- fixed denominator、single dispatch、sibling abort、usage unknown、journal crash seal；
- V1–V4 artifacts、validators、SHA 不变；
- tracked Compose 与根 `.env.example` 默认关闭；
- focused/full/static、数据库并发 E2E 与两路独立复审通过。

R5 static/Mock checkpoint 已完成并停止。只有用户重新接受当时 Provider 数据边界并明确授权唯一
一次 V5 branch controlled-Live，才能创建 V5 marker 并调用 Provider。只有 V5 Live 全门通过，才允许
进入产品 Docker/API/可见浏览器验收、分支收尾、main 合并与 main 回放。

R4 必须先冻结以下验收终态，而不是到 Live 时临时解释：

| 场景                                  | 必须终态                                                       |
| ------------------------------------- | -------------------------------------------------------------- |
| non-tutor route / local guard         | `not_eligible`，runtime/dispatch 都为 0                        |
| pre-dispatch abort                    | `fallback_aborted`，zero-call、usage=0                         |
| post-dispatch abort                   | `attempted_aborted`，usage unknown，收口 sibling 后停止新 pair |
| dispatch journal 已落但 terminal 丢失 | `attempted_orphaned`，crash-only seal，不 replay/resume        |
| 重复 request/dispatch key             | 单胜者 claim；第二次拒绝，不调用 Provider                      |
| shortlist/snapshot 漂移               | stale fail-closed；不应用 ordinal、不重调 Provider             |
| sibling lane failure                  | 各自 failure category/usage；不能复制触发 lane 的结果          |

Live reservation 还必须覆盖每个持久化失败点：marker 创建前失败不创建 executor；marker 已成功后，
journal 初始化、append、terminal 或 evidence 发布任一失败都消费该 V5 名额，并只允许单胜者
crash-only seal。活 owner 不得被误封，dead owner recovery 受 token/ABA fence；任何恢复都不得再调用
Provider。

R4 已按上述设计完成：原生 V5 report/runner/CLI/marker/hash-chain journal/hard-link evidence/validator
固定 `72/24/48/24/32` 分母、guard-first、single-pair dispatch、双 lane 隔离、首错 breaker 与
incomplete-null 聚合。Marker/journal/evidence 失败、duplicate dispatch、orphan、live/dead owner、ABA、
tail drift、same/different bytes 与历史 lineage 双向拒绝均有 zero-provider 回归。`synthetic_test` Live
固定 `quality_gate_failed`，只有 `deepseek_network` provenance 才可能通过。R4 没有接 product
composition/gate/Trace persistence、Provider、Docker/API/browser 或业务数据。

R5 已按上述设计完成：reviewed public Mock factory 经过 Tutor/Organizer V5 candidate、validator 与
local merger；fresh Mock 为 `24/24` zero-call、`48/48` strict runtime、semantic `1/1/1`。受影响
静态门、Organizer PostgreSQL `12/12`、Compose default-off、V1--V4 SHA/validator、V5 Live
artifact=0 与两路终审通过。48 次 synthetic invocation 不是真实 Provider call；R5 没有读取
credential、调用 Provider、接产品或启动 Docker/API/browser。

R6 已按独立 V5 identity 执行并失败封存。唯一 run `aa637d3a-f7c4-4549-a724-9cdbefdd89c8`
使用 `deepseek_network`，24 个 guard 全部 zero-call；前 6 对启动 12 次 Provider 调用并得到
11 个 strict runtime。第 6 对 Tutor 在 `3021ms` 越过冻结的 `3000ms` timeout 后打开 breaker，同对
Organizer strict success，后续 36 runtime 未启动。Report 因分母不完整把 semantic、P95、aggregate
token 与总费用全部保持 `null`，最终 `quality_gate_failed`。Marker、58 条 hash-chain journal 与
evidence 已 durable seal，validator 通过且无 recovery claim；R6 禁止 retry/resume/replay。

该结果验证了 guard-first、dispatch-before-call、lane terminal、fixed denominator、breaker 与
incomplete-null 设计确实在真实 Provider 路径生效，但没有形成质量 authority，也没有证明产品
composition/API/browser 可用。R7 及其后的 main/Phase 6.10 必须保持阻断。

V6 R0 只读取证并冻结 hard-timeout/P95 分离、Tutor preferred-depth local authority、Organizer
confidence local authority、model-owned axes 与独立 lineage。V6 设计见
`docs/superpowers/specs/phase-6-9-7-tutor-organizer-v6-remediation-design.md`；该交接不重开 V5 R7，
也不构成新的 Provider 授权。

## 7. 非目标

- 不重跑或改写 V1–V4；
- 不把 V1 dataset 原地“修正确认”；
- 不降低 threshold、删失败 case、改固定分母或把 Mock 当 Live；
- 不保存 raw prompt/model output、credential、真实用户原文或自由文本错误；
- 不让本地 merger 静默修正越权 subject、非法 ordinal 或不支持 intent；
- 不自动执行 Organizer suggestion；
- 不在新的独立 Live quality authority 通过前启动产品验收、合并 main、进入 Phase 6.10 或写博客收尾。
