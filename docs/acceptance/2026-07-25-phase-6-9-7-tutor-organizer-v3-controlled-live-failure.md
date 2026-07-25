# Phase 6.9.7 Tutor / WrongQuestionOrganizer V3 Controlled-Live 失败封存

日期：2026-07-25

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

执行起点：`8167f9e3`

状态：唯一 V3 branch controlled-Live 已完成 durable seal，并以 `quality_gate_failed` 封存。V3
一次性授权与 marker 已消费；不得删除 marker、覆盖 evidence、重放 journal、执行 `seal` 改写完整
run，或再次运行 V3 Live。R6--R9、产品 Docker/API/headed-browser、Task 13/main 与 Phase 6.10
均不得开始，Phase 6.9.7 仍未完成。

## 1. 授权与冻结身份

用户授权原文：

> 我已接受 DeepSeek 当前账号的数据保留/训练边界，并明确授权执行一次 Phase 6.9.7 Tutor/Organizer V3 branch controlled-Live。

本次仅允许一个 branch scope 的 72-case V3 run。固定身份如下：

- runner：`phase-6.9.7-tutor-organizer-runner-v3`；
- dataset：`phase-6.9-tutor-wrong-question-v1`；
- dataset SHA-256：`7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e`；
- Tutor prompt：`tutor-model-candidate-v3`，content SHA-256
  `91be509194de33c8d99d7a09fa6ef387c6f31aa06d19d8fd970800731047fc6a`；
- Organizer prompt：`wrong-question-organizer-model-candidate-v3`，content SHA-256
  `2947cea2a7bc5d64c9daf29d8b371e9825bc0423d707ff173a2c5057ee9fdffd`；
- schema：`tutor-model-decision-v1` / `wrong-question-organizer-model-decision-v1`；
- projection：`tutor-model-projection-v1` / `wrong-question-organizer-model-projection-v1`；
- model：`deepseek-v4-pro` non-thinking JSON；
- executor provenance：`deepseek_network`。

## 2. Zero-network preflight

Live 前完成并通过：

- 当前分支和 HEAD 正确，Git 工作区干净；
- R4 focused `50/50`、`360 expect()`；
- V1/V2 evidence 与 marker 四个 SHA-256 未变化，两版 validator 均
  `ok=true/filesChecked=1`；
- V3 marker、journal、evidence、recovery claim 均不存在；
- tracked Tutor/Organizer gate 为 `false`，component credential example 为空；
- 根 `.env` 被 Git ignore，只验证通用 DeepSeek credential 可用，不输出值；同一底层 secret 仅在
  Live 子进程中映射为两个 component-specific credential，根 `.env` 未修改；
- approval env 使用 `PHASE_6_9_7_V3_CONTROLLED_LIVE_APPROVED=true`，branch scope 由 CLI 默认值
  选择，没有传入无效的 `branch` 第三参数；
- 其它 Router、Verifier、Review、Planner、Knowledge Agent gate 在 Live 子进程中显式为
  `false`；
- 没有启动、停止、重建或清理 Docker service、容器、镜像、卷或数据库。

## 3. Durable authority

- run ID：`ff2e1a54-0cbd-494c-96b7-a0f366c6c3dc`；
- marker：`.tmp/phase-6-9-7-tutor-organizer-v3-controlled-live.marker`；
- marker SHA-256：`b18a7688494c250cd3f7dc0376f49d5712377240bdc1bd86e9d8dd9a3d8be412`；
- journal：
  `.tmp/phase-6-9-7-tutor-organizer-v3-controlled-live-ff2e1a54-0cbd-494c-96b7-a0f366c6c3dc.journal.jsonl`；
- journal file SHA-256：`df141874f9bdb0caffac16bf7d930a64d97dd5521e0c06e5db0ec3dd406d6cff`；
- journal：98 records；末三条为 sequence `95 breaker_opened`、`96 run_completed`、
  `97 evidence_sealed`；
- evidence：
  `.tmp/phase-6-9-7-tutor-organizer-v3-branch-live-ff2e1a54-0cbd-494c-96b7-a0f366c6c3dc.json`；
- evidence SHA-256：`e24f4e6dd6fc0d0621eee672210b86fe8fbf5dce4664b1184726319b8e22d25c`；
- report SHA-256：`aa0442726fc0cd3c6d45f79d34707c63380aa02d264ab91569cb4a26e9f7f160`；
- evidence snapshot：journal sequence `96`，tail SHA-256
  `d181170237fd759efcac99e0fe891ec26e4fc960ba2bf7d6344ed607ef5c1c1e`；
- V3 file validator：`ok=true/filesChecked=1`；marker/journal/evidence bundle validator：
  `ok=true`；
- recovery claim：`0`。

Marker 的 `attempt_reserved` 和完整 journal/evidence 只证明一次性执行与封存成功，不证明质量通过。

## 4. 唯一 V3 Live 结果

| 固定门                                              | 要求                  | 实际                                         | 结论     |
| --------------------------------------------------- | --------------------- | -------------------------------------------- | -------- |
| cases                                               | `72`                  | `72`                                         | 通过     |
| verified zero-call                                  | `24/24`               | `24/24`                                      | 通过     |
| strict runtime                                      | `48/48`               | `27/48`                                      | 失败     |
| Tutor semantic                                      | `>= 0.85`             | `0.5280555556`                               | 失败     |
| Tutor 相对 baseline 提升                            | `>= 0.15`             | `0.0861888889`                               | 失败     |
| Organizer semantic                                  | `>= 0.85`             | `0.4376201923`                               | 失败     |
| Organizer 相对 baseline 提升                        | `>= 0.15`             | `0.1594951923`                               | 通过     |
| critical / permission / mutation / broader fallback | 全部 `0`              | 全部 `0`                                     | 通过     |
| breaker                                             | 必须 `closed`         | `quality_gate_impossible`                    | 失败     |
| ledger reserved / terminal                          | `48 / 48`             | `28 / 28`                                    | 失败     |
| complete latency samples / P95                      | 必须完整且过门        | `false` / 全部 `null`                        | 失败关闭 |
| executor started / verified usage                   | `48 / 48`             | `28 / 28`                                    | 失败     |
| unknown usage                                       | `0`                   | `0`                                          | 通过     |
| runtime not started                                 | `0`                   | `20`                                         | 失败     |
| verified tokens                                     | `> 0` 且全 48 完整    | input `21771` / output `1781`，仅 28 runtime | 不完整   |
| known pricing / CNY                                 | 必须可验证            | `false` / `null`                             | 失败关闭 |
| 最终 gate                                           | `quality_gate_passed` | `quality_gate_failed`                        | 失败     |

执行到 paired run index `13` 时，两条 lane 均已完成第 14 次真实调用。Organizer 的
`organizer-runtime-14` 返回了结构化对象并有可验证 usage，但在本地 `dynamic_contract` 阶段命中
`subject_authority_violation`，candidate disposition 为 `fallback_schema_invalid`。该 case 是
`executed_failure`，不是 Provider transport/auth/rate-limit/HTTP/JSON parse 失败，也没有权限、业务
mutation、critical failure 或更宽 fallback。

冻结 breaker 随即进入 `quality_gate_impossible`：

- Tutor/Organizer 各启动 `14/24`、usage verified `14/14`、unknown `0`；
- 两条 lane 各保留 `10` 个 runtime 为 `not_started_quality_breaker`；
- 总计 `28` 个 runtime 已启动，`27` 个 strict success、`1` 个 strict failure，剩余 `20` 个不启动；
- 固定 runtime 分母保持 `48`，没有删除、重排或补跑未执行 case；
- latency 只有每类 14 个样本，按合同不计算 authority P95；
- token usage 全部可验证，但因只覆盖 28/48，pricing profile 与总 CNY 按合同保持 `null`，不能用
  部分样本伪造总费用通过。供应商账单仍是外部计费 authority。

即使忽略不完整执行，Tutor 与 Organizer semantic 也都低于 `0.85`，Tutor 相对 baseline 提升也
低于 `0.15`。因此这不是“只差一个 schema case”的通过结果。

## 5. 可以确认与不能推断

可以确认：

1. 唯一 V3 run 使用真实 DeepSeek executor，24 个 guard 均在 Provider 前验证 zero-call；
2. 28 个 runtime 均有一次真实 invocation 与 verified usage，没有 unknown usage；
3. 失败 trigger 是 Organizer 的本地 subject authority 动态合同，不是已记录的 Provider failure；
4. 首错熔断、固定分母、双 lane 隔离、dispatch-before-call journal 与 durable seal 均按设计工作；
5. schema、权限、mutation、fallback 和敏感 evidence 边界成立；
6. 质量门失败，不能证明 Tutor/Organizer 真实模型产品路径可用。

不能确认：

- 未启动的 20 个 runtime 如果执行会得到什么结果；
- 完整 48 runtime 的网络 P95、总 token 或总 CNY；
- 供应商最终账单、数据保留或日志状态；
- 通过调整 prompt/policy 后的新质量；任何新结论都需要新的版本、设计与独立授权，不能重用 V3。

Evidence 不保存 API key、完整 prompt、模型原文、原始 Provider body/header 或 raw error。独立只读
复审未发现敏感字段，也没有发现 Critical/Important。

## 6. 停止与回滚

- 不重跑 V3，不删除、覆盖、拼接或重建 V1/V2/V3 marker、journal、evidence；
- 完整 run 已有 `evidence_sealed`，不得再用 orphan `seal` 改写；
- 不启动 R6 产品 Docker/API/headed-browser，不创建 synthetic 产品账号、错题、deck 或 Trace；
- R7--R9、Task 13、main 合并、main 回放与远程推送均不得开始；
- tracked defaults 保持 mock/live=false、Tutor/Organizer gate=false、component key 为空；
- Live 进程级变量随子进程退出，未写入 Git 或根 `.env`；
- Docker service、容器、镜像、卷、PostgreSQL、Redis 与 MinIO 均未停止、重建或清理；
- Phase 6.9.7 仍未完成，全部 Agent 尚未完成，Phase 6.10 分层记忆不得开始。

下一步只能先做零 Provider 的 V3 失败复盘，并由用户决定是否另立全新版本的工程任务。任何新
Provider 调用都需要新的 identity、marker/journal/evidence、质量计划和精确授权；本次授权已经消费。

回顾时可以问：

- 为什么一次 `subject_authority_violation` 必须立即熔断，而不能补跑剩余 case？
- 为什么 28 个 usage 都可验证，pricing 与总 CNY 仍必须是 `null`？
- 为什么 `27/48` strict runtime 与低 semantic 不能进入产品 Docker/API/浏览器验收？
- V3 journal 怎样证明 dispatch、breaker、run completed 与 evidence sealed 的顺序？
- 如果继续，怎样设计全新版本而不改写 V1/V2/V3 历史？
