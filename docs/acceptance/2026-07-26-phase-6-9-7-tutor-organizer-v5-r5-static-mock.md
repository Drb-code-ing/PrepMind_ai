# Phase 6.9.7 Tutor / WrongQuestionOrganizer V5 R5 Static/Mock Checkpoint

日期：2026-07-26

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

checkpoint 起点：`8196ff70`

## 1. 结论

V5 R5 static/Mock checkpoint 已完成。正式源码现在提供 reviewed V5 Mock factory，默认 Mock CLI
真实经过两条受治理 candidate、strict validator 与本地权威 merger；fresh deterministic baseline、fresh
V5 Mock、受影响静态门、WrongQuestionOrganizer PostgreSQL 并发 E2E、Compose default-off、历史
artifact 不可变性、残留清理和两路独立复审均已关闭。

本 checkpoint 全程 zero-provider：未读取根 `.env` 或 component credential，未调用 DeepSeek、OpenAI、
Qwen 或其它 Provider，未启动/重建产品 Docker service、调用产品 API 或打开浏览器，也未修改业务数据。
Mock 只能证明工程合同，不能证明真实模型语义质量或产品可用性。

V5 R0--R5 已完成；Phase 6.9.7 仍未完成。下一步必须停止在 R6 新的精确一次性 V5 branch
controlled-Live 授权门前。产品 gate、Docker/API/可见浏览器、Task 13/main、Phase 6.10 和博客收尾
均未开始。

## 2. R5 实现

- 新增公开子路径 `@repo/agent/phase-6-9-7-v5-mock` 与 reviewed Mock factory；
- 新增 `bun --filter @repo/agent eval:phase-6-9-7:v5:mock`；
- CLI `mock` 默认注入正式源码 factory；`live` 不隐式借用 Mock factory，缺少显式 Live factory 时返回
  `runtime_factory_unavailable` 且不创建 marker；
- Tutor Mock 路径经过 local authority -> ordinal-safe projection -> V5 candidate -> validator -> local merger；
- Organizer Mock 路径经过 owner snapshot shortlist -> ordinal projection -> V5 candidate -> validator -> local
  merger；
- expected 只存在于 eval-only responder/评分闭包，实际 prompt 不含 case ID、expected、oracle 或 V1--V4
  identity；
- 24 条 guard 不构造模型 runtime，保持真实 zero-call；48 条 runtime 各调用一次合成 Mock executor，无
  retry。

## 3. 静态与本地数据库门

| 范围                                  | 结果                                       |
| ------------------------------------- | ------------------------------------------ |
| V5 focused                            | `62/62`，`1570 assertions`                 |
| Agent full                            | `745/745`，`9200 assertions`               |
| Agent typecheck / lint                | exit `0` / exit `0`                        |
| AI full                               | `199/199`，`1054 expect()`                 |
| AI typecheck / lint                   | exit `0` / exit `0`                        |
| Types tests / typecheck               | `42/42` / exit `0`                         |
| Server Docker boundary / build        | `3/3`，`31 expect()` / exit `0`            |
| Server no-fix lint                    | exit `0`                                   |
| Web full                              | `439/439`                                  |
| Web lint / production build           | exit `0` / exit `0`；17 个静态页面完成生成 |
| WrongQuestionOrganizer PostgreSQL E2E | `12/12`                                    |
| Compose tracked example               | `config --quiet` exit `0`                  |

Types 仍有既存 `MODULE_TYPELESS_PACKAGE_JSON` 性能 warning。额外尝试直接执行 Types lint 时，当前 package
工具解析返回 `bun: command not found: eslint`；这不是源码断言失败，也不被记录为 lint 通过。本 checkpoint
按冻结矩阵使用 `42/42` contract tests 与 `tsc --noEmit` 作为 Types authority，不顺带修改既存工具配置。

## 4. Fresh deterministic baseline

- dataset：`phase-6.9-tutor-wrong-question-v2`
- dataset SHA-256：`42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b`
- policy SHA-256：`b39134038c22fe304cf3212da11da468d9a2d88a51a0162bbad1102186cf009d`
- baseline SHA-256：`0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca`
- 完整 runtime：`12/48`
- Tutor / Organizer / combined semantic：
  `0.6629642857142858 / 0.278125 / 0.4705446428571429`
- Provider / usage / cost：`0 / 0 / 0 CNY`

这是 V5 policy 对冻结 V2 72-case dataset 的未修饰本地 baseline，不是另一个 V5 dataset。R5 没有因
Mock 满分修改 expected、baseline、policy、threshold 或失败 case。

## 5. Fresh V5 Mock

- run ID：`6eaf428c-9800-4871-9ccc-9a644438123b`
- evidence SHA-256：`8ba2f869bca8b71fe262bc6feacce4b8fdc583eed72eeacf074414201c2e3a57`
- `24/24` verified zero-call；`48/48` strict runtime；24 个 paired requests；32 个 Organizer decisions；
- Tutor / Organizer / combined semantic：`1 / 1 / 1`；
- P95：Tutor `246ms`；Organizer `328ms`；paired candidate `328ms`；Tutor orchestration `276ms`；
- synthetic provider invocation counter：`48`；Mock input estimate：`45616`；output/cost：`0 / 0 CNY`；
- report gate：`mock_quality_not_evidence`；
- V5 validator：`{\"ok\":true,\"filesChecked\":1}`。

这里的 `48` 只是共享 Mock runtime 的合成 executor invocation 计数，不是真实 Provider 调用；Mock 的
output/cost 为 0 也是该 Mock telemetry 的真实语义，不能外推为 DeepSeek token 或账单证据。两轮报告
除 runId 外 byte-stable；actual prompt 泄漏扫描通过。唯一 Mock evidence 已按精确 run ID 删除，没有
清空 `.tmp`。

## 6. PostgreSQL、默认关闭与残留

WrongQuestionOrganizer `12/12` E2E 覆盖 default-off/零模型 Trace、owner isolation、locked name、force
唯一 relation、同 owner/同主题并发、同题 single/batch/force 跨路由收敛，以及并发 rename/move 时用户
authority 胜出。

Tracked Compose 继续保持：

```text
AI_PROVIDER_MODE=mock
AI_ENABLE_LIVE_CALLS=false
TUTOR_AGENT_MODEL_ENABLED=false
TUTOR_AGENT_DEEPSEEK_API_KEY=
WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED=false
WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY=
```

本 checkpoint 没有执行 `docker compose down -v`、Docker prune、容器/镜像/卷删除、database reset、
Redis flush 或 MinIO wipe。

## 7. 历史不可变性与 V5 artifact=0

| artifact    | SHA-256                                                            |
| ----------- | ------------------------------------------------------------------ |
| V1 evidence | `be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5` |
| V2 evidence | `0c64506211d66570fdcf6a016a10885881985bdb0bc4628441c2e5b363d84c77` |
| V3 evidence | `e24f4e6dd6fc0d0621eee672210b86fe8fbf5dce4664b1184726319b8e22d25c` |
| V4 evidence | `6ec60be1fced72766253e237b892fabb8e1d4ceca555249593d693f5e2d94608` |

V1--V4 validators 均为 `{"ok":true,"filesChecked":1}`。R5 结束时 V5 Mock evidence 已精确删除，
V5 Live marker/journal/evidence/recovery claim 数量均为 `0`。V1--V4 历史 authority 没有被改写或拼接。

## 8. 两路独立终审

- contract/security/concurrency：未发现 P0--P2 缺陷；确认 Mock factory 真实经过 V5 candidate，prompt
  无 oracle/旧 lineage 泄漏，CLI Mock 不预留 Live state，Live 无显式 factory/approval 继续 fail-closed；
- docs/history/operations：发现的唯一阻断是核心文档仍把 R5 写为下一步，本提交已统一改为 R5 完成、
  下一步仅 R6；历史验收记录保持不改写。

记录一个 P3 测试边界：eval-only responder 的 `exact_deck_match` guard 以非空 existing-deck shortlist
表达 fixture oracle，而不是严格比较具体 deck。它不进入产品权限、候选或写路径，不阻断 R5；后续若
扩展 dataset，可把该合成判定收敛为显式 exact-match fixture。

## 9. 明确未完成

- 没有执行 V5 controlled-Live，没有真实语义、网络 P95、真实 token 或 Provider 账单证据；
- 没有把 V5 Tutor/Organizer candidate 接入产品 composition/gate/Trace persistence；
- 没有启动 authenticated Docker API 或可见 `/chat`、`/error-book` 浏览器验收；
- 没有创建产品 synthetic 用户/错题/Trace/session；
- 没有合并 main、执行 main default-off replay 或推送 main；
- 没有完成 Phase 6.9.7、Phase 6 全部 Agent、可执行 LangGraph 或 Phase 6.10 分层记忆；
- 没有开始《多 Agent 架构》或《记忆系统》面试学习博客收尾。

## 10. 停止条件与下一步

R5 文档提交并推送功能分支后必须停止在授权门。R6 的唯一合法前置是用户在当前时点重新确认
DeepSeek 账号的数据保留/训练边界，并明确授权一次 Phase 6.9.7 Tutor/Organizer V5 branch
controlled-Live；此前“继续/所有权限”不能替代该一次性网络授权。

可以这样继续询问：

- “为什么 V5 Mock semantic `1/1/1` 仍不能证明真实模型可用？”
- “怎样证明 24 个 guard 没有构造 runtime，而 48 个 Mock runtime 各只调用一次？”
- “V5 R6 前哪些 marker/journal/recovery/evidence 必须为 0？”
- “为什么 PostgreSQL 12/12 与 Compose default-off 仍不能替代 Docker 产品验收？”
- “我已接受 DeepSeek 当前账号的数据保留/训练边界，并明确授权执行一次 Phase 6.9.7 Tutor/Organizer V5 branch controlled-Live。”
