# Phase 6.9.7 Tutor / WrongQuestionOrganizer V6 R4 Static/Mock Checkpoint

日期：2026-07-27

分支：`codex/phase-6-9-7-tutor-wrong-question-agents`

R3 基线提交：`907a2b2583c0204b8acdc142c69987b5e139e4fd`

## 1. 结论

V6 R4 static/Mock checkpoint 已完成。仓库现在提供 reviewed V6 Mock factory、V6 baseline/Mock CLI，
并通过真实 V6 Tutor/Organizer candidate、strict validator、本地 authority merger、原生 V6 runner 与
evidence validator 完成 fresh 分支验收。

本 checkpoint 仍为 zero-provider：没有人工读取根 `.env` 或 component credential，没有调用 DeepSeek、
OpenAI、Qwen 或其它 Provider，没有创建 V6 Live marker/journal/evidence/recovery claim，没有启动或重建
产品 API/Web 服务，也没有执行浏览器验收。仅复用既有本地 PostgreSQL 容器完成 Organizer 并发 E2E；
没有删除 Docker 容器、镜像、卷或既有数据。

Mock 只证明工程合同，不证明真实模型语义质量、网络 P95、Provider token/账单或产品可用性。V6
R0--R4 已完成；Phase 6.9.7 仍未完成。下一步必须停止在新的 V6 R5 branch controlled-Live 精确授权
门前。

## 2. R4 实现

- 新增公开子路径 `@repo/agent/phase-6-9-7-v6-mock` 与 reviewed V6 Mock factory；
- 新增 `eval:phase-6-9-7:v6:baseline` 与 `eval:phase-6-9-7:v6:mock`；
- 公共 V6 CLI 的 `mock` 默认使用正式 factory，仍不借用或构造 Live executor；
- Tutor Mock 经过 safe projection -> intent-only V6 candidate -> dynamic validator -> 本地 preferred-depth/
  pedagogy merger；
- Organizer Mock 经过 actual owner shortlist -> ordinal-only V6 candidate -> dynamic validator -> 本地
  confidence/ID/locked-name merger；
- 24 条 guard 不构造 runtime，48 条 runtime 各执行一次 synthetic Mock invocation，无重试；
- duration 来自 V6 单调时钟与正式 deadline contract，不复制 V5 固定 latency；
- Mock output token 为正数且受上限校验，费用固定为 `0 CNY`，明确不冒充 Provider telemetry。

正式 Mock 首次暴露 Organizer 评分投影使用了实际 shortlist ordinal，而冻结 V2 expected 使用 canonical
ordinal。修复只在 eval adapter 中先验证实际 shortlist/本地选择，再按 resolved subject、真实 deck ID、
topic label/alias 映射回 canonical ordinal；没有修改 dataset、expected、candidate、模型权限或本地事实
authority。

## 3. 静态与本地数据库门

| 范围                                  | 结果                                   |
| ------------------------------------- | -------------------------------------- |
| V6 runner/durability/lineage/CLI/Mock | `36/36`，`309 expect()`                |
| Agent full                            | `828/828`，`10826 expect()`            |
| Agent typecheck / lint                | exit `0` / exit `0`                    |
| AI full                               | `199/199`，`1054 expect()`             |
| AI typecheck / lint                   | exit `0` / exit `0`                    |
| Types tests / typecheck               | `42/42` / exit `0`                     |
| Server Docker boundary                | `3/3`                                  |
| Server no-fix lint / build            | exit `0` / exit `0`                    |
| Web full                              | `439/439`                              |
| Web lint / production build           | exit `0` / exit `0`；17 个页面完成生成 |
| WrongQuestionOrganizer PostgreSQL E2E | `12/12`；匹配测试账号残留 `0`          |
| Compose tracked example               | `config --quiet` exit `0`              |
| 两路独立只读复审                      | `APPROVED`；无 P0/P1                   |

Types 与 Web 仍打印既有 `MODULE_TYPELESS_PACKAGE_JSON` 性能 warning；它们不是测试失败，本任务没有顺带
修改 package module 配置。

Contract/security/concurrency 复审确认 Mock 真实穿过 V6 candidate/validator/merger、单 dispatch、
zero-call 与 Live durability 隔离；对 folded deck canonical ID 的初步疑问经源码复核后撤销。Docs/history/
operations 复审指出 `docs/data-flow.md` 的旧 V2 状态标题，已改为 V1--V5 失败封存与 V6 R0--R4
zero-provider 当前态。两路最终均 `APPROVED`，没有 P0/P1 阻断。

## 4. Fresh deterministic baseline

- dataset：`phase-6.9-tutor-wrong-question-v2`；
- dataset SHA-256：`42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b`；
- source policy SHA-256：`b39134038c22fe304cf3212da11da468d9a2d88a51a0162bbad1102186cf009d`；
- baseline SHA-256：`0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca`；
- 完整 runtime：`12/48`；critical failure：`0`；
- Tutor / Organizer / combined semantic：
  `0.6629642857142858 / 0.278125 / 0.4705446428571429`；
- Provider invocation / token / cost：`0 / 0 / 0 CNY`。

这是冻结 V2 dataset 上的未修饰本地 baseline，不是 V6 模型结果。R4 没有因 Mock 满分修改 expected、
baseline、threshold 或失败 case。

## 5. Fresh V6 Mock

- run ID：`88d72b3c-b1b9-4b4d-bb56-903b04b437b0`；
- evidence SHA-256：`e73e5cabd9984bcbd6c3018109f9e165054f5cbfc96376627630115878f39920`；
- report SHA-256：`a86f21c94a002e02c3a0ee9be7690de4be31f8ca2368b49a9f30383e744e88f8`；
- `24/24` verified zero-call；`48/48` strict runtime；24 个 paired requests；32 个 Organizer decisions；
- Tutor / Organizer / combined semantic：`1 / 1 / 1`；
- model-owned：Tutor intent `24/24`；Organizer subject/deck/target ordinal 均为 `32/32`；
- P95：Tutor candidate `3ms`；Organizer candidate `1ms`；paired candidate `9.8304ms`；Tutor
  orchestration `4.1247ms`；
- synthetic invocation counter：`48`；verified runtime：`48`；Mock input/output：`37020/1882`；
  estimated cost：`0 CNY`；
- report gate：`mock_quality_not_evidence`；V6 validator：`{"ok":true,"filesChecked":1}`。

这 48 次 invocation 只是共享 Mock runtime 的合成执行计数，不是真实 Provider call。P95 是本机工程
路径快照，不是 DeepSeek 网络或产品端到端延迟；`0 CNY` 也不是 Provider 账单证据。唯一 Mock evidence
已按精确 run ID 删除，没有清空 `.tmp`。

## 6. 历史不可变性与残留

| artifact    | SHA-256                                                            |
| ----------- | ------------------------------------------------------------------ |
| V1 evidence | `be0448712b2567e572a27003937995700ef7f6e0d32ff210b3c1c7793c3f34b5` |
| V2 evidence | `0c64506211d66570fdcf6a016a10885881985bdb0bc4628441c2e5b363d84c77` |
| V3 evidence | `e24f4e6dd6fc0d0621eee672210b86fe8fbf5dce4664b1184726319b8e22d25c` |
| V4 evidence | `6ec60be1fced72766253e237b892fabb8e1d4ceca555249593d693f5e2d94608` |
| V5 evidence | `84487b448acd7bd5e65cd523eb7556cd9b3175bc9ba44572e06a78157c45b70a` |
| V5 journal  | `a8b8bcbfbbce9b5d8e62919edf24c71d2440cd94c74737d01fccb5c6204e8506` |
| V5 marker   | `c3a3eb063677303591b858f0667c94bd8d30f993cf060736e54f1bf3b18c9e75` |

V1--V5 evidence validators 均返回 `ok=true`。R4 结束时 V6 Mock evidence 已精确删除，V6 Live marker、
journal、Live evidence 与 recovery claim 数量均为 `0`。R4 未创建产品 synthetic 账号、Trace 或浏览器
storage；PostgreSQL E2E 的匹配测试账号残留为 `0`。

Tracked Compose 继续保持 `AI_PROVIDER_MODE=mock`、Live=false、Tutor/Organizer gate=false、component
credential 为空；worker/admin 不接收这两条能力。

## 7. 明确未完成

- 没有执行 V6 controlled-Live，没有真实语义、网络 P95、Provider token 或账单证据；
- 没有把 V6 Tutor/Organizer candidate、`3500ms` Tutor timeout 或新 local authority 接入产品
  composition/gate/Trace；
- 没有启动 authenticated Docker API 或可见 `/chat`、`/error-book` 浏览器验收；
- 没有合并 main、执行 main default-off replay 或推送 main；
- 没有完成 Phase 6.9.7、Phase 6 全部 Agent、可执行 LangGraph 或 Phase 6.10 分层记忆；
- 没有开始《多 Agent 架构》或《记忆系统》面试学习博客收尾。

R3 已记录的 durability 边界仍保留：文件 fsync 不等于父目录 fsync；recovery claim 的 journal tail 在
appender/seal 二次校验；尚无 stale-claim rename 后再次崩溃专测。本 checkpoint 不把它们冒充为已
解决的跨主机 lease 或 Provider exactly-once。

## 8. 停止条件与下一步

R4 文档提交并推送功能分支后必须停止在授权门。R5 的唯一合法前置是：当前分支 clean/pushed，V6
Live artifact 为 0，历史 SHA/validator 仍通过，用户在运行当时重新接受 DeepSeek 数据保留/训练边界，
并明确授权唯一一次 **Phase 6.9.7 Tutor/Organizer V6 branch controlled-Live**。此前的“继续”或旧版
授权不能替代该一次性网络授权。

可以这样继续询问：

- “为什么 V6 Mock semantic/model-owned 全满分仍不能证明 DeepSeek 可用？”
- “actual shortlist ordinal 为什么必须先映射回冻结 canonical ordinal 才能评分？”
- “为什么 Mock output token 可以是正数，但费用仍必须是 0？”
- “R5 前哪些 V6 marker/journal/evidence/recovery artifact 必须为 0？”
- “我已接受 DeepSeek 当前账号的数据保留/训练边界，并明确授权执行一次 Phase 6.9.7
  Tutor/Organizer V6 branch controlled-Live。”
