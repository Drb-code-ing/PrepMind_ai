# Phase 6.9.7 Tutor / WrongQuestionOrganizer V4 R5 Static/Mock Checkpoint

日期：2026-07-26

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

checkpoint 起点：`38085994`

## 1. 结论

V4 R5 static/Mock checkpoint 已完成。Fresh V4 Mock、guard/breaker/fixed-denominator、全量静态门、
WrongQuestionOrganizer PostgreSQL E2E、Compose default-off boundary、历史不可变性、残留清理与文档
回顾入口均已关闭。

本 checkpoint 全程 zero-network：未读取根 `.env` 或 component credential，未调用 DeepSeek、OpenAI、
Qwen 或其它 Provider，未启动/重建产品 Docker service、调用产品 API 或打开浏览器。Mock 只能证明
工程合同，不能证明真实模型语义质量或产品可用性。

V4 R0--R5 已完成；Phase 6.9.7 仍未完成。下一步必须停在 R6 新的精确一次性 V4 branch
controlled-Live 授权门前。V4 Live、产品 Docker/API/可见浏览器、Task 13/main、Phase 6.10 和博客
收尾均未开始。

## 2. 静态与本地数据库门

| 范围                                  | 结果                                                            |
| ------------------------------------- | --------------------------------------------------------------- |
| V4/V3 focused                         | `68/68`，`548 expect()`                                         |
| Agent full                            | `674/674`，`7094 expect()`                                      |
| Agent typecheck / lint                | exit `0` / exit `0`                                             |
| AI full                               | `199/199`，`1054 expect()`                                      |
| AI typecheck / lint                   | exit `0` / exit `0`                                             |
| Types tests / typecheck               | `42/42` / exit `0`                                              |
| Server full                           | `227` suites passed / `3` skipped；`2154` passed / `30` skipped |
| Server no-fix lint / build            | exit `0` / exit `0`                                             |
| Web full                              | `439/439`                                                       |
| Web lint / production build           | exit `0` / exit `0`；17 routes                                  |
| WrongQuestionOrganizer PostgreSQL E2E | `12/12`                                                         |
| Compose tracked example               | `config --quiet` exit `0`，无 stdout                            |

Server full 第一次调用没有注入测试 `DATABASE_URL`，唯一 integration suite 在 Prisma 初始化前报
`Environment variable not found: DATABASE_URL`；这不是代码断言失败。随后只使用
`wrong-question-organizer.e2e-spec.ts` 已公开的本地默认连接串
`postgresql://prepmind:devpass@127.0.0.1:5433/prepmind` 与测试 JWT 值补跑，得到表中完整通过结果。
没有读取根 `.env`，也没有启动、重建、停止或删除任何 Docker 容器/镜像/卷。

Types 仍有既存 `MODULE_TYPELESS_PACKAGE_JSON` 性能 warning；42 个 contract tests 与 `tsc --noEmit`
均通过。本 checkpoint 不顺带修改该 package metadata。

## 3. 冻结 deterministic baseline

- dataset：`phase-6.9-tutor-wrong-question-v1`
- dataset SHA-256：`7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e`
- cases：72；zero-call：24；runtime：48；paired requests：24；Organizer decisions：32
- 完整 runtime：`6/48`；critical failure：`0`
- Tutor semantic：`0.44186666666666674`
- Organizer semantic：`0.278125`
- combined semantic：`0.3599958333333334`
- provider / input / output / cost：`0 / 0 / 0 / 0 CNY`

Baseline 仍是未修饰本地 deterministic policy，没有经过模型候选 guard。R5 没有因 Mock 满分重排
detector、修改 expected 或覆盖 baseline。

## 4. Fresh V4 Mock all-success

- run ID：`c1bdf998-6fae-4c32-a4e3-bd6bea053454`
- evidence SHA-256：`cf50ce47053fd372d88c376550b622c2d74e42218de57333067ac4d6aa59656f`
- runner：`phase-6.9.7-tutor-organizer-runner-v4`
- disposition：`mock_direct`
- `24/24` verified zero-call；`48/48` executor started、usage verified 与 strict runtime
- Tutor / Organizer / combined semantic：`1 / 1 / 1`
- P95：Tutor `246ms`；Organizer `328ms`；paired candidate `328ms`；Tutor orchestration `276ms`
- verified usage：input `21948`；output `5647`
- estimated cost：`0.099726 CNY`
- V4 validator：`{"ok":true,"filesChecked":1}`
- report gate：`quality_gate_failed`

Mock 的 `quality_gate_failed` 是 Live-only authority 合同：`mock_synthetic` 即使所有质量指标为 1，也
不能启用产品 gate 或冒充 `deepseek_network`。唯一 Mock evidence 已按 run ID 精确删除；没有清空
`.tmp`，V1/V2/V3 artifacts 未受影响。

## 5. Guard / breaker / failure Mock

V4 lineage test 使用独立 synthetic identity 验证两类 fail-closed 终态：

### 5.1 Guard failure

- 24 个 guard 先执行；首个结果被改为不匹配；
- runtime executor 实际调用 `0`；
- report 仍有 72 entries，`notStartedCases=72`；
- `breakerState=guard_failed`，`dispatchedPairs=0`、`completedPairs=0`。

### 5.2 首对 runtime contract failure

- 24 个 guard 全部先通过且 zero-call；
- pair `0` 同时启动 Tutor/Organizer，各调用 `1` 次；
- Tutor schema failure 打开 `quality_gate_impossible`；
- `dispatchedPairs=1`、`completedPairs=1`，ledger `2 reserved / 2 terminal`；
- 后续 46 个 runtime 为 `not_started_quality_breaker`；
- V4 diagnostics：not-started `70`、contract failure `1`、semantic mismatch `0`、semantic match `1`；
- 固定总分母继续为 `72/24/48`，无 retry、补跑、resume、replay 或证据文件。

同组测试还覆盖 lane abort/预算隔离、sibling orphan、dispatch key 唯一、tamper/cross-version 拒绝、
marker race、recovery ABA 与 hard-link evidence。

## 6. PostgreSQL E2E、默认关闭与残留

WrongQuestionOrganizer `12/12` E2E 覆盖：

- default-off batch 使用本地写入且模型 Trace 为 0；
- owner isolation、missing/cross-owner 同一 404；
- locked deck name、force 唯一 relation；
- 同 owner 同主题并发、同题 single/batch/force 跨路由收敛；
- 并发 rename/move 的用户 authority 胜出。

完成后数据库中 `wrong-question-organizer-%@example.com` 测试账号计数为 `0`，级联组织层与 Trace
无本轮残留。

Tracked `docker/.env.example` 与 Compose quiet config 保持：

```text
AI_PROVIDER_MODE=mock
AI_ENABLE_LIVE_CALLS=false
TUTOR_AGENT_MODEL_ENABLED=false
TUTOR_AGENT_DEEPSEEK_API_KEY=
WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED=false
WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY=
```

Worker/Admin credential 与 gate 隔离继续由 Server full 中的 Compose/config tests 覆盖。本 checkpoint
禁止并且没有执行 `docker compose down -v`、Docker prune、container/image/volume 删除、database
reset、Redis flush 或 MinIO wipe。

## 7. 历史不可变性与 V4 artifact=0

| artifact    | SHA-256                                                            |
| ----------- | ------------------------------------------------------------------ |
| V1 evidence | `be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5` |
| V1 marker   | `7cb443f18149de25628576a1e4969c423281776b5f3f6ffb1da6a8d39f6ecffb` |
| V2 evidence | `0c64506211d66570fdcf6a016a10885881985bdb0bc4628441c2e5b363d84c77` |
| V2 marker   | `ac65ac67bd155f448e498a2c1dd9d7762d1efb4cc720a3cf1153083299c98504` |
| V3 evidence | `e24f4e6dd6fc0d0621eee672210b86fe8fbf5dce4664b1184726319b8e22d25c` |
| V3 journal  | `df141874f9bdb0caffac16bf7d930a64d97dd5521e0c06e5db0ec3dd406d6cff` |
| V3 marker   | `b18a7688494c250cd3f7dc0376f49d5712377240bdc1bd86e9d8dd9a3d8be412` |

V1/V2/V3 file validator 均为 `{"ok":true,"filesChecked":1}`。R5 结束时 V4 Mock evidence 已删除，
V4 Live marker/journal/evidence/recovery claim 均为 `0`。V4 Live CLI 继续在 R6 前硬返回
`live_not_available_before_r6`。

## 8. 明确未完成

- 没有执行 V4 controlled-Live，没有真实语义、网络 P95、真实 token 或 Provider 账单证据；
- 没有启用 Tutor/Organizer 产品 gate，不能声称两个真实模型 Agent 已可用于产品；
- 没有启动 authenticated Docker API 或可见 `/chat`、`/error-book` 浏览器验收；
- 没有创建产品 synthetic 用户/错题/Trace/session；
- 没有合并 main、执行 main default-off replay 或推送 main；
- 没有完成 Phase 6.9.7、Phase 6 全部 Agent、可执行 LangGraph 或 Phase 6.10 分层记忆；
- 没有开始《多 Agent 架构》或《记忆系统》面试学习博客收尾。

## 9. 停止条件与下一步

R5 文档提交与远程推送后必须停止在授权门。R6 的唯一合法前置是用户在当前时点重新确认 DeepSeek
账号的数据保留/训练边界，并明确写出一次 V4 branch controlled-Live 授权；此前“继续/所有权限”
不能替代该一次性网络授权。

可以这样继续询问：

- “R5 为什么 Mock semantic `1/1` 仍然是 `quality_gate_failed`？”
- “R5 怎样证明 24 个 guard 真正 zero-call、breaker 后 46 个 runtime 没有启动？”
- “V4 Live 前哪些 marker/journal/recovery/evidence 必须为 0？”
- “为什么 PostgreSQL E2E 通过仍不能证明 DeepSeek 模型路径可用？”
- “我已接受 DeepSeek 当前账号的数据保留/训练边界，并明确授权执行一次 Phase 6.9.7 Tutor/Organizer V4 branch controlled-Live。”

## 10. 后续 R6 终态

上述是 R5 当时的 static/Mock checkpoint 与授权门记录，不作改写。后续用户已提供所列精确授权，
唯一 V4 R6 run `0fb47591-5ff4-4e46-bcf3-2cd267d1fb2f` 已以 `10/48` strict runtime、
`quality_gate_failed` 失败封存。一次性名额已消费且不得重跑；R7--R9、产品 Docker/API/浏览器、
Task 13/main、Phase 6.10 与博客收尾均不得开始。若继续只能建立与 V1--V4 双向隔离的零 Provider
remediation。详见 `2026-07-26-phase-6-9-7-tutor-organizer-v4-controlled-live-failure.md`。
