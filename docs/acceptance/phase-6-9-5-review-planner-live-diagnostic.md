# Phase 6.9.5 Review / Planner 真实模型诊断与项目内启用验收

## 目标与边界

本阶段只为 `ReviewAgent` 与 `PlannerAgent` 建立受控的真实模型只读建议路径。模型只能在当前确定性快照中选择弱点索引、计划块顺序和受限策略枚举；JWT owner、学习事实、FSRS、分钟数、链接、任务创建与任何写入操作始终由 Nest 服务和本地 merger 掌握。

默认生产状态保持关闭：`REVIEW_AGENT_MODEL_ENABLED=false`、`PLANNER_AGENT_MODEL_ENABLED=false`，两个 timeout 默认均为 `4500ms`。全局 Live 双开关、对应组件 gate、安全 HTTPS provider 配置、匹配凭据和预算均是必要条件；任一缺失、超时、schema 无效、预算耗尽或 telemetry 不可验证时，只返回确定性建议。

本记录不把 Mock、静态检查、Docker 配置解析或浏览器页面当作真实模型质量证据。

## Task 6 无凭据门

本轮在不注入 AI provider 配置、不开启全局 Live 或 Review/Planner gate 的前提下执行。后端全量测试只注入运行测试所需的数据库和 JWT 配置；没有执行受控诊断、Live、Docker 或浏览器。

| 项目 | 结果 |
| --- | --- |
| `bun --filter @repo/agent test` | 402 passed / 0 failed |
| `bun --filter @repo/ai test` | 155 passed / 0 failed |
| `bun --filter @repo/server test` | 776 passed / 0 failed / 29 skipped |
| `bun --filter @repo/server lint`、`build` | 均 exit 0 |
| `bun --filter @repo/web test` | 409 passed / 0 failed |
| `bun --filter @repo/web lint`、`build` | 均 exit 0 |
| `bun --cwd packages/types typecheck` | exit 0 |

Worker readiness 的子进程回归改为直接运行 Node + `ts-node` 的实际 CLI。这样验证的是 CLI 约定的异常退出码 `2` 与脱敏输出，不会把 Bun workspace script runner 在 Windows 上返回的包装退出码 `1` 误判为功能失败；子进程环境只允许传递运行 Node 所需的路径/临时目录和该测试的显式 fixture 配置。

## 新鲜 Mock 证据

本次 Mock 文件是不可覆盖的本地 `.tmp` 产物：`phase-6-9-5-live-diagnostic-mock-20260716T133731970Z.json`。它不提交到仓库，也不复用旧 Live 证据。

| 计数 | 值 |
| --- | --- |
| case entries | 48 |
| zero-call cases | 26 |
| Mock runtime invocations | 22 |
| strict successes | 48 |
| rubric quality passes | 48 |
| critical failures | 0 |
| production decision | `mock_quality_not_evidence` |

这里的 runtime invocation 是本地 Mock contract，不是 provider 调用。Mock 证明固定数据集、strict schema、预算、zero-call、安全降级和报告脱敏能够工作；它不证明真实模型语义质量，也不授权开启任一生产 gate。

## Task 7 两个隔离的 controlled-Live 诊断（均已关闭）

2026-07-16 的 v1 诊断先发现本地 probe 与 canonical Review candidate schema 不匹配。其后，单独完成零网络 schema-contract 修复与复审，才创建了全新的 v2 profile；v2 使用可满足 canonical schema 的无事实 Review candidate 请求。v2 不修改、覆盖或解释 v1，也不把两条 profile 的计数拼接。

两个 profile 都不是 48-case 质量评测，也没有开启任一业务生产 gate。它们各自的 once marker 已消耗，必须原样保留：

- v1：`docs/acceptance/evidence/phase-6-9-5-controlled-live/.review-planner-controlled-live.once`
- v2：`docs/acceptance/evidence/phase-6-9-5-controlled-live-v2/.review-planner-controlled-live-v2.once`

| 脱敏字段 | v1 历史记录 | v2 当前关闭记录 |
| --- | --- | --- |
| evidence schema | `phase-6.9.5-review-planner-controlled-live-evidence-v1` | `phase-6.9.5-review-planner-controlled-live-evidence-v2` |
| `status` | `invalid_attempted` | `invalid_attempted` |
| `gate` | `closed` | `closed` |
| `providerAttemptCount` | `1` | `1` |
| `usageKnown` | `false` | `false` |
| `diagnosticCode` | `structured_output` | `structured_output` |
| `state` | `finalized` | `finalized` |

v2 的最终 evidence 为 `docs/acceptance/evidence/phase-6-9-5-controlled-live-v2/review-planner-live-20260716T144922378Z-451d4dc8c07a.json`。两份 evidence 都只保存上述受控状态、schema version 与对应 once marker；不保存 prompt、用户学习事实、模型输出、API key、provider endpoint、HTTP status/header、原始错误、stack 或 token/cost 数值。每个 `providerAttemptCount=1` 只说明该独立 profile 已发生一次 provider 尝试；`usageKnown=false` 不能被改记为 zero-call、零成本、账单事实或模型质量通过。

## 当前结论与未执行项

- 已完成：无凭据静态门、Mock contract、受控诊断的原生脱敏 evidence 边界，以及 v1/v2 两个独立诊断 profile 的终局留档。
- 未执行且不得借用任一 profile 的结果补做：48-case controlled-Live、Docker authenticated suggestions/plan、可见浏览器状态、合成账号与 Trace 清理、main 复验和远程推送。
- 当前没有真实模型质量通过结论、没有项目内 `candidate_applied` 验收，也没有可开启任一 Review/Planner 业务 gate 的授权。`REVIEW_AGENT_MODEL_ENABLED` 与 `PLANNER_AGENT_MODEL_ENABLED` 继续保持默认 `false`。
- v2 当前不重试：`invalid_attempted / structured_output` 保持 `gate=closed`。不得重跑 v1 或 v2，也不得运行 48-case、Docker 或浏览器验收。任何后续排障必须先形成新的、零网络的根因设计与评审；在新的批准边界形成前，本阶段继续关闭。

## 回顾入口

- 为什么 Review/Planner 的模型只能选择索引和枚举，不能生成分钟数或写入任务？
- 为什么 48/48 Mock strict success 仍然不能称为 Live passed？
- 为什么 worker readiness 的 CLI 回归要绕开 Bun package-script wrapper？
- 为什么每个独立 profile 的一次 provider 尝试且 `usageKnown=false` 都不能被记为 zero-call、零成本或模型验收通过？
- 为什么 v1/v2 once marker 必须同时保留，且 `invalid_attempted` 后不能直接重试？
