# Phase 6.9.7 Tutor / WrongQuestionOrganizer V7 R3 Static/Mock 验收记录

日期：2026-07-28

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

R3 起始提交：`c5457f6c7b071ef29003ab8109fea14aff1f04ff`

范围：真实 V6 candidate/schema/projection/prompt/merger 上的 V7 zero-network fault matrix、reviewed Mock、全量静态/PostgreSQL/Compose checkpoint；全程 zero-provider。

## 1. 结论

V7 R3 已完成。`TutorAgent` 与 `WrongQuestionOrganizerAgent` 的 48 条 runtime 不再使用 answer-only fixture，而是全部从冻结 V2 dataset 的 `subset === 'runtime'` 派生，依次穿过真实 V6 candidate、bounded projection、正式 system/user prompt、strict output schema 和本地 authority merger，再进入 R1 的第一方 DeepSeek V4 Pro direct adapter。

R3 只把 adapter 的 `fetch` delegate 替换为进程内 synthetic responder。Responder 从实际 bounded prompt 选择 ordinal，不读取 case `expected`、oracle、真实 ID 或写命令，也不访问网络。因此本轮能证明 request shape、wire stages、failure taxonomy、breaker、usage 和本地 merger 的工程合同，但不能证明 DeepSeek 真实输出质量、网络 P95、供应商 usage/费用或产品可用性。

Fresh reviewed Mock 为 `24/24` guard zero-call、`48/48` strict runtime，Tutor/Organizer/combined semantic 与 model-owned axes 全部为 `1`，四类 wire counter 均为 `48`。Gate 固定为 `mock_quality_not_evidence`，不会成为 controlled-Live authority。

Phase 6.9.7 仍未完成。下一步仅 R4 唯一 V7 branch controlled-Live 授权门；当前“继续”不构成该授权。

## 2. 两个 Agent 在本轮中的职责

- `TutorAgent`：在本地已经冻结的 eligible intents 中选择教学意图 ordinal；本地代码继续重建讲解深度、教学策略、prompt 权限和最终回答边界。
- `WrongQuestionOrganizerAgent`：在 owner snapshot 产生的 subject/deck/topic shortlist 中选择 ordinal；本地代码继续掌握真实 ID、subject authority、locked name、confidence、stale fence、Trace admission、model-free command 和最终写权限。
- 两个 Agent 都不拥有 userId、真实业务写权限、最终 Chat 回答、RAG authority、预算放宽或自动重试权限。

## 3. R3 实现

新增 reviewed V7 Mock factory：

- `packages/agent/src/evals/phase-6-9-tutor-wrong-question-v7-mock.ts`
- `@repo/agent/phase-6-9-7-v7-mock` package export

Mock factory 固定：

- exact `https://api.deepseek.com/v1/chat/completions`；
- `deepseek-v4-pro`、`thinking.disabled`、`response_format=json_object`、`stream=false`；
- Tutor `1200/300`、Organizer `3500/800` 预算边界；
- injected delegate provenance 永久为 `synthetic_test`，report provenance 为 `mock_synthetic`；
- 24 guard 复用正式 zero-call case；48 runtime 复用正式 V6 Tutor/Organizer runtime case；
- synthetic responder 只解析实际 prompt projection 并返回受限 ordinal。

默认 `v7:mock` CLI 已接 reviewed factory；Mock 不创建 Live marker。无 runtime factory 时的内部 fail-closed code 统一为 `runtime_factory_unavailable`。

## 4. Zero-network fault matrix

新增 `packages/agent/tests/phase-6-9-tutor-organizer-v7-fault-matrix.test.ts`，覆盖：

- 全部 48 runtime 的 frozen dataset、V6 dataset binding 与两份 prompt SHA；
- request URL/header/body/model/non-thinking/JSON/max-token 形态；
- fetch 同步 throw、Promise reject；
- auth、rate-limit、其它 client、server 与异常 HTTP status；
- 空 response、畸形 response JSON；
- reasoning content 与正 reasoning token；
- completion 缺失、completion JSON parse、Zod schema mismatch；
- usage missing/zero/negative/fraction/overflow；
- first/middle/last breaker 位置、固定 48 分母、no retry/backfill；
- sibling abort 的 lane-local 归因，不复制触发 lane 的 Provider category；
- report 对 synthetic key、raw error/body/reasoning/schema payload 的递归泄漏扫描。

每个预期 fault 都精确断言 `lastCompletedStage`、私有 failure category、`usageDisposition` 与 executor/dispatch/response/verified-usage 四类计数。除 contract 预留的最终兜底外，没有非预期 `unknown`。

## 5. Fresh baseline 与 reviewed Mock

Fresh deterministic baseline：

| 指标                |                                                               结果 |
| ------------------- | -----------------------------------------------------------------: |
| dataset SHA-256     | `42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b` |
| complete hits       |                                                            `12/48` |
| Tutor semantic      |                                               `0.6629642857142858` |
| Organizer semantic  |                                                         `0.278125` |
| Combined semantic   |                                               `0.4705446428571429` |
| Provider/token/cost |                                                                `0` |

Fresh reviewed V7 Mock：

| 指标                                            |                                   结果 |
| ----------------------------------------------- | -------------------------------------: |
| run ID                                          | `e09baa4a-6f48-41c3-bb48-607a72c300df` |
| validator                                       |             `ok=true / filesChecked=1` |
| guard zero-call                                 |                                `24/24` |
| strict runtime                                  |                                `48/48` |
| Tutor / Organizer / Combined semantic           |                            `1 / 1 / 1` |
| Tutor intent                                    |                                `24/24` |
| Organizer subject / deck / target ordinal       |                `32/32 / 32/32 / 32/32` |
| executor / dispatch / response / verified usage |                    `48 / 48 / 48 / 48` |
| synthetic input / output tokens                 |                         `22949 / 1882` |
| synthetic estimated cost                        |                         `0.080139 CNY` |
| gate                                            |            `mock_quality_not_evidence` |

Mock evidence 已按本次精确 path 删除，没有清空 `.tmp`。V7 Live marker、journal、evidence 与 recovery claim 均为 0。

## 6. 全量验收

| Gate                                         | 结果                                                            |
| -------------------------------------------- | --------------------------------------------------------------- |
| V7 R3 focused                                | `28/28`，`1028` assertions                                      |
| Post-doc five-file minimal regression        | `26/26`，`1015` expect calls                                    |
| `@repo/agent` full                           | `856/856`，`11881` assertions                                   |
| Agent typecheck / lint / Prettier            | 通过                                                            |
| `@repo/ai` full                              | `224/224`，`1452` assertions                                    |
| AI typecheck / lint                          | 通过                                                            |
| `@repo/types`                                | `42/42` + `tsc --noEmit` 通过                                   |
| `@repo/server` full                          | `227` suites passed / `3` skipped；`2154` passed / `30` skipped |
| Server no-fix ESLint / build                 | 通过                                                            |
| `@repo/web` full                             | `439/439`                                                       |
| Web ESLint / production build                | 通过；17 个页面生成                                             |
| Organizer PostgreSQL E2E                     | `12/12`                                                         |
| Docker runtime boundary focused              | `3/3`                                                           |
| Compose tracked default-off `config --quiet` | exit `0`                                                        |
| V1--V6 evidence validators                   | 全部 `ok=true / filesChecked=1`                                 |
| contract/security/wire 独立终审              | PASS，无 Critical/Important/Minor                               |
| docs/history/operations 独立终审             | PASS，无 Critical/Important/Minor                               |

`@repo/types` 当前没有独立可运行的 ESLint dependency/config；本轮沿用既有真实口径记录 `42/42 + tsc --noEmit`，没有为 R3 顺带虚构或新增 Types lint。

Organizer PostgreSQL E2E 只复用既有 `docker-postgres-1`，没有启动、重建或删除容器。测试后 synthetic users、wrong questions、orphan groups/decks/items/traces 均为 0。

## 7. 历史不可变性

V1--V6 validators 全部通过。V6 三份 physical SHA 与历史 authority 一致：

- evidence：`beb9d460dcbe10419af06aab130c04d0410debd2123732523fb4a09ff21ea5e9`；
- journal：`be91b0c41d9a538c4be651de52621329751852478261f230fed5e06e758c2a2f`；
- marker：`cbddba87ec6e491f4e5a5d55c886150eb557e510ff09bd60acfa2ede7c99f988`。

本轮没有删除、覆盖、恢复、重跑、回填或拼接 V1--V6 artifact。

## 8. 明确未发生

- 未读取、打印或修改根 `.env`、component credential 或 API key；
- 未调用 DeepSeek 或其它 Provider，未执行 `v7:live`；
- 未启动产品 Docker service、Nest API、Next Web 或可见浏览器；
- 未接入 Tutor Web / Organizer Server 的 V7 产品 composition；
- 未创建测试账号或修改 PostgreSQL、Redis、MinIO 业务数据；
- 未创建 V7 Live marker/journal/evidence/recovery claim；
- 未开始 R4、R5、R6、Task 13/main、Phase 6.9.8、Phase 6.10、Phase 8/9 或博客收尾；
- 未执行 Docker `down -v`、prune、volume/database reset、Redis flush 或 MinIO wipe。

## 9. 下一步与授权门

下一原子任务仅 V7 R4。开始前必须同时满足：

1. R3 单独提交并推送，功能分支 local/remote SHA 一致；
2. V7 Live marker/journal/evidence/recovery claim 仍为 0；
3. V1--V6 validators/SHA 继续通过；
4. 用户重新接受运行当时 DeepSeek 数据保留/训练边界；
5. 用户明确授权唯一一次 `Phase 6.9.7 Tutor/Organizer V7 branch controlled-Live`。

普通“继续”“开始”或此前 V1--V6 的授权都不能消费 V7 R4 名额。R4 无论通过或失败都只 seal 一次，不 retry、resume、replay 或 backfill；只有 R4 全门通过，R5 产品 Docker/API/可见浏览器才可能开始。

回顾时可以问：

- “为什么 V7 Mock 穿过真实 candidate 和 adapter，仍然不是 Live authority？”
- “为什么 synthetic responder 必须从实际 prompt 选 ordinal，而不能读取 expected？”
- “executor、dispatch、response、verified usage 四个计数分别证明什么？”
- “为什么首个 runtime contract failure 要停止后续 pair，但不能缩小 48 分母？”
- “为什么 sibling abort 不能复制另一 lane 的 failure category？”
- “为什么 Compose config 通过和 PostgreSQL E2E 都不能宣称产品 Docker 验收完成？”
- “R3 与 R4 的授权和证据边界分别是什么？”
