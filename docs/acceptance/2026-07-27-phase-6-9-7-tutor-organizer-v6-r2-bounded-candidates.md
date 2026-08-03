# Phase 6.9.7 Tutor / WrongQuestionOrganizer V6 R2 Bounded Candidates 验收

日期：2026-07-27

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

基线提交：`30558cf4`

## 1. 结论

V6 R2 已完成，且全程 zero-provider。本任务把 R1 的 preferred-depth / confidence source contracts
接成两个独立 package candidate：Tutor 模型只选择本地 eligible intent ordinal；Organizer 模型只选择
实际 owner shortlist 中的 subject/deck/topic ordinal。模型仍承担需要语义判断的轴，但不拥有最终教学
策略、confidence、真实 ID、用户锁定名称、写命令或数据库权限。

R2 只证明 projection、strict validator、本地 merger、预算/取消/失败回退、实际 shortlist 双 stale
fence 与 anti-overfit 工程合同。它没有 V6 runner、CLI、approval、marker、journal、evidence、validator、
Mock checkpoint 或 Live，也没有接入 Web/Nest 产品 composition、gate 或 Trace persistence。因此不能把
本记录解释为真实模型质量、Docker/API/浏览器可用性或 Phase 6.9.7 完成证据。

## 2. 模型与本地 authority 边界

| Agent                     | 模型拥有                                          | 本地权威                                                                |
| ------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------- |
| Tutor V6                  | eligible `intentIndex`                            | preferred depth、context use、guiding/final-answer、structure、最终策略 |
| WrongQuestionOrganizer V6 | shortlist fingerprint、subject/deck/topic ordinal | owner/snapshot、真实 ID、locked name、confidence、说明、command/write   |

设计目的不是把 Agent 退化为纯规则，而是把“需要语义判断的有限选择”交给模型，把事实、权限、写入和可验证
不变量留给本地代码。这样模型仍有大脑，但不能通过自由文本或伪造 ID 越过产品权限边界。

## 3. Tutor intent-only candidate

新增公开入口 `@repo/agent/tutor-v6`，核心顺序固定为：

```text
route/safety/explicit-instruction/abort/budget guard
  -> safe projection
  -> local signal authority derives eligible intents
  -> local preferred-depth authority binds one strategy per ordinal
  -> model returns exactly { intentIndex }
  -> strict association validation
  -> local merger rebuilds the complete TutorStrategy
  -> applied or deterministic fallback
```

关键合同：

- projection 只包含安全文本、active-context availability、authority SHA 与 eligible ordinal；
- schema 不接受 intent 名称、depth、confidence、evidence、答案、route、tool、ID 或额外字段；
- 模型选中 intent 后，本地 authority 决定唯一 preferred depth、是否使用 active context、是否追问、
  是否允许最终答案以及 answer structure；
- `answer_direct` 不进入模型 eligible intent，模型不能通过输出字段重新获得最终答案权限；
- 非 Tutor route、不安全输入、五类明确教学指令、pre-abort 和预算不足均在 runtime 前零调用；
- eligible 路径最多一次调用、无 retry；schema、runtime、usage、authority drift 或 post-call abort 都回到
  原确定性 TutorStrategy。

冻结 V2 Tutor runtime 的 24 个 intent 均通过实际 candidate 路径，模型返回只使用 expected-driven
no-network responder；这证明候选合同可应用，不证明真实模型会做出同样选择。

## 4. Organizer actual-shortlist ordinal candidate

新增公开入口 `@repo/agent/wrong-question-organizer-v6`。R2 不复制一份假的 ordinal map，而是复用 V5
已经冻结的 owner snapshot shortlist authority：

```text
source snapshot
  -> derive actual owner shortlist A
  -> guard + pre-runtime re-derive shortlist B
  -> require A/B owner + snapshot + shortlist fingerprints equal
  -> project only fingerprint and ordinals
  -> one bounded runtime call
  -> post-runtime re-derive shortlist C
  -> require A/C fingerprints equal
  -> validate subject/deck/topic associations
  -> rebuild local confidence, IDs, names, description and command binding
```

三个 fingerprint 层次各有不同职责：

- owner domain 防止跨账号 shortlist；
- snapshot version/fingerprint 绑定题目、deck、topic、locked name 与版本事实；
- shortlist fingerprint 绑定稳定排序后的 question/deck/topic ordinal 映射。

任一层在调用前或调用后变化，都以 `stale_shortlist` 整批回退，不重试、不补跑，也不使用旧 ordinal
结果。相同内容经过 ABA 改动再恢复时，因为 snapshot version/fingerprint 已改变，旧 decision 仍不能
重新生效。

模型 strict output 不包含 confidence、subject/deck/topic 名称、真实 question/deck ID、evidence prose、
reason、description 或 write command。本地 merger：

- 从 actual shortlist 把 ordinal 解析为同一 owner 快照中的真实实体；
- 保留已有 deck 的 locked name，拒绝 create-topic 与 locked deck 名称碰撞；
- 按 structured subject、knowledge point、category/error type 与 same-subject overlap 重建
  `medium | high` confidence；
- 跨语言阅读 overlap 只使用有界本地等价组，不能把任意 `reuse_existing` 直接提升为 high；
- 重建 reason/description、signals 与 command binding，但不执行写入。

公共 `mergeWrongQuestionOrganizerV6ModelDecision()` 不信任调用方传入的 validated-shaped object。它先
还原 raw ordinal decision，再重新执行完整 validator，防止空 decision、重复 ordinal、伪造
`resolvedSubject` 或非法 association 绕过 candidate 主路径。

## 5. 安全、鲁棒性与 anti-overfit

独立 fixture 不进入 V2 dataset、Live 分母或费用聚合，覆盖：

- Tutor 五类 intent，中英双语、mixed、否定、引用式干扰、active context 有无与单变量 mutation；
- unknown/quoted-only signal 的 runtime 前 zero-call；
- Organizer 六学科、same-subject/cross-language overlap、question/deck reorder、locked name；
- owner drift、snapshot stale、ABA、duplicate/out-of-range ordinal 与 cross-subject association；
- hostile 顶层 getter/proxy、hostile runtime accessor 与 post-call abort；
- actual prompt 递归扫描 V1--V5 identity、frozen case ID、expected/oracle、source ID 和完整 label authority；
- deliberate contamination 反例，证明 scanner 不是永远返回“安全”。

R2 还修复两类容易被测试掩盖的边界：locked-name collision 用例不再由条件分支跳过；V2 fixture adapter
按 actual shortlist 的 subject/topic label 解析 ordinal，不伪造旧 provenance。

## 6. 冻结 identity

| Contract                    | SHA-256                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| Tutor V6 prompt             | `4f73ae60e708ed9ba08bc5533cc489626543ca09e0396777ef4d725c9656a169` |
| Organizer V6 prompt         | `c5f1f662ba380283aa08ffe2dc194874c9420b1c6b34ffc86107e476101f3450` |
| V6 independent robustness   | `314543fe1694c0caa2b8fc48fa79a1bfcd751eb0431664ffafb9ceee3103904b` |
| V2 dataset                  | `42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b` |
| deterministic baseline      | `0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca` |
| Tutor preferred-depth rules | `b57a828e14294f712a6547be2ac168b1d58b79cdc5b9aecbb071304f4e5ae7af` |
| Organizer confidence rules  | `a46eda402e8c39cdc965277375e8a2aeea27e41c98cda7fd4ba513a9cb520475` |

V2 dataset/expected/baseline bytes 与 V1--V5 artifact 均未修改。R2 没有生成 V6 report、marker、journal 或
evidence，因此也没有可以被误认为 Live authority 的新文件。

## 7. 验证证据

执行并通过：

```text
bun test packages/agent/tests/tutor-v6-model-candidate.test.ts \
  packages/agent/tests/wrong-question-organizer-v6-model-candidate.test.ts \
  packages/agent/tests/phase-6-9-tutor-wrong-question-v6-independent-robustness.test.ts
=> 24 pass / 0 fail / 989 expect()

cd packages/agent
bun run test
=> 792 pass / 0 fail / 10458 expect() / 88 files

bun run typecheck
=> exit 0

bun run lint
=> exit 0
```

两路只读代码/测试复审无 P0/P1/P2 阻断。复审保留一个明确的验收边界：R2 responder 依据 frozen
expected 生成 no-network 输出，所以只能验证 projection/validator/merger 和守卫，不能证明真实模型语义
质量；该风险必须由后续独立 runner、fresh Mock 和唯一 controlled-Live 分阶段关闭。

## 8. 当前停止点

- 没有 V6 product composition、gate、Trace persistence 或 executor factory；
- 没有 V6 runner、CLI、approval、marker、journal、evidence、validator、Mock checkpoint 或 Live；
- 没有读取根 `.env`、component credential 或 Provider retention 配置；
- Provider invocation 为 0，没有创建 Live artifact；
- 没有启动 Docker service、API 或浏览器，没有账号、Trace、PostgreSQL、Redis、MinIO 或业务数据操作；
- 没有合并 main，也没有开始 Task 13、Phase 6.9.8、Phase 6.10、Phase 8/9 或博客收尾。

下一原子任务仅 V6 R3：建立独立 runner/CLI/approval、marker/hash-chain journal/hard-link evidence/
validator、fixed denominator、breaker、crash-only seal 与 V1--V5/V6 双向 lineage 隔离。R3 仍必须
zero-provider，不创建实际 Live marker；R4 static/Mock checkpoint 与新的精确授权前不得读取 credential
或调用 Provider。

## 9. 回顾时可以问

- 为什么模型只拥有 intent/ordinal，仍然算真正的 Agent，而不是纯 deterministic rule？
- Tutor 的 preferred depth 为什么必须由本地教学 authority 重建？
- Organizer 的 owner snapshot、snapshot fingerprint 与 shortlist fingerprint 分别防什么？
- 为什么 Provider 调用前后都要重新派生 shortlist，单次 preflight 不够？
- 为什么 confidence 不能由模型自报，跨语言 overlap 又不能简单等同 high？
- 为什么 public merger 必须重新验证 validated-shaped 输入？
- 为什么 focused/full tests 全绿仍不能声称真实模型或产品可用？
