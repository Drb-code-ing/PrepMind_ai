# Phase 6.9.5 Review / Planner 真实模型诊断与项目内启用验收

## 目标与边界

本阶段只为 `ReviewAgent` 与 `PlannerAgent` 建立受控的真实模型只读建议路径。模型只能在当前确定性快照中选择弱点索引、计划块顺序和受限策略枚举；JWT owner、学习事实、FSRS、分钟数、链接、任务创建与任何写入操作始终由 Nest 服务和本地 merger 掌握。

默认生产状态保持关闭：`REVIEW_AGENT_MODEL_ENABLED=false`、`PLANNER_AGENT_MODEL_ENABLED=false`，两个 timeout 默认均为 `4500ms`。全局 Live 双开关、对应组件 gate、安全 HTTPS provider 配置、匹配凭据和预算均是必要条件；任一缺失、超时、schema 无效、预算耗尽或 telemetry 不可验证时，只返回确定性建议。

本记录不把 Mock、静态检查、Docker 配置解析或浏览器页面当作真实模型质量证据。

## 2026-07-18 V8 最终离线 checkpoint

V8 completion 与 durable product acceptance runner 已完成离线实现，当前实现 checkpoint 为 `faa97a8`。本轮没有读取或调用 provider，没有创建 V8 evidence/once marker，没有启动 Docker 产品验收或可见浏览器；`REVIEW_AGENT_MODEL_ENABLED=false`、`PLANNER_AGENT_MODEL_ENABLED=false` 和 product acceptance 默认关闭保持不变。

已实现的闭环包括：V1--V7 immutable snapshot、15-stage durable evidence、one-shot DeepSeek V4 Pro non-thinking CLI、server-only capability admission、branch/main durable slot/usage ledger、recovery owner lock、Docker server identity/health attestation、owner-scoped Prisma facts、authenticated API、headed Chrome 精确 profile、Trace/只读事实/owner isolation、default-off restore 与精确 cleanup。浏览器终止只匹配精确 executable、PID、完整 command line 和 branch/main `profile-v8`；删除超时会取消受控子进程并等待删除 promise settle，不会留下旧 `fs.rm` 在重试后继续删除新 profile。

| 离线门 | 结果 |
| --- | --- |
| Server 全量 | `1265 passed / 30 skipped / 0 failed` |
| Review E2E | `3/3 passed` |
| Web | `409/409 passed` |
| Windows durable I/O / V8 evidence / product ledger native | 全部 exit 0 |
| Agent / AI / shared types | 测试或 typecheck 全部 exit 0 |
| Server/Web lint 与 build | 全部 exit 0 |
| Compose / diff | `config --quiet` 与 `git diff --check` exit 0 |
| 独立复审 | contract/security 与 acceptance/operations 均无未关闭 Critical/Important |

最终 operations 复审曾发现实际 `acceptance.json` 使用 ledger 私有简化 schema，正式 schema 只被单测引用。按 TDD 增加 fresh ledger 集成 RED 后，normal finalize、preseal 与 fresh complete reader 已统一为 exported official strict schema/serializer；修复后 product ledger native `55/55`、相关 Jest `138/138`、targeted lint、Server build 与 diff check 均通过。该 checkpoint 只证明工程入口、权限、预算、durability、失败关闭和产品 runner 可执行；不证明真实模型质量、实际 token/成本、`candidate_applied`、Docker 产品可用性或 Phase 6.9.5 已完成。下一步只能执行唯一 V8 controlled-Live；只有 public reader 返回完整 committed success，才可继续 branch 产品验收。

## 历史 2026-07-16 Task 6 无凭据门

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

## 历史 2026-07-16 新鲜 Mock 证据

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

## 历史 Task 7：四个隔离的 controlled-Live 诊断（均已关闭）

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

## 2026-07-17 V7 usage parity 全量离线验收

V7 是独立 usage-parity recovery，不是 V6 retry，也没有改写 V6 的 `usage_unverifiable` 历史事实。Task 1--6 已在严格零网络边界内完成：

- V6 把 `estimatedInputTokens=96` 误作 provider actual input 上限的问题由离线 `97/4` fixture 稳定复现并修复；V7 接受正安全 actual input `97`，仍限制单次 output、整轮 input/output reservation、最多 23 attempts 与 CNY 1.00 hard cap。
- DeepSeek V4 Pro non-thinking raw response audit 在 callback 前 strict clone/freeze，只记录 `missing / invalid / positive` usage shape；不保存 token 数值、response、reasoning text、URL、header、credential 或 raw error。
- V7 evidence 使用独立 `reserved / attempted / finalized` lifecycle。V1--V6 historical integrity-v3 snapshot 当前为 `18 entries`，aggregate tree hash `9f8cc9a7d5ba83d630fa5806f19aaa74066352de92bb04631813c17feaa230ba`；V6 marker SHA-256 为 `ac04ea11c4e416e44bd870c158a6bff0d65db297262ab6610790cf355525ec31`，V6 JSON SHA-256 为 `4fb435824785af4b2601b83787b22a4b98de1ac47d222f2566e351960bfd1afb`。
- one-shot CLI 只接受 `--confirm-controlled-live-v7-deepseek-v4-pro-usage-parity`。确认、preflight、historical snapshot、reservation、mark attempted、executor、canary、paired eval 与 final seal 的顺序均有 injected-only 回归；本轮没有执行该 package script。
- production parity 只公开冻结的 `provider/model/baseUrlIdentity/structuredOutputMode/timeoutMs/schemaId`，不公开实际 URL、key、pricing、executor 或写权限。V7 eval gate 未进入 Docker、Web、worker 或 server config allowlist；两个产品 gate 缺失或为 `false` 时 executor 构造为 0。
- direct Mock report 固定为 `mock_quality_not_evidence`；strict-fake evaluator 的 live-shaped contract 外层固定为 `mock_quality_not_live_evidence`。两条离线证据均为 48 cases、26 verified zero-call、22 runtime、48 strict、48 quality、0 critical；任何一条都不是 provider quality evidence。

| 离线 gate | 已观察结果 |
| --- | --- |
| focused AI transport | 190 passed / 0 failed |
| focused Server V7 factory/evidence/CLI/config/runtime | 86 passed / 0 failed |
| Windows native V7 evidence | 15 passed / 0 failed / 130 assertions |
| full AI / Agent | 190 / 406 passed |
| full Server | 980 passed / 30 skipped / 0 failed |
| full Web | 409 passed / 0 failed |
| typecheck / lint / build | AI、types、Server、Web 对应命令均 exit 0 |
| Compose / diff | `docker compose ... config --quiet`、`git diff --check` 均 exit 0 |

Task 6 当时的 Compose 只执行静态 `config --quiet`，没有运行 `up`、`build`、`down`，也没有输出渲染后的配置；当时尚无 V7 marker/evidence 或 provider 调用。这是历史离线记录，最新 Live 终态见下文。

当时唯一允许的结论是：`V7 offline engineering ready; controlled-Live not run and not authorized.` Task 7 两轮离线复审随后通过；用户于 2026-07-18 授权唯一 V7 Live，其终态见下文。

### V7 Task 7 两轮离线复审与通过标准

第一轮是 contract/security review：逐项检查 preview/actual 分离、raw/runtime usage 映射、不可变预算、单次 output/整轮 reservation/CNY cap、one-fetch/no-retry、凭据与正文不泄露、V1--V6 byte protection、marker race、只读权限和 default-off 产品 gate。发现任何 defect，必须先写失败回归，再修复并独立提交；存在未关闭的 Critical 或 Important 即不通过。

第二轮是 acceptance/operations review：从精确 confirmation 开始独立追踪到 terminal seal，确认只有显式 V7 CLI 能触发；默认环境、普通 script、Docker service、Web、worker 和产品 API 都不能调用 V7。还要确认 `mock_quality_not_live_evidence` 不能被解释为 provider evidence，任一 failed evidence 都没有 token/cost 数值。两轮必须由独立审查视角完成，且最终无未关闭 Critical/Important。

Task 7 当时计划在复审后固定运行 AI、Agent、五个 focused Server V7 specs、native evidence、`git diff --check` 和 `git status --short`。所有命令必须 exit 0；提交前 status 只能包含审查实际产生的 deliberate docs/回归修复。该离线任务当时要求提交后停止并请求单独 Live 授权；后续唯一 V7 Live 终态见下文 2026-07-18 记录。完整命令见 `docs/superpowers/plans/2026-07-17-phase-6-9-5-deepseek-v4-pro-usage-recovery-v7.md` Task 7。

### Task 7 实际复审结果与 success seal

两轮独立复审最终均为 PASS，Critical/Important/Minor 均为 0。第一轮曾发现 terminal replacement 后没有 fresh V1--V6 复核；按 TDD 增加回归后，第二轮又发现“历史漂移 + downgrade replacement 写失败”可能留下可误读的 complete JSON。最终采用 hash-bound、history-bound success seal：

- 成功记录先以私有 `success_candidate` 存在，standalone JSON 不属于公开 finalized schema，不是成功证据。
- 25ms 单次 quiescence 后 fresh 验证 V1--V6，只有候选字节、leaf、SHA-256、nonce commitment 和 historical tree hash 一致时，才 exclusive-create 无 token/cost 的 success marker。
- 唯一公开 reader 每次重新复核 once marker、candidate、success marker 和 fresh V1--V6 tree；任一缺失、伪造、hash/tree/commitment 不匹配、reparse、seal 创建失败或 downgrade 写失败都只投影 `finalized / invalid_attempted / closed / evidence_io`，不返回 candidate 的 token/cost。
- success seal 只 exclusive-create 一次，没有 provider/file retry loop；私有 WeakMap capability 未扩大 reservation、CLI、Docker、Web、worker、API 或产品 gate 权限。

修复后 evidence Jest 为 `5/5`，Windows native evidence 为 `15/15 / 130 assertions`；第二轮还独立复核 evidence + CLI Jest `25/25`、targeted ESLint、Server build 与 diff check。当时真实 V7 evidence 目录仍不存在，未运行 V7 package、Live、Docker 或浏览器；这项历史离线状态已由下文 2026-07-18 唯一 Live 终态替代。

## 2026-07-18 V7 唯一 controlled-Live 终态

用户明确同意继续后，本轮将授权严格限定为唯一 V7 controlled-Live，不启用 `REVIEW_AGENT_MODEL_ENABLED` 或 `PLANNER_AGENT_MODEL_ENABLED`。根 Bun 入口仅在当前子进程显式设置 eval/live gate，从根 `.env` 自动加载但不输出 DeepSeek key。

运行前零网络 preflight 为 `ok=true`，composition identity 为 `deepseek / deepseek-v4-pro / deepseek-v1 / deepseek_v4_pro_nonthinking_json / 4500ms / review-model-candidate-v1`；V1--V6 snapshot 为 `18 entries / 9f8cc9a7d5ba83d630fa5806f19aaa74066352de92bb04631813c17feaa230ba`，V7 目录不存在。唯一命令耗时约 49.7s，退出码 1，安全 stdout 为：

```text
status=invalid_attempted
gate=closed
providerAttemptCount=23
usageKnown=false
diagnosticCode=evidence_io
```

持久化目录只包含：

- `.review-planner-controlled-live-v7-deepseek-v4-pro-usage-parity.once`：84 bytes，SHA-256 `1920c68d8fd10d77af1cf63731e46ed8e9c02270093a024302b24eb97fa85bda`。
- `review-planner-live-20260717T161356046Z-e26f821fdc46.json`：245 bytes，SHA-256 `79c07fed05a011a6344e7df3aecd9c616824c6a7cd07873693f3ddfaab1a63ba`，public reader 与原始 strict record 均为 `finalized / invalid_attempted / closed / 23 / false / evidence_io`。

目录没有 success seal，JSON 没有 aggregate input/output token、cost 或质量 counters。运行后 V1--V6 snapshot 仍是同一 18-entry tree hash。因此 23 attempts 只证明 provider 尝试次数已被安全观察，不证明 22 个 paired case 通过、不证明语义质量、P95、usage/cost 或账单。

两条独立只读追踪把最窄可证边界收敛为：全部 23 个允许的 provider attempts 被安全计数后，paired-result/orchestration failure 或 evidence finalization/history I/O failure 被折叠为 `evidence_io`。当前磁盘形态可以排除 committed success、纯 success-seal create failure、preflight/canary 前失败与 `success_candidate` 的 downgrade-write failure；但 `evidence_io` 是故意有损的安全投影，不能唯一区分：

1. CLI `finish()` final history verify 瞬时读取失败；
2. finalizer internal history verify 或 terminal replacement I/O 失败；
3. `success_candidate` 后 post-terminal verify 瞬时失败且 downgrade 成功；
4. 低可能的 paired-result/CLI unexpected throw，或原有 paired failure 随后被 finalization I/O 收紧。

按设计，V7 once marker 已消费并不可重跑，不得删除、重命名、重建或从候选数据推导 success。因为 terminal gate 未通过，本轮停止 Docker/API/可见浏览器/Trace、main 合并与 push；两个产品 gate 继续为 `false`。

### 历史 V7 complete 门与新 lineage 产品验收边界

V7 运行前冻结的 complete 门是：48 cases、26 verified zero-call、22 runtime、48 strict success、48 quality pass、0 critical、semantic quality rate 至少 90%、P95 不高于 4500ms、provider attempts 恰好 23、正安全 usage 且总 input/output 不超过 `42_996 / 9_712` reservation、按固定价格计算的 observed cost 不高于 CNY 1.00；安全、权限、schema、history 或 terminal seal 任一失败都关闭。V7 实际终态没有满足或证明这些门，且 once marker 已消费，因此这段只保留为历史 contract，不是再次运行 V7 的授权入口。

未来只能先为新 lineage 完成零网络 stage-diagnostic 设计、TDD 与独立复审，再取得新的明确 Live 授权，并按新 lineage 冻结的质量、安全、权限、延迟、usage/cost 与 evidence 门执行。即使新 lineage complete，也不自动开启产品 gate。Docker/API/可见浏览器/Trace 验收必须覆盖 Review 与 Planner 两个组件，但 gate 独立且一次只临时开启一个：先验证对应 owner-scoped suggestions、candidate/fallback、Trace 和只读边界，随即恢复该 gate 为 `false`，再验另一个组件。任一组件未通过就保持该组件关闭。两者均通过并精确清理合成数据后，才可合并 main；main 仍需复验，再推送远程。

## 当前结论与未执行项

- 已完成：v1--v6 独立关闭证据留档；V7 Task 1--7 的 usage parity、safe audit、factory、evidence、CLI、composition parity、success seal、全量离线 gate、两轮独立复审与文档同步。
- 已执行且终态关闭：V7 唯一 controlled-Live，结果为 `23 / false / evidence_io`，不可重跑且无真实 provider quality decision。未执行 Docker authenticated suggestions/plan、可见浏览器、Trace、合成数据清理、main 复验和远程推送。
- 当前没有真实模型质量通过结论、没有项目内 `candidate_applied` 验收，也没有可开启任一 Review/Planner 业务 gate 的授权。`REVIEW_AGENT_MODEL_ENABLED` 与 `PLANNER_AGENT_MODEL_ENABLED` 继续保持默认 `false`。
- v1--v7 都是独立且不可重跑的 terminal profile。V7 once marker 已消费，当前不存在可继续的 V7 产品验收路径；必须先单独设计新 lineage 的安全 stage diagnostics，不得重跑或改写 V7。

## 回顾入口

- 为什么 Review/Planner 的模型只能选择索引和枚举，不能生成分钟数或写入任务？
- 为什么 48/48 Mock strict success 仍然不能称为 Live passed？
- 为什么 worker readiness 的 CLI 回归要绕开 Bun package-script wrapper？
- 为什么每个独立 profile 的一次 provider 尝试且 `usageKnown=false` 都不能被记为 zero-call、零成本或模型验收通过？
- 为什么 v1--v5 的不可变 snapshot 与 V6 私有 provisional/seal 都需要同时存在？
- 为什么 V6 的一次 `usage_unverifiable` provider attempt 既不是 zero-call，也不能推导实际费用或模型质量？
- 为什么 V7 的 `97/4` 离线通过只能修复 validator，不能改写 V6 历史 provider 事实？
- 为什么 strict-fake evaluator 的 live-shaped report 必须再包一层 `mock_quality_not_live_evidence`？
- 为什么 V7 offline engineering ready 当时仍不构成 Live 授权，而 2026-07-18 消耗唯一授权并终态关闭后不能继续 V7 产品验收？
