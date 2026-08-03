# Phase 6.9.7 Tutor / WrongQuestionOrganizer V4 R6 Controlled-Live 失败封存

日期：2026-07-26

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

R5 checkpoint：`2a3ec9e0`

## 1. 结论

用户重新接受当时 DeepSeek 账号的数据保留/训练边界，并明确授权唯一一次 V4 branch
controlled-Live。唯一 run `0fb47591-5ff4-4e46-bcf3-2cd267d1fb2f` 已使用
`deepseek-v4-pro` non-thinking JSON 与 `deepseek_network` provenance 完成并 durable seal，最终为
`quality_gate_failed`。

24 个 guard 全部通过且真实 zero-call。Runner 顺序执行前 6 个 paired requests，共启动 12 个
executor；其中 10 个 strict runtime success。第 6 对的 Tutor 在结构化对象形成后被本地 V4 动态
合同以 `invalid_evidence_association` 拒绝，触发 `quality_gate_impossible` breaker；同对 Organizer
收到 sibling abort，usage 保持 unknown。其余 36 个 runtime 固定保留在 48 分母内并记录为
`not_started_quality_breaker`，没有补跑、重试、resume、replay 或第二次 Provider 调用。

V4 R6 已失败封存且不得重跑。R7 产品 Docker/API/可见浏览器、R8 分支收尾、R9 main、Task 13、
Phase 6.10 与博客收尾均不得开始。Phase 6.9.7 和两个 Agent 的生产验收仍未完成，产品 gates 保持
默认关闭。

## 2. Live 前零网络门

R6 在创建 marker 或网络 executor 前完成以下检查：

| 门 | 结果 |
| --- | --- |
| 6 份 V4 semantics/diagnostics/robustness/lineage/durability | `45/45`，`458 expect()` |
| Agent typecheck / lint | exit `0` / exit `0` |
| Fresh V4 Mock | `24/24` zero-call、`48/48` runtime；专用 validator 通过后按 run ID 精确删除 |
| V1 / V2 / V3 file validator | 三版均 `ok=true, filesChecked=1` |
| V1 / V2 / V3 历史 SHA | 七个 SHA 与 R5 全部一致 |
| V4 Live artifact / recovery claim | `0` |
| tracked Compose defaults | `mock / live=false / Tutor=false / Organizer=false / component key empty` |

Focused 测试在 Live 前发现并修复了一个仅测试夹具问题：复制自 V3 的 synthetic executor 对 V4
`general_follow_up` 使用了旧 evidence 名称，并未为一个高置信 Organizer case 返回 V4 允许的完整
证据集合。修复只让 synthetic fixture 遵守已经冻结的 V4 policy；没有修改 dataset、expected、
baseline、prompt、validator、merger、质量门、模型、价格、预算或真实 Live 结果。

根 `.env` 的通用 DeepSeek credential 只在授权进程内读取，映射为 Tutor/Organizer 两个 component
credential 后从子进程环境移除通用 key。Live 子进程显式使用：

- `AI_PROVIDER_MODE=live`、`AI_ENABLE_LIVE_CALLS=true`；
- Tutor/Organizer 两个目标 gate 为 `true`，其余六个 Agent gate 为 `false`；
- `https://api.deepseek.com/v1`、`deepseek-v4-pro`、non-thinking JSON；
- Tutor `3000ms / 1-1200-300`；Organizer `5000ms / 1-3500-800`；
- 无 tools、无 retry，component key 未写盘、未打印、未进入 evidence。

## 3. 唯一 Live 结果

### 3.1 执行与安全

| 指标 | 结果 |
| --- | --- |
| run / scope / disposition | `0fb47591-5ff4-4e46-bcf3-2cd267d1fb2f` / `branch` / `completed_run` |
| guard | `24/24` verified zero-call |
| paired scheduler | `6 dispatched / 6 completed`，双 lane 最大并发 `2` |
| executor | `12` started，`11` usage verified，`1` usage unknown |
| strict runtime | `10/48` |
| breaker | `quality_gate_impossible`，trigger `tutor-runtime-06` / pair `5` |
| 后续未执行 | `36` runtime，全部 `not_started_quality_breaker` |
| safety | critical / permission / mutation / broader fallback 均 `0` |
| Provider failure category | 全部 `0` |

`tutor-runtime-06` 的模型 JSON 通过 Provider raw schema，但 evidence 与 `step_check` 的 V4
primary/allowed association 不一致，因此后续 canonical projection 被本地 dynamic contract 拒绝并返回
`fallback_schema_invalid`；报告中的 `canonicalSchemaSuccess=false` 描述的是这一后置结果，不否定 raw
schema 已通过。Evidence 只保留固定 stage/reason，不保存 raw model output、prompt 或 Provider 原始错误，
所以不得进一步猜测模型原始字段。

Organizer 同一 pair 已经 dispatch 并开始调用，但在 Tutor 打开 breaker 后收到 sibling abort；它被记录
为 `attempted_aborted / unknown_after_attempt`，不冒充 zero-call、成功或零成本。

### 3.2 语义与费用

由于只完成 6 对，未执行项继续进入固定语义分母，最终指标为：

- Tutor semantic `0.14410714285714285`，相对 baseline `-0.29775952380952386`；
- Organizer semantic `0.10372596153846154`，相对 baseline `-0.17439903846153848`；
- combined semantic `0.1239165521978022`；
- diagnostics：`60` not-started、`2` contract failures、`6` semantic mismatches、`4` semantic matches；
- 11 个 verified usage 合计 input `9445`、output `652`、可核验费用 `0.032247 CNY`；
- 因 Organizer aborted case 的 usage unknown，完整 pricing profile / total CNY 必须保持 `null`，不能把
  部分费用写成整轮费用；
- P95 样本只有 6 对，`latencySampleComplete=false`，四个 P95 均保持 `null`。

前 5 对虽有 10 个 strict runtime success，但仍出现 Tutor intent/guiding/answer-structure 与 Organizer
subject/topic 的 semantic mismatch；它们不能与 Mock 满分或历史 run 拼接成新的通过结论。

## 4. Durable evidence

| artifact | SHA-256 |
| --- | --- |
| V4 evidence | `6ec60be1fced72766253e237b892fabb8e1d4ceca555249593d693f5e2d94608` |
| V4 journal | `8cc65e21a17d870fbad1c582677526a78f2859de933f7e43cfbea6481103188e` |
| V4 marker | `601f62b6d328a805cfa8d7e3e681d2523551f4eaaba67d182323f9d1546cdae2` |

Evidence 路径：
`.tmp/phase-6-9-7-tutor-organizer-v4-branch-live-0fb47591-5ff4-4e46-bcf3-2cd267d1fb2f.json`。

Journal 共 58 条 hash-chain records：

- `journal_initialized=1`、`guard_terminal=24`；
- `dispatch_started=12`、`runtime_terminal=12`、`pair_terminal=6`；
- `breaker_opened=1`、`run_completed=1`、`evidence_sealed=1`。

File validator 与 marker+journal+evidence bundle validator 均为 `ok=true`。最后一条 journal record 是
`evidence_sealed(completed_run)`，绑定 evidence SHA 与 seal 前 journal tail。V1/V2/V3 七个历史 SHA 和
三版 validator 在 R6 后再次保持不变。

## 5. 没有执行的产品步骤

本轮没有启动、重建或停止产品 Docker service，没有调用认证产品 API、打开浏览器、创建 synthetic
用户/错题/deck/Trace/session，也没有修改 PostgreSQL、Redis 或 MinIO 业务数据。特别没有执行
`docker compose down -v`、Docker prune、volume/container/image 删除、database reset、Redis flush
或 MinIO wipe。

R6 的进程级 Live/gate/component credential 随进程退出，不改变 tracked default-off 配置。失败结果
不允许临时启用 Tutor/Organizer 产品 gate，也不允许以本地 fallback 可用为理由进入 R7。

## 6. 后续边界

V4 R6 的一次性名额已经消费。后续若继续改善 Tutor/Organizer，只能先建立新的零 Provider、独立
identity 的 remediation 设计，解释：

1. 为什么 `step_check` 的模型 evidence 与本地 V4 association 仍不一致；
2. 为什么前 5 对仍有 Tutor intent/guiding/structure 与 Organizer topic/subject 语义偏差；
3. 如何在不修改冻结 dataset/expected/threshold、不读取 raw user data、不重用 V4 marker/evidence 的
   前提下增加 held-out 证据。

新的设计、runner、授权、marker、journal、evidence 与 validator 必须与 V1--V4 双向隔离；在新的
static/Mock checkpoint 和用户新的精确授权前不得调用 Provider。当前不得开始产品验收、main 合并、
Phase 6.10 或两篇面试学习博客收尾。

回顾时可以问：

- “V4 为什么在第 6 对触发 breaker，而不是继续把 48 个 runtime 全部调用完？”
- “为什么有 `0.032247 CNY` 可核验费用，整轮 total CNY 仍必须是 null？”
- “V4 的 10 个 strict success 为什么不能与 Mock 或 V3 拼接成通过？”
- “V4 failure seal 怎样证明 dispatch-before-call、固定分母与未重试？”
