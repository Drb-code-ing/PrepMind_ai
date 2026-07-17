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

## Task 7 四个隔离的 controlled-Live 诊断（均已关闭）

2026-07-16 的 v1 诊断先发现本地 probe 与 canonical Review candidate schema 不匹配。其后，单独完成零网络 schema-contract 修复与复审，才创建了全新的 v2 profile；v2 使用可满足 canonical schema 的无事实 Review candidate 请求。v2 不修改、覆盖或解释 v1，也不把两条 profile 的计数拼接。

v3 在完成独立的零网络 structured-output 阶段归因设计、实现与复审后才创建。它只把已经受信的运行时内部阶段安全地写入新的 v3 专用 evidence，不向 HTTP、Trace、浏览器或业务 DTO 暴露该字段；它不是 v1/v2 的重试，不能覆盖、解释或拼接两条历史 profile。

v4 在完成独立的零网络封闭式 JSON 归一化与 stage-provenance 边界复审后才创建；它有自己的 evidence schema、目录和 once marker，不能覆盖、解释或拼接 v1/v2/v3。v4 的唯一 provider 尝试同样在受信内部 `provider_json_parse` 阶段以 `structured_output` 关闭，因此没有重试、没有 48-case Live，也没有 Docker 或浏览器验收。

四个 profile 都不是 48-case 质量评测，也没有开启任一业务生产 gate。它们各自的 once marker 已消耗，必须原样保留：

- v1：`docs/acceptance/evidence/phase-6-9-5-controlled-live/.review-planner-controlled-live.once`
- v2：`docs/acceptance/evidence/phase-6-9-5-controlled-live-v2/.review-planner-controlled-live-v2.once`
- v3：`docs/acceptance/evidence/phase-6-9-5-controlled-live-v3/.review-planner-controlled-live-v3.once`
- v4：`docs/acceptance/evidence/phase-6-9-5-controlled-live-v4/.review-planner-controlled-live-v4.once`

| 脱敏字段 | v1 历史记录 | v2 关闭记录 | v3 关闭记录 | v4 关闭记录 |
| --- | --- | --- | --- | --- |
| evidence schema | `phase-6.9.5-review-planner-controlled-live-evidence-v1` | `phase-6.9.5-review-planner-controlled-live-evidence-v2` | `phase-6.9.5-review-planner-controlled-live-evidence-v3` | `phase-6.9.5-review-planner-controlled-live-evidence-v4` |
| `status` | `invalid_attempted` | `invalid_attempted` | `invalid_attempted` | `invalid_attempted` |
| `gate` | `closed` | `closed` | `closed` | `closed` |
| `providerAttemptCount` | `1` | `1` | `1` | `1` |
| `usageKnown` | `false` | `false` | `false` | `false` |
| `diagnosticCode` | `structured_output` | `structured_output` | `structured_output` | `structured_output` |
| `structuredOutputStage` | 不适用 | 不适用 | `provider_json_parse` | `provider_json_parse` |
| `state` | `finalized` | `finalized` | `finalized` | `finalized` |

v2 的最终 evidence 为 `docs/acceptance/evidence/phase-6-9-5-controlled-live-v2/review-planner-live-20260716T144922378Z-451d4dc8c07a.json`；v3 的最终 evidence 为 `docs/acceptance/evidence/phase-6-9-5-controlled-live-v3/review-planner-live-20260716T175755421Z-84a2a9591afa.json`；v4 的最终 evidence 为 `docs/acceptance/evidence/phase-6-9-5-controlled-live-v4/review-planner-live-20260716T201358494Z-16c8a4ee5a07.json`。四份 evidence 都只保存上述受控状态、schema version 与对应 once marker；不保存 prompt、用户学习事实、模型输出、API key、provider endpoint、HTTP status/header、原始错误、stack 或 token/cost 数值。v3/v4 的 `structuredOutputStage=provider_json_parse` 仅是受信运行时内部分类，不等同于保存 provider 原文或精确诊断其根因。每个 `providerAttemptCount=1` 只说明该独立 profile 已发生一次 provider 尝试；`usageKnown=false` 不能被改记为 zero-call、零成本、账单事实或模型质量通过。

## 2026-07-17 离线评测与 telemetry 可信度补强

本节不改写 v1--v4 evidence，也不新增 provider attempt。它只记录后续独立 profile 之前已完成的离线工程收口：

| 关注点 | 当前可验证行为 | 不能推出的结论 |
| --- | --- | --- |
| `phase-6.9-review-planner-v2` | 48 cases；26 条 zero-call 实际经过 candidate guard 并由 `zeroCallVerified` 约束；22 条 runtime fixture 覆盖不同 Review/Planner 语义组合 | Mock 仍不是真实模型质量证据 |
| Live usage | 缺失、非法、负数、非整数或 `0/0` provider usage 固定为 `PROVIDER_ERROR / invalid_response`；预留预算不回退 | failure DTO 中的 `0/0` 不表示 provider 未计费或零费用 |
| Trace cost | 仅成功、正安全整数 usage、模型单价完整时显示 `pricingKnown=true` 与集中估算成本 | 估算成本不替代供应商账单；旧 evidence 不回填 |
| Compose fixture | 测试子进程仅继承 Docker 所需的最小 OS 环境白名单；host-only Qwen canary 验证 `--env-file` 插值和全部 service 解析不会继承宿主变量 | 不向 Web 投影 Review/Planner gate、timeout 或真实凭据 |

本轮不触发 Docker、浏览器、合成账号、Trace 或清理流程。完整静态验证在离线改动后通过：Agent、AI、Server、Web、shared types、server/web lint 与 build 均为 exit 0；具体命令和计数见同日 DEVLOG。Qwen Chat v5 仍只有独立设计，直到精确价格 profile 与独立费用 cap 获批准前，任何 v5 preflight 都必须 provider 前关闭。

fresh Mock artifact 为 `.tmp/phase-6-9-5-v2-mock-20260717T080000Z.json`：48 entries、26 `zeroCallVerified`、22 Mock runtime invocations、48 strict successes、48 quality passes、0 critical failures，生产决策仍为 `mock_quality_not_evidence`。该本地 `.tmp` 文件是本轮可重跑的 Mock 输出，不是受控 Live evidence，未提交到仓库。

## 2026-07-17 DeepSeek V4 Pro v5 终局记录

v5 使用与生产候选相同的 OpenAI-compatible JSON-object executor、`deepseek-v4-pro`、独立 once marker、CNY 1.00 hard cap 与完整 v1--v4 历史树校验。离线验证通过后，唯一一次 provider 尝试的最终 evidence 为 `docs/acceptance/evidence/phase-6-9-5-controlled-live-v5-deepseek-v4-pro/review-planner-live-20260717T051002762Z-d44e06ef3e8c.json`。

| 字段 | v5 结果 |
| --- | --- |
| `status` / `gate` | `invalid_attempted` / `closed` |
| `providerAttemptCount` / `usageKnown` | `1` / `false` |
| `diagnosticCode` | `structured_output` |
| 48-case / Docker / 浏览器 | 未执行 |

这只证明一次真实 provider 调用在结构化输出边界关闭；它不保存 provider 原文，也不证明普通 Chat 不可用、零成本、质量失败或模型通过。v5 marker 已消耗，严禁重跑。`REVIEW_AGENT_MODEL_ENABLED` 与 `PLANNER_AGENT_MODEL_ENABLED` 继续为 `false`。此前 workspace package-script 在本机返回 provider 前 `preflight_invalid`，没有创建 v5 evidence，也没有 provider 调用；最终 evidence 来自通过同一 preflight 的根 Bun 入口。后续只能先做新的零网络根因设计与独立复审。

## 2026-07-17 V6 controlled-Live 终态诊断（已执行且关闭）

V6 是独立于 v1--v5 的 DeepSeek V4 Pro non-thinking lineage，不是 v5 retry。Task 1--6 的离线工程完成后，用户已明确授权并仅执行一次精确 V6 命令。运行只在子进程临时覆盖 Live 配置，根 `.env` 的默认 Mock 配置没有改写；未启动 Docker 或浏览器。

### 已完成的离线边界

- 只有精确 `deepseek-v4-pro` + `https://api.deepseek.com/v1` 的 Review/Planner candidate 才会选择 typed `deepseek_v4_pro_nonthinking_json` transport。该 transport 在 delegate 前写入 `thinking:{type:'disabled'}`，保留 JSON-object request，并在本地拒绝 tools/schema drift、预置 thinking 与暴露 `reasoning_content` 的 response。
- 两条产品业务 gate 仍固定默认 `REVIEW_AGENT_MODEL_ENABLED=false` 与 `PLANNER_AGENT_MODEL_ENABLED=false`；没有普通 Chat 行为变更、没有自动改用 Qwen，也没有产品内真实模型可用性结论。
- V6 factory 只把 `not_reported` 或 `reported_zero` 的 reasoning 审计投影到 complete evidence，并始终按完整 provider aggregate completion 进行 CNY 记账；不得从 output 中扣除 reasoning detail。V1--V5 evidence tree 与 once marker 由不可重解析的 SHA-256 snapshot 保护。
- V6 是私有、owner-scoped、一次性终态能力：安全 preflight 先写 provisional reservation，任何失败都以安全状态封存；只有受控 run 的严格 complete 才允许 seal。它不产生 raw prompt、response、credential、URL、header、reasoning text 或 provider 原始错误。

### 离线证据与受控预算

| 项目 | 已观察结果 | 不可推导的结论 |
| --- | --- | --- |
| CLI / canary | 精确确认命令已执行一次；最终 runtime evidence 为一次 provider canary 尝试 | 不代表 48-case、真实模型通过或可开启 gate |
| fake CLI 回归 | hardening 前的 fake CLI 为 `31/31` | 不是当前 V6 Live 证据 |
| focused V6 suite / native evidence | hardening 后 focused suite `61/61`，native evidence `15/15` | 不代表 provider 质量通过 |
| fresh Mock | 一次离线 proof 为 48 cases / 26 verified zero-call / 22 Mock runtime / 48 strict / 0 critical，决定为 `mock_quality_not_evidence`；`.tmp` artifact 随后已删除 | Mock 不是 provider 调用、质量通过或 gate 启用授权 |
| provider ceiling | 1 个 fact-free canary + 至多 22 个 paired runtime case，即最多 23 次；最坏 reservation 为 CNY `0.18726`，hard cap CNY `1.00` | 不等于实际账单、已发生费用或可自动开启 gate |

完整离线验证在 lint-style 修复提交后重新执行：AI、Agent、Server、shared types、Web 的测试/lint/build，Compose `config --quiet` 与 `git diff --check` 均 exit 0。该记录只说明 V6 pre-Live 工程边界可复核，不声明 Live passed、production enabled 或真实模型已可在项目中使用。

### 唯一一次 V6 Live 的终态

- evidence：`docs/acceptance/evidence/phase-6-9-5-controlled-live-v6-deepseek-v4-pro-nonthinking/review-planner-live-20260717T111332841Z-9d02337a8c85.json`；同目录 once marker 已被消耗。
- 可解析最终字段为 `state=finalized`、`status=invalid_attempted`、`gate=closed`、`providerAttemptCount=1`、`usageKnown=false`、`diagnosticCode=usage_unverifiable`。
- 这表示 provider boundary 已被触达一次，但 usage 无法验证；运行时按 fail-closed 终止。它不能被解释为 zero-call、零成本、供应商账单、模型质量失败或模型质量通过。
- V6 不能重跑，不能进入 48-case quality decision、Docker authenticated suggestions/plan、可见浏览器、main 合并或远程推送。两个业务 gate 继续保持 `false`。
- V1--V5 的 marker/evidence 未改写；本次 V6 evidence 也不保存 prompt、用户事实、模型输出、凭据、URL、HTTP 原文错误、stack、token 或成本数值。

## 当前结论与未执行项

- 已完成：v1--v5 独立关闭证据的留档，以及 V6 typed non-thinking transport、resolver/factory/evidence/CLI/Mock/复审和一次终态 Live evidence 的封存。
- 未执行且不得借用任一 profile 的结果补做：V6 48-case quality decision、Docker authenticated suggestions/plan、可见浏览器状态、合成账号与 Trace 清理、main 复验和远程推送。
- 当前没有真实模型质量通过结论、没有项目内 `candidate_applied` 验收，也没有可开启任一 Review/Planner 业务 gate 的授权。`REVIEW_AGENT_MODEL_ENABLED` 与 `PLANNER_AGENT_MODEL_ENABLED` 继续保持默认 `false`。
- v1--v6 都是独立且不可重跑的 terminal profile。若要继续，只能先基于 `usage_unverifiable` 做新的零网络根因设计与独立复审，再由用户决定是否批准一个全新的、隔离的 profile；不得把它称为 V6 retry，也不得拼接任何历史计数。任何后续 profile 在独立产品验收前都必须保持业务 gate 关闭。

## 回顾入口

- 为什么 Review/Planner 的模型只能选择索引和枚举，不能生成分钟数或写入任务？
- 为什么 48/48 Mock strict success 仍然不能称为 Live passed？
- 为什么 worker readiness 的 CLI 回归要绕开 Bun package-script wrapper？
- 为什么每个独立 profile 的一次 provider 尝试且 `usageKnown=false` 都不能被记为 zero-call、零成本或模型验收通过？
- 为什么 v1--v5 的不可变 snapshot 与 V6 私有 provisional/seal 都需要同时存在？
- 为什么 V6 的一次 `usage_unverifiable` provider attempt 既不是 zero-call，也不能推导实际费用或模型质量？
