# PrepMind AI 开发日志
> 2026-07-20 — Phase 6.9.5 Review/Planner 分支生产验收收口：V22 的唯一 branch product 因把 API aggregate duration 与 Trace candidate-step duration 做精确相等比较而终止，唯一 recovery 已封存为 `recovered`。修复仅解除该独立计时耦合，仍严格校验 provider/model、candidate state、正 duration、step topology 与双向 usage。随后在用户授权下完成一次独立 DeepSeek V4 Pro Docker API 与可见 `/plan` 验收：API 为 Review `candidate_applied / 945ms / 225+7`、Planner `candidate_applied / 732ms / 222+8`；浏览器为 Review `1329ms / 225+7`、Planner `839ms / 222+8`，页面实际渲染“Agent 学习建议”。Docker server 已恢复 `REVIEW_AGENT_MODEL_ENABLED=false`、`PLANNER_AGENT_MODEL_ENABLED=false`、`AI_ENABLE_LIVE_CALLS=false`；合成账户与 Trace 清理复核为 `0/0`。下一步必须先提交并复验分支，再 `--no-ff` 合并到 `main`；只在 `main` 的 HEAD 上进行 default-off replay、复核和推送，才可标记阶段最终完成。完整证据见 `docs/acceptance/2026-07-20-phase-6-9-5-review-planner-production.md`。

> 2026-07-20 — V21 最小运行时切换：V20 `preflightOnly` 已通过，但唯一 product 在真实 `acquireOwner` 前安全关闭。根因是 owner/ledger 的 Windows reparse-safe I/O 依赖 `bun:ffi`，Node runner 不能执行它。V21 仅将受控 product/recovery/preflight lifecycle 改为 Bun 直接执行，保留 profile、确认、权限、预算、default-off、清理和 V10 authority 的既有边界；V21 product/recovery、Docker、浏览器、API 与 provider 尚未运行，gate 仍 false。

> 2026-07-20 — V20 离线收口：V19 的只读 Node preflight 已返回 `ready`，证明 runner/parser/default host 可执行；但其唯一 branch product 仍在 owner 前返回固定 `default_off`，没有 owner、ledger、Docker、浏览器、API、provider、合成资源或三类 roots，故不可重跑且 recovery 不适用。V20 建立独立 namespace，并在 public product execute 内增加 `preflightOnly`：它保留真实 confirmation/default ports/default host，只把 owner 固定为 `owner_active`，因而在 reservation 前零资源验证 exact execute path。V20 product/recovery、Docker、浏览器、API 与 provider 均未运行，两个 gate 继续 false。详见 `docs/acceptance/phase-6-9-5-review-planner-v19-closure-v20-plan.md` 与 `docs/superpowers/specs/2026-07-20-phase-6-9-5-v20-product-lineage-design.md`。

> 2026-07-20 — V19 离线收口：V18 的唯一 branch product 在 owner 前返回固定 `default_off`，没有 owner、ledger、Docker、浏览器、API、provider、合成资源或三类 roots，故不可重跑且 recovery 不适用。argv probe 已确认严格 confirmation 与 environment 两参数正确；差异仍是 Node-runner product preflight 与直接 Bun host `ready` 的运行时 parity，不能猜测后再消耗新 product。V19 建立独立 namespace，并新增只读 `preflight:review-planner:v19:product`：它使用同一 Node runner、严格 parser 与 root-bound default host，却在 owner 前停止且不创建资源。V19 product/recovery、Docker、浏览器、API 与 provider 均未运行，两个 gate 继续 false。详见 `docs/acceptance/phase-6-9-5-review-planner-v18-closure-v19-plan.md` 与 `docs/superpowers/specs/2026-07-20-phase-6-9-5-v19-product-lineage-design.md`。

> 2026-07-20 — V18 离线收口：V17 的唯一 package command 在确认 parser 前停止，根因是 Bun 将标准首位 `--` 原样转发，而 V17 parser 正确地只接受 confirmation 与 environment 两个参数。V17 没有 owner、ledger、Docker、浏览器、API、provider、合成资源或三类 roots，仍作为不可重跑、不可恢复历史封存。V18 建立新的 confirmation、schema、ledger/recovery/execution/browser/public-evidence namespace，保留 V17 的 CWD、allowlist、resolver 和只读 V10-authority bridge；唯一变化是在 allowlisted entry 后最多剥离一个 separator，其他参数仍严格 fail-closed。V18 product/recovery、Docker、浏览器、API 与 provider 均未运行，两个 gate 继续 false。详见 `docs/acceptance/phase-6-9-5-review-planner-v17-closure-v18-plan.md` 与 `docs/superpowers/specs/2026-07-20-phase-6-9-5-v18-product-lineage-design.md`。

> 2026-07-20 — V17 preflight 关闭：唯一 V17 branch package command 返回固定 `default_off`，没有 owner、ledger、Docker mutation、浏览器、API、provider 或合成资源，public/recovery/execution roots 均为空，故不可重跑且 recovery 不适用。直接 Node host preflight 已返回 `ready`；后续确定 command-only 差异为 Bun separator forwarding，严格 parser 从未收到有效的两参数确认，故以 V18 新 lineage 处理，不能据此宣告 Phase 6.9.5 完成、合并 main 或 push。两个 gate 继续 false。

> 2026-07-20 — V17 离线收口：V16 唯一 branch command 在 root-absent preflight 安全停止，未创建 owner、ledger、Docker mutation、浏览器、API、provider 或合成资源，故不得重跑或 recovery。根因不是 default-off：V16 Node runner 从 `apps/server` CWD 启动，而 V10 immutable authority 受设计保护使用默认 `process.cwd()`，从错误目录读不到 evidence。V17 建立全新 namespace，并在加载两个精确 allowlisted entry 前切换并复核仓库根；既有 source roots、两个 bridge、resolver boundary 不放宽。它继承 V16 的受限 URL/model receipt 与 recovery boundary，V11--V16 sentinel 不变。此时 V17 gate=false，尚未运行 product/recovery、Docker、浏览器、API 或 provider。详见 `docs/superpowers/specs/2026-07-20-phase-6-9-5-v17-product-lineage-design.md` 与 `docs/acceptance/phase-6-9-5-review-planner-v16-closure-v17-plan.md`。

> 2026-07-20 — V16 离线收口：V15 的唯一 branch command 在 `default_off` preflight 安全停止，未创建 owner、ledger、Docker mutation、浏览器、API、provider 或合成资源，三类 V15 root 均为空，故不得重跑或 recovery。根因是普通 Compose 的安全官方 URL `https://api.deepseek.com/v1` 与 V15 receipt 固定根 URL 不匹配。V16 建立全新 confirmation、Node runner、ledger/recovery/execution/browser namespace，并只允许官方根 URL或 `/v1`、Flash/Pro；mock、live、两 gate、credential、capability、max-request 与重复受控键仍严格 fail-closed。default-off receipt 持久重读 `baseUrl`/`model`，V16 recovery 显式注入自己的 validator，V11--V15 sentinel 保持不变。此时尚未运行 V16 product/recovery、Docker、浏览器、API 或 provider，两个 gate 继续 false。详见 `docs/superpowers/specs/2026-07-20-phase-6-9-5-v16-product-lineage-design.md` 与 `docs/acceptance/phase-6-9-5-review-planner-v15-closure-v16-plan.md`。

> 2026-07-20 — V15 离线收口：V14 已在 root-absent `default_off` preflight 封存，绝不重跑。其根因是普通 Compose Chat 安全地使用 `deepseek-v4-flash`，而旧 receipt 错将 `deepseek-v4-pro` 固定为关闭态前提。修复只允许 Flash/Pro 两个明确模型值；`mock`、live=false、两 gate=false、空 credential/capability、maxRequests=0 仍逐项严格校验，受控 Docker 环境键重复也 fail-closed。V15 以独立 confirmation、Node runner、ledger/recovery/execution/browser roots 与 V11--V14 native sentinel 建立；reservation 后、diagnostics 前发生异常时，仅在可证明零资源、零 checkpoint 的情况下回滚，否则保持 `failed` fail-closed。此时尚未运行 V15 product/recovery、Docker、浏览器、API 或 provider，两个 gate 仍为 false。详细边界见 `docs/superpowers/specs/2026-07-20-phase-6-9-5-v15-product-lineage-design.md` 与 `docs/acceptance/phase-6-9-5-review-planner-v14-closure-v15-plan.md`。

> 2026-07-20 — V14 preflight 关闭：在 `b808d97` 离线收口与 Docker mock/default-off 复验后，唯一 V14 branch CLI 返回固定 `default_off`，未进入 owner、ledger、Docker mutation、浏览器、API、provider 或合成资源；public/recovery/execution roots 均仍不存在，故没有 recovery-admissible terminal。根因是历史 V8 strict default-off receipt 将 `AI_MODEL=deepseek-v4-pro` 作为关闭态前置条件，而普通 Compose server 保留 Chat 的 `deepseek-v4-flash`；live/gate/credential 均保持关闭。V14 不得重试，必须由用户在修复 strict default-off contract 并建立新 lineage或其他路线之间作出新决定。详见 `docs/acceptance/phase-6-9-5-review-planner-v14-preflight-blocked.md`。

> 2026-07-20 — 当前更正（二）：V13 唯一 branch product 在只写入 reservation 后被 Bun 1.3.14 segmentation fault 中断；未产生 execution manifest、checkpoint、failure terminal、Docker/API/browser/provider 或合成资源，且 default-off 已复验，因此 V13 不可重试也不满足 recovery preflight。V14 已使用新 root 建立独立 lineage，并用 native sentinel 证明不写 V11/V12/V13。V14 的唯一 host 命令由 Node CommonJS TypeScript runner 执行：仅 allowlist 两个 V14 入口，并在内存转译 canonical path 位于 scripts/review-agent approved roots 或两个精确 workspace bridge（`packages/database/src/index.ts`、`packages/agent/src/review-planner-diagnostics.ts`）的相对依赖；V7/V8/V9 evidence 已改为 diagnostics subpath，避免加载 Agent barrel，保留每个模块原始 `__dirname`，不生成 bundle；继承/未知入口、越界依赖和 bootstrap 失败都只输出固定 `default_off`，以绕开已观察的 Bun host-process crash；详细边界见 `docs/acceptance/phase-6-9-5-review-planner-v13-closure-v14-plan.md`。

> 2026-07-20 — 当前更正：V12 已消费唯一 branch product，因 `review_api_trace_canonicalize` 的 Trace 总耗时/候选步骤耗时错误关联而安全终止，随后已完成唯一 recovery；V12 永久封存为 `recovered`，不得重跑或改写证据。根因已由生产 DTO 回归测试修复，V13 已建立完全独立的 confirmation、ledger/recovery/execution/browser namespace，并已证明不写 V11/V12 根。V13 尚未运行 Docker、浏览器、API 或 provider，两个业务 gate 继续为 `false`；下一步是在最终静态与镜像门禁后执行唯一 V13 branch product。详见 `docs/acceptance/phase-6-9-5-review-planner-v12-closure-v13-plan.md` 与 `docs/superpowers/specs/2026-07-20-phase-6-9-5-v13-product-lineage-design.md`。本条替代下方 V12 离线 checkpoint 的“尚未执行”当前态描述，保留其作为执行前历史记录。

> 2026-07-20 — Phase 6.9.5 V12 已完成离线 checkpoint：独立 profile、four-slot durable ledger、attempt binding、最早安全 recovery、V8 adapter 和真实 default-off host boundary 已就位；V11 public/recovery root 的 native SHA sentinel 保持不变。此 checkpoint 没有执行 V12 product/recovery CLI、Docker、浏览器、API 或 provider；V12 roots 为空，两个 Review/Planner gate 继续为 `false`。V10 仍是唯一语义质量 authority，V11 仍是不可复用的 `operation_failed / recovery-only` 历史。两项相互独立的 contract/operations review 已无未关闭 P0/P1；下一步仍须一次新的单独用户授权，才可运行唯一 V12 branch product。完整记录见 `docs/acceptance/phase-6-9-5-review-planner-v12-offline-checkpoint.md`。

> 2026-07-20 — V11 branch product 已封存为 `operation_failed / recovery-only`：安全终态停在 `review_api_activate / not_started`，未到 provider 调用。首 checkpoint 前的严格 attempt state 曾被 recovery preflight 误拒；`cfd15b1` 只修复该 recoverability 缺口，随后一次有效 recovery 完成，server 已验证回到 mock/default-off、两个 gate=false、容器无 DeepSeek key。V11 不重跑、不进 main；下一次产品验收必须使用独立 lineage。完整记录见 `docs/acceptance/phase-6-9-5-review-planner-v11-product-recovery.md`。

> 2026-07-20 — Phase 6.9.5 V11 execution bridge 已完成离线 checkpoint：V10 controlled-Live 仍是唯一语义质量权威，V10 product terminal 仍为 recovery-only。V11 CLI、私有 manifest、success ledger、默认关闭与精确 recovery selector 已就位；未执行 V11 Docker、浏览器或真实模型，产品 gate 继续为 `false`。

> 2026-07-20 — 对齐遗留 Review/Planner server 测试 fixture 与 index-only candidate contract：只更新 V1/V4/V6/V7 controlled-eval 和 service mock 输出及过时负例，未改生产、Agent、AI 或 V11 行为；该修复恢复全量 server 静态门禁，不产生新的 Live/Docker/browser 证据。

> 2026-07-20 — 修正 V11 branch product preflight 对安全默认 Chat 配置的误拦截：仅在 `mock/default-off` 且所有 gate、密钥与产品能力均关闭时，允许当前 Chat 的 `deepseek-v4-flash`（并保留恢复目标 `deepseek-v4-pro`）；V8/V10 恢复与 activation 断言未放宽，尚未执行 V11 runtime。

> 2026-07-20 — 收紧 V11 product runtime 的密钥边界：server Compose 不再持久映射根 `DEEPSEEK_API_KEY`，只在受控 activation 期间由内存中的 root key 注入一次性产品变量；default-off 与 cleanup 均显式清空。常规 Docker server Chat 继续 mock 默认，worker/web 和 OpenAI 路径未改，未执行 V11 runtime。

> 2026-07-20 — 修正 V11 owner-held revalidation 的 self-lock 误拦截：初始 preflight 仍要求 public/recovery/execution 三根为空；仅同一活跃 product owner 的 revalidate 可见并验证 recovery 根中唯一的 `owner.lock`。任何额外 recovery leaf、public/execution 内容、伪造/关闭/跨环境 owner 都 fail-closed，未执行 V11 runtime。

> 维护规则：`DEVLOG.md` 记录阶段级里程碑、关键工程决策和验收结果，不写逐提交流水账。每个关键阶段必须保留“目标 / 为什么 / 主要内容 / 边界 / 验收 / 回顾时可以问”，方便接手、复盘和面试表达。精简只压缩重复和噪声，不能删掉理解项目所需的动机、关键步骤和决策依据。完整路线看 `docs/roadmap.md`，当前数据边界看 `docs/data-flow.md`，面试复盘看 `docs/blogs/`，具体实现追溯看 `git log`。

## 当前快照

更新时间：2026-07-20

当前阶段：Phase 7 工程化已经完成；Phase 6.9.4.4 已完成 Router/Verifier 混合模型生产验收并恢复默认关闭。Phase 6.9.5 已完成分支验收：V10 仍是唯一语义质量 authority，V22 的 `operation_failed -> recovered` 历史不可重跑，修复后的一次独立 DeepSeek V4 Pro Docker API/可见 `/plan` 验收确认 Review/Planner 均能 `candidate_applied`。默认产品开关已恢复 false，合成账户与 Trace 已精确清理。下一步是提交/复验分支、`--no-ff` 合并 main；只在 main 上 default-off replay、复核和推送，完成后才进入 Phase 6.9.6。

| 阶段         | 状态   | 关键词                                                                                       |
| ------------ | ------ | -------------------------------------------------------------------------------------------- |
| Phase 0      | 已完成 | Monorepo、Prisma 初稿、Docker 基础设施                                                       |
| Phase 1      | 已完成 | 前端 MVP、AI 聊天、OCR、错题本、Dexie                                                        |
| Phase 2      | 已完成 | NestJS、Auth、PostgreSQL、业务 API 迁移、MinIO                                               |
| Phase 3      | 已完成 | OCR structured output、讲题 prompt、多题保存                                                 |
| Phase 4      | 已完成 | FSRS、ReviewTask、离线评分、学习统计、复习计划                                               |
| Phase 5      | 已完成 | RAG 数据模型、文档处理、检索、Chat RAG、`/knowledge`                                         |
| Phase 6      | 补强中 | 多 Agent 基础、Trace 与业务 policy 已落地；真实模型 Agent、通信、权限、Orchestrator 与可执行 LangGraph 继续推进 |
| Phase 6.9.1  | 已完成 | Agent eval contract、32 个 seed cases、deterministic baseline、paired eval 模板              |
| Phase 6.9.2  | 已完成 | 共享 ModelAgentRuntime、结构化 Mock/Live contract、预算、超时取消、脱敏 Trace                |
| Phase 6.9.3.1 | 已完成 | ConversationSummary / ConversationState strict contract 与 PostgreSQL/Prisma 地基         |
| Phase 6.9.3.2 | 已完成 | ConversationState、Redis 降级缓存、prepare API 与 Chat history state 恢复                 |
| Phase 6.9.3.3 | 已完成 | 12 条/70% 滚动摘要、ModelAgentRuntime、凭据防护、source hash 与 CAS                       |
| Phase 6.9.3.4 | 已完成 | conversationId/prepare 编排、分层 assembler、Dexie v9 sanitized state、安全 headers/Trace |
| Phase 6.9.3.5 | 已完成 | Docker Mock/Live、DeepSeek JSON structured output、Trace 分层 token、清理与阶段证据      |
| Phase 6.9.5  | 分支验收完成 | V10 语义质量 authority、V22 recovered 历史、独立真实模型 Docker API/浏览器验收、default-off 恢复与合成数据清理；待 main replay |
| Phase 7.0    | 已完成 | BackgroundJob 控制面                                                                         |
| Phase 7.1    | 已完成 | BullMQ 文档处理队列、inline / queue 双模式                                                   |
| Phase 7.2    | 已完成 | RAG SafetyGuard、prompt injection chunk 过滤                                                 |
| Phase 7.3    | 已完成 | EventBus 失败隔离、后台任务 summary、`/knowledge` 任务摘要                                   |
| Phase 7.4    | 已完成 | Swagger / OpenAPI debug docs、`/api-docs`、response envelope                                 |
| Phase 7.5    | 已完成 | Swagger 中文说明、核心写接口 request body 示例                                               |
| Phase 7.6    | 已完成 | API / worker 启动拆分、worker-only application context                                       |
| Phase 7.7    | 已完成 | Worker Observability、Redis heartbeat、队列 backlog                                          |
| Phase 7.8.1  | 已完成 | RAG Eval Baseline、固定评估集、recall / top1 / safety 指标                                   |
| Phase 7.8.2  | 已完成 | Hybrid Retrieval、向量候选 + PostgreSQL full-text 融合排序                                   |
| Phase 7.8.3  | 已完成 | RAG Eval Smoke、本地 API 级上传/处理/检索/eval 串联                                          |
| Phase 7.8.4  | 已完成 | RAG Eval Smoke 收尾增强、case guard、keep-data 开关                                          |
| Phase 7.9.1  | 已完成 | Durable Outbox 地基、claim / retry / dead-letter 状态机                                      |
| Phase 7.9.2  | 已完成 | Outbox Dispatcher 最小闭环、handler registry                                                 |
| Phase 7.9.3  | 已完成 | Outbox Dispatcher worker-only 受控运行、防重入 tick                                          |
| Phase 7.9.4  | 已完成 | Outbox Summary / Metrics、worker observability 只读指标                                      |
| Phase 7.10   | 已完成 | Outbox Ops 后端闭环、脱敏列表/详情、安全 requeue                                             |
| Phase 7.11   | 已完成 | Worker Readiness、`/worker-readiness`、部署前 CLI                                            |
| Phase 7.12   | 已完成 | Docker worker healthcheck、容器级 readiness                                                  |
| Phase 7.13   | 已完成 | Docker Web 镜像、Next standalone、全栈 Compose 验收                                          |
| Phase 7.14.1 | 已完成 | Operator 权限与操作审计设计文档                                                              |
| Phase 7.14.2 | 已完成 | OperatorGuard、系统级诊断入口 admin-only                                                     |
| Phase 7.14.3 | 已完成 | `OperatorAuditLog`、审计 service、脱敏 metadata 与来源 hash                                  |
| Phase 7.14.4 | 已完成 | Outbox requeue 成功/失败审计接入                                                             |
| Phase 7.14.5 | 已完成 | `GET /operator-audit-logs`、admin-only 脱敏审计查询 API                                      |
| Phase 7.14.6 | 已完成 | `/operator-audit` 管理员审计台、ADMIN 侧边栏入口、脱敏列表筛选                               |
| Phase 7.15   | 已完成 | 管理员审计台真实运行验收、Docker dev 诊断开关、`127.0.0.1` hydration 修复                    |
| Phase 7.16   | 已完成 | 独立桌面端 Admin Console、Outbox Ops 操作页、审计/Worker 页面、学习端后台入口                |
| Phase 7.17   | 已完成 | Docker Admin Console service、`3100` 独立容器、全栈 Compose 验收                             |
| Phase 7.17.1 | 已完成 | 管理员后台返回学习端 host 对齐、loopback 登录态排障记录                                      |
| Phase 7.18   | 已完成 | Admin Outbox Ops 产品化、事件详情分区、requeue 后续验证                                      |
| Phase 7.19   | 已完成 | Admin Console 控制台数据化、真实运维总览、后台管理复盘博客                                   |
| Phase 7.20   | 已完成 | Operator Audit 详情闭环、审计详情双栏、脱敏详情 API                                          |
| Phase 7.21   | 已完成 | Admin Ops 交互收口、自定义筛选控件、Outbox requeue 原因必填                                  |
| Phase 7.22   | 已完成 | Docker Admin Ops 真实验收、普通用户 403 拦截、测试数据清理、后台 favicon 收口                |
| Phase 7.23.1 | 已完成 | 180 天审计保留、异步 ZIP 证据包、事务型 Outbox、fail-closed 下载审计设计                     |
| Phase 7.23.2 | 已完成 | strict export contract、Prisma export/maintenance 模型、ACCOUNT/SYSTEM job、生产关闭配置     |
| Phase 7.23.3 | 已完成 | Serializable 申请事务、strict audit、HMAC 指纹、Outbox-only BullMQ 投递                      |
| Phase 7.23.4 | 已完成 | 单并发 ZIP Worker、REPEATABLE READ、formula-safe CSV、lease/CAS、attempt-fenced MinIO        |
| Phase 7.23.5 | 已完成 | 小时级维护、24h/180d 清理、active-export 水位、stale repair、crash janitor、三队列 readiness |
| Phase 7.23.6 | 已完成 | 系统级 ADMIN 查询/详情、稳定游标、binary envelope bypass、strict 下载审计                    |
| Phase 7.23.7 | 已完成 | `/audit` tabs、证据包申请/查询/详情、幂等重试、authenticated Blob 下载、a11y                 |
| Phase 7.23.8 | 已完成 | API/Worker Docker 拓扑、下载/过期/清理 smoke、真实浏览器验收、面试博客                       |

## 近期关键记录

### 2026-07-19 - V10 branch product-acceptance terminal recovery

结果：V10 的唯一 branch product-acceptance ledger 在 `slot-01-review-api` durable claim 后、结果 leaf 之前以脱敏 `operation_failed` 终止。后续 recovery-only 已成功将 server 恢复为 mock/default-off，且用精确 selector 清理合成账号、fixture、Trace 与临时浏览器 profile；recovery 本身为 `0` provider invocation、`0` acceptance request、`0` browser continue。

边界：这是一条独立的 V10 product 终态，不是 V10 controlled-Live 失败，也不能重跑、reset、补写、重用或解释为 zero-call / zero-cost。原 runner 将 trace baseline、API dispatch、response schema、Trace 读取和 slot 写入统一折叠为 `operation_failed`，所以不能从此安全证据逆推原始根因。

下一步：先设计和实现新的 V11 product-acceptance lineage。它只增加 fixed failure checkpoint、component/slot 与保守 provider-call state，不落 prompt、response、raw error、credential、token、用户 facts 或单次 usage。在 Mock/fake 验证与复审通过前，两个 product gate 继续 default-off。完整证据见 `docs/acceptance/phase-6-9-5-review-planner-v10-product-acceptance-recovery.md`。

### 2026-07-19 - V10 product-acceptance 隔离 lineage

目标：在不重跑已通过的 V10 controlled-Live、也不改写 V8 `recovery_only` 历史的前提下，为后续 branch 产品验收建立独立的 V10 命名空间。

主要内容：新增不可变 profile，统一 V8/V10 的 public ledger 根目录、recovery 临时根目录、可见浏览器 profile 路径与 product/recovery 确认令牌；新增 V10 product/recovery CLI 与 package 命令。V10 branch 只读取已经封存的 V10 Live authority；V8 与 V10 使用不同 owner lock、ledger 与 recovery 目录，四请求上限、default-off 恢复、owner、ledger、recovery 与 cleanup 约束不变。两条 lineage 复用同一份严格 wire schema（数据语义没有变化），本次隔离的是运行和证据命名空间，不进行 schema migration。

验收边界：Windows native 测试先完成 V8 `recovery_only`，再成功获取 V10 owner 并预留 V10 branch ledger，证明旧终态不会授权、阻断或写入新 lineage。该提交不运行 Docker、浏览器、真实模型，不修改 `.env`、V8/V10 evidence，也不打开产品 gate。

回顾时可以问：为什么 V10 不能复用 V8 的 recovery-only ledger？V10 CLI 如何拒绝 V8 confirmation？新的 namespace 如何保留原有 cleanup/default-off 安全边界？

### 2026-07-19 - V8 branch product-acceptance recovered archive

结果：旧 V8 branch 产品验收先因遗漏 preflight 参数在 provider 前以 `0-call` 失败；随后首次实际分支尝试暴露 runner parse bug，并写入 recovery-only terminal。恢复过程没有新 provider 调用，cleanup 为零。

边界：该证据仅归档历史失败，既不是 V10 controlled-Live failure，也不能 reset、重用或扩展。旧 V8 evidence 保持只读，产品 gate 继续默认关闭；下一步必须建立新的隔离 V10 product-acceptance lineage，不能直接进入 Docker、浏览器、main 或 push。

### 2026-07-19 - Phase 6.9.5 V10 唯一 controlled-Live outcome

目标：在不扩大模型权限、不开启产品 gate 的前提下，验证只返回 `focusIndexes` / `blockOrder` 的 V10 真实模型路径。

结果：唯一 CLI exit `0`；public reader 五次 fresh read 均为 `complete / passed`。安全 aggregate 为 V10 v3，`23` provider attempts、`22` paired admissions、`48/48` strict/quality、critical `0`、P95 `1465ms`、usage `5764/232`、CNY `0.018684/1.00`；schema、quality、P95、usage、attempt、admission 与 cost 全通过。V1--V9 manifest 保持 `36` entries / `61a6e4a956784a59a8b8639d4c94d6fd870bce5dd8549a026abf02a0e7cb769d`。

边界：根 `.env` 未改，普通环境继续 mock/default-off；V10 evidence/success seal 已封存且不得改写、重跑、删除或拼接。两条产品 gate 仍为 `false`，没有运行 Docker、浏览器、main merge、replay 或 push。下一步是逐组件的分支 Docker/headed-browser 验收，结束后恢复默认关闭。完整证据见 `docs/acceptance/phase-6-9-5-review-planner-v10-offline-checkpoint.md`。

回顾时可以问：为什么 V10 的质量门只评价产品实际合并的两个字段？为什么 Live passed 后仍要保持产品 gate 关闭并单独做产品验收？

### 2026-07-19 - Phase 6.9.5 V10 offline checkpoint

目标：以最小修复让模型的可见 contract 与产品实际合并的 Review `focusIndexes` / Planner `blockOrder` 一致，同时不扩大模型权限。

边界：V9 仍是不可改写的 `quality_gate_failed` 历史。V10 还没有 evidence directory、once marker 或 success seal；产品 gate 均为 `false`，没有运行 Live、Docker、浏览器、main replay 或 push。V10 writer/reader 只发布 strict safe lane aggregate，拒绝 prompt、snapshot、model output、raw error、URL、credential、cookie、stack 和 per-case timing/usage。

验收：V10/V8/V9/composition Jest `266/266`、Agent `409/409` 与 typecheck、server lint/build、V10 native `3/3` 和 `git diff --check` 已通过；V1--V9 fresh manifest 为 `36` entries / `61a6e4a956784a59a8b8639d4c94d6fd870bce5dd8549a026abf02a0e7cb769d`。唯一 Live 仅可从根目录 `--env-file=.env` 注入凭据，在独立进程中开启 V10 eval gate 并显式关闭 V8/V9 eval 与两条产品 gate；固定 `deepseek-v4-pro`、JSON-object non-thinking、`4500ms`、`23/22` 和 CNY `1.00`。完整记录见 `docs/acceptance/phase-6-9-5-review-planner-v10-offline-checkpoint.md`。

回顾时可以问：为什么 V10 只评估产品真正使用的两个字段？为什么 V9 的质量失败不能用 V10 离线通过抵消？为什么 `.env` 只能用于命令注入而不能写入 gate？

### 2026-07-19 - Phase 6.9.5 V9 Task 1--5 离线 checkpoint

目标：在不改写 V1--V8、不运行新 provider 调用和不开启产品 gate 的前提下，为 V8 未形成 durable terminal aggregate 的缺口建立独立 V9 lineage，并让产品验收只依赖 V9 committed success。

为什么：V8 CLI stdout 的 23 attempts 没有形成可供产品 admission 使用的 durable success。继续读取 V8 provisional/public projection、拼接历史计数或用 `git show` 构造成功都会破坏 one-shot 与证据权威边界。V9 因此必须拥有独立 eval gate、aggregate diagnostic、durable evidence、once-only CLI 和 product authority。

主要内容：`ef0cf5f` 固定 V9 strict safe aggregate contract，`36fb988` 捕获同一次 paired run 的 aggregate，`25b1a3e` 增加 durable evidence，`697ca9f` 增加 controlled-Live CLI，`683a209` 将 product acceptance 改绑 V9。Authority 仅接受 `finalized / complete / closed / passed`、23 provider attempts、22 paired admissions 与 lowercase 64-hex evidence SHA；完整 V9 leaf 集合必须全部为 Git ordinary `H`，并在读取前后保持 leaf、commit、branch、clean 一致。任何 pending、`evidence_io`、未知 profile、非法 hash、assume-unchanged、skip-worktree、缺失/额外 leaf 或漂移都在 ledger、Prisma、Docker、浏览器前关闭；无 legacy V8 reader 或 `git show` 回退。

边界：本段是 V9 运行前的离线 checkpoint；实际 Live 终态见下一条。V1--V8 继续只读；离线阶段的 V9 eval gate、`REVIEW_AGENT_MODEL_ENABLED` 与 `PLANNER_AGENT_MODEL_ENABLED` 均缺省关闭，产品继续 deterministic。

验收：V9 focused `136/136`；Server `1381 passed / 30 skipped`；Review E2E `3/3`；Web `409/409`；AI `190/190`；Agent `406/406`；shared types typecheck exit 0；Review/Planner Windows native 按各自正确 cwd 合计 `133/133`，其中 V5/V6 cwd 是命令入口契约而非代码失败；product acceptance `131/131`；lint/build/Compose/diff 均 exit 0。contract/security 复审 PASS，无未关闭 Critical/Important。完整边界见 `docs/acceptance/phase-6-9-5-review-planner-v9-offline-checkpoint.md`。

回顾时可以问：为什么 V9 offline 通过仍不能写成 Live success？为什么 product authority 必须绑定完整 ordinary-`H` leaf 集合和前后 Git snapshot？为什么 eval gate 为 true 也不能打开 Review/Planner 产品 gate？

### 2026-07-19 - Phase 6.9.5 V9 唯一 controlled-Live 终态

目标：在不启用产品 gate 的前提下，用独立 durable V9 lineage 验证 Review/Planner 真实模型建议的质量、权限、预算和性能。

结果：首次 workspace 入口因根 `.env` 未传播到 `apps/server` 而 `preflight_invalid / 0-call`，没有消费 V9。根 `.env` 显式注入后的唯一运行完成 `23` provider attempts、`22` paired admissions、`26` verified zero-call、`48` strict successes；durable reader 返回 `finalized / invalid_attempted / closed / quality_gate_failed`。P95 `1396ms`、usage `7943/510`、CNY `0.026889/1.00` 和 attempt/admission/schema gates 全通过，但 quality `30/48`、semantic `4/22`、critical `2` 未达门槛。

边界：V9 once/evidence 已消费且不可重跑、覆盖或删除；没有 success seal，产品 authority fail-closed。因此没有 Docker、浏览器、Trace、合成账号、main replay 或 push。Review/Planner 产品 gate 已恢复缺省关闭，产品仍 deterministic。下一步只能以最小质量根因修复建立新 lineage。

### 2026-07-18 - Phase 6.9.5 V8 唯一 controlled-Live 终态

目标：在两个产品 gate 保持关闭的前提下，只执行一次 V8 DeepSeek V4 Pro non-thinking 评测，并仅依据 durable committed evidence 决定能否进入产品验收。

结果：零网络 preflight 为 `ok=true`，工作树 clean，V8 目录不存在，V1--V7 snapshot 为 20 entries / `6078891e6c962bc5c8e57471017d7f64e210c5f4ffd867c96136e33983ac2bd6`。唯一命令执行 23 次 provider attempt 后返回 `invalid_attempted / closed / usageKnown=false / invalid_response`。durable marker 连续到 `.stage-080-paired-returned`，没有 `.stage-090-report-validated`、candidate 或 success seal；因此失败位于 paired evaluator 已返回、report/cost/admission 完整成功门尚未通过的边界。

落盘 231-byte 文件仍为 provisional `state=attempted / providerAttemptCount=0 / usageKnown=false / transport`，SHA-256 为 `82813d58d70a438fb3942358c1ab49f85a52c17e319ca4261c98f7f56c39e0a7`；89-byte once marker SHA-256 为 `c014e04a7aa9a695971fe307a5b9909e0172c2e9cb0af7a1dcf0b39d5ff9733d`。public reader 则返回 `invalid_attempted / closed / 0 / false / evidence_io / lastStage=.stage-080-paired-returned`。因此 23/`invalid_response` 只有本次 CLI safe stdout 支撑，未被 finalizer durable commit；落盘与 public reader 的 0 都不能解释为 zero-call、零成本或否认已发生的外部尝试。

边界：V8 不可重跑，不拼接 V1--V7，不把 23 attempts 推导为 strict/quality/P95/usage/cost 通过，也不把 public reader 的 0 推导为零费用。由于没有 committed success，branch Docker/API/可见浏览器/Trace acceptance、main 合并、main replay 与 push 均禁止。两个产品 gate 继续 `false`。

回顾时可以问：`.stage-080` 精确证明了什么？为什么 CLI stdout 的 23/invalid_response、provisional 文件的 0/transport 与 public reader 的 0/evidence_io 必须分开记录？为什么没有 `.stage-090` 就不能读取或补写质量 counters？

### 2026-07-18 - Phase 6.9.5 V8 最终离线工程 checkpoint

目标：在不运行唯一 V8 controlled-Live 的前提下，把 stage evidence、provider composition、产品 admission、branch/main durable ledger、recovery 和真实产品 runner 收口到可执行、可恢复、可审计的同一边界。

为什么：只验证 Mock 或单个 adapter 不能证明真实 runner 会遵守正式 evidence contract。最终复审发现实际 `acceptance.json` 曾使用 ledger 私有简化 schema，绕过正式 strict schema；按 TDD 增加 fresh ledger 集成 RED 后，normal finalize、preseal 与 fresh complete reader 已统一到 exported official schema/serializer，防止 branch/main 产物缺字段或逃逸禁存约束。

主要内容与边界：V8 使用 15-stage durable marker、V1--V7 immutable snapshot、DeepSeek V4 Pro non-thinking one-shot CLI；产品路径使用 server-only component/capability admission、每环境四 slot durable ledger、owner lifetime lock、Docker container identity/health attestation、owner-scoped Prisma facts、authenticated API、headed Chrome exact profile、Trace/facts/default-off/cleanup receipts。两个产品 gate 仍为 `false`，真实 V8 evidence/once marker 与产品 acceptance 目录均未创建；本 checkpoint 没有 provider、Docker recreate 或浏览器副作用。

验收：Server `1265 passed / 30 skipped`，Review E2E `3/3`，Web `409/409`；Windows durable I/O、V8 stage evidence、product ledger native，Agent/AI/types，Server/Web lint/build，Compose `config --quiet` 与 `git diff --check` 全部 exit 0。official-schema 修复后 native ledger `55/55`、相关 Jest `138/138`；contract/security 与 acceptance/operations 复审均无未关闭 Critical/Important。实现 checkpoint 为 `faa97a8`。

回顾时可以问：为什么实际写盘 `acceptance.json` 必须与正式 schema 共用同一个 serializer？为什么 branch/main 产品验收需要 durable slot ledger 和 recovery owner lock，而不能靠内存计数？为什么离线门全绿仍不能称为 Review/Planner 真实模型可用？

### 2026-07-18 - Phase 6.9.5 V8 stage-diagnostics completion 设计

目标：在不重跑或改写 V7 的前提下，为新的 one-shot lineage 建立可定位的 durable stage evidence，并把真实模型质量门、产品验收、main 复验、推送和安全关机串成完整完成条件。

为什么：V7 的 `evidence_io` 同时覆盖 paired-result/orchestration 和 finalization/history 多个边界，23 attempts 不能证明 paired report 返回或质量通过；只给 terminal JSON 增加 stage 又无法覆盖 terminal write 自身失败。现有运维文档还把 Review/Planner 回滚错误地指向 `web`，且没有冻结 main 复验语义、精确产品 fixture 与关机前凭据/进程收口。

主要设计：V8 使用 15 个固定文件名、零字节、append-only、exclusive-create stage markers；success seal 绑定完整 stage manifest、candidate、历史 tree 与 commitment。保留 DeepSeek V4 Pro non-thinking、48/26/22、23 attempts、4500ms、CNY 1.00 和两个产品 gate `false` 的质量边界。V8 complete 后按 Review-only -> 重建 default-off `server` -> Planner-only -> 再次 default-off 的顺序验收 API、`/plan`、`/today`、Trace、owner isolation 和只读事实；已消费 paired lineage 不在 main 重跑。

实现复审补强：native close-failure RED 证明“直接写公开 marker/seal，再把 close 成功作为 committed 条件”无法被跨进程 reader 从相同字节验证。V8 因此让 once、15 个 stage 与 seal 都先写 fixed private prepare leaf 并 durable-close，再在同一 no-reparse directory HANDLE 下 existing-only 重开并用 `NtSetInformationFile` exclusive rename 到各自 public leaf；rename 是唯一 commit 点，之后 handle close 仅是 cleanup，不删除或撤销已提交 leaf。路径型 `MoveFileExW`、rename 后新增成功门、失败删除/补偿与 provider 重跑均禁止。

durability 口径同时收紧为 local fixed NTFS 上的 process crash/restart，不宣称物理断电或其他文件系统；实现必须有 volume preflight 与 rename 前/后 child hard-exit evidence。prepare leaf 由 committed leaf 内部唯一派生，V8 只允许 once/15-stage/success 固定目标。任一 prepare/public leaf 遗留都阻断后续 reservation；若失败发生在首个 prepare 创建前，只能证明本 invocation 零重试/零 provider，任何新 invocation 仍需用户重新授权。

安全边界：stage marker 无正文，不含 prompt、response、case id、token、cost、credential、URL 或 raw error；V1--V7 全部只读。最终只允许 `docker compose stop` 保留容器/镜像/volume/data，禁止 `down`、`down -v`、prune、reset、flush 或 wipe。

验收：设计自检无 TBD/TODO/未定项；两条独立只读审计已分别覆盖 contract/security 与 acceptance/operations。Task 1 durable I/O 与 Task 2 V8 evidence/state machine 已按 TDD 提交，但 native close-failure 复审又暴露 final publication 悖论，当前正在按本节 rename commit amendment 补 RED/GREEN；尚未创建真实 V8 evidence/once marker、调用 provider、启动 Docker 或浏览器。

回顾时可以问：为什么零字节 append-only markers 比 terminal `diagnosticStage` 更可靠？为什么 Review/Planner gate 恢复必须重建 `server` 而不是 `web`？为什么 main 不能重跑已经消费的 paired lineage？

### 2026-07-18 - Phase 6.9.5 V7 controlled-Live 终态关闭

目标：在不启用产品 gate 的前提下，执行获批的唯一 V7 DeepSeek V4 Pro controlled-Live，最多一个 canary + 22 个 paired runtime。

主要事实：根 Bun 进程仅对本轮显式设置 Live/eval gate，两个产品 gate 固定为 `false`。零网络 preflight 确认 `deepseek-v4-pro / deepseek-v1 / nonthinking JSON / 4500ms`、V1--V6 18-entry tree hash 与 CNY 1.00 hard cap。唯一运行耗时约 49.7s，终态 stdout 与 public reader 都为 `invalid_attempted / closed / providerAttemptCount=23 / usageKnown=false / evidence_io`。

证据：once marker SHA-256 `1920c68d8fd10d77af1cf63731e46ed8e9c02270093a024302b24eb97fa85bda`；JSON `review-planner-live-20260717T161356046Z-e26f821fdc46.json`，245 bytes，SHA-256 `79c07fed05a011a6344e7df3aecd9c616824c6a7cd07873693f3ddfaab1a63ba`。无 success seal、无 aggregate token/cost，V1--V6 tree hash 运行后仍为 `9f8cc9a7d5ba83d630fa5806f19aaa74066352de92bb04631813c17feaa230ba`。

根因边界：两个独立只读复核将问题收窄到“全部 23 个允许的 provider attempts 被安全计数后，paired-result/orchestration failure 或 evidence finalization/history I/O failure 被折叠为 `evidence_io`”。当前字节可以排除已 committed success、纯 seal-create failure、preflight/canary 前失败和 `success_candidate` 的 downgrade-write failure；但无法唯一区分 paired-result failure、CLI final history verify、finalizer internal verify/terminal replace、candidate 后瞬时 history failure + 成功 downgrade，也不能反推 provider 质量、usage 或账单。

边界：V7 once marker 已消费，严禁重跑、删除或重建 evidence。任一门失败按设计停止 Docker/浏览器/main/push，两个产品 gate 保持 `false`。

回顾时可以问：为什么 23 attempts 不等于 22 个 paired case 质量通过？为什么 `evidence_io` 的有损脱敏使得子阶段不可唯一恢复？为什么没有 success seal 必须停止产品验收？

### 2026-07-17 - Phase 6.9.5 V7 Task 7 独立复审与 success seal 收口

目标：完成 contract/security 与 acceptance/operations 两轮独立离线复审，并关闭 terminal evidence replacement 后历史漂移可能留下假成功证据的 TOCTOU 窗口。

为什么：旧顺序在写入 `complete` 后检测到 V1--V6 漂移时，若降级替换本身再失败，磁盘可能残留可被误读的 `complete` JSON。仅检查 boolean 无法解决，必须把“存在候选 JSON”与“证据已成功提交”分离。

主要内容与边界：成功先写成公开 schema 不接受的私有 `success_candidate`，单次 25ms quiescence 后 fresh 复核 V1--V6，再 exclusive-create 与 evidence leaf、candidate SHA-256、历史 tree hash 和 nonce commitment 绑定的无数值 success seal。唯一公开 reader 只有在 once marker、candidate、seal、hash/commitment 与 fresh history 全部一致时才投影逻辑 `finalized/complete`；任一缺失、伪造、reparse、降级写失败或 seal 创建失败都固定返回不含 token/cost 的 `evidence_io`。无 provider/file retry loop，reservation 仍只公开 `relativePath/markAttempted`，产品 gate 未改变。

当时验收：缺陷回归先观察到 RED；修复后 evidence Jest `5/5`、Windows native `15/15 / 130 assertions`、targeted ESLint、Server build 与 diff check 通过。contract/security 和 acceptance/operations 复审均为 PASS，Critical/Important/Minor 均为 0。该离线复审时尚未运行 V7 package script、controlled-Live、Docker 或浏览器，未创建真实 V7 marker/evidence，未开启业务 gate；后续唯一 Live 终态见上文 2026-07-18 记录。

回顾时可以问：为什么 standalone `complete` JSON 不再是成功证据？为什么 downgrade 写失败后没有 success seal 仍能 fail-closed？为什么 Task 7 离线通过当时仍不构成 Live 授权，而该唯一授权在 2026-07-18 消耗后不得再次运行？

### 2026-07-17 - Phase 6.9.5 V7 全量离线验收

目标：在不接触 provider、Docker 运行态或浏览器的前提下，对 V7 transport、factory、evidence、CLI、composition、权限和项目构建做一次完整、可复核的离线收口。

为什么：局部 97-token 回归或 48-case fake 成功只能证明一个 contract；只有把 AI/Agent/Server/Web/types、不可变历史、默认关闭 gate 和只读 merger 一起检查，才能在申请下一次 Live 前排除工程漂移，同时仍不把离线结果冒充 provider 证据。

主要内容与边界：focused gate 为 AI 190、Server 86、Windows native evidence 9/40 assertions；V1--V6 snapshot 为 integrity-v3、18 entries、aggregate tree hash `9f8cc9a7d5ba83d630fa5806f19aaa74066352de92bb04631813c17feaa230ba`，并固定 V6 marker/JSON 哈希。全量 gate 为 AI 190、Agent 406、Server 980 passed/30 skipped、Web 409；AI/types typecheck、AI/Server/Web lint、Server/Web build、Compose 静态 `config --quiet` 与 diff check 均 exit 0。Compose 没有执行 `up/build/down` 或输出渲染配置。V7 package script、controlled-Live、Docker 服务、浏览器、真实 key、provider、真实 V7 evidence/marker 均未触达。

当时结论：V7 offline engineering ready；controlled-Live not run and not authorized。Review/Planner product path remains deterministic because both model gates are false。该结论只描述 2026-07-17 的离线收口；后续唯一 V7 Live 已于 2026-07-18 终态关闭，不能按当时设想继续产品验收。

回顾时可以问：为什么 190/86/9 的 focused gate 与 190/406/980/409 的全量 gate 都不能证明 provider 质量？为什么只读读取 V1--V6 tree hash 不会消费 V7 once marker？为什么 Compose `config --quiet` 不是 Docker 启动验收？

### 2026-07-17 - Phase 6.9.5 V7 Mock 与 production-composition parity（离线）

目标：证明 V7 诊断使用的 DeepSeek V4 Pro non-thinking transport 与产品候选 composition 对齐，同时继续隔离评测 gate、产品 gate、模型输出和本地写权限。

为什么：仅在 evaluator 测试里看到相同 model 字符串不足以证明生产一致性；直接暴露 executor config 又会泄露 URL/key。另一方面，fake executor 的 48-case 成功如果被标成 Live，会把工程回归误写成 provider 质量证据。

主要内容与边界：新增 sanitized composition identity，仅返回 `deepseek / deepseek-v4-pro / deepseek-v1 / deepseek_v4_pro_nonthinking_json / 4500ms / review-model-candidate-v1`，对象冻结且不含 URL、凭据、pricing 或 executor；同一测试把它与 production private/public resolver 逐字段 cross-compare，并把 schemaId 锚定到 canary 实际使用的 canonical schema。V7 eval gate 不在 production allowlist；业务 gate 缺失或均为 `false` 时，即使 eval gate 为 true 也不会构造 executor，只返回 deterministic Mock suggestions。直接 Mock runner 的 48-case 决定固定为 `mock_quality_not_evidence`；strict fake 穿过 V7 evaluator 的另一条回归仅用于 live-shaped engineering contract，外层固定标为 `mock_quality_not_live_evidence`。两条离线证据计数均为 `26` verified zero-call、`22` runtime、`48` strict、`48` quality pass、`0` critical，均不能充当 provider evidence。模型 schema 只允许选择本地 snapshot 的 index/order，不能生成或修改 FSRS、minutes、links、owner facts、persisted records 或 write permissions。

当时验收：focused factory/config/runtime 61/61、`@repo/agent` 406/406、ReviewAgent owner-scope server 7/7；静态扫描确认 V7 eval gate 未进入 Docker、Web、worker 或 server config allowlist。该离线验收时没有运行 V7 package script、Live、Docker 或浏览器，没有创建真实 V7 marker/evidence，也没有开启 Review/Planner 产品 gate；后续唯一 Live 终态见上文 2026-07-18 记录。

回顾时可以问：为什么 parity helper 使用 `deepseek-v1` identity 而不返回真实 URL？为什么 48/48 Mock 仍不能说明 provider 可用？为什么 eval gate 为 true 也不能开启产品 Review/Planner runtime？

### 2026-07-17 - Phase 6.9.5 V7 one-shot CLI（离线）

目标：为新的 V7 usage-parity profile 提供唯一、显式且可审计的 orchestration 入口，同时保证普通测试、构建、服务启动和业务请求都不会隐式触发真实模型。

为什么：V7 evidence 是一次性 capability。若 CLI 对确认参数、历史完整性、attempt marker、evaluator 构造、canary、paired eval 或 finalizer 的顺序处理不严，可能造成 evidence 被重复消费、失败后继续调用 provider，或把不完整结果误记为质量通过。

主要内容与边界：新增精确参数 `--confirm-controlled-live-v7-deepseek-v4-pro-usage-parity` 与显式 package script；CLI 依次执行 preflight、历史快照、reservation、历史复核、mark attempted、evaluator、canary、paired eval 和 final seal。preflight 异常在 reservation 前固定关闭；reservation 后任一失败最多 terminal finalize 一次。evaluator construction 异常保留为 `executor_init`，其余 evidence/orchestration 异常为 `evidence_io`；failed canary 永不进入 48-case paired eval。成功摘要必须同时满足 23 次 provider attempt、48 case、26 个 verified zero-call、22 个 runtime、48 strict/quality pass、0 critical、P95 与精确 CNY 记账约束。process wrapper 只序列化 strict safe projection，不输出 prompt、response、凭据、URL、header、raw error、stack 或失败 token 数值。

当时验收：dependency-injected CLI regression 20/20、V7 factory 27/27、五个 Task 4 相关文件 targeted ESLint exit 0、Server build exit 0、`git diff --check` exit 0。测试覆盖错误 confirmation、credential-bearing preflight throw、snapshot/reserve/历史复核/mark/evaluator/paired/finalize 失败、精确成功顺序、failed canary 截止和非法 aggregate。该 CLI 离线验收时没有执行 V7 package script，没有读取真实 key、调用 provider、创建真实 marker/evidence、启动 Docker/浏览器或开启产品 gate；后续唯一 Live 终态见上文 2026-07-18 记录。

回顾时可以问：为什么 evaluator construction 使用 `executor_init` 而不是通用 `evidence_io`？为什么 reservation 后所有失败都必须 terminal seal？为什么 CLI 文件存在不等于已经运行 V7 Live？

### 2026-07-17 - Phase 6.9.5 V7 preview/actual usage parity 设计

目标：停止继续更换 provider/transport 参数，修复 V6 把工程 input preview 错当 provider actual usage 上限的 contract 违例，并为下一次 profile 补充不含数值的 usage-shape 诊断。

为什么：V6 evidence 为安全只保留最小终态，无法区分 provider 缺 usage、SDK 归一化丢失或更早的 response/schema 失败。继续原样发 canary 只会产生第七份同样模糊的 terminal evidence。

主要内容与边界：代码追踪发现 canary 使用 `estimatedInputTokens=96`，随后又要求 `provider inputTokens <= 96`；离线 executor fixture 返回合法 `97/4` 时稳定复现 `usage_unverifiable`。V7 保留 exact DeepSeek V4 Pro non-thinking OpenAI-compatible executor，允许正安全 actual input 超过 preview、仍限制 output cap、整轮 aggregate reservation 与 CNY hard cap；cloned-response audit 只新增 `missing/invalid/positive` usage shape，用于区分 provider telemetry 与 SDK normalization。V7 使用独立 profile/schema/marker/evidence/CLI，并在 provider 前复核 V1--V6 immutable tree；Review/Planner 权限、facts、本地 merger、预算、超时、deterministic fallback 与默认关闭 gate 均不改变。

替代方案：只删除 96-token 检查虽然能修复复现，但下一次缺 usage 时仍无法定位来源；改用 direct-fetch 或 Qwen 会同时改变 transport/provider，扩大变量。采用“最小 parity 修复 + 安全 usage-shape audit”，既保持 production parity，也避免 generic terminal evidence。

设计当时验收：已完成代码数据流复核与 `97/4` 离线复现，当时尚未修改实现或创建 V7 evidence/marker。其后 Task 1--6 已按 TDD 计划完成，离线结论见上文“V7 全量离线验收”；当时这些离线结果不构成 Live 授权，唯一 V7 授权已于 2026-07-18 消耗并终态关闭。

回顾时可以问：为什么 input preview 不能限制 provider actual usage？为什么 97/4 fixture 不能改写 V6 历史 provider 事实？为什么 V7 Live 通过仍不等于产品 gate 自动开启？

### 2026-07-17 - Phase 6.9.5 V6 离线验收与 Live 授权边界（历史记录，已由终态关闭替代）

目标：把 V6 已完成的非网络工程事实、不可跨越的真实模型边界和下一次唯一授权动作统一写入项目记录，避免把 fake CLI、Mock、静态测试或历史 v1--v5 evidence 误称为真实模型通过。

主要内容与做法：V6 仅让精确 `deepseek-v4-pro` + `https://api.deepseek.com/v1` 的 Review/Planner candidate 使用 typed non-thinking JSON transport；delegate 前固定写入 `thinking:{type:'disabled'}`，本地拒绝 tool/schema drift 与 reasoning-content response。业务 gate 继续默认关闭，普通 Chat 与 V4 Flash `json_object` 不变。factory audit 的 complete evidence 只接受 `not_reported` 或 `reported_zero` reasoning projection，并按完整 provider completion aggregate 计算 CNY，不从 output 中扣减 reasoning detail。V1--V5 evidence tree/marker 使用 immutable no-reparse snapshot；V6 reservation 是 private owner-bound one-time terminal capability，安全 provisional 写入后才可按 terminal outcome seal。离线 fake CLI 历史回归为 31/31；hardening 后 focused V6 suite 为 61/61、native evidence 为 15/15。一次 fresh Mock proof 为 48 cases / 26 verified zero-call / 22 Mock runtime / 48 strict / 0 critical，固定决定 `mock_quality_not_evidence`，临时 `.tmp` 输出已删除。

历史边界：在这份离线记录写入时，尚未运行 V6 CLI、provider、Docker、浏览器或产品 API，且 V6 evidence 目录和 once marker 均不存在。最多预算固定为 1 个 fact-free canary + 22 个 paired case，即 23 次，worst-case reservation CNY `0.18726`、hard cap CNY `1.00`；它不是实际费用、供应商账单、Live passed 或 production enabled。两个业务 gate 始终保持 `false`，不自动回退 Qwen。

历史验收：lint-style 修复提交后重新运行 AI、Agent、Server、shared types、Web 的测试/lint/build，`docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker config --quiet` 与 `git diff --check` 均 exit 0；当时尚无 V6 marker/evidence。其后用户已授权并执行唯一一次 V6 canary，终态结果见下节“V6 controlled-Live 终态关闭”；该命令现已消耗，任何后续动作不得重跑 V6。

回顾时可以问：为什么 V6 的 complete evidence 只允许两种 reasoning aggregate，却仍以完整 completion 记账？为什么 V6 private provisional/seal 能防止一次性 evidence 被伪造为成功？为什么 `48/48` Mock 和 CNY `0.18726` reservation 都不能说明项目已能使用真实 Review/Planner 模型？

### 2026-07-17 - Phase 6.9.5 V6 controlled-Live 终态关闭

目标：在已完成 Task 1--6 的独立 V6 non-thinking profile 上，按用户明确授权执行唯一一次 fact-free provider canary，并在任何 usage 不可验证时保留安全、可审计且不可重跑的终态，而不是把失败伪装成零调用或继续推进产品验收。

主要内容与边界：精确 V6 CLI 只在一个子进程中临时配置 Live；根 `.env` 的默认 Mock 配置与两条业务 gate 都未改写，未启动 Docker 或浏览器。runtime evidence 与同目录 once marker 已封存，最终字段为 `state=finalized / status=invalid_attempted / gate=closed / providerAttemptCount=1 / usageKnown=false / diagnosticCode=usage_unverifiable`。V1--V5 evidence/marker 没有工作区改动；V6 JSON 仅保留白名单终态字段，不含 prompt、用户事实、模型输出、凭据、URL、HTTP 元数据、raw error、stack、token 或成本。

为什么：provider boundary 已被触达但 usage 未能验证时，任何质量、成本或可用性说法都没有证据基础。fail-closed 能避免把未知计费、未知 response 或未知质量写成 `candidate_applied`、zero-call 或零成本成功。

验收：独立解析 V6 JSON，确认上述六个最终字段；检查 once marker 存在；扫描 evidence 禁止内容无命中；`git status` 显示 V1--V5 evidence 无改动。V6 的 48-case、Docker authenticated suggestions/plan、可见浏览器、main 合并、main 复验和远程推送均未执行。

当时后续状态：V6 不能重跑；截至该记录写入时，V7 已完成 Task 1--6 离线实施，仍需 Task 7 两轮复审与新的单独 Live 授权。后续唯一 V7 Live 已于 2026-07-18 终态关闭，当前仍保持两个业务 gate 为 `false`，不得重跑 V7。

回顾时可以问：为什么 `usageKnown=false` 不能被记为零成本？为什么新的诊断必须拥有自己的 marker/evidence 而不是重跑 V6？

### 2026-07-17 - Phase 6.9.5 V6 non-thinking evidence 隔离（离线）

目标：为 V6 这条独立 DeepSeek V4 Pro non-thinking lineage 预先冻结一次性、安全且可审计的 evidence 边界，同时以字节级历史快照保护 v1--v5，避免新的受控实验覆盖、重用或误解释旧 evidence。

主要内容与边界：新增独立 V6 profile/schema/once-lock 常量与严格 `reserved`、`attempted`、`finalized` records。完整记录只允许固定的 23 次尝试、CNY token/cost/cap、48/26/22/48 固定质量计数，以及 `not_reported` 或 `reported_zero` 的安全 non-thinking aggregate；关闭记录只保留有界诊断，`thinking_not_disabled` 也只能保留 reasoning 枚举、布尔值和非负安全 token 计数。V1--V5 的所有目录和 marker 都以 native HANDLE-relative、existing-only、no-reparse 清单 hash 在 reserve 前、executor 前、provider 前及 finalization 后复核；V6 writer 唯一可写范围是新的 runtime V6 tree、其 once marker 和安全 JSON。reservation 对调用方只暴露 `relativePath` 与 `markAttempted`；terminal capability 仅由模块私有 WeakMap 绑定给原始 object，并以一次性 owner claim、safe-provisional 写入和唯一 terminal replacement 串行化，伪造/clone 或重复 handle 在任何写入前 fail-closed。finalization 的第一个 durable record 固定是 closed `evidence_io`，最后一次 history check 通过后才允许覆盖为请求的 terminal summary 并 seal；history mismatch 或任一 writer failure 都只 seal 已有的 safe attempted/finalized record，绝不留下 durable `complete`。这不是不可能的跨目录原子锁声明：枚举仅提供不可信 leaf names，已绑定目录及每个重新相对打开的 leaf 都禁止 reparse/DELETE，下一次 fresh snapshot 负责检测并发新增或变更。

验收：先运行新增 evidence spec，因 V6 evidence module 不存在而得到 module-not-found RED；独立复审发现旧顺序在 final hash mismatch 且 corrective writer failure 时会遗留 `complete`，新增组合回归先 RED，再改为 safe-provisional ordering。第二次复审发现公开 reservation 可直接 terminal-write，新增 public-surface regression 先 RED，再将 capability 收进 WeakMap；clone 进入受控 finalizer 时不发生写入。后续复审补强使公开 controlled finalizer 也只能由一个 owner 执行：并发或完成后的第二次调用均不能重写 finalized record。本次补强后 focused Jest 3/3（61 tests）和 Windows Bun native 15/15 通过。native tests 覆盖 V1--V5 历史的 added/changed/removed/renamed、late concurrent entry、junction/reparse、duplicate V6 marker、native writer denied、final history mismatch 的 sealed `evidence_io`、private capability 与 forged-handle fail-closed，以及四个边界的 hash 复核。旧的 call-count 注入式 terminal writer failure test 已移除，因为它需要重新暴露或伪造私有 writer capability；实际 native writer denied 与 sealed-record 可观察断言保留，不设置 test-only public write backdoor。所有 fixture 只位于 OS 临时目录；未创建仓库实际 V6 evidence 目录或 marker，未读取 `.env`、未调用 provider、未运行 V6 CLI、Docker 或浏览器。该离线 writer 不构成 Live、质量通过、费用结论或生产启用。

回顾时可以问：为什么 V6 必须将 v1--v5 的完整目录和 once marker 都纳入 snapshot，而不能只保护 marker？为什么 post-finalization hash failure 必须覆盖为 `evidence_io` 才能 seal？为什么 V6 evidence 只保留 reasoning 的安全 aggregate，而不能保存 provider response 或调试文本？

### 2026-07-17 - Phase 6.9.5 V6 non-thinking evaluator（离线）

目标：在不重跑 v1--v5、不创建 V6 profile/marker/evidence 且不接触 provider 的前提下，先冻结 V6 的一次 canary、22 个 paired runtime 尝试、非 thinking 审计和 CNY 费用上限。

主要内容与边界：factory 只接受全局 live gate、独立 V6 gate、精确 DeepSeek V4 Pro `/v1` 与两个 Review/Planner 业务 gate 显式为 `false` 的测试配置。它把 `deepseek_v4_pro_nonthinking_json` config 与只在 evaluator 闭包中的 audit callback 交给 executor；callback 仅归约 reasoning 枚举、布尔值和安全 token 整数，绝不写入 Agent Trace、公开配置或原始 response。完成路径对 evidence 只暴露冻结的 `not_reported` / `reported_zero` 聚合（缺失时为前者）；positive、invalid、content 与 provider 原始数据绝不越过 evaluator，且任一非合规审计都会关闭路径。canary 必须是一次、正安全整数 usage 且无 audit 违规；缺失/零/小数/负 usage、reasoning content、正 reasoning tokens 或非法 detail 都立即以 V6 本地域 `thinking_not_disabled` 或受限诊断关闭，不能进入 paired。paired 仍使用原 48-case 的 zero-call guards，最多 22 个 runtime calls，且只有 canary 加 22 个 paired delegate attempts 恰好等于 23 时才可接受 report；全部运行时 strict success、26 个 verified zero-call、零 critical、P95 不超过 4500ms、语义质量不少于 90%、正 aggregate usage 与 CNY 不超过 1 仍缺一不可。CNY 始终按完整 completion tokens 计算，`reported_zero` 不扣减 output；它不进入现有 USD Trace。

验收：先运行新增 factory spec，因 V6 factory 模块不存在而 RED（仅 module-not-found，0 tests executed）；最小实现后 V6 focused 18/18、V6+封存 V5 factory 27/27、`bun --filter @repo/agent test` 与 `bun --filter @repo/ai test` 181/181 均通过。全部 executor/provider 路径由注入 fake 覆盖；未读取 `.env`、未调用真实模型、未运行 V6 CLI、Docker 或浏览器，也未创建或修改 V1--V5/V6 evidence 或 marker。Task 3 只是离线 evaluator，不是 Live、质量通过或生产启用结论。

回顾时可以问：为什么 V6 要把 48 个 contract strict successes 中的 26 个 zero-call 与 22 个 runtime strict successes 分开验证？为什么 non-thinking audit 只能留在 evaluator 闭包，且不允许从 completion token 中扣除 reasoning detail？为什么 24th delegate 必须在 provider 前被阻断？

### 2026-07-17 - Phase 6.9.5 V6 Review/Planner resolver 精确绑定（离线）

目标：让已封闭的 DeepSeek V4 Pro non-thinking transport 只能由 Review/Planner 的精确 production composition 选择，同时保持两个业务 gate 默认关闭。

主要内容与边界：`resolveReviewPlannerLiveExecutorConfig` 仅在 `provider=deepseek`、`model=deepseek-v4-pro` 与 trim 后仍精确 `https://api.deepseek.com/v1` 同时成立时返回 `deepseek_v4_pro_nonthinking_json`；尾随斜杠、显式端口、query、其他 DeepSeek host、错误 provider credential 或输入 `schemaProfiles` / `onNonThinkingAudit` 一律 fail-closed。V4 Flash 仍使用通用 `json_object`。两条业务 gate 都是 `false` 时 factory 不构造 executor，公开 `ReviewPlannerModelConfig` 序列化不含 credential 或 base URL；没有新增环境变量、audit callback、普通 Chat 改动或 provider 调用。

验收：先以 focused server Jest 观察到 V4 Pro 仍解析为 `json_object` 且 unsafe 变体仍构造 executor 的 RED；最小 resolver 修复后 config/factory 28/28 GREEN。V6 profile、marker、evidence、CLI、Docker、浏览器与 Live 均未创建或运行，后续仍须先完成 factory/evidence/CLI/Mock/独立复审并取得新的用户明确 Live 授权。

更正：V5 是已封存的 `json_object` lineage；V6 transport 绑定后，exact old V5 env 在 preflight 立即返回 `PreflightInvalid`，旧的 mock diagnostic/paired-execution 断言已退役，且 `createExecutor` 必须保持零调用。这只更新离线测试边界，不改写 V5 evidence、marker 或一次性 provider 结论。

回顾时可以问：为什么 V4 Pro transport 必须比较原始 canonical base URL，而不是仅按 host allowlist？为什么 `schemaProfiles` 必须在 Review/Planner composition boundary 直接 fail-closed？为什么 gate 关闭时甚至不应构造 executor？

### 2026-07-17 - Phase 6.9.5 V6 non-thinking typed transport（离线）

目标：在 V5 的 `structured_output` 终态后先验证一个可证伪的 transport 根因假设：DeepSeek V4 Pro 默认 thinking 是否需要在真实 JSON candidate request 上显式关闭；本记录只确认本地 SDK wire 与权限边界，不声称真实模型已经通过。

主要内容与边界：`@repo/ai` 新增封闭的 `deepseek_v4_pro_nonthinking_json` mode。它只接受 `provider=deepseek`、`model=deepseek-v4-pro` 与精确 `https://api.deepseek.com/v1`；通过 Vercel AI SDK 官方 custom `fetch` middleware，在 delegate 前验证 `POST /v1/chat/completions`、`response_format:{type:'json_object'}`、无 tools/tool_choice/functions/function_call/json_schema，拒绝预置 `thinking`，然后只写入固定 `thinking:{type:'disabled'}`。未知 `providerOptions.openai.thinking` 的零网络对照实验证实不会出现在 SDK wire，因而不能被当作关闭 thinking 的实现。middleware 对返回值只暂态归约 reasoning 是否出现和安全整数 detail；它不读取或保存 `message.content`，也不向 Trace/HTTP/文档投影 prompt、candidate、chain-of-thought、endpoint、header、凭据或原始错误。发现 reasoning content、正 reasoning token 或非法 detail 时在本地 fail-closed，现有 runtime 仍回落 deterministic suggestion。

验收：先观察到 transport module/mode 缺失的 RED；实现后 direct transport 18/18、provider wire 33/33、完整 `bun --filter @repo/ai test` 181/181、`bun --filter @repo/ai typecheck`、`lint` 与 `bun --filter @repo/server build` 均通过。所有 provider responses 均由 fake fetch 构造；未读取 `.env`、未调用 DeepSeek、未创建 V6 evidence/once marker、未启动 Docker/浏览器，`REVIEW_AGENT_MODEL_ENABLED` 和 `PLANNER_AGENT_MODEL_ENABLED` 仍未改变。V6 的 factory、evidence、CLI、Mock、独立复审和用户明确的一次 Live 授权仍在后续任务。

回顾时可以问：为什么通用 `providerOptions` 不能作为 DeepSeek thinking 开关？为什么 middleware 必须在 delegate 前验证完整 JSON request？为什么 response audit 只允许保留安全计数而不能记录 reasoning/content 原文？

### 2026-07-17 - Phase 6.9.5 DeepSeek V4 Pro v5 一次性 Live 关闭

目标：以与生产候选一致的 JSON-object executor 验证 Review/Planner 真实模型只读建议是否可进入 48-case 和项目验收。

结果：离线全量验证后仅执行一次 `deepseek-v4-pro` provider 尝试，v5 独立 evidence 记录为 `invalid_attempted / closed / providerAttemptCount=1 / usageKnown=false / structured_output`。48-case、Docker、浏览器、main 合并和推送均未执行；两个业务 gate 继续 `false`。证据不含 provider 原文、prompt、候选、凭据或 endpoint，不能被解释为普通 Chat 不可用、零成本、质量结论或阶段完成。

回顾时可以问：为什么与生产 executor 对齐的 v5 仍须在 structured-output 关闭后停止？为什么 `providerAttemptCount=1` 不能让我们继续 48-case？为什么新的根因设计必须先于任何新 profile？

### 2026-07-17 - Phase 6.9.5 DeepSeek V4 Pro v5 once-only CLI 与 Mock 边界

目标：把独立 v5 的真实模型入口约束为单一、可审计且不可重试的 server-only 命令，同时先用不触网的 Mock 再次证明冻结 48-case 数据集、zero-call 边界和安全汇总可运行；本条不记录任何 Live 成功结论。

主要内容与做法：新增 `eval:review-planner:live:v5:deepseek` 与精确确认参数 `--confirm-controlled-live-v5-deepseek-v4-pro`。CLI 在 provider 边界前依序验证配置、快照并复核 v1--v4 历史 evidence、reserve 独立 v5 evidence/marker，再标记 attempted；它只执行一个 canary，且只有 `complete / usageKnown=true / providerAttemptCount=1` 时才允许 22 个 eligible runtime case 继续。最终状态必须同时满足 `quality_gate_passed`、48 entries、26 个实际 verified zero-call、22 runtime、23 total attempts、P95 不超过 4500ms、正数 provider usage，以及 DeepSeek V4 Pro 非缓存 CNY 聚合费用不超过 CNY 1；否则严格关闭。序列化与脚本 stdout 都只投影状态、计数、受限 CNY 聚合和质量摘要，不会写出 prompt、candidate、凭据、endpoint 或 raw provider 输出。

离线证据：V5 CLI Jest 覆盖 confirmation/preflight、初始历史 hash、reservation、一次 marker、canary 失败、exact 48-case 开放条件、P95/费用关闭与安全序列化；`phase-6.9-review-planner-v2` Mock 运行得到 48 cases、26 verified zero-call、22 runtime、48 strict successes、0 critical failures、`mock_quality_not_evidence`。Mock 不会消费 v5 marker、不调用 provider，也不会改变 `REVIEW_AGENT_MODEL_ENABLED=false` 与 `PLANNER_AGENT_MODEL_ENABLED=false` 的默认业务状态。

回顾时可以问：为什么 v5 必须先 reserve evidence 再创建 evaluator？为什么 canary 的正数 usage 和一次调用数是进入 48-case 的前置条件？为什么 v5 的 CNY price profile 不能写进现有 USD Trace？

### 2026-07-17 - Phase 6.9.5 DeepSeek V4 Pro v5 证据隔离

目标：为 DeepSeek V4 Pro v5 的一次性受控验收建立独立 evidence/once-marker 与历史完整性边界，保证 v1--v4 的目录树、marker 和字节内容不会被 v5 写入、覆盖或静默改写。

主要内容与边界：v5 只可通过 Windows HANDLE-relative writer 创建 `phase-6-9-5-controlled-live-v5-deepseek-v4-pro` 目录及其专属 marker；evidence 是严格白名单 JSON。关闭结果只保留状态、gate、调用计数、usage 标记和受限诊断码；完整开放结果才可保留固定 CNY price profile、受限 token/CNY 聚合、硬上限和质量计数。它不保存 prompt、candidate、模型原文、凭据、endpoint、header、raw error 或 stack。v1--v4 在每次外部边界前后按目录项名称、类型、字节长度和 SHA-256 重新核对；缺失、追加、改写、普通文件外的节点或 reparse/junction/symlink 都 fail-closed。

验收：先以缺少 v5 模块确认 RED；随后 focused Jest 3/3 与 Windows Bun native 5/5 通过，覆盖正常 reserve/mark/finalize、历史树字节哈希不变、历史改写/追加/reparse 和 v5 marker 冲突。此任务未读取凭据、未调用真实模型、未启动 Docker 或浏览器，也没有创建任何受控 Live evidence；Review/Planner 业务 gate 仍默认 `false`。

回顾时可以问：为什么 v5 evidence 必须与 v1--v4 的 once marker 彻底分离？为什么历史验证既要比较 hash，也要拒绝 reparse point？为什么 CNY 聚合不能进入 USD Trace？

### 2026-07-17 - Phase 6.9.5 DeepSeek V4 Pro v5 受控评测工厂

目标：为 ReviewAgent / PlannerAgent 建立一条与生产候选相同、但仍默认关闭且只读的 DeepSeek `deepseek-v4-pro` JSON-object 受控评测入口，避免把历史 v1--v4 的 direct-fetch 结构化输出失败误写成“DeepSeek Chat 不可用”。

主要内容与边界：v5 工厂只接受 `AI_PROVIDER_MODE=live`、全局 live gate、独立 v5 gate、精确的 `https://api.deepseek.com/v1` / `deepseek-v4-pro` 绑定，且两个业务 gate 必须显式为 `false`。它复用实际生产的 OpenAI-compatible `json_object` executor（无 tools、无 strict-tool、`maxRetries=0`），模型只产生 canonical Review/Planner candidate；本地 schema、facts merger、FSRS、任务、权限、持久化与失败 fallback 仍为权威。canary 与后续 22 个 runtime case 都必须具备正安全整数 provider usage；非法、零、缺失、超限或第 24 次请求均 fail-closed，绝不让额外 provider 调用穿透。

成本：用户提供的 V4 Pro 价格快照为非缓存输入 CNY 3/百万、输出 CNY 6/百万。v5 预留 `42,996` 输入与 `9,712` 输出 token，最坏估算 CNY `0.18726`，低于批准上限 CNY `1.00`。该 CNY profile 仅供 v5 evidence 使用；在线 Agent Trace 的金额字段仍是 USD，故没有把 CNY 写入其中或编造汇率。

验收：红灯测试先证明 factory 缺失；实现后 `review-planner-controlled-live-eval-v5-deepseek.factory.spec.ts` 18/18 与 `bun --filter @repo/ai test` 161/161 通过，均未读取真实凭据或调用 provider。此记录只代表离线 factory；v5 evidence、CLI、Mock、唯一 Live、Docker、浏览器、main 复验和推送仍未发生。

回顾时可以问：为什么 v5 必须复用 production JSON executor 而非第四次 direct-fetch adapter？为什么 CNY 价格不能直接写进 USD Trace？为什么第 24 次请求必须在 delegate 前被拒绝？

### 2026-07-17 - Phase 6.9.5 DeepSeek V4 Pro v5 evidence 隔离

目标：把即将发生的 v5 唯一真实调用和已消耗的 v1--v4 历史调用彻底隔离，使新证据既可审计，也不能覆写、拼接或误读旧证据。

主要内容与边界：新增独立 profile、严格 safe-summary schema、专用 once marker 与 Windows HANDLE-relative writer。v5 只可写自己的 evidence 目录；complete evidence 只含 provider 尝试数、正 usage 状态、CNY price profile、聚合 token/CNY cap 与质量计数，closed evidence 不携带费用或质量字段；成功 evidence 的 token 必须为正数且 CNY 必须精确匹配固定非缓存公式。任何 prompt、candidate、key、endpoint、header、raw output/error 或 stack 都会被 schema/deny-list 拒绝。v5 在 provider 边界前后通过 existing-only 的 native HANDLE-relative reader 对 v1--v4 完整 evidence tree 与 marker 做 SHA-256 清单验证；文件增删改、reparse point、缺 marker 或已存在 v5 marker 都 fail-closed，历史扫描绝不创建目录。

验收：evidence schema Jest 3/3、原生 Bun evidence 测试 5/5 与 Server lint 通过；原生测试覆盖历史 tree 字节级保持、内容/新增文件/reparse 篡改和 marker 冲突。没有运行 CLI、真实模型、Docker 或浏览器，业务 gate 继续关闭。

回顾时可以问：为什么不只 hash 四个 marker，而要 hash 整个历史 evidence tree？为什么 complete 与 closed evidence 必须是不同的严格 schema？为什么 v5 writer 必须限制在 HANDLE-relative 的专属目录？

### 2026-07-17 - Phase 6.9.5 离线评测与 telemetry 可信度补强

目标：在不启动任何新的 provider 调用、不改变 Review/Planner 默认业务 gate 的前提下，让后续独立 profile 的 48-case 评测、zero-call 边界和成本 Trace 可以作为可审计证据，而不是由报告字段或 `0/0` usage 冒充成功。

主要内容：

- `phase-6.9-review-planner-v2` 保持 48 条 case（26 条 provider 前 zero-call、22 条 runtime）。26 条 zero-call 现在实际穿过 candidate 入口并覆盖 not-eligible、safety-blocked、budget-exhausted 与 aborted；只有 runtime 计数仍为 0、strict/rubric 均通过且 `zeroCallVerified=true` 才能通过 report contract。意外 runtime 调用固定产生 `zero_call_boundary_failed`，不能再由直接构造的成功记录掩盖。
- 22 条 runtime fixture 扩展为不同的 Review diagnosis / focus 组合与 Planner strategy / block order，而不是重复同一个弱点或排序夹具。Mock 仍只证明 contract，固定决策仍为 `mock_quality_not_evidence`。
- `ModelAgentRuntime` 的 live 成功路径现在要求 provider-reported input/output usage 都是正安全整数。缺失、非整数、负数或 `0/0` 统一成为 `PROVIDER_ERROR / invalid_response`，保留调用前已预留预算，并让 Review/Planner 回退本地只读建议；失败结果里的 `0/0` 是固定脱敏失败值，绝不表示已验证的 provider usage 或零费用。
- Review/Planner Trace 复用集中定价表，但只有全部成功 Trace 具有正安全整数 usage 且每个模型都有已知单价时才标记 `pricingKnown=true` 并写入估算成本。未知单价、失败 Trace 或不可验证 usage 一律显示未知定价和成本 `0`，不回填历史 evidence，也不替代供应商账单。
- Docker Compose fixture 改为最小 OS 运行环境白名单，而不是克隆再删除部分 `process.env`；host-only `QWEN_API_KEY` canary 证明 Compose 解析全部服务时不会把宿主 Qwen/RAG/JWT 等插值变量带入临时 config。该变更只修复测试隔离，未将 Review/Planner gate、timeout 或凭据投影到 Web/镜像。

验收：未读取或调用任何新的真实模型。fresh Mock artifact 为 `.tmp/phase-6-9-5-v2-mock-20260717T080000Z.json`，结果为 48 entries / 26 verified zero-call / 22 Mock runtime / 48 strict / 48 quality / 0 critical，决策固定为 `mock_quality_not_evidence`。`bun --filter @repo/agent test`、`bun --filter @repo/ai test`、`bun --cwd packages/types typecheck`、`bun --filter @repo/server test -- --runInBand`（89 suites、826 passed、30 skipped）、`bun --filter @repo/server lint`、`bun --filter @repo/web test`（409 passed）、`bun --filter @repo/web lint`、server/web build 与 `git diff --check` 均通过。历史 v1--v4 controlled-Live evidence 和 once marker 完全未改写，两个业务 gate 继续默认 `false`。

回顾时可以问：为什么 zero-call 必须实际穿过 candidate safety gate？为什么 provider 返回 `0/0` usage 不能被解释为零成本成功？为什么集中定价仍不能替代供应商账单？

### 2026-07-17 - Phase 6.9.5 Review / Planner v4 controlled-Live 关闭记录

目标：在独立的零网络封闭式 JSON 归一化和 stage-provenance 边界复审后，以新的 v4 profile 确认 provider 结构化输出是否能取得进入 48-case 与项目内验收的资格；不扩大模型权限，也不复用任何历史 profile。

为什么：v1/v2/v3 的关闭 evidence 已经证明“不能把失败写成 zero-call 或通过”，但不能授权无边界重试。v4 因此使用新的 evidence schema、目录和 once marker，并将已受信的内部阶段保持在最小脱敏范围，避免覆盖旧证据、保存 provider 原文或以 Docker/浏览器成功冒充模型质量。

主要内容与做法：

- v4 以独立目录、`phase-6.9.5-review-planner-controlled-live-evidence-v4` schema 和 `.review-planner-controlled-live-v4.once` marker 运行；v1/v2/v3 evidence 与 marker 未改写、未复用、未拼接。
- 唯一一次 v4 provider 尝试终态为 `invalid_attempted / closed / 1 / false / structured_output / provider_json_parse`。`provider_json_parse` 仍只是受信 runtime 内部阶段，未进入业务 API、Trace、浏览器或 DTO。
- evidence 只写白名单状态、schema version 与 marker；不写 prompt、用户学习事实、candidate JSON、模型输出、凭据、endpoint、HTTP metadata、raw error、stack、token 或成本。默认 `REVIEW_AGENT_MODEL_ENABLED=false`、`PLANNER_AGENT_MODEL_ENABLED=false` 未改变。

边界：v4 不重试，不运行 48-case controlled-Live、Docker authenticated suggestions/plan 或可见浏览器验收；它不是质量通过、zero-call、零成本或账单结论。没有创建合成账号或 Trace，故没有清理动作；main 复验和远程推送仍未开始。

验收：v4 evidence 与 once marker 均存在，evidence 为 parseable 的白名单 JSON，保留 `invalid_attempted`、`closed`、`providerAttemptCount=1`、`usageKnown=false`、`structured_output` 与 `provider_json_parse`；v1/v2/v3 未改写；默认业务 gate 仍关闭。

回顾时可以问：为什么 v4 必须使用新 evidence/marker，而不是重试 v3？为什么 `provider_json_parse` 可以留在脱敏 evidence，却不能进入 Trace 或浏览器？

### 2026-07-17 - Phase 6.9.5 Review / Planner v3 controlled-Live 关闭记录

目标：在不扩大模型权限、不读取或记录 provider 原文的前提下，验证 v3 专用受控诊断能否通过新的安全内部阶段分类，取得继续 48-case 与项目内验收的资格。

为什么：v1/v2 的泛化 `structured_output` 已经安全地阻断后续验收，但不能区分运行时已知的结构化输出阶段。v3 通过独立 profile、evidence schema 和 once marker 保留一个最小、脱敏的阶段值，避免以重试、raw error 或模糊记录替代根因证据。

主要内容与做法：

- v3 以独立目录、`phase-6.9.5-review-planner-controlled-live-evidence-v3` schema 和 `.review-planner-controlled-live-v3.once` marker 运行；v1/v2 evidence 与 marker 均保持字节级历史记录，不覆盖、不复用、不拼接。
- 唯一一次 v3 provider 尝试终态为 `invalid_attempted / closed / 1 / false / structured_output / provider_json_parse`。`provider_json_parse` 仅是受信 runtime 内部阶段，未进入业务 API、Trace、浏览器或 DTO。
- evidence 只写严格白名单字段；不写 prompt、用户学习事实、candidate JSON、模型输出、凭据、endpoint、HTTP metadata、raw error、stack、token 或成本。默认 `REVIEW_AGENT_MODEL_ENABLED=false`、`PLANNER_AGENT_MODEL_ENABLED=false` 未改变。

边界：v3 失败不是 48-case 质量结论，也不是 zero-call、零成本或账单结论；不重试 v3，不运行 48-case controlled-Live、Docker authenticated suggestions/plan 或可见浏览器验收。v1/v2 同样不重跑；没有创建项目内合成账号或 Trace，因此没有相应清理动作；main 复验和远程推送仍未开始。

验收：v3 evidence 与 once marker 均存在，evidence 为 parseable 的白名单 JSON，保留 `invalid_attempted`、`closed`、`providerAttemptCount=1`、`usageKnown=false`、`structured_output` 与 `provider_json_parse`；v1/v2 没有改写；默认业务 gate 仍关闭。

回顾时可以问：为什么只将 `provider_json_parse` 作为 v3 私有 evidence 字段，而不保存 provider 原文？为什么一次失败后仍必须保留 consumed marker 并停止 48-case、Docker 和浏览器验收？

### 2026-07-16 - Phase 6.9.5 Review / Planner v2 controlled-Live 关闭记录

目标：在 v1 暴露本地 probe 与 canonical Review candidate schema 不匹配后，先完成零网络 schema-contract 修复与复审，再以完全隔离的 v2 profile 验证可满足 schema 的无事实诊断请求；不改变 ReviewAgent / PlannerAgent 的只读、权限和本地 facts 边界。

为什么：v1 的 `structured_output` 不能被误写成 provider 语义质量失败，也不能靠覆盖 v1 evidence 或直接重试来消除。独立 v2 profile 让修复后的本地 contract 与旧证据可审计地分开，同时仍以 provider 实际结果决定是否允许继续。

主要内容与做法：

- v2 使用单独的 evidence schema、目录和 `.review-planner-controlled-live-v2.once` marker；v1 evidence 与 `.review-planner-controlled-live.once` 保持只读、不覆盖、不复用且不合并计数。
- v2 仍固定单 provider attempt、零 retry、4500ms timeout、无用户事实和 JSON-object + canonical schema；业务 `REVIEW_AGENT_MODEL_ENABLED` 与 `PLANNER_AGENT_MODEL_ENABLED` 始终为 `false`。
- v2 最终结果仍是 `invalid_attempted / structured_output`，`providerAttemptCount=1`、`usageKnown=false`、`gate=closed`。只记录严格脱敏的状态摘要，不记录 prompt、candidate JSON、用户事实、模型输出、凭据、endpoint、HTTP metadata、raw error、stack、token 或成本。

边界：v2 结果不与 v1 合并成质量、调用次数或成本结论；不得重跑任一 profile，也不得启动 48-case controlled-Live、Docker authenticated suggestions/plan 或可见浏览器。没有创建合成账号或 Trace，故没有相应清理动作；不执行 main 复验或远程推送。

验收：v1/v2 evidence 与两个 marker 均存在且只含允许字段；v2 summary 为 `invalid_attempted / closed / 1 / false / structured_output`；Nest 默认业务 gate、Compose 默认投影和当前文档结论均为关闭。

回顾时可以问：为什么修复 v1 的本地 schema-contract 后仍需要独立 v2 evidence？为什么两个失败 profile 不能相加后解释为质量、zero-call 或成本结果？

### 2026-07-16 - Phase 6.9.5 Review / Planner v1 controlled-Live 历史记录

目标：在不放开 ReviewAgent / PlannerAgent 的事实或写权限前，使用一次 server-only 受控诊断确认真实模型路径是否具备进入后续 48-case 与项目内验收的资格。

为什么：受限 candidate、Mock 和静态门只能证明工程 contract，不能证明 provider 实际 structured output 可用；同时，已发生的 provider 尝试不能被错误记成 zero-call、零成本或模型质量通过。

主要内容与做法：

- 诊断只允许一次精确 `--confirm-controlled-live` 调用，业务 `REVIEW_AGENT_MODEL_ENABLED`、`PLANNER_AGENT_MODEL_ENABLED` 均保持 `false`；模型无权读写用户业务请求或改变本地 merger 的 facts、FSRS、分钟数、链接和任务。
- 原生 evidence 使用受信目录约束与 once marker。最终文件只保留固定状态、`providerAttemptCount`、`usageKnown`、固定诊断码和 schema version；不写 prompt、用户学习事实、模型输出、API key、endpoint、HTTP metadata、raw error、stack 或 token/cost 数值。
- v1 尝试结果为 `invalid_attempted / structured_output`，`providerAttemptCount=1`、`usageKnown=false`、`gate=closed`。这说明存在一次 provider 尝试，但没有可验证 usage，也没有 quality pass 或生产启用结论。该历史 evidence 保持原样；后续 v2 在单独 profile 中记录，不能倒写或拼接。

边界：v1 不重跑，不跑 48-case controlled-Live，不启动 Docker authenticated suggestions/plan 或可见浏览器；不创建合成账号/Trace，因此没有相应清理动作；不执行 main 复验或远程推送。不得删除、替换 v1 marker 或将 v1 evidence 与 v2 或任何历史 run 拼接。

验收：检查 native evidence 与 marker 只包含允许字段；检查 Nest 默认 gate、Compose 默认投影和文档结论均为关闭。开发测试与 Mock 的既有通过结果仍只证明工程回归，不能覆盖本次 Live 失败。

回顾时可以问：为什么一次 provider 尝试且 `usageKnown=false` 不能按 zero-call 或零成本处理？为什么 `invalid_attempted` 必须停止，而不是直接重试并把后续成功当作同一轮证据？

### 2026-07-15 - Agent-first 路线、12 组件边界与双博客决策

目标：把“先完成全部 Agent 架构，再进入记忆系统”的顺序写成权威开发路线，并为 11 个当前逻辑节点加 Tool-Using Orchestrator 固定职责、通信、权限和初步模型路径。

为什么：旧文档把 Agent 模型化、长期/情景记忆和 Orchestrator 交叉排在 Phase 6.9.5～6.9.7，容易误判 Router/Verifier 收尾等于整个多 Agent/记忆阶段结束；部分文档还把 Review/Planner、KnowledgeDedup/Organizer 的当前 deterministic baseline 写成长期目标，并把 Phase 6.9.4.3 的 Router 延迟失败写成永久结论。

主要内容与做法：

- 新增 `docs/superpowers/specs/2026-07-15-phase-6-9-agent-architecture-completion-design.md`，明确 12 个受治理组件、实时 Chat 主链、阈值/显式业务链、版本化通信 DTO、后端身份权威、按风险授权写操作和失败不扩大权限。
- 确认 Router、Tutor、Verifier、WrongQuestionOrganizer、Retriever 使用模型/规则混合；Review、Planner、KnowledgeDedup、KnowledgeOrganizer、FinalResponse、Memory 候选提取和 Orchestrator 必须有真实模型参与。
- 记录当前工程事实：`createAgentGraph()` 仍只是 descriptor；Retriever/FinalResponse 隐含于 RAG/Chat 链路；Orchestrator 尚未实现。后续必须补成可执行、可恢复、可观测的 LangGraph。
- 重排后续为 Phase 6.9.5～6.9.10 先完成全部 Agent，Phase 6.10 再做结构化长期记忆注入与 Episodic Memory。
- 博客拆为《多 Agent 架构》和《记忆系统》两个独立交付物，题目与结构由用户届时确认，不提前收尾。

边界：本次只修订路线与开发文档，不改变代码、数据库、Docker 状态或历史验收 evidence。Phase 6.9.4.4 仍需完成 Task 8～10 才能标记完成。

验收：检查核心文档中的旧 handoff、永久 deterministic 和单篇合并博客措辞；执行 Markdown diff/空白检查，并由无上下文读者复核职责、阶段和权限是否可独立理解。

回顾时可以问：为什么 Review/Planner 和 Knowledge Agent 需要模型参与但不能让模型掌握事实与写权限？为什么 MemoryAgent 候选提取属于 Agent 阶段，而记忆注入和 Episodic Memory 属于 Phase 6.10？

### 2026-07-11 - Phase 7 Maintenance：Smoke 资源关闭与可见浏览器验收规范

目标：收掉 Phase 7.23.8 质量审查留下的非阻塞技术债，让审计证据包 smoke 在 Queue/Prisma 资源
关闭失败时给出安全、可判断的失败结果，并把真实浏览器验收默认使用可见窗口写入仓库规范。

为什么：业务链路即使已经 PASS，`Queue.close()` 或 `Prisma.$disconnect()` 失败仍说明进程资源没有
正常收口；完全吞掉 rejected result 会让脚本误报成功。但 close failure 不能覆盖更早的下载、清理
等主要错误。另一方面，headless 自动化便于回归，却不能让协作者同步观察真实页面操作。

主要内容与做法：

- `Promise.allSettled()` 结果进入显式 failure selection：使用 `hasFailure` 而不是 truthy 判断，任意
  falsy Promise rejection 也会先规范化为安全 Error。没有更早错误且任一 close rejected 时返回
  `stage=close/code=RESOURCE_CLOSE_FAILED`；已有主链路或 cleanup 错误时保留原错误，不复制 raw close
  reason、token 或依赖消息。
- 新增 RED/GREEN 单测覆盖 close rejected、安全输出、既有错误优先和全部 fulfilled；聚焦 smoke
  27/27 与定向 ESLint 通过。
- 真实 Docker API/Worker/MinIO smoke 再次 PASS：records=4、request/download audit 各 1、
  EXPIRED=true、objectDeleted=true；本轮 ADMIN/STUDENT 临时账号已删除。
- `AGENTS.md` 与验收清单新增 headed 约定：真实页面验收默认把浏览器窗口保持可见；headless 只做
  自动化补充，必须明确标注，不能替代用户要求的可见验收。

边界：本次不新增 Phase 7 能力、不改变证据包业务状态机、API、数据库或 Docker 拓扑；纯 CLI
资源关闭路径没有新增必须通过浏览器操作的页面。

回顾时可以问：为什么资源关闭错误不能被静默吞掉，又为什么不能覆盖更早的业务/cleanup 错误？

### 2026-07-11 - Phase 7.23.8 Audit Evidence Export Delivery Closure

目标：在真实 Docker PostgreSQL、Redis、MinIO、API、Worker、Web 和 Admin Console 上完成审计
证据包从申请、可靠投递、ZIP 生成、下载审计到过期删除的最终验收，并留下可重复运行的安全 smoke
和面试复盘文档。

为什么：

- 申请返回 202 只证明 PostgreSQL facts 已提交，READY 也不足以证明下载 headers/字节、strict audit、
  MinIO 删除和浏览器 Blob 行为正确；最终阶段必须验证跨进程、跨存储真实链路。
- 完整 Compose 同时启动 `server` 与 `worker` 时，如果 API 容器仍用 `both`，会重复注册 processor；
  worker 镜像用户与 tmpfs owner 不一致还会让 crash janitor 因 EPERM 失效。
- 手工验收难以稳定覆盖 STUDENT 403、ZIP 精确内容、manifest/hash、24 小时逻辑过期与 cleanup，
  因此需要确定性脚本锁住最终交付边界。

主要内容与做法：

- Compose 的 `server` 默认改为纯 `api`，Dispatcher/export/maintenance gates 只交给独立 worker；
  worker 运行用户收口为 `1001:1001`，192 MiB tmpfs 同步设置 `0700,uid=1001,gid=1001`。
- 修复 `minio-init` 的 shell argv 结构，让完整 lifecycle script 成为 `/bin/sh -c` 第三个参数；真实 MinIO
  核对到 2 条规则，包含 2 天 expiration/noncurrent、delete-marker 与 incomplete multipart 边界。
- 新增 `smoke:operator-audit-export`：只接收环境变量中的临时 ADMIN/STUDENT token，支持正确的
  `BULLMQ_PREFIX`（默认 `prepmind`），串联申请、轮询、下载、ZIP/CSV/manifest/SHA、审计、维护、
  410 和对象删除；失败只输出安全 stage/code，`finally` 默认精确清理本次合成 facts 和对象。
- Outbox Ops e2e 修正过期 fixture：STUDENT 明确断言 403，后续 200 路径使用已提升的 ADMIN token。
- 中文路径构建流程拆为从 `P:` 只执行 build、从原始 `E:` 工作区执行 runtime Compose；不再使用
  `--project-directory P:\`，避免 lifecycle bind mount 被错误解析到 `P:\minio`。

边界：

- Docker Hub/镜像源无法拉取 `minio/mc` 时，本次只在本机创建未提交的兼容镜像，以真实 MinIO SDK
  执行 Compose 所需四条命令并核对 lifecycle。它不是官方镜像拉取成功，也不是生产方案。
- production 的 export/maintenance/diagnostic gates 仍默认关闭；本地 fallback HMAC secret 不可复用。
- SHA-256 是完整性校验，不是数字签名或不可抵赖；HMAC 来源指纹仍是可关联数据，不是匿名数据；
  证据包是工程上一致的观察结果，不是法律级数据库快照、WORM 或 legal hold。

验收：

- 合同/类型共 14/14；focused Server 35 suites、371 passed、2 个明确 integration skip；完整 e2e
  16 suites、56/56；smoke/config 26/26；Compose contract 13/13；Admin 56/56。database test、
  targeted ESLint、Server/Admin build 与 Admin lint 均通过，migration 无待部署项。
- 配额、幂等与恢复边界用以下聚焦门禁复核：

  ```powershell
  bun --filter @repo/server test -- operator-audit-export-request operator-audit-export-archive operator-audit-maintenance operator-audit-export-requested operator-audit-export-temp-janitor worker-readiness --runInBand
  ```

  结果为 12 suites、130 tests 通过，1 个需显式 Redis integration flag 的 suite/test 跳过。用例明确覆盖
  same actor/clientRequestId 同 hash 只产生一份 facts/一条 request audit、不同 hash 409、每管理员
  active=2/小时=10/全局 active=10 时 429；Redis enqueue failure 回到 Dispatcher retry/dead-letter；
  DEAD 24 小时内保留、超过窗口转 `DELIVERY_ABANDONED`；pre-count=50,001、archive byte limit=64 MiB、
  temp disk 不满足严格余量时均 fail-safe；janitor 只清安全失效 token 且不碰 active Bull job。

- 真实 API/queue/storage smoke 输出 `Operator audit export smoke: PASS`，记录数 1，request/download
  audit 各 1，EXPIRED=true、objectDeleted=true。浏览器在 Docker Admin Console 完成真实申请、下载、
  审计、过期与普通用户拦截：ZIP 777 bytes，console/page error 0，body 横向溢出 0；匿名 refresh
  401 是预期登录探测，不计为页面错误。
- 清理后合成 exports 7、audits 13、outbox 7、SYSTEM jobs 7、users 2 均删除，MinIO objects 0；
  worker `healthy`、failing streak 0，maintenance state 为 `SUCCEEDED`。未停止用户现有 Docker 基础设施。
  这组清理计数来自真实验收 helper，不是 smoke 单独负责删除用户；smoke 只精确清本轮 export facts、
  Bull jobs 与对象，预先准备的 ADMIN/STUDENT 账号在整轮浏览器验收后另行删除。
- 功能分支在 cleanup/固定 API role 修复后 smoke 记录数 4；再补 maintenance terminal wait 后最终
  smoke 记录数 5。两次均 request/download audit 各 1、EXPIRED=true、objectDeleted=true；按 export id
  查询 users/export/outbox/audits 为 `0|0|0|0`。容器内 readiness 为 `ready`：knowledge/export queue 均 waiting/active/delayed/failed=0，
  maintenance queue 仅保留 1 个预期 repeatable delayed job，maintenance current、online worker=1、
  outbox dead=0/backlog=false、issues=none。

回顾时可以问：为什么证据包真实验收必须同时覆盖 API/Worker 拓扑、ZIP 字节、下载审计、
维护删除和 cleanup，而不能把 202 或 READY 当成完成？

### 2026-07-11 - Phase 7.23.7 Admin Audit Evidence-Package Workspace

目标：在独立 Admin Console `/audit` 内完成“审计记录 / 证据包”工作台，让管理员沿用同一组脱敏筛选申请证据包、观察异步状态、查看安全详情并下载 READY ZIP。

为什么：

- 网络或 5xx 可能发生在服务端已提交之后；每次点击生成新 UUID 会把重试变成重复申请，但表单变化后复用旧 UUID 又会造成同 id 不同 hash 冲突。
- ZIP 不是 JSON envelope，下载仍需携带管理员 Bearer token，并显式约束文件名、哈希和 object URL 生命周期。
- 五态异步任务需要非颜色状态解释、active-only polling 和合法的同级交互控件。

主要内容与做法：

- `/audit` 提升共享 `AuditFilterState`，用支持 ArrowLeft/ArrowRight/Home/End 的 `tablist/tab/tabpanel` 切换审计记录与证据包；证据包申请默认继承 action/status/target/actor filters。
- create/list/detail 全部经过 `@repo/types` shared strict Zod schema；list 只序列化批准的 query。通用 API client 新增 authenticated POST Blob path，安全解析 attachment 文件名和 `X-Content-SHA256`；失败响应才解析 JSON envelope，普通 JSON 行为不回归。
- 申请带明确 31 天/50,000 条边界与 reason/date `aria-describedby` 错误关联。pending request 保存 `clientRequestId` 与继承筛选签名：网络/5xx 且完整表单未变时重用，任一字段或父 filters 变化时清理，成功后清理并只说明排队中。
- 列表支持稳定 cursor 加载并按 id 去重，只在存在 QUEUED/PROCESSING 时每 5 秒更新。固定 detail aside 展示筛选、reason、SYSTEM BackgroundJob id、记录数、文件大小、CSV/ZIP SHA-256、时间线与安全错误。
- FAILED 提示缩小范围；EXPIRED 说明文件已删除且没有恢复/延长动作；仅 `READY && canDownload` 显示同级 Download/Copy icon buttons。Blob 下载用临时 `<a download>` 触发，`finally` 始终 remove anchor 并 revoke object URL。

边界：

- 不改后端 API/contract，不使用 presigned URL，不展示 objectKey、processingToken、requestHash、payload、metadata 或 lease，不提供延长、恢复文件或编辑对象。
- 浏览器验收使用 Admin dev server + Playwright route interception + local ADMIN session，不代表真实 PostgreSQL/Redis/Worker/MinIO/下载审计全链路；Phase 7.23.8 继续真实 Docker 验收。

验收：

- TDD 将申请 pending/reuse/reset 决策与 cursor page merge 提取为纯函数，持久测试覆盖 network/5xx 同签名复用、reason/date/父 filters 变化清理且改回旧值不复活、成功/终态失败清理，以及重复 id 保留最新页版本和首次顺序。源码 contract 只负责静态安全/wiring 边界；jsdom + Testing Library 真实渲染生产共用 tabs/row，验证 ArrowLeft/Right/Home/End、焦点、单一可见 panel 和无嵌套 button。Admin 完整测试 56/56，ESLint、Next build、types typecheck、Server build 通过。
- Headless Chromium 1440×900 与 1024×768 均完成 QUEUED→PROCESSING→READY、tabs 键盘、错误关联、长 id/hash、固定轨道及 download/copy；两尺寸 console error 0、page error 0、横向溢出 0。临时脚本、截图、dev server 与 next-env 已清理。

回顾时可以问：前端为什么要在网络失败后复用 clientRequestId，而不是每次点击都生成新 UUID？

### 2026-07-11 - Phase 7.23.6 Operator Audit Query and Fail-Closed Download API

目标：为 Phase 7.23.5 已生成并维护的审计证据包提供受支持的系统级 ADMIN 查询、详情与安全 ZIP 下载入口，同时保证内部 MinIO/fencing 字段不越过 API 边界，任何下载字节都不能绕过 strict operator audit。

为什么：

- 没有 list/detail API 时，管理员无法发现其他管理员申请的系统级证据包，也无法用稳定游标安全翻页；仅暴露对象 key 或 presigned URL 会把存储实现和凭据边界推给浏览器。
- 下载审计如果写在打开 MinIO 流之前，会记录并未准备成功的下载；写在返回字节之后，又可能先泄露内容再发现审计失败。因此必须先确认对象流可读，再 fail-closed 写 strict audit，最后才交给 HTTP 响应。
- 全局 response envelope 适合 JSON，但不能包装 ZIP；浏览器还需要明确的安全文件名、哈希、长度、缓存与 CORS exposed header 合约。

主要内容与做法：

- 新增 `OperatorAuditExportQueryService`：list/detail 都是经过既有 audit gate、export gate、JWT、OperatorGuard 的系统级 ADMIN 视图，不按 current admin 限定 `requestedByUserId`。列表按 `createdAt desc, id desc` 排序，cursor 先按 id 找回 createdAt，再使用 `(createdAt,id)` 复合小于谓词；未知 cursor 返回空页，不退化为不稳定 offset。
- 每个 list/detail 响应只读取一次数据库 `clock_timestamp()`；`canDownload` 仅在 READY、`expiresAt > DB now` 且内部 objectKey/fileName/archiveSha256 完整时为 true。objectKey 仅以最小内部 select 参与布尔派生，显式 mapper 再经过 shared strict response schema，绝不进入 DTO；requestHash、processingToken、leaseExpiresAt、payload、metadata 等不 select/不返回。
- 新增 `POST /operator-audit-exports/:id/download`，不使用 presigned URL。服务端净化文件名为 `[A-Za-z0-9._-]`，无安全字符时固定回退 `prepmind-operator-audit-export.zip`；响应为 `application/zip`、`Cache-Control: no-store, private`，并携带 `Content-Disposition`、`Content-Length` 与 `X-Content-SHA256`。全局 interceptor 对 Nest 同一运行时的 `StreamableFile` 原样旁路，普通 JSON 仍保持 envelope；CORS 只新增暴露文件名与 SHA-256 两个响应头。
- 下载 service 严格按 load export → database now → 校验 DB archiveSize 为正数且不超过配置上限 → open MinIO stream → 核对 MinIO stat size 与 DB 完全一致 → strict `AUDIT_EXPORT_DOWNLOAD` → return stream 执行。size mismatch 与 strict audit 失败都会先销毁已经打开的 stream；对象 confirmed missing 会 best-effort 记录失败审计并用 `id + READY + exact objectKey` CAS 标记 `FAILED/EXPORT_FILE_MISSING`，MinIO 暂时不可用只返回安全 502、不错误降级数据库事实，也不泄露 raw storage error。size mismatch、strict audit failure 与 missing CAS persistence failure 只记录固定 warning，不拼接 raw error、objectKey、连接信息、用户正文或实际/预期 size。
- 状态边界固定为 not found 404、QUEUED/PROCESSING/FAILED 409、EXPIRED 或 READY 已到期 410、文件不可用 502、strict audit 失败 503。成功下载审计表示服务端已经授权并准备好对象流，不表示浏览器一定持久化了全部字节。

边界：

- 本阶段未实现 Phase 7.23.7 Admin UI、Phase 7.23.8 Docker 全栈/博客，不启用 production gate，也不引入 presigned URL。
- 下载是 POST，ZIP 是全局 JSON envelope 的唯一新增二进制例外；错误响应仍使用安全 JSON envelope。

TDD 与验收：

- query、download、storage、controller/module、response envelope 与 bootstrap 均先取得预期 RED 再实现 GREEN；focused 总集合 5 suites / 50 tests、最终 download 20/20，storage+download 合计 50 tests 通过。
- 新增真实 PostgreSQL API e2e 1 suite / 9 tests，覆盖 gate-off 认证前 404、无 token 401、STUDENT 四入口 403、ADMIN B 下载 ADMIN A、ZIP signature/非 JSON、安全 headers、download audit actor、410/409/502/503、missing CAS、strict audit 流销毁、内部字段不泄露与 legacy/HMAC 指纹 opaque correlation。
- Server full test 69 suites / 626 tests 通过，2 个 opt-in suites / tests 按预期跳过；Server build、changed-file ESLint/Prettier 与 `git diff --check` 通过。e2e 清理后测试用户、export 与 fingerprint audit 残留均为 0；测试使用 API role 与 StorageService override，未写入 MinIO、Redis 或明文 temp。

回顾时可以问：

- “为什么下载必须在打开对象流之后、返回字节之前 fail-closed 写审计？”
- “为什么 objectKey 可以被 query service 最小读取来派生 canDownload，却绝不能进入 response mapper？”
- “为什么 confirmed missing 要 CAS 标记 FAILED，而 MinIO unavailable 不能直接改写 READY？”

### 2026-07-10 - Phase 7.23.5 Operator Audit Retention Maintenance

目标：把 Phase 7.23.4 生成但尚未自动回收的证据包和审计历史接入可恢复、可观测的小时级维护闭环，同时保证 180 天清理不会踩到刚申请或长时间执行的导出。

为什么：

- `expiresAt` 只能表达 24 小时逻辑失效，不能代替 MinIO 物理删除、失败 attempt orphan 回收和终态 metadata 清理；维护暂时故障时还需要 48 小时 lifecycle 兜底。
- 直接按 `now - 180 days` 删除会和导出申请/读取形成竞态。申请与维护必须共享 retention advisory lock，维护还要把最早 `QUEUED/PROCESSING.startAt` 纳入 active-export 水位。
- 只按任务年龄修复僵尸状态会误杀仍在 BullMQ active 的 Worker；只按目录年龄清理明文则可能删除仍持有有效 processing token 的归档。

主要内容与做法：

- 新增每小时 `operator-audit-maintenance` scheduler，payload 严格固定为 `{schemaVersion:1}`，processor 本地 `concurrency=1` 且只调用 `maintenance.run()`；仅 `worker|both + maintenance gate` 注册，并在应用 bootstrap 把 maintenance queue 的 BullMQ global concurrency 固定为 1，使多个 worker replica 也只能串行维护。不接受 actor/user/filter，也不创建账号 BackgroundJob 或 OperatorAuditLog。
- `run()` 全程以 database clock 为准并持久化 singleton `RUNNING -> SUCCEEDED/FAILED`。READY 到 24 小时后先删除 selected object、列举严格 export prefix 并清 orphan，成功后才 CAS 为 `EXPIRED/objectKey=null/expiredAt`；missing 幂等，MinIO unavailable 保留 DB 事实等待重试。FAILED/EXPIRED prefix 与 180 天前终态 metadata 同样遵循“对象先空、数据库后删”。
- 审计日志每批最多 1,000、每次最多 20 批；每批使用新的短事务重新取得 retention advisory xact lock、DB clock 和 `effectiveCutoff=min(now-180d, oldestActive.startAt)`，再按 `(createdAt,id)` 删除。真实 PostgreSQL 交错测试证明 request 校验后、commit active watermark 前维护无法越过共享锁。
- Outbox `DEAD` 保留 24 小时人工 requeue 窗口，超窗后同事务把 Export/SYSTEM job 标为 `FAILED/DELIVERY_ABANDONED`。PROCESSING 只有超过一小时、lease 已过期且 Bull job 非 active 时才以双表 CAS 修复；Redis active 时保持原状。
- crash janitor 在 worker module init 及每次 maintenance 后运行，只接受严格 `prepmind-audit-export-<safeExportId>-<uuidToken>`，并同时验证 DB token/lease、Bull job state 和 realpath 仍在安全 temp root 下；绝不只按年龄删。默认明文根改为 `os.tmpdir()/prepmind-audit-exports`，POSIX 0700，Compose worker 用 192 MiB tmpfs 承载，为严格 `free > 2 * 64 MiB` preflight 留出余量。
- Worker heartbeat 固定声明 knowledge、audit export、audit maintenance 三队列。Readiness/Observability/CLI/Admin Worker 页分别展示三队列和 maintenance freshness；启用后超过两小时未成功为 fail，paused queue not-ready，failed job degraded，关闭 export/maintenance 不拖垮健康的 knowledge worker。
- Compose 新增 `minio-init` 导入 `operator-audit-exports/` 2 天 expiration、2 天 noncurrent、1 天 incomplete multipart 与 expired delete-marker 规则；这是 48 小时物理兜底。production 若启用 versioning，仍需在部署验收中确认 noncurrent/delete marker 真正清理。

边界：

- 本阶段没有实现 Phase 7.23.6 list/detail/download API 或 fail-closed 下载审计，也没有实现 Phase 7.23.7 证据包管理 UI；Admin 只扩展既有 Worker 健康页。
- 24 小时是 API/领域逻辑过期，小时任务负责正常物理清理，48 小时 lifecycle 只是故障兜底，不能把 lifecycle 延迟描述成可继续下载的 TTL。
- production gates 继续默认关闭；local Compose 显式开启只服务开发验证。维护失败仅持久化 `sanitizeJobError().slice(0,240)`，日志和 readiness 不输出路径、payload、用户内容或连接串。

TDD 与验收：

- 首批 maintenance/scheduler/processor/janitor RED 因模块不存在失败，GREEN 11/11；terminal selected object 回收用例先 RED 后修正，最终 maintenance 4 suites 13/13，含20批上限、terminal metadata、状态 counters 和真实 PostgreSQL 锁交错。
- 追加质量复审先以启动契约 RED 证明 maintenance 缺少 global concurrency provider，再新增 bootstrap `setGlobalConcurrency(1)`；真实 Redis 双 Worker/双 job 阻塞验证 1/1 通过，第二个 job 在首个释放前保持 waiting，最大 active 始终为 1。既有 export queue 的 global concurrency=1 与 global-first paused Worker 启动顺序保持不变。
- Readiness strict contract 先拒绝三个新字段；server readiness 首轮 11 failures、observability 首轮 11 failures、heartbeat queue list 1 failure 均按预期 RED，补三队列独立采集与 freshness 后 GREEN。Docker source contract 先因 lifecycle JSON 缺失 RED；archive bounded temp root 先因 helper 缺失 RED，随后归档/janitor/Docker 25/25。
- 阶段聚焦验证 12 suites 71/71；Admin 34/34，Server/Admin build 与 Compose config 通过。完整 Server 为 66 suites / 578 tests 通过、1 个显式 opt-in integration 跳过，types/database/frozen-lock 均通过。

回顾时可以问：

- “活跃导出水位如何避免 180 天清理与长时间导出互相踩踏？”
- “为什么 DEAD 事件要保留 24 小时恢复窗口，而 PROCESSING 又必须结合 lease 和 Bull job state？”
- “24 小时逻辑过期、小时级物理清理和 48 小时 lifecycle 分别解决什么问题？”
- “crash janitor 为什么不能只看目录年龄？”

### 2026-07-10 - Phase 7.23.4 Operator Audit Export Fenced ZIP Worker

目标：把 Phase 7.23.3 已可靠投递的 `operator-audit-export` BullMQ job 变成真正可执行的单并发证据包 Worker，在固定快照内生成脱敏 CSV + manifest ZIP，并保证失去 lease 的旧 Worker 无法覆盖新证据包。

为什么：

- BullMQ lock 只保护 Redis delivery；进程暂停、网络抖动或 lock/lease 丢失后，旧进程仍可能继续写 PostgreSQL 或 MinIO。仅靠 job id 幂等不能阻止“旧 attempt 最后完成并覆盖新 attempt”的僵尸写入。
- 审计 CSV 会被 Excel 等表格软件打开；只做 RFC CSV quoting 不能阻止 `=`, `+`, `-`, `@` 公式注入，也不能防住 tab、CR、NBSP 或全角空格前缀绕过。
- 证据包必须对应一个稳定的审计快照，且不能把 `metadata`、原始来源、secret 或任意用户正文带入归档；本地 plaintext 和未被数据库选中的对象也不能长期残留。

主要内容与做法：

- 新增 strict Bull payload，仅允许非空 `exportId/backgroundJobId`。状态仓库每次使用 `clock_timestamp()`，在同一事务内复核 Export 与 `scope=SYSTEM/userId=null` BackgroundJob 的 queue/job/resource 关联事实，并用随机 processing token、lease 和 `updateMany` CAS 同步执行 claim/renew/retry/fail/ready；任一事实 CAS 丢失都会回滚，旧 token 不能选择 object key。
- Worker 仅在 `SERVER_ROLE=worker|both` 且 export、Outbox Dispatcher、maintenance 三个 gate 都显式为 `true` 时注册。BullMQ 本地 concurrency 固定为 1；processor 先以 `autorun=false` 注册，应用 bootstrap 再先写入 queue global concurrency=1、后启动 Worker，避免多副本突破生产单并发不变量。`worker.run()` 的 Promise 会立即绑定 rejection handler；若初始化或主循环退出，只记录不含 raw error/连接信息的固定 fatal 日志，设置 `exitCode=1` 并发送 `SIGTERM`，signal 失败则显式 `exit(1)`，让编排器重启而不是留下在线但不消费的进程。600 秒 Bull lock 不变；live lease 通过 `moveToDelayed(leaseExpiresAt + 1000)` + `DelayedError` 延迟，已用 BullMQ 5.79.2 + 真实 Redis 验证 delayed 状态 `attemptsMade=0`。处理中每 `lease/3` 由 interval 续租；归档完成后/上传前以及上传后分别同步 renew/recheck。失败状态 CAS 的数据库结果不确定时同样 delayed 到 lease 恢复窗口，不消耗当前或最后一个 Bull business attempt。
- 归档查询使用 Prisma interactive transaction + `RepeatableRead`、`SET TRANSACTION READ ONLY` 和仅由已验证数字配置生成的 `SET LOCAL statement_timeout`。effective end 为 `min(endAt,snapshotAt)`；先 count，再按 `createdAt ASC,id ASC` 的复合 keyset 每页 1,000 条流式读取，pre-count 与 streamed count 都执行 50,000 条上限，select 明确排除 `metadata`。
- CSV 固定 13 列、UTF-8 BOM、CRLF 和末尾 newline；先复用 secret sanitizer，再逐字符跳过 Unicode 空白与将被移除的非法 C0/DEL 控制字符，检查首个有效字符是否为公式前缀；之后规范 CRLF、移除非法控制字符并在必要时加单引号，由 `csv-stringify` 负责成熟 quoting。manifest v1 固定包含 range、null filters、query timestamps、record count 与 CSV SHA-256。
- 使用 `archiver@7.0.1` level 9 只写 `records.csv/manifest.json`。最初安装的 archiver 8 是 ESM-only，与当前 CommonJS Jest/Nest 加载边界不兼容；固定成熟的 7.0.1 并对齐 `@types/archiver@7.0.0`，避免把 Jest VM 绕过逻辑带入生产代码。归档 byte-count transform 同时计算实际 archive SHA-256 并在超过 64 MiB 时安全终止。
- plaintext temp 路径位于 `os.tmpdir()/prepmind-audit-export-<exportId>-<token>`；创建前要求可用空间严格大于 `2 * maxArchiveBytes`，内部失败自动清理，成功则由 processor `finally` 清理。`0700/0600` 只在 POSIX/Linux 容器形成明确权限保证；Windows 本地沿用临时目录继承 ACL，不能把 mode 数字等同于 Windows ACL，且 production export gate 默认关闭。
- MinIO key 固定为 `operator-audit-exports/<exportId>/attempts/<processingToken>.zip`，id/token 和 read/delete/list 都重新执行严格 grammar。只有当前 token 的 `markReady` CAS 能把 attempt key 写成数据库权威 object key；若 PostgreSQL commit 已成功但 ACK 丢失，Worker 会读取 Export + SYSTEM BackgroundJob 双事实：`READY + SUCCEEDED + 同 objectKey` 视为已提交并保留对象；明确仍是当前 token、已由其它 token 接管或终态未选择该 key 时才允许删除。reconciliation 不可用或结果不确定时保留对象并 delayed，未被权威 key 选中的 orphan 由 Phase 7.23.5 维护回收。missing 白名单为 NoSuchKey/NoSuchObject/MinIO 8 bodyless NotFound/HTTP 404，其余统一为不复制 raw message 的 unavailable。

边界：

- 本阶段没有实现 Phase 7.23.5 保留维护、stale repair/readiness 指标、Phase 7.23.6 list/detail/download API、fail-closed 下载审计、Admin UI 或 Docker 运行验收；production gates 仍默认关闭。
- safe DTO 仍不返回 object key、processing token、payload 或 metadata；MinIO export prefix 不进入既有公开图片/资料读写路径。下载前的对象存在性、range、响应头和下载审计属于后续阶段。

TDD 与验收：

- State RED 因 payload/repository 缺失失败，GREEN 11/11；CSV RED 因模块缺失失败，GREEN 5/5；Archive RED 因 service 缺失失败，首轮 GREEN 解决 ESM/CJS 依赖兼容后为 6/6，补充 1,001 行复合 keyset 后为 7/7。
- Storage RED 为 6 个新行为失败、18 个既有行为通过，GREEN 24/24；Processor RED 因模块缺失失败后 GREEN 10/10，role-bound provider RED 为 1 failed + 10 passed，首轮 GREEN 11/11。
- 交付前只读审查新增 RED 5 failed + 22 passed：精确复现 interval renew exception 静默完成、C0 清理后公式显露、MinIO ACK-lost orphan、manifest secret 与 archiver warning 缺口；修复后 CSV 5/5、Archive 9/9、Processor 13/13，共 27/27 GREEN。
- 质量复审按 TDD 新增 12 个 RED：覆盖 READY commit-ACK ambiguity、reconciliation 不可用、retry/final 状态 CAS 数据库失败、三 gate 注册矩阵、MinIO 8 `NotFound` 与 concurrency>1 配置；首轮 GREEN 后 4 suites 93/93。随后为消除启动竞态再新增 lifecycle RED，确认缺少 `onApplicationBootstrap`，改为 paused Worker + global-first bootstrap 后 Processor 18/18 GREEN。
- Worker run rejection 复审继续按 TDD：lifecycle RED 为 1 failed + 18 passed，证明 `run()` 未附加 catch；立即绑定 handler 后 19/19 GREEN。fatal service/process control RED 为 3 failed + 18 passed，接入固定日志与受控 SIGTERM 后 21/21 GREEN；最后用 signal-failure RED 证明原始错误会逃逸，补 `exit(1)` fallback 后 Processor 22/22 GREEN，测试全程 mock process control，未真实终止测试进程。
- BullMQ delay integration 首次运行已经证明 delayed 时 attempt 不增加，同时纠正了“成功 delivery 完成后仍应为 0”的过严测试假设；最终真实 Redis 1/1 通过并清理唯一测试 queue、job、Worker、QueueEvents 与连接。该 spec 只在显式文件 pattern 或 `test:integration:audit-export-delay` opt-in 时连接 Redis；质量修复后的默认完整 unit suite 为 61 suites、552 tests 通过，仅该 1 suite/1 test 跳过；另用 BullMQ 正式 `setGlobalConcurrency/getGlobalConcurrency` 对真实 Redis 验证 queue global concurrency 为 1。
- 聚焦 env/归档/状态/CSV/processor/storage 6 suites 共 112/112 通过；`main...HEAD` 全部 15 个 changed Server TS 定向 ESLint/Prettier 与 Server build 通过。依赖分类、temp/Redis cleanup、敏感串断言和 Phase 7.23.5+ 越界均已自审。

回顾时可以问：

- “processing token 如何阻止失去 lease 的旧 Worker 覆盖新证据包？”
- “为什么 attempt-fenced key 还必须配合数据库选中的 object key，而不能只依赖 MinIO 覆盖写？”
- “为什么公式检测必须早于 tab/CR 等控制字符清理？”
- “为什么审计查询选择只读 REPEATABLE READ，而申请事务仍使用 Serializable？”

### 2026-07-10 - Phase 7.23.3 Operator Audit Export 事务型可靠投递

目标：让 PostgreSQL commit 成为审计证据包申请的唯一成功边界，并由 Outbox Dispatcher 独占 PostgreSQL -> Redis/BullMQ 桥接，消除“数据库成功但 Redis enqueue 失败”的双写窗口。

为什么：

- request path 若在数据库事务之外直接调用 `queue.add()`，PostgreSQL 与 Redis 任一侧失败都会留下“有任务无队列”或“有队列无事实”的不可原子恢复状态。
- 证据包申请是高权限操作；Export、SYSTEM BackgroundJob、可靠投递事件和 `AUDIT_EXPORT_REQUEST` 必须同生共死，审计写失败不能像普通运维观测那样吞掉。
- Dispatcher 面对 retry、进程崩溃和重复 claim 时，必须用 deterministic Bull job id 和数据库关联事实复核来保证重复投递安全。

主要内容与做法：

- 新增 `POST /operator-audit-exports`，guard 顺序为 Operator Audit gate、export gate、JWT、Operator；export gate 关闭时认证前返回 404。body 使用 strict shared schema，非法 UUID/reason/date/unknown field 转为安全领域 400，不暴露 Zod issues；strict request audit 写失败回滚并返回安全领域 503。Swagger 明确完整 body properties/formats/length/enums、`additionalProperties:false` 与安全 202/400/409/429/503 样例。
- request service 在事务前生成 export/job UUID；Serializable 事务内依次以 `$executeRaw` 取得 retention/quota advisory locks，再用 database clock 校验 `start < end`、31 天上限、180 天下界、未来 end，并执行每管理员 active 2 / 每小时 10 / 全局 active 10 配额。Prisma 无法反序列化 advisory lock 的 `void` 返回，因此锁不能使用 `$queryRaw`。
- 首条 advisory lock 等待会在释放前固定 Serializable snapshot；整个 interactive transaction 没有事务外副作用，因此事务任意阶段（包括 strict audit create）只有 P2034、raw PostgreSQL 40001、明确 target 为 `OperatorAuditExport.[requestedByUserId,clientRequestId]` 的 P2002 才最多重跑 5 次。normalized input 与预生成 export/job UUID 跨 attempts 复用，每次 attempt 重新取锁与 DB clock；其它唯一冲突/错误原样失败。
- actor + clientRequestId + stable normalized request hash 支持幂等重放；lookup 先于滚动 retention/future 窗口校验，因此旧请求越过 180 天边界后同 hash 仍返回既有 DTO 且不重复写审计，不同 hash 仍优先返回 `OPERATOR_AUDIT_EXPORT_IDEMPOTENCY_CONFLICT`/409。只有 lookup 未命中的新申请才执行窗口、配额校验，并按 Export -> SYSTEM BackgroundJob -> OutboxEvent -> strict audit 顺序写入同一事务。
- `OutboxService.enqueueInTransaction()` 只使用传入 transaction client 且不 catch/root fallback；既有 `enqueue()` unique-key recovery 不变。Outbox payload 严格只有 `exportId/backgroundJobId`。
- `OperatorAuditService.recordSuccessStrict()` 可使用 transaction 或 root Prisma client 并传播错误；既有 success/failure 入口仍 warning-only，所以申请 audit 是 fail-closed/strict，Outbox requeue audit 仍 best-effort。来源指纹改为 `OPERATOR_AUDIT_FINGERPRINT_SECRET` 驱动的 `hmac-sha256:<64 hex>`。
- 注册 `operator-audit-export` queue 和 injectable bound-arrow handler。handler 严格校验 payload、Export 与 linked SYSTEM BackgroundJob；FAILED/EXPIRED、已交付的 PROCESSING/READY + ACTIVE/SUCCEEDED、已有 Bull job 都 no-op，只有 QUEUED export + QUEUED BackgroundJob 才以 BackgroundJob id 作为 Bull job id 投递，其余未批准状态组合按 invalid payload 进入 retry/dead-letter；Redis 错误原样传播。

边界：

- 当前没有 ZIP processor、CSV/manifest、MinIO 上传、保留维护、list/detail/download API、fail-closed 下载审计或 Admin UI；queue 中的 generate job 还没有消费者，不能把可靠投递理解成证据包已经能生成。
- export/maintenance production gates 继续默认关闭；本阶段没有新增 migration、没有改变知识库 queue-first + best-effort observer 语义，也没有让 API request path 直接接触 Queue。
- DEAD 事件仍可通过既有受审计 requeue 在设计的 24 小时投递恢复窗口内恢复；申请审计严格失败关闭，但既有 Outbox requeue 审计继续 best-effort。

验收：

- RED：指定 service 命令 4 个 suite 失败，分别证明 request service/handler、transactional enqueue、strict audit 与 HMAC 能力缺失；既有 15 项仍通过。
- GREEN：聚焦事务/handler/controller/audit/outbox 回归 11 个 suite、126 项通过；完整 Server 回归 57 个 suite、491 项通过；真实 PostgreSQL concurrency e2e 3/3 通过，三个场景均捕获 Prisma `P2034`、`target=undefined` 并由 bounded retry 恢复。定向 ESLint、changed-file Prettier 与 Server build 通过。
- 覆盖精确七步事务顺序、rollback 传播、同 hash replay/异 hash conflict、四类时间边界、三类配额、无 Queue 依赖、guard 顺序、strict payload、linked SYSTEM facts、Bull job 幂等/no-op 和 Redis 失败传播。

回顾时可以问：

- “事务型 Outbox 如何消除 PostgreSQL 成功但 Redis enqueue 失败的双写窗口？”
- “为什么 Serializable + advisory lock 需要 bounded whole-transaction retry，而不是改成 Read Committed？”
- “为什么 request audit 要 fail-closed/strict，而 Outbox requeue audit 仍然 best-effort？”
- “为什么 Dispatcher enqueue 前还要复核 Export 与 SYSTEM BackgroundJob，而不是只信 Outbox payload？”
- “领域 400/503 如何避免 Zod issues 与原始数据库错误进入响应？”

### 2026-07-10 - Phase 7.23.2 Operator Audit Export Contract 与持久化地基

目标：先固定证据包申请/查询的安全 contract、可恢复的导出领域事实和跨用户生命周期的 SYSTEM 后台任务语义，让后续可靠投递、Worker、维护任务和 API 建立在同一组数据库不变量上。

为什么：

- 账号级 `BackgroundJob` 原本通过 `userId` 外键级联删除，若直接承载审计导出，请求人删除会同时破坏仍需保留的导出事实与执行事实。
- 导出 DTO 必须在 API 实现前严格排除 object key、request hash、processing token、payload 与 metadata，避免内部投递/存储字段进入公共 contract。
- lease、BullMQ lock、stale repair 与 query timeout 有顺序约束；production 任一审计查询、Outbox 操作或导出路径开启后都必须具备至少 32 字符的 fingerprint secret，因此错误组合要在 bootstrap 时 fail fast。

主要内容与做法：

- 新增 `@repo/types/api/operator-audit-export` strict Zod contract：五种状态、UUID 幂等键、递增 ISO range、3~240 字符 reason、nullable filters、安全 detail/list 与稳定 cursor；`OperatorAuditAction` 增加 request/download actions。
- Prisma 新增 `OperatorAuditExport` 与 singleton maintenance state；`backgroundJobId` 唯一但无外键，`requestedByUserId` 删除时 `SET NULL`。`BackgroundJob` 增加 ACCOUNT/SYSTEM scope，数据库 CHECK 强制 ACCOUNT 有 user、SYSTEM 无 user，既有用户外键继续 `ON DELETE CASCADE`。
- 账号 `BackgroundJobsService` 的 create/find/count/update/list/summary，以及知识库 direct active count、create、active find、enqueue-failure update 全部显式带 `scope=ACCOUNT`，required `userId` 签名和 DTO 不变。数据库 e2e 使用隔离用户与定向清理，真实验证 FK、CHECK、`SET NULL` 和 service scope。
- export/maintenance gates 在所有环境默认关闭；worker/both 开启 export 时必须同时开启 Dispatcher 与 maintenance。配置层约束 `lease < Bull lock < stale` 且 `query timeout < stale`；production 显式开启 Operator Audit、Outbox Ops 或 audit export 任一路径都必须提供 trim 后至少 32 字符的 secret，非 production fallback 也满足长度要求。本阶段只做配置门禁，不实现 HMAC hashing。
- export list query 拒绝 `createdFrom > createdTo` 并允许相等边界；strict nested filters characterization 证明内部 `objectKey` 不能藏进 filters。
- Docker server 镜像以 `NODE_ENV=production` 运行，而 dev Compose 显式开启 Outbox Ops 与 Operator Audit；因此只在 `docker-compose.dev.yml` server environment 提供可覆盖的 `local-dev-audit-fingerprint-change-me` fallback。`Dockerfile.server` 不烘焙该 secret，真实 production 必须提供独立值并禁止复用本地 fallback。

边界：

- 没有实现导出申请事务、Outbox 可靠投递、BullMQ queue/handler、ZIP Worker、MinIO、180 天保留清理、HTTP API、下载审计或 Admin UI。
- request/download actions 只是 contract/enum 预留，export/maintenance 表没有运行时写入者；两项 production gate 保持关闭，不能把 schema 落库理解成已交付运行能力。

验收：

- RED：contract 因缺失模块/actions 失败；env/account-scope 定向测试 13 项按缺失 key/scope 失败；数据库 e2e 3 项按 Prisma 不认识 scope、SYSTEM 仍要求 user 失败；首次 Server build 发现旧审计 row type 仍只接受 `OUTBOX_REQUEUE`。
- Quality review RED：env 定向测试分别暴露 production Outbox Ops、API-role export 与短 secret 未拒绝；list query reversed window 未拒绝；知识库 direct BackgroundJob count/create/find/update 都缺少 ACCOUNT scope。
- Characterization：nested filters strict test 首次即通过；两条数据库负例首次运行时 PostgreSQL 已通过 `BackgroundJob_scope_user_check` 拒绝，只需把断言从不存在的 Prisma `P2004` code 改为匹配真实 constraint wrapper。
- Spec re-review RED：`docker-compose-readiness` 10 项通过、1 项失败，定位到 dev Compose 在 production runtime 下开启审计 gates 却没有提供新要求的 fingerprint secret；修复后 suite 11 项通过，并确认 secret 只属于 server service、未写进 production Dockerfile。
- GREEN：contract 14 项与 types typecheck 通过；required Server focused gate 64 项通过；migration 在本地 `5433` PostgreSQL 成功部署；database typecheck、background-job-scope e2e 5 项与 Server build 通过。
- e2e 证明两种非法 scope/user 组合都被数据库拒绝、ACCOUNT job 随 user 删除、SYSTEM job 与 export 在 requester 删除后保留、`requestedByUserId` 置空且 `backgroundJobId` 不变，并证明账号 service 不能读取 SYSTEM job。

回顾时可以问：

- “为什么 `OperatorAuditExport.backgroundJobId` 唯一但不建立外键？”
- “ACCOUNT job 的 `userId + scope` 双重过滤和数据库 CHECK 分别防什么？”
- “为什么 export/maintenance 在所有环境默认关闭？”
- “lease、BullMQ lock、stale repair 和 query timeout 为什么必须有严格相对顺序？”

### 2026-07-10 - Phase 7.23 实施计划就绪

目标：把已审阅通过的审计保留与证据包设计拆成能够逐阶段 TDD、独立提交、合入 `main` 并再次验收的实施路线，避免把事务、Worker、维护任务、下载安全和 Admin UI 一次性堆进不可审查的大提交。

为什么：

- 这条链路跨 PostgreSQL、Outbox、Redis/BullMQ、MinIO、二进制 HTTP 和 Admin Console；只写功能清单无法约束双写窗口、僵尸 Worker、保留清理竞态和 fail-closed 审计。
- 仓库要求一步一提交、任务后同步文档、合并 `main` 后复验，而且新任务必须从最新 `main` 开分支；计划需要把这些要求变成每阶段的执行门禁。
- 设计中有 31 天、50,000 条、64 MiB、24/48 小时、180 天等相互关联的边界，必须提前固定类型名、队列名、测试命令和预期结果，避免实现时各模块自行解释。

主要内容：

- 正式计划：`docs/superpowers/plans/phase-7-23-operator-audit-retention-export.md`。
- Phase 7.23.2 ~ 7.23.8 分别覆盖 contract/Prisma、事务型 Outbox、ZIP Worker、保留维护、查询下载 API、Admin 证据包 UI、Docker 验收与面试博客。
- 每个阶段使用独立 `codex/phase-7-23-*` 分支和一个实现提交；阶段验收后 `--no-ff` 合入 `main`，在 `main` 重跑同一验证门禁后才能开下一分支。
- 计划写明 RED/GREEN 命令、关键签名、数据库约束、BullMQ 5.79.2 delayed 行为验证、CSV 公式注入样本、MinIO lifecycle、二进制 envelope 旁路和普通用户 403 验收。

边界：

- 本次只新增实施计划和进度索引，没有修改 Prisma、API、Worker、MinIO、Admin UI 或运行时配置。
- Phase 7.23.2 仍未开始，当前项目不具备证据包申请、生成、下载或自动保留清理能力。
- 计划不改变现有 Outbox requeue 的 best-effort 审计，也不加入 legal hold、预签名下载、数字签名或全库导出。

验收：

- 已从最新 `main` 创建独立计划分支；计划包含 writing-plans 要求的 agentic-worker 说明、checkbox 步骤、精确路径、TDD 失败/通过预期和逐任务提交。
- 已按设计逐项覆盖三份事实、SYSTEM job、事务型 Outbox、lease/token fencing、REPEATABLE READ、保留水位、fail-closed 下载、Admin Blob 下载和 Docker 主分支复验。
- 已执行占位词、类型/名称一致性、路径引用和 `git diff --check` 自审；实现阶段仍必须以每个任务的新鲜测试输出为准。

回顾时可以问：

- “为什么 Phase 7.23 要拆成 7 个从 `main` 开始的阶段，而不是一个长期功能分支？”
- “计划如何把双写、僵尸 Worker、保留清理和二进制下载分别放进可验证的任务？”
- “实现时为什么每次合并 `main` 后还要重复验收？”

### 2026-07-10 - Phase 7.23.1 Operator Audit 保留周期与证据包导出设计

目标：为现有 `OperatorAuditLog` 补上明确的 180 天保留边界，并设计一条 ADMIN 可控、脱敏、可校验、24 小时过期的事故证据包导出链路。

为什么：

- 审计日志如果没有保留周期会持续增长，也无法解释数据为什么仍被保存。
- 当前 Admin Console 只能在线查看审计记录，事故复盘时缺少安全交接方式；数据库裸导出会绕过 DTO 脱敏边界。
- BackgroundJob 只能证明数据库里存在任务，不能消除 PostgreSQL commit 成功但 Redis enqueue 失败的双写窗口。
- 导出文件本身也是敏感数据，必须有独立 TTL、下载审计和自动清理，不能把 MinIO 临时目录当长期档案库。

主要内容：

- 明确第一版定位为事故排障证据包，不做通用 BI、legal hold、WORM、数字签名或长期合规归档。
- 默认保留 `OperatorAuditLog` 180 天；证据包最多覆盖 31 天、50,000 条记录，ZIP 在 MinIO 保留 24 小时。
- 设计 `OperatorAuditExport` 领域模型，和 `BackgroundJob`、`OutboxEvent` 分别承担导出事实、执行事实和可靠投递事实。
- 导出申请在同一 PostgreSQL 事务内创建 Export、BackgroundJob、OutboxEvent 和 `AUDIT_EXPORT_REQUEST` 审计；Outbox Dispatcher 是 BullMQ enqueue 的唯一桥接入口。
- `BackgroundJob` 设计增加 `ACCOUNT / SYSTEM` scope 与 nullable user 关系，避免请求人删除时级联破坏系统级导出任务；Worker 使用 processing token + lease 恢复硬崩溃后的 stalled attempt。
- ZIP 固定包含脱敏 `records.csv` 与 `manifest.json`，提供 CSV / archive SHA-256；CSV 需要防 formula injection，SHA-256 不宣传成数字签名。
- 导出申请和下载使用 fail-closed audit；现有 Outbox requeue audit 继续保持 best-effort，不被本阶段意外改变。
- 维护任务使用活跃导出水位保护 180 天边界数据，分批清理到期 ZIP、历史审计和导出元数据。
- 导出申请与 retention batch 共享 PostgreSQL advisory lock，查询使用 REPEATABLE READ；MinIO prefix lifecycle、crash janitor 和持久 maintenance state 补齐物理清理与 readiness 兜底。
- Admin Console `/audit` 规划“审计记录 / 证据包”标签页；实现拆为 Phase 7.23.2 ~ 7.23.8，每项单独提交并同步文档。

边界：

- 本提交只落设计，不修改 Prisma、contract、API、Worker、MinIO、Admin UI 或运行时配置。
- 不导出 `metadata`、Outbox payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token、cookie、原始 IP 或原始 User-Agent。
- 不提供全库导出、手动延期、恢复过期文件、删除审计记录、编辑 payload 或绕过 OperatorGuard 的入口。

验收：

- 开始新任务前先把 Phase 7.17 ~ 7.22 合入 `main`；合并后复验发现 5 处 Prettier 问题，修复提交后定向 Server lint 与 107 项相关测试通过，Web 294 项和 Admin 33 项测试、相关 build/typecheck/Compose config 也通过。
- 设计按“背景 / 目标 / 非目标 / 数据模型 / 事务型 Outbox / Worker / 保留清理 / API / Admin / 测试 / 验收 / 实施拆分”完整记录。
- 正式 spec：`docs/superpowers/specs/phase-7-23-operator-audit-retention-export-design.md`。

回顾时可以问：

- “为什么 BackgroundJob、OperatorAuditExport 和 OutboxEvent 不能互相替代？”
- “当前知识库 requested outbox 为什么不能防止 BullMQ enqueue 丢失？”
- “为什么审计导出要 fail-closed，而 Outbox requeue audit 仍然 best-effort？”
- “维护任务如何避免删掉仍被活跃导出需要的 180 天边界数据？”
- “CSV formula injection 和 SHA-256 的能力边界分别是什么？”

### 2026-07-09 - Phase 7.22 Docker Admin Ops 真实验收收口

目标：在 Docker 全栈环境里用真实管理员账号完整跑一轮 Admin Console 运维闭环，确认 Phase 7.21 的筛选控件和 requeue guard 不只在 mock / 静态测试里成立，也能在真实容器、真实 API、真实 PostgreSQL 数据上工作。

为什么：

- Admin Console 是给管理员排障用的，不验 Docker 全栈就无法证明 `admin -> server -> postgres / redis / worker` 的真实链路可用。
- Outbox requeue 是系统级状态变更，必须确认普通用户不能访问、管理员操作必须写审计、worker readiness 能反映 backlog 并在测试数据清理后恢复。
- 本轮验收还发现后台缺少 favicon 会产生浏览器 404 噪声，因此顺手补齐后台图标，让调试控制台更干净。

主要内容：

- 使用 Docker Compose dev 栈启动 `postgres / redis / minio / server / worker / web / admin`，管理员后台访问 `http://127.0.0.1:3100`，API 访问 `http://127.0.0.1:3001`。
- 创建临时 ADMIN 账号和临时普通账号；ADMIN 账号登录后台并完成 `/outbox -> requeue -> /audit -> /worker` 浏览器验收，普通账号直接请求 `/outbox-events` 返回 `403`。
- 在数据库中插入安全的 `knowledge.document.processing.requested` 失败 outbox 事件，页面里确认自定义状态筛选是 `combobox`，没有回退到原生 `<select>`；requeue 按钮在填写 reason 和勾选确认前不可用。
- requeue 成功后在 `/audit` 看到 `OUTBOX_REQUEUE / SUCCEEDED` 审计记录，并能点开右侧详情；在 `/worker` 看到因为临时 pending outbox 导致的 degraded 信号，清理测试数据后容器内 readiness CLI 恢复 `ready`。
- 新增 `apps/admin/public/favicon.svg` 并在后台 `metadata.icons` 中声明，减少后台浏览器调试时的 favicon 404 噪声。

边界：

- 本阶段不新增后端 API、不新增批量 requeue、不新增删除 / 跳过 / 立即 dispatch / payload 编辑。
- 测试 outbox、审计记录和临时账号在验收后清理，不污染本地长期数据。
- 前端 reason + confirm 仍是产品层防误操作；真正安全边界仍是后端 feature gate、`JwtAuthGuard`、`OperatorGuard` 和服务层状态机。

验收：

- Docker 浏览器验收：`http://127.0.0.1:3100/login` 登录 ADMIN，进入 `/outbox` 完成筛选、详情、reason + confirm requeue；进入 `/audit` 查看审计记录详情；进入 `/worker` 查看 readiness。
- 普通用户 API 验收：临时普通账号携带 token 访问 `GET /outbox-events?status=FAILED` 返回 `403`。
- 容器 readiness 验收：`docker compose --project-name docker -f P:\docker\docker-compose.dev.yml --project-directory P:\ exec -T worker bun apps/server/dist/scripts/worker-readiness.js` 输出 `Worker readiness: ready`。

回顾时可以问：

- “为什么 Phase 7.21 做完后还要单独做 Docker 全栈验收？”
- “Outbox requeue 后为什么 worker readiness 会短暂 degraded？”
- “普通用户 403 和前端隐藏入口分别证明了什么？”
- “为什么验收数据要清理，哪些数据可以清理，哪些生产审计不能随便清理？”

### 2026-07-09 - Phase 7.21 Admin Ops 交互收口

目标：把管理员后台的 Outbox / Audit 筛选和 requeue 操作体验再收紧一层，解决原生下拉框割裂、requeue 原因可省略导致复盘信息不足的问题。

为什么：

- 后台管理不只是“能调接口”，还要让管理员在高压排障时快速判断、谨慎操作、事后能复盘。
- 浏览器原生 select 在 Windows 上会出现系统蓝色高亮和粗边框，和当前 Admin Console 的低干扰视觉语言割裂，显得像临时 demo。
- requeue 会改变系统级 outbox 状态，即使后端允许 reason 可选，前端运维工作流也应该引导管理员填写原因，便于后续在 `/audit` 详情里解释这次操作。

主要内容：

- 新增 `apps/admin/src/components/admin-filter-select.tsx`，提供后台专用自定义筛选控件，支持 `combobox / listbox / option` 语义、label 关联、`aria-selected`、`aria-activedescendant`、上下键切换、Enter 选择、Escape 关闭、外部点击关闭和低干扰滚动样式。
- `/outbox` 和 `/audit` 替换原生 `<select>`，状态筛选统一使用 Admin Console 的轻量 popover 风格。
- `/outbox` requeue 前端增加 `reasonRequired` guard：必须填写 reason 并勾选确认后，按钮才可用；切换事件或筛选条件时清空 reason，避免把 A 事件的原因误带到 B 事件；成功后仍刷新 outbox、audit 和 worker readiness。
- 新增静态 contract test，防止页面回退到原生 select，防止 requeue 操作绕过 reason guard。

边界：

- 不新增后端 API，不改变 `POST /outbox-events/:id/requeue` contract；后端仍只做安全状态机和审计。
- 不新增批量 requeue、删除事件、跳过事件、立即 dispatch 或 payload 编辑。
- 前端 reason 必填是产品化防误操作，不替代后端 `JwtAuthGuard + OperatorGuard + OutboxOpsService` 的真实安全边界。

验收：

- `bun --filter @repo/admin test`
- `node --experimental-strip-types --test apps/admin/src/lib/*.test.mts`
- `bun --filter @repo/admin lint`
- `bun --filter @repo/admin build`

回顾时可以问：

- “为什么后台管理页面不直接用浏览器原生 select？”
- “为什么 requeue reason 在后端可选，但前端要做必填？”
- “前端防误操作和后端状态机安全边界分别负责什么？”
- “如何用静态 contract test 防止 UI 回退和危险入口回归？”

### 2026-07-09 - Phase 7.20 Operator Audit 详情闭环

目标：把 Admin Console 的 `/audit` 从“能查审计列表”升级为“能追踪一次管理员诊断写操作全过程”的审计详情页，让 requeue 后的复盘更完整。

为什么：

- Phase 7.19 已经让控制台能发现风险，Phase 7.18 已经让 Outbox Ops 能处理风险，但 Audit 如果只有列表，管理员仍然很难看清一次操作的完整上下文。
- 高权限诊断写操作需要可复盘：谁操作、操作了什么 target、为什么操作、请求指纹是什么、失败时错误摘要是什么。
- 面试表达上，这一步能把后台管理闭环讲成“发现问题 -> 处理问题 -> 验证恢复 -> 审计复盘”，而不是只讲一个 requeue 按钮。

主要内容：

- `@repo/types/api/operator-audit` 新增 `operatorAuditLogDetailResponseSchema`，详情 DTO 复用脱敏列表 item 字段。
- 后端新增 `GET /operator-audit-logs/:id`，经过 `OPERATOR_AUDIT_ENABLED` feature gate、`JwtAuthGuard` 和 `OperatorGuard`。
- `OperatorAuditService.getDetail()` 使用显式 `select`，继续排除 `metadata`，不存在时返回 `OPERATOR_AUDIT_LOG_NOT_FOUND`。
- Admin Console `/audit` 改成列表 + 详情双栏；点击左侧记录后，右侧展示操作上下文、目标对象、来源指纹和错误摘要。
- 列表选中态增加 `aria-pressed` 和左侧强调条；列表与详情区域都使用独立滚动。
- `operator-audit-page-contract.test.mts` 增加静态契约，防止页面退回纯列表或展示 `metadata`、payload、原始 IP / User-Agent 等敏感内容。
- `docs/blogs/admin-console-ops-platform.md` 补充“审计详情为什么重要”。

边界：

- 不新增审计导出、保留周期配置、更细 operator role、批量操作或审计删除。
- 详情 API 不返回 `metadata`、payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token、cookie、原始 IP 或原始 User-Agent。
- 前端详情页只是运维体验层，不承担最终鉴权；真正安全边界仍是后端 feature gate、`JwtAuthGuard` 和 `OperatorGuard`。

验收：

- `bun test packages/types/tests/operator-audit.test.mts`
- `bun --cwd packages/types typecheck`
- `bun --filter @repo/server test -- operator-audit --runInBand`
- `bun --filter @repo/server build`
- `node --experimental-strip-types --test apps/admin/src/lib/*.test.mts`
- `bun --filter @repo/admin lint`
- `bun --filter @repo/admin build`
- Docker 重建 `server / admin` 后访问 `http://localhost:3100/audit`，点击审计记录，确认右侧详情展示操作上下文、目标对象、来源指纹和错误摘要，且不展示敏感原始字段。

回顾时可以问：

- “为什么审计列表不够，需要审计详情？”
- “审计详情为什么复用脱敏 DTO，而不是把 metadata 也返回前端？”
- “Operator Audit 如何记录 requestId、IP hash 和 User-Agent hash？”
- “前端审计详情和后端 OperatorGuard 的安全职责怎么分工？”
- “这一步如何补齐后台管理的复盘闭环？”

### 2026-07-09 - Phase 7.19 Admin Console 控制台数据化

目标：把独立管理员后台首页从“能跳转到各个运维页面”的入口页，升级成管理员一打开就能看到系统当前状态的真实运维总览。

为什么：

- Phase 7.16 ~ 7.18 已经有独立 Admin Console、Docker admin service、Outbox Ops、操作审计和 Worker Readiness，但首页如果只是静态导航，就不像真正的企业后台。
- 管理员进入后台时，第一眼应该知道“现在有没有需要处理的任务链路风险”，而不是先逐个页面点进去找。
- 面试表达上，这一步能把后台管理讲成一套运维产品闭环：总览发现风险，Outbox 处理事件，Audit 复盘操作，Worker Readiness 验证恢复。

主要内容：

- `/` 控制台使用 TanStack Query 读取 `workerReadinessApi.get()`、`outboxApi.list(FAILED / DEAD)` 和 `operatorAuditApi.list(OUTBOX_REQUEUE)`。
- 新增 `admin-dashboard-view.ts`，把 readiness、outbox 和 audit 信号聚合为顶部状态、关注项数量、FAILED / DEAD 数量和最近审计数量。
- 顶部状态区根据 read error、`not_ready`、DEAD outbox、`degraded`、FAILED outbox 和审计失败生成不同严重度。
- 中部三块信号继续对应 `/worker`、`/outbox`、`/audit`，但展示真实状态摘要，而不是静态说明。
- 最近关注区按风险优先展示 DEAD / FAILED 事件、readiness issue 和最近审计结果。
- 同步补了一篇面试学习博客 `docs/blogs/admin-console-ops-platform.md`，覆盖今天整个后台管理产品化链路，而不是只写控制台首页。

边界：

- 不新增后端 API，不改变权限模型，不放宽 CORS、feature gate、`JwtAuthGuard` 或 `OperatorGuard`。
- 控制台只读取脱敏 DTO，不展示 payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token 或 cookie。
- 不新增批量 requeue、删除事件、跳过事件、立即 dispatch 或 payload 修改。
- 数据读取失败时显示异常状态，不使用假数据伪装健康。

验收：

- `node --experimental-strip-types --test apps/admin/src/lib/*.test.mts`
- `bun --filter @repo/admin lint`
- `bun --filter @repo/admin build`
- Docker 使用 `subst P: "E:\PrepMind_ai智能备考助手"` 映射路径后重建 `admin`，浏览器访问 `http://localhost:3100/`。
- 浏览器验收确认控制台读取真实 Worker readiness、FAILED / DEAD Outbox 数量和最近审计记录；内部入口跳转到 `/worker` 正常。

回顾时可以问：

- “为什么后台首页不能只是导航页？”
- “控制台如何聚合 Worker Readiness、Outbox 和 Operator Audit？”
- “为什么读取失败要作为一个明确运维状态，而不是静默兜底？”
- “Admin Console 前端总览和后端 OperatorGuard 的安全边界怎么分工？”
- “今天的后台管理链路如何从发现问题、处理问题到复盘问题形成闭环？”

### 2026-07-09 - Phase 7.18 Admin Outbox Ops 产品化

目标：把独立后台里的 `/outbox` 从“能查列表、能点 requeue”的工程调试页，升级成管理员能理解失败原因、判断是否适合重新入队、执行安全 requeue，并知道后续去哪里验证恢复的单事件操作工作流。

为什么：

- Outbox requeue 会改变系统级事件状态，如果页面只给一个按钮，管理员很容易把 handler missing、invalid payload 这类根因未修复的问题误当成“重试一下就好”。
- Phase 7.15 ~ 7.17 已经把权限、审计、Worker Readiness 和独立 Admin Console 搭起来了，下一步需要把这些能力串成真正可操作、可解释、可复盘的后台流程。
- 面试表达上，这一步能讲清楚“后台运维页面不是堆 API 返回值”，而是把状态机、错误分类、审计和后续观测做成产品化闭环。

主要内容：

- `apps/admin/src/lib/outbox-view.ts` 增加 Outbox 展示 helper：只允许 `FAILED / DEAD` 进入 requeue 流程；`PENDING / PROCESSING / SUCCEEDED` 给出只读原因；handler missing、invalid payload、Redis/数据库/超时和未知错误给出不同处理建议。
- `/outbox` 详情页重构为五个分区：生命周期、事件身份、诊断建议、重新入队操作、后续验证。
- 重新入队操作保留“操作原因 + 显式确认 + 按钮禁用”三段式保护；requeue 成功后刷新 outbox 列表、详情、operator audit 和 worker readiness 缓存，避免 20 秒 staleTime 内看到旧信号。
- 后续验证区直接给出 `/worker` 和 `/audit` 入口，让管理员知道 requeue 后要看 Worker Readiness、Outbox backlog 和操作审计，而不是以为按钮点完就代表任务已经执行完成。
- 列表选中态增加 `aria-pressed` 与左侧强调条，不再只依赖背景色判断当前选中事件。
- 增加静态 contract test，防止页面暴露完整 payload 或增加批量 requeue、删除、跳过、立即 dispatch、payload 修改等危险入口；浏览器验收中发现 aftercare 文案容易暗示危险操作名后，补充测试并改成“不会改写事件数据或事件结果”。

边界：

- 本阶段不改后端 API contract，不新增权限模型，不绕过 `JwtAuthGuard + OperatorGuard`。
- 页面仍只展示脱敏 DTO、`payloadHash`、错误 code / preview、状态和时间戳，不展示完整 payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token 或 cookie。
- requeue 仍只是安全状态流转：`FAILED / DEAD -> PENDING`，不立即执行 handler，不改写事件数据，不改写事件结果。
- 不做批量操作、删除事件、跳过事件、立即 dispatch、payload 修改、审计导出或保留周期策略。

验收：

- `node --experimental-strip-types --test apps/admin/src/lib/outbox-page-contract.test.mts apps/admin/src/lib/outbox-view.test.mts`
- `bun --filter @repo/admin lint`
- `bun --filter @repo/admin build`
- Docker 使用 `subst P: "E:\PrepMind_ai智能备考助手"` 规避中文路径 BuildKit header bug 后，重建并启动 `admin`，浏览器访问 `http://localhost:3100/outbox`。
- 浏览器验收覆盖：管理员登录态可进入 Outbox Ops；FAILED 事件详情展示五个分区；详情不展示完整 payload；invalid payload 提示先修生产方/数据契约；Redis timeout 事件提示依赖恢复后再 requeue；原因和确认未满足时按钮禁用；requeue 后事件回到 `PENDING`、attempts 重置、后续验证区更新；`/audit` 能看到脱敏 requeue 审计；清理测试数据后 `/worker` 回到 `Ready` 且 `backlog=false`。

回顾时可以问：

- “为什么 Outbox Ops 页面不能只做一个 requeue 按钮？”
- “handler missing、invalid payload 和 Redis timeout 三类错误为什么要给不同操作建议？”
- “requeue 为什么只是状态机里的 `FAILED / DEAD -> PENDING`，而不是立刻执行 handler？”
- “为什么 requeue 成功后要同时刷新 outbox、audit 和 worker readiness？”
- “前端页面隐藏危险入口和后端 `OperatorGuard` 的安全职责有什么区别？”

### 2026-07-09 - Phase 7.17.1 管理员后台返回学习端登录态修复

目标：修复从独立管理员后台点击“返回学习端”后，学习端看起来又要求重新登录的问题，并把本机 `localhost` / `127.0.0.1` 混用导致的登录态排障经验沉淀到文档里。

为什么：

- Phase 7.16 / 7.17 已经把学习端和管理员后台拆成两个 Next app，用户会在 `3000` 和 `3100` 两个端口之间跳转。
- 本机浏览器会把 `localhost` 和 `127.0.0.1` 当成不同 host；如果后台通过 `localhost:3100` 打开，却硬跳回 `127.0.0.1:3000`，前端状态、refresh cookie 和 API 请求 host 就可能不一致。
- 这个问题表面像“鉴权失效”或“后台返回后掉登录”，但根因不是后端 `JwtAuthGuard` 坏了，而是本机 loopback host 混用让 session recovery 链路不稳定。

主要内容：

- 后台“返回学习端”不再硬编码 `http://127.0.0.1:3000`，而是优先使用 `NEXT_PUBLIC_LEARNING_APP_URL`，未配置时跟随当前页面的 `window.location.hostname` 跳回对应的 `3000`。
- 学习端和管理员后台的 API client 在浏览器端会对齐 loopback host：当页面是 `localhost` 时，把本机 API base 也解析为 `localhost:3001`；当页面是 `127.0.0.1` 时，则解析为 `127.0.0.1:3001`。
- 新增回归测试覆盖后台返回 URL、admin API base 和 web API base 的 loopback host 对齐规则。
- `docs/dev-start.md` 补充管理员后台和学习端跳转时的 host 选择建议，避免后续手动验收再次踩坑。

边界：

- 这次不改变后端鉴权模型、不改变 cookie 策略、不放宽 CORS 和 `OperatorGuard`。
- `NEXT_PUBLIC_LEARNING_APP_URL` 仍可用于显式覆盖学习端地址；自动对齐只处理本机 `localhost` / `127.0.0.1` 场景，不改外部域名。
- 前端 host 对齐只是本地开发和 Docker dev 验收体验修复，真正权限仍由后端 session、access token、`JwtAuthGuard` 和 `OperatorGuard` 控制。

验收：

- `node --experimental-strip-types --test apps/admin/src/lib/*.test.mts`
- `node --experimental-strip-types --test apps/web/src/lib/api-client.test.mts apps/web/src/lib/sidebar-nav.test.mts`
- `bun --filter @repo/admin lint`
- `bun --filter @repo/web lint`
- `bun --filter @repo/admin build`
- `bun --filter @repo/web build`
- Docker 重建并启动 `web / admin / server` 后，浏览器访问 `http://localhost:3100/worker`，确认“返回学习端”链接为 `http://localhost:3000`，点击后直接进入 `http://localhost:3000/chat`，没有回到登录页。

回顾时可以问：

- “为什么 `localhost` 和 `127.0.0.1` 在浏览器登录态里不能随便混用？”
- “为什么这个问题看起来像鉴权失败，但根因其实是前端 host 和 refresh cookie 链路不一致？”
- “后台返回学习端为什么要跟随当前 hostname，而不是固定写死 `127.0.0.1`？”
- “Docker dev、本机 dev 和生产域名场景下，前端 API base 应该怎么区分？”

### 2026-07-09 - Phase 7.17 Docker Admin Console Service

目标：把 Phase 7.16 的独立管理员后台从“只能本机 `bun run dev:admin` 启动”推进到 Docker Compose 一等服务，让本地全栈部署形态和我们讲的架构边界一致。

为什么：

- Phase 7.16 已经把学习端和管理员后台拆成两个 Next app，但 Docker 里还只有 `web / server / worker`，部署拓扑不完整。
- 管理员后台应该能像企业项目一样单独启动、单独暴露端口、单独验收，而不是永远依赖学习端 dev server。
- 面试讲架构时可以清楚解释：`web` 是学生学习 PWA，`admin` 是 operator 控制台，`server` 是 API，`worker` 是后台任务进程。

主要内容：

- 新增 `docker/Dockerfile.admin`，用 Bun workspace + Next standalone 构建 `@repo/admin`，容器端口为 `3100`。
- `docker/docker-compose.dev.yml` 新增 `admin` service，依赖 `server`，浏览器访问 `http://127.0.0.1:3100`。
- Docker `web` service 增加 `NEXT_PUBLIC_ADMIN_CONSOLE_URL=http://127.0.0.1:3100`，学习端 ADMIN 侧边栏“后台管理”默认跳转到管理员后台容器。
- Docker `server` CORS 默认补充 `http://localhost:3100` 和 `http://127.0.0.1:3100`。
- 修复 `Dockerfile.web` / `Dockerfile.server` 的 workspace manifest 缺口：根 workspace 是 `apps/*`，所以 deps 层必须复制 `apps/admin/package.json`，否则 `bun install --frozen-lockfile` 会失败。
- 新增/扩展 Docker 静态契约测试，覆盖 admin Dockerfile、admin compose service、web 管理后台 URL 和 workspace manifest 完整性。

边界：

- 本阶段不新增新的后台业务页面，不新增新的后端 API 或权限模型。
- 不做生产域名、TLS、反向代理、镜像推送或 Kubernetes 配置。
- 管理员后台前端只是体验层，真正安全边界仍是后端 `JwtAuthGuard + OperatorGuard`。

验收：

- `bun --filter @repo/server test -- docker-compose-readiness --runInBand`
- `docker compose -f docker/docker-compose.dev.yml --profile worker build admin`
- `docker compose -f docker/docker-compose.dev.yml --profile worker build web`
- `docker compose -f docker/docker-compose.dev.yml --profile worker build server`
- `docker compose -f docker/docker-compose.dev.yml --profile worker build worker`
- `docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin`
- `docker compose -f docker/docker-compose.dev.yml --profile worker ps`：`web` 暴露 `3000`，`admin` 暴露 `3100`，`server` 暴露 `3001`，`worker` 为 `healthy`。
- 浏览器验收：`http://127.0.0.1:3000` 学习端可加载；`http://127.0.0.1:3100` 管理员后台可加载；管理员可看控制台、Outbox Ops、操作审计和 Worker Readiness；普通用户请求 `/operator-audit-logs`、`/worker-readiness`、`/outbox-events` 均返回 403。
- 中文路径下 Docker Compose `--build` 仍可能触发 Docker Desktop gRPC non-printable ASCII，本次使用 `subst P: "E:\PrepMind_ai智能备考助手"` 映射 ASCII 路径完成全栈验收。

回顾时可以问：

- “为什么 `admin` 要做成独立 Docker service，而不是继续塞进 `web`？”
- “Docker 里的 `web / admin / server / worker` 各自承担什么职责？”
- “为什么 Dockerfile 的 deps 层必须复制所有 workspace package.json？”
- “管理员后台前端门禁和后端 OperatorGuard 的安全边界有什么区别？”

### 2026-07-09 - Phase 7.16 桌面端 Admin Console 第一版

目标：把管理员诊断能力从学习端移动页面里抽出来，形成独立的桌面端后台管理入口，让 Outbox requeue、审计查询和 worker readiness 更像企业项目里的运维后台。

为什么：

- 全部堆在学习端侧边栏会让普通学习产品变臃肿；管理员工具应该和学生学习路径分离。
- `/operator-audit` 适合作为移动端/轻量审计入口，但 Outbox requeue 需要详情、确认、原因输入和错误建议，更适合电脑屏幕。
- 后续如果继续加 operator 页面，例如 outbox 详情、任务重放、告警、导出、保留周期配置，独立 admin app 更容易扩展。

主要内容：

- 新增 `apps/admin` Next.js workspace，包名 `@repo/admin`，默认端口 `3100`，根命令 `bun run dev:admin`。
- 新增后台登录、会话恢复和 `ADMIN` 前端门禁；真正安全边界仍由后端 `JwtAuthGuard + OperatorGuard` 保证。
- 新增后台控制台、`/outbox`、`/audit`、`/worker` 页面。
- `Outbox Ops` 复用 `GET /outbox-events`、`GET /outbox-events/:id` 和 `POST /outbox-events/:id/requeue`，支持筛选、脱敏详情、原因输入、显式确认和 requeue。
- `Outbox Ops` 对 `OUTBOX_HANDLER_NOT_FOUND` / handler missing 类错误给出“先修复代码，不要盲目重新入队”的提示。
- `操作审计` 复用 `GET /operator-audit-logs`，展示 `OUTBOX_REQUEUE` 的成功/失败、target、reason、actor、错误摘要。
- `Worker Readiness` 复用 `GET /worker-readiness`，展示 Redis、BullMQ queue、worker heartbeat 和 outbox readiness。
- 学习端保留 `/operator-audit`；ADMIN 用户在移动端和桌面端侧边栏都会看到“后台管理”入口，普通用户和匿名用户不显示；后台应用本身仍是桌面优先布局。

边界：

- 本阶段不新增独立 Docker `admin` service；本地用 `bun run dev:admin` 启动，后端仍可连接 Docker PostgreSQL / Redis / MinIO。
- 不新增后端接口、不放宽鉴权、不做批量 requeue、不删除 outbox event、不编辑 payload、不直接执行 handler。
- 前端隐藏入口只是体验层，不作为权限边界；所有系统级诊断仍以后端 guard 为准。

验收：

- `node --experimental-strip-types --test apps/admin/src/lib/*.test.mts`
- `node --experimental-strip-types --test apps/web/src/lib/sidebar-nav.test.mts`
- `bun --filter @repo/admin lint`
- `bun --filter @repo/admin build`
- `bun --filter @repo/web lint`
- `bun --filter @repo/server test -- outbox-ops.controller operator-audit.controller worker-readiness.controller --runInBand`
- 浏览器验收：访问 `http://127.0.0.1:3100`，验证管理员登录、控制台、Outbox Ops、审计、Worker 页面；普通账号只能看到无权限状态。

回顾时可以问：

- “为什么这次选择独立 `apps/admin`，而不是继续往学习端侧边栏塞页面？”
- “Outbox requeue 为什么必须有原因输入和确认框？”
- “为什么 handler missing 的 DEAD event 不应该盲目 requeue？”
- “后台管理前端和后端 OperatorGuard 的职责边界是什么？”

### 2026-07-09 - Phase 7.15 收尾：审计筛选控件与 requeue 手动排障说明

目标：把管理员审计台从“能用”继续推进到“手动排障时不容易误操作”，同时把用户反馈的原生下拉框视觉问题收掉。

为什么：

- `/operator-audit` 是移动端优先的管理诊断页，原生 `<select>` 在浏览器里会弹出系统样式蓝色选项框，视觉上割裂，也不像 App 内部控件。
- requeue 是会改变 outbox 状态的高权限操作，必须让开发者知道什么时候该重试、什么时候不能重试，以及它不会绕过状态机直接执行 handler。
- Phase 7.15 验收中出现过 `OUTBOX_HANDLER_NOT_FOUND` 类测试事件导致 worker readiness 降级，这正好说明“看到 DEAD 就盲目 requeue”是不对的，必须先判断根因。

主要内容：

- `/operator-audit` 的 action / status 筛选从原生 `<select>` 改为自定义 `FilterSelect`，使用 button + listbox + check icon，保留 44px 触控目标、焦点样式和 `aria-haspopup/listbox/option` 语义。
- `apps/web/src/lib/operator-audit-ui-integration.test.mts` 增加防回归断言：页面必须包含 `FilterSelect` 和 `role="listbox"`，且不能再出现原生 `<select>`。
- `docs/dev-start.md` 增加 Outbox requeue 手动排障流程，明确 `FAILED / DEAD -> PENDING`、需要先修根因、不要对 unknown handler / invalid payload 盲目 requeue，并给出 PowerShell API 调试示例。
- `docs/dev-start.md` 增加中文路径下 Docker build 的 `subst P:` 规避方案；直接在中文路径 build 仍会触发 Docker gRPC non-printable ASCII，但通过 ASCII 映射路径加 `--project-name docker` 可成功重建 server/web 镜像。

边界：

- 本次不新增前端 outbox 列表页或一键 requeue 按钮；当前 requeue 仍是 admin-only 后端诊断 API，审计台负责查看 requeue 审计记录。
- requeue 不编辑 payload、不直接执行 handler、不强制成功、不删除事件。
- UI 只改善筛选控件，不改变 `/operator-audit-logs` 查询 contract 或后端鉴权。

验收：

- `node --experimental-strip-types --test apps/web/src/lib/operator-audit-ui-integration.test.mts`
- `node --experimental-strip-types --test apps/web/src/lib/operator-audit-view.test.mts`
- `bun --filter @repo/web lint`
- `bun --filter @repo/web build`
- `docker compose -f docker/docker-compose.dev.yml --profile worker exec -T worker sh -lc "bun apps/server/dist/scripts/worker-readiness.js"`
- `docker compose --project-name docker -f P:\docker\docker-compose.dev.yml --project-directory P:\ --profile worker build server web`

回顾时可以问：

- “为什么 requeue 不是直接执行 handler，而是回到 PENDING 等 worker 正常消费？”
- “为什么 unknown handler 的 DEAD event 不能靠 requeue 解决？”
- “审计筛选控件为什么要用自定义 listbox，而不是浏览器原生 select？”
- “为什么中文路径下 Docker compose build 会失败，而 `subst P:` 后可以成功？”

### 2026-07-09 - Phase 7.15 Operator Audit 真实运行验收与本地诊断收口

目标：把管理员审计台从“代码和单元测试完成”推进到“真实前后端可以跑、管理员能用、普通用户被拦截、审计记录可查”的验收状态。

为什么：

- Phase 7.14 已经补齐 `OperatorGuard`、审计写入、审计查询 API 和前端页面，但真实运行时仍可能被环境、旧镜像、登录态或前端 hydration 问题挡住。
- Docker server 镜像运行态是 `NODE_ENV=production`，而 Outbox Ops / Operator Audit / Worker Readiness / Worker Observability 默认 production 关闭；本地 dev compose 如果不显式打开，就会表现为管理员也访问 404。
- Next dev server 在 `127.0.0.1` 下会阻止 dev resource；如果项目文档让用户访问 `127.0.0.1:3000`，就必须允许这个 dev origin，否则页面 SSR 能看见，但 React 事件不挂载，登录表单会像“点了没反应”。

主要内容：

- `docker/docker-compose.dev.yml` 为 server service 显式设置 `OUTBOX_OPS_ENABLED=true`、`OPERATOR_AUDIT_ENABLED=true`、`WORKER_READINESS_ENABLED=true`、`WORKER_OBSERVABILITY_ENABLED=true`，保证本地 Docker dev 栈的诊断入口可验收。
- `apps/server/src/worker-readiness/docker-compose-readiness.spec.ts` 增加 compose 回归测试，防止本地诊断开关和 `127.0.0.1` dev origin 再被漏掉。
- `apps/web/next.config.ts` 增加 `allowedDevOrigins: ['127.0.0.1']`，修复从 `127.0.0.1:3000` 打开 dev 前端时客户端 hydration 不完整的问题。
- 创建本地验收账号：管理员 `phase715-admin-20260709000525@example.com`、普通用户 `phase715-student-20260709000525@example.com`；通过 Docker PostgreSQL 只把管理员测试账号升级为 `ADMIN`。
- 通过真实 `POST /outbox-events/:id/requeue` 生成 `OUTBOX_REQUEUE / SUCCEEDED` 审计记录，再用 `/operator-audit` 页面读取脱敏列表。

边界：

- 这次不新增审计详情页、导出、保留周期、批量操作或更细 operator role。
- 前端“审计”入口只是体验层；真正权限仍由后端 `JwtAuthGuard + OperatorGuard` 控制。
- Docker build 在当前中文路径下触发 Docker gRPC header 非 ASCII 问题，未把 Docker server/web 镜像重建作为完成条件；改用本机前后端 + Docker PostgreSQL/Redis/MinIO 验证最新源码，数据仍使用同一个 Docker 数据库。
- 浏览器登录态验收优先使用 `localhost:3000` 与 `localhost:3001` 保持 cookie host 一致；`127.0.0.1` 已单独验证 hydration 正常。

验收：

- `bun --filter @repo/server test -- docker-compose-readiness --runInBand`
- `GET /operator-audit-logs`：管理员返回 200，普通用户返回 403。
- `POST /outbox-events/:id/requeue`：管理员返回 201，并写入一条脱敏 `OUTBOX_REQUEUE` 审计记录。
- 浏览器验收：普通用户侧边栏不显示“审计”；普通用户直达 `/operator-audit` 显示无权限且不请求 `/operator-audit-logs`；管理员侧边栏显示“审计 管理员操作留痕”；管理员点击入口进入 `/operator-audit`，审计筛选和最近记录可见。

回顾时可以问：

- “为什么 Docker dev compose 里要显式打开诊断 feature gate，而不是依赖 `NODE_ENV` 默认值？”
- “为什么普通用户访问审计页时前端不请求审计 API，但后端仍必须返回 403？”
- “为什么 `127.0.0.1` 页面能看到 SSR 内容，却可能因为 dev origin 限制导致按钮事件不生效？”
- “为什么本地验收账号改成 ADMIN 后必须重新登录？”

### 2026-07-08 - Phase 7.14.6 收尾：Prisma Studio 排障与 Admin 导航入口

目标：把本地查看数据库和管理员审计入口从“知道内部命令的人才能用”调整为更接近真实开发者体验。

为什么：

- 用户用 `bun --cwd packages/database prisma studio` 打开 Studio 时，Prisma CLI 可能读不到根目录 `.env`，从而报 `DATABASE_URL` 缺失或在 Studio 里弹 `Prisma Client Error`，容易误判为“数据库没有数据”。
- 本地数据库当前确实有 `User` 数据；问题核心是命令运行目录、环境变量读取和 migration 状态，而不是账号数据丢失。
- `/operator-audit` 已经具备 admin-only 页面和后端 guard，管理员仍要手动输入地址不符合产品使用习惯；但普通用户不能看到这个入口。

主要内容：

- 新增 Prisma CLI 包装脚本，`db:studio` / `db:status` / `db:generate` / `db:migrate` 会优先读取根目录 `.env`，减少 `DATABASE_URL` 因工作目录不同丢失的问题。
- 新增 `bun run db:status`，用于快速确认当前 Prisma 连接的数据库和 migration 状态。
- 对当前 Docker PostgreSQL 执行安全 migration deploy，补上 `OperatorAuditLog` migration；没有执行 reset，没有清库。
- `/operator-audit` 从“隐藏手动地址”调整为“管理员侧边栏可见入口”；普通用户和未登录用户不展示该按钮，页面本身仍保留前端 ADMIN 拦截，后端 `JwtAuthGuard + OperatorGuard` 仍是真正安全边界。
- `docs/dev-start.md` 顶部补充 Prisma Studio、psql 改 admin、命令差异和侧边栏入口说明。

边界：

- 前端导航只负责体验分流，不替代后端权限。
- `migrate dev` 如果提示 reset，不能为了省事清库；本地已有数据时优先分析 drift，必要时只用 deploy 应用未执行 migration。
- Prisma Studio 是数据库查看/编辑工具，不是升级管理员账号的唯一方式；快速改角色更适合用容器内 psql。

验收：

- `bun run db:status`
- Docker PostgreSQL `User` 表确认有 45 条账号记录。
- `bun apps/web/src/lib/sidebar-nav.test.mts`

回顾时可以问：

- “为什么同一个数据库，用 Prisma Studio 看不到数据不一定代表数据丢了？”
- “`bun run db:studio` 和 `docker compose exec postgres psql ...` 分别解决什么问题？”
- “为什么 admin 导航可以前端隐藏，但真正鉴权必须在后端？”
- “为什么看到 Prisma 要 reset 时不能直接照做？”

### 2026-07-08 - Phase 7.14.6 Operator Audit Hidden Admin Page

目标：给已经完成的 Operator Audit 查询 API 补一个受控的前端查看入口，让管理员不用直接连数据库或手写请求，也能在产品里查看脱敏审计记录。

为什么：

- 只有后端 API 时，排障仍然需要 Swagger、curl 或数据库查询，对本地验收和面试展示都不够直观。
- 审计页面不能出现在普通学习用户导航里，否则会让用户误以为这是普通功能，也会暴露不必要的运维入口。
- 前端可以做体验拦截和空状态提示，但真正权限必须继续由后端 `OperatorAuditEnabledGuard -> JwtAuthGuard -> OperatorGuard` 控制。

主要内容：

- 新增 `apps/web/src/lib/operator-audit-api.ts`，复用 `@repo/types/api/operator-audit` Zod schema 解析 `/operator-audit-logs` 响应。
- 新增 `operatorAuditQueryKeys` 与 `useOperatorAuditLogs()`，只有当前会话 `currentUser.role === 'ADMIN'` 时才启用请求。
- 新增隐藏页面 `/operator-audit`，不加入普通侧边栏或个人中心主导航；管理员可手动访问。
- 页面支持按 `action`、`status`、`targetType`、`targetId`、`actorUserId` 筛选，展示审计时间、操作者、目标、原因、requestId、错误码、脱敏错误预览和 IP/User-Agent hash。
- 普通用户访问时展示无权限说明，不主动请求审计 API；未登录仍由 `(main)` layout 的 `AuthGuard` 处理。
- 页面只展示脱敏字段，不展示 payload、metadata、aggregateId、prompt、RAG chunk、模型回答、API key、token、cookie 或用户正文。

边界：

- 前端页面不是安全边界，只是体验层；不能用它替代后端 OperatorGuard。
- 本轮不做审计详情页、不做导出、不做审计删除/编辑、不做保留周期策略、不新增更细的 operator role。
- 当前分页使用“下一页”读取下一批结果，不做复杂无限列表缓存，避免 React effect 合并分页带来的状态副作用。

验收：

- `node --experimental-strip-types --test apps/web/src/lib/operator-audit-api.test.mts`
- `node --experimental-strip-types --test apps/web/src/lib/operator-audit-query-keys.test.mts`
- `node --experimental-strip-types --test apps/web/src/lib/operator-audit-view.test.mts`
- `node --experimental-strip-types --test apps/web/src/lib/operator-audit-ui-integration.test.mts`
- `bun --filter @repo/web lint`

回顾时可以问：

- “为什么 `/operator-audit` 不放进普通导航？”
- “前端 ADMIN 拦截和后端 OperatorGuard 的职责有什么区别？”
- “这个页面为什么只展示脱敏 DTO，不展示 metadata 或 payload？”
- “为什么第一版选择隐藏页面和筛选列表，而不是完整管理后台？”

### 2026-07-08 - Phase 7.14.5 Operator Audit Query API

目标：把已写入数据库的 operator 审计日志变成可受控查询的后端 API，回答“谁在什么时候做了什么、为什么做、结果如何”。

为什么：

- 高权限诊断写操作不能只靠“有权限”，还要能追踪、复盘和排障。
- 只写审计日志但没有受控查询入口，事故时仍要手动连数据库查，不适合生产化。
- 查询入口必须只返回脱敏字段，避免排障入口变成敏感数据泄露入口。

主要内容：

- 新增 `@repo/types/api/operator-audit` contract，包含 action/status、列表 query 和脱敏 response DTO。
- `packages/types/package.json` 增加 `./api/operator-audit` 子路径导出，修复 NodeNext 下 server 无法解析新增 contract 的问题。
- `OperatorAuditService.list()` 支持 `action`、`status`、`targetType`、`targetId`、`actorUserId`、`limit`、`cursor` 过滤。
- 分页按 `createdAt desc, id desc` 使用复合 cursor，避免同时间戳数据漏查。
- 新增 `GET /operator-audit-logs`，guard 顺序为 `OperatorAuditEnabledGuard -> JwtAuthGuard -> OperatorGuard`。
- 新增 `OPERATOR_AUDIT_ENABLED`：默认非 production 开启、production 关闭，关闭时在认证前隐藏为 404。

边界：

- 不做前端页面、不做审计导出、不提供详情接口、不支持删除或编辑审计日志。
- 查询结果不返回 `metadata`、outbox payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、access token、refresh token、cookie、原始 IP 或原始 User-Agent。

验收：

- `bun test packages/types/tests/operator-audit.test.mts`
- `bun --cwd packages/types typecheck`
- `bun --filter @repo/server test -- operator-audit.controller operator-audit.service env --runInBand`
- `bun --cwd apps/server eslint src/operator-audit src/config/env.ts src/config/env.spec.ts src/app.module.ts`
- `bun --filter @repo/server build`

回顾时可以问：

- “Operator Audit 查询 API 为什么要单独加 feature gate？”
- “`GET /operator-audit-logs` 返回哪些字段，为什么不返回 metadata？”
- “这里的复合 cursor 是怎么避免翻页漏数据的？”
- “为什么权限和审计是两层不同的生产安全能力？”

### 2026-07-08 - Phase 7.14.3 / 7.14.4 OperatorAuditLog + Outbox Requeue Audit

目标：在 OperatorGuard 之后补上操作审计地基，并把 `POST /outbox-events/:id/requeue` 接入成功/失败留痕，避免审计 service 变成死码。

为什么：

- `requeue` 会改变后台事件状态，属于 operator 诊断写操作，需要留下可追责记录。
- 审计写入要 best-effort，不能因为审计系统异常阻断原本的修复操作。
- 审计日志要长期保留，即使 actor user 后续被删除，也不能丢失历史操作链路。

主要内容：

- Prisma 新增 `OperatorAuditAction`、`OperatorAuditStatus`、`OperatorAuditLog` 和 migration。
- `OperatorAuditService` 支持 `recordSuccess()` / `recordFailure()`。
- metadata 改为 allowlist，只允许 `previousStatus`、`nextStatus`、`attemptsBefore`、`attemptsAfter`、`payloadHash`、`lastErrorCode`、`source` 等安全字段。
- reason / requestId / errorCode / errorPreview 均做脱敏和截断。
- `OperatorAuditLog.actorUserId` 使用 nullable + `onDelete: SetNull`，actor 删除后审计记录保留。
- `OutboxOpsController.requeue()` 成功记录 `OUTBOX_REQUEUE / SUCCEEDED`，失败记录 `OUTBOX_REQUEUE / FAILED` 后继续抛出原错误。

边界：

- 不新增前端页面，不开放审计查询接口，不保存 payload、prompt、chunk、API key、token、cookie 或原始 IP/User-Agent。

验收：

- `bun --filter @repo/server test -- operator-audit.service outbox-ops.controller --runInBand`
- `bun --cwd apps/server eslint src/operator-audit src/outbox/outbox-ops.controller.ts src/outbox/outbox-ops.controller.spec.ts`
- `bun --filter @repo/server build`
- `bun --cwd packages/database test`
- `bun run db:generate`

回顾时可以问：

- “OperatorAuditLog 为什么 actorUserId 要 nullable + SetNull？”
- “审计 metadata 为什么用 allowlist，而不是黑名单过滤？”
- “Outbox requeue 成功和失败分别怎么记录审计？”
- “审计写入失败为什么不能影响 requeue 主流程？”

### 2026-07-08 - Phase 7.14.2 OperatorGuard

目标：把 Outbox Ops、Worker Observability、HTTP Worker Readiness 从普通登录用户可访问的诊断入口升级为 admin/operator-only。

为什么：

- 这些接口暴露的是系统级队列、worker、readiness 或 outbox 状态，不是普通学生账号应看到的业务数据。
- feature gate 只能控制入口是否开放，不能替代角色权限。
- 后续 requeue、审计查询等高权限能力都需要统一 operator 权限地基。

主要内容：

- 新增 `OperatorGuard`，基于 `request.user.role === 'ADMIN'` 判断权限。
- `AuthModule` 注册并导出 `OperatorGuard`。
- `OutboxOpsController`、`WorkerObservabilityController`、`WorkerReadinessController` 的 guard 顺序统一为 feature gate -> JWT -> operator。
- feature gate 仍优先返回 404，避免关闭时暴露诊断面。

边界：

- 不新增审计表，不记录 requeue 操作日志；审计写入留给 Phase 7.14.3 / 7.14.4。
- 不影响 Worker Readiness CLI、Docker healthcheck、Chat、RAG、Agent Trace 或普通业务 API。

验收：

- `bun --filter @repo/server test -- operator.guard outbox-ops.controller worker-observability.controller worker-readiness.controller --runInBand`

回顾时可以问：

- “OperatorGuard 和 JwtAuthGuard 的职责有什么区别？”
- “为什么 guard 顺序要 feature gate -> JWT -> Operator？”
- “为什么关闭诊断入口时返回 404 而不是 403？”
- “普通用户访问 worker observability 会有什么风险？”

### 2026-07-08 - Phase 7.13 Docker Web / Full Stack Compose

目标：把 API / worker / readiness 容器链路扩展到 Web 容器，完成本地 Docker Compose 全栈启动与浏览器验收。

为什么：

- 之前只验证了 API / worker，不能证明用户从浏览器访问 Docker Web 容器的完整链路可用。
- Next standalone 在 monorepo + Bun workspace 下容易出现依赖复制和 tracing root 问题，需要真实容器构建验证。
- 本地 compose 全栈能让后续验收更接近部署形态。

主要内容：

- `docker/Dockerfile.web` 迁移到 Bun workspace + Next standalone。
- `apps/web/next.config.ts` 开启 `output: 'standalone'` 并设置 monorepo tracing root。
- Compose dev 栈拉起 `postgres / redis / minio / server / worker / web`。
- Web 容器支持本地 dev AI mode switch 展示，受 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true` 约束。
- 修复 server Dockerfile 的 Bun workspace runtime 布局，避免内部 `@repo/*` 包或 `.bun` store 链接在容器内解析失败。

边界：

- 本轮是本地 Docker Compose 验收，不引入 Kubernetes、生产域名、TLS、CI 镜像推送或云部署。

验收：

- `bun --filter @repo/web lint`
- `bun --filter @repo/web test`
- `bun --filter @repo/web build`
- `docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web`
- HTTP smoke：`http://127.0.0.1:3000` 返回 200，`http://127.0.0.1:3001/health` 返回 `status=ok`。
- Playwright 浏览器验收：注册临时账号后跳转 `/chat`，刷新后仍保持登录态。

回顾时可以问：

- “Docker Web 镜像为什么要用 Next standalone？”
- “monorepo 下 Dockerfile.web 需要复制哪些 workspace 文件？”
- “为什么本地 Web 容器也要支持 mock/live 开关展示？”
- “这轮 Docker 全栈验收证明了什么，没证明什么？”

### 2026-07-08 - Phase 7.12 Docker Worker Healthcheck

目标：把 worker readiness CLI 接入 Docker Compose worker service，让容器编排能看到 `healthy / unhealthy`。

为什么：

- worker-only 进程不监听 HTTP，不能靠 `/health` 判断它是否能处理后台任务。
- 容器层 healthcheck 能让 Docker Compose 直接暴露 worker 健康状态，降低本地部署排障成本。
- readiness CLI 已经存在，复用它比再写一套容器专用检查更一致。

主要内容：

- `docker/docker-compose.dev.yml` 的 `worker` service 新增 healthcheck。
- 容器内 healthcheck 使用 `bun apps/server/dist/scripts/worker-readiness.js`。
- 新增 `WORKER_READINESS_CLI_TIMEOUT_MS` 和 healthcheck interval/timeout/retries/start_period。
- 新增 docker compose readiness 回归测试。
- 更新启动文档，区分本机 CLI 与容器 healthcheck。

边界：

- 不改 Chat、RAG prompt、Tutor 输出或 live model 链路，不需要真实模型 smoke。
- 不引入 Kubernetes readiness probe、Prometheus 指标或生产部署平台配置。

验收：

- `bun --filter @repo/server test -- worker-readiness docker-compose-readiness`
- `bun --cwd apps/server eslint src/worker-readiness`
- `bun --filter @repo/server build`
- `docker compose -f docker/docker-compose.dev.yml --profile worker config`
- `git diff --check`

回顾时可以问：

- “worker-only 为什么没有 HTTP health endpoint？”
- “Docker healthcheck 调的是本机 CLI 还是容器内构建产物？”
- “`docker compose ps` 里的 healthy 到底代表什么？”
- “readiness CLI 和容器 healthcheck 的区别是什么？”

### 2026-07-08 - Phase 7.11 Worker Readiness

目标：在 `/health` 和 `/worker-observability/summary` 之外，补一个适合机器和部署系统使用的 worker readiness 判断。

为什么：

- `/health` 只能说明 API 进程活着，不能说明后台 worker 链路可接流量。
- `/worker-observability/summary` 面向开发者排障，信息更细；readiness 要给机器一个明确可判断结论。
- 部署前检查需要稳定退出码和安全摘要，不能打印连接串、payload 或原始依赖错误。

主要内容：

- 新增 `@repo/types/api/worker-readiness` contract。
- 新增 `WORKER_READINESS_ENABLED`，默认非 production 开启、production 关闭。
- 新增 `WorkerReadinessService`，组合 Redis、BullMQ queue counts、worker heartbeat 和 outbox summary。
- 新增 HTTP 入口 `GET /worker-readiness` 和 CLI `bun --filter @repo/server readiness:worker`。
- CLI 使用最小只读 Nest module，不导入 `AppModule`，不启动 HTTP、worker processor、heartbeat 或 outbox dispatcher。
- readiness 输出区分 `ready / degraded / not_ready`，异常或超时退出码为 2。

边界：

- Readiness 不替代 `/worker-observability/summary` 的详细排障信息，也不替代 `/health` 的 API liveness。
- CLI 只读检查，不消费 BullMQ、不 dispatch outbox、不 requeue、不修改业务数据。

验收：

- `bun --filter @repo/server test -- env`
- `bun --cwd packages/types typecheck`
- `bun --filter @repo/server test -- worker-readiness`
- `bun --cwd apps/server eslint src/worker-readiness scripts/worker-readiness.ts`
- `bun --filter @repo/server build`
- `git diff --check`

回顾时可以问：

- “`/health`、worker observability、worker readiness 三者怎么分工？”
- “readiness CLI 为什么不能导入 AppModule？”
- “退出码 0 / 1 / 2 分别代表什么？”
- “readiness 输出为什么不能打印原始错误？”

### 2026-07-07 - Phase 7.10 Outbox Ops

目标：给 durable outbox 补上安全的后端操作闭环，让开发者能在不暴露 payload 的前提下查看失败事件，并在修复根因后手动 requeue。

为什么：

- durable outbox 有了持久事件和重试状态后，必须能安全查看失败事件，否则排障仍然只能查数据库。
- dead / failed 事件需要可控 requeue，但 requeue 不能绕过状态机或直接执行 handler。
- outbox payload 可能间接关联业务上下文，诊断 API 必须默认隐藏敏感内容。

主要内容：

- 新增 `@repo/types/api/outbox` contract。
- 新增 `OUTBOX_OPS_ENABLED`，默认非 production 开启、production 关闭。
- 新增 `OutboxOpsService` / `OutboxOpsController`，支持脱敏列表、脱敏详情和 `FAILED / DEAD` requeue。
- 列表分页按 `updatedAt desc, id desc` 使用复合 cursor。
- `lastErrorPreview` 复用 `sanitizeJobError()`，覆盖 Bearer、access/refresh token、cookie、`sk-...`、Qwen/DashScope/OpenAI key 等形态。
- requeue 使用条件 `updateMany` 做 compare-and-swap，只把 `FAILED / DEAD` 重置为 `PENDING`，不立即执行 handler。

边界：

- 不返回 payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token 或 cookie。
- 不支持删除、强制成功、跳过、payload 编辑或直接 dispatch。

验收：

- `bun --cwd packages/types typecheck`
- `bun --filter @repo/server test -- outbox-ops env`
- `bun --filter @repo/server test -- outbox-ops job-error-sanitizer`
- `bun --cwd apps/server eslint src/outbox src/jobs/job-error-sanitizer.ts src/jobs/job-error-sanitizer.spec.ts`
- `bun --filter @repo/server build`
- `bun --cwd apps/server jest --config ./test/jest-e2e.json --runInBand --testTimeout=30000 --forceExit --verbose outbox-ops`

回顾时可以问：

- “Outbox Ops 为什么只返回脱敏列表和详情？”
- “requeue 为什么用 updateMany 做 compare-and-swap？”
- “FAILED / DEAD -> PENDING 为什么不直接执行 handler？”
- “`sanitizeJobError()` 主要防什么泄露？”

### 2026-07-06 / 2026-07-07 - Phase 7.9 Durable Outbox

目标：把关键内部事件从纯 in-process 链路推进到可重试、可观测、可受控消费的 durable outbox 地基。

为什么：

- in-process EventBus 失败后无法跨进程持久重试，适合轻量通知，不适合需要可靠投递的内部事件。
- outbox 可以把“业务事务”和“异步事件”连接起来，为后续生产化 worker 链路打地基。
- dispatcher runner 需要受控开启，避免生产部署后未经确认消费历史事件。

主要内容：

- Phase 7.9.1：新增 `OutboxEvent`、enqueue / claim / success / retry / dead-letter 状态机。
- Phase 7.9.2：新增 dispatcher service 和显式 handler registry，先接入 `knowledge.document.processing.requested`。
- Phase 7.9.3：新增 worker-only dispatcher runner，支持生产默认关闭、防重入 tick、batch size 和 lock timeout。
- Phase 7.9.4：新增 outbox summary / metrics，接入 worker observability。

边界：

- 不替换 BullMQ、`BackgroundJob` 或现有 in-process EventBus。
- dispatcher handler 不保存用户正文、prompt、chunk、API key、token 或 cookie。
- production 默认不自动消费历史 outbox，需要显式开启。

验收：

- `bun --filter @repo/server test -- outbox`
- `bun --filter @repo/server test -- outbox-dispatcher`
- `bun --filter @repo/server test -- outbox-dispatcher-runner`
- `bun --filter @repo/server test -- outbox-metrics worker-observability`
- `bun --filter @repo/server build`

回顾时可以问：

- “Durable Outbox 和 EventBus / BullMQ 的区别是什么？”
- “claim / retry / dead-letter 状态机怎么防重复消费？”
- “为什么 dispatcher 要显式 handler registry？”
- “为什么 production 默认不自动开启 dispatcher runner？”

### 2026-07-06 - Phase 7.8 RAG Eval / Hybrid Retrieval

目标：给 RAG 检索质量建立可回归的评估基线，并把检索从单纯向量召回升级为 hybrid retrieval。

为什么：

- fake embedding 只能验证工程链路，不能证明真实语义检索质量。
- 没有固定评估集时，每次改检索排序都很难判断是变好了还是变差了。
- 纯向量召回容易漏掉关键词明确的问题，hybrid retrieval 能补充关键词候选。

主要内容：

- Phase 7.8.1：新增固定检索评估集和 `recall@k`、`top1Accuracy`、`safetyPassRate`、`noHitPassRate` 指标。
- Phase 7.8.2：`/knowledge/search` 支持 vector candidates + PostgreSQL full-text keyword candidates 融合排序。
- Phase 7.8.3：新增 `bun --filter @repo/server smoke:rag-eval`，串联注册、上传、处理、检索和 eval。
- Phase 7.8.4：新增必需 case id guard，避免评估集改名或缺失时误报 PASS；支持 `RAG_EVAL_SMOKE_KEEP_DATA=true`。
- 补充 Qwen embedding 配置与真实检索 smoke 说明。

边界：

- fake eval 只证明工程回归，不证明真实语义质量。
- smoke 默认不进 CI、不保存 API key、token、cookie、embedding 向量或完整 hit content。

验收：

- `bun --cwd packages/types typecheck`
- `bun --filter @repo/server test -- rag-eval`
- `bun --filter @repo/server smoke:rag-eval`
- `bun --filter @repo/server build`

回顾时可以问：

- “RAG Eval 的 recall@k / top1 / safety / no-hit 指标分别看什么？”
- “Hybrid Retrieval 怎么融合向量候选和关键词候选？”
- “fake eval 和真实 embedding smoke 分别证明什么？”
- “为什么要有 case id guard 防误报？”

### 2026-07-02 / 2026-07-05 - Phase 7.3 ~ 7.7 Observability / OpenAPI / Worker Split

目标：把后台任务、接口文档和 worker 进程边界做成更可调试、更适合本地验收和面试讲解的工程化能力。

为什么：

- Phase 7 开始后，后台任务、worker、诊断 API 增多，如果没有观测和文档入口，开发者很难知道系统现在发生了什么。
- Swagger 用来帮助本地调试和面试展示，但不能变成第二套 contract 来源。
- API / worker 拆分能让后台任务进程独立部署和独立观测。

主要内容：

- Phase 7.3：EventBus handler 失败隔离，新增 `GET /background-jobs/summary` 和 `/knowledge` 后台任务摘要轮询兜底。
- Phase 7.4：新增 Swagger / OpenAPI debug docs，入口 `/api-docs` 和 `/api-docs-json`。
- Phase 7.5：核心写接口补中文 request body 示例，Swagger 顶部说明中文化。
- Phase 7.6：拆分 `SERVER_ROLE=api | worker | both`，worker-only 不监听 HTTP。
- Phase 7.7：新增 Redis heartbeat、BullMQ queue counts、worker observability summary 和 `/knowledge` 健康状态条。

边界：

- Swagger 是调试/展示层，不替代 `@repo/types` contract。
- worker observability 默认 production 关闭，不返回 payload、prompt、chunk、API key、token 或 cookie。
- 这组改动不改 Chat prompt / RAG prompt / live model 策略。

验收：

- `bun --cwd packages/types typecheck`
- `bun --filter @repo/server test -- event-bus background-jobs worker-observability`
- `bun --filter @repo/web test -- background-job knowledge-view`
- `bun --filter @repo/server build`
- `bun --filter @repo/web build`
- `docker compose -f docker/docker-compose.dev.yml --profile worker config`
- `git diff --check`

回顾时可以问：

- “EventBus 失败隔离解决了什么问题？”
- “Swagger 为什么只是展示层，不是 contract 事实源？”
- “`SERVER_ROLE=api | worker | both` 分别适合什么场景？”
- “Worker Observability 的 queue counts、heartbeat、BackgroundJob summary 各代表什么？”

### 2026-06-30 - Phase 7.0 / 7.1 / 7.2 Background Jobs + RAG SafetyGuard

目标：把知识库文档处理从同步接口升级为可切换的后台任务链路，并把用户上传资料视为低信任 RAG 证据。

为什么：

- 文档解析、分块、embedding 可能耗时，同步接口会拖慢用户请求，也不利于失败重试。
- 用户上传资料可能包含恶意 prompt injection，RAG 不能把检索片段当成可信指令。
- inline / queue 双模式可以兼顾本地简单开发和后台任务生产化。

主要内容：

- 新增 `BackgroundJob` 数据模型和 `@repo/types/api/background-job` contract。
- `KNOWLEDGE_PROCESSING_MODE=inline | queue` 控制文档处理模式。
- queue 模式创建 `BackgroundJob` 并投递 BullMQ；worker 处理时持续校验 `status + storageKey + contentHash` 快照。
- `/knowledge` 展示文档后台处理状态，只在活跃处理时轮询。
- `@repo/rag` 增加 deterministic chunk safety classifier。
- 文档处理时写入 `metadata.safety`，检索 API 返回 safety metadata。
- Chat RAG prompt 组装前过滤 high-risk chunk；medium-risk chunk 只作为可疑引用。
- `KnowledgeVerifierAgent` 对高风险或 `safeForPrompt=false` 的资料输出保守 guidance。

边界：

- Redis 是 queue 链路必需依赖。
- BackgroundJob 只保存脱敏任务元数据，不保存完整文件、prompt、RAG chunk、API key 或 token。
- SafetyGuard 不执行检索片段里的指令，只把资料当证据。

验收：

- mock / e2e 覆盖固定 prompt-injection 样本。
- live/browser smoke 记录在 `docs/ai-behavior-acceptance.md`。
- Trace 和 BackgroundJob 仍只保存脱敏元数据。

回顾时可以问：

- “为什么知识库处理要支持 inline / queue 双模式？”
- “BullMQ 在文档处理链路里负责什么？”
- “RAG SafetyGuard 怎么判断高风险 chunk？”
- “Chat prompt 前为什么要过滤 high-risk chunk？”

### 2026-06-20 ~ 2026-06-29 - Phase 6 Multi-Agent

目标：落地多 Agent 协作亮点，并保持确定性 policy、可观测和只读建议边界。

为什么：

- 单一 Chat 链路难以承载讲题、资料核对、错题组织、复习规划、长期记忆等多种职责。
- 多 Agent 能把复杂任务拆成可解释的策略层，但当前阶段要先保证确定性和可验收。
- 只读建议和人审确认能降低自动写库、自动误分类、自动污染记忆的风险。

主要内容：

- Phase 6.0 / 6.1 / 6.2：新增 Agent Runtime contract、RouterAgent、TutorAgent 策略层，`/api/chat` 输出 route headers。
- Phase 6.3：`KnowledgeVerifierAgent` 在 RAG 命中后评估资料可信度，并注入保守使用 guidance。
- Phase 6.4：`WrongQuestionOrganizerAgent` 推荐学科组与专题 deck，`/error-book` 升级为学科 -> 专题 -> 错题下钻结构。
- Phase 6.5：`ReviewAgent` / `PlannerAgent` 提供只读学习建议，不创建未来 `ReviewTask(source=PLANNER)`。
- Phase 6.6：`MemoryAgent` 生成长期记忆候选，必须用户确认后才成为 active memory。
- Phase 6.7：Agent Trace 持久化脱敏 route、step、token 和估算成本元数据。
- Phase 6.8：`KnowledgeDedupAgent` / `KnowledgeOrganizerAgent` 提供资料重复、新版、互补、集合和标签建议。

边界：

- 当前 Phase 6 Agent 都是确定性 policy，不直接调用真实模型。
- Review / Planner / Memory / Knowledge agents 都遵循“只读建议或人审确认”，不在每次 Chat 中自动写库或自动注入。
- Agent Trace 不保存完整 prompt、完整回答、完整 RAG chunk 或 API key。

验收：

- fixed deterministic eval set 覆盖当前确定性 Agent policy。
- mock 验证工程链路；涉及 Chat 输出体验时按 `docs/ai-behavior-acceptance.md` 做 live 小样本验收。

回顾时可以问：

- “Phase 6 每个 Agent 各自负责什么？”
- “为什么这些 Agent 当前是 deterministic policy，不直接调用真实模型？”
- “RouterAgent / TutorAgent / KnowledgeVerifierAgent 在 Chat 链路里的顺序是什么？”
- “MemoryAgent 为什么必须用户确认后才成为长期记忆？”

## 早期里程碑索引

> 说明：2026-06-05 ~ 2026-06-19 的早期 DEVLOG 曾经按日记录，后来在多轮文档清理中被压缩。这里按 `git log -- DEVLOG.md` 恢复成阶段索引，详细内容可用对应提交追溯。

| 日期       | 阶段                | 主要进展                                                                                 | 回顾时可以问                                                      | 追溯线索                                              |
| ---------- | ------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| 2026-06-05 | Phase 0             | 新增 DEVLOG，记录 pnpm / monorepo 恢复与项目初始化。                                     | “项目最初的 monorepo 和 Docker 基础怎么搭的？”                    | `2f9c2cb`、`ef1a580`                                  |
| 2026-06-06 | Phase 1             | 登录模块、AI 聊天、上下文传递规划、开发博客更新。                                        | “Phase 1 的登录和聊天 MVP 怎么组织状态？”                         | `2797be2`、`8311a6a`、`af62415`                       |
| 2026-06-07 | Phase 1             | Day 3 开发日志，规划 Phase 1 -> Phase 2 存储迁移。                                       | “为什么从本地存储逐步迁移到后端权威数据？”                        | `31b6649`                                             |
| 2026-06-08 | Phase 1             | Dexie 迁移、OCR 流式、错题本 CRUD、今日任务静态版、Phase 1 收官。                        | “Dexie 在 Phase 1 里承担了哪些离线和本地恢复职责？”               | `9f59fbf`、`4a92f87`、`b64b94d`、`a8d864f`、`375e2cb` |
| 2026-06-09 | Phase 2.1           | 后端基础与 Auth/User API 收口，准备 Phase 2.2。                                          | “NestJS 后端和 Auth/User API 是怎么作为后端地基落地的？”          | `b2fb4b9`                                             |
| 2026-06-11 | Phase 2.2           | Auth flow、refresh token reuse detection、WrongQuestion API、前端接入和动态 CORS。       | “登录态为什么改成后端 session 权威控制？”                         | `65ad246`、`8ebc04f`、`cc132b5`、`d022234`、`6a68627` |
| 2026-06-12 | Phase 2.3           | OCRRecord、ChatMessage sync、MinIO 图片链路、chat streaming 稳定性和 Phase 2.3 handoff。 | “WrongQuestion / ChatMessage / OCRRecord 如何迁移到 PostgreSQL？” | `12614a4`、`265ba42`、`909260d`、`53802c9`、`3d6f99b` |
| 2026-06-13 | Phase 2.3 / 2.5     | Phase 2.3 稳定化，Chat-first 产品壳层和体验打磨。                                        | “为什么产品壳层改成 Chat-first？”                                 | `122aea2`、`537e458`、`c723e0b`                       |
| 2026-06-14 | Phase 3 / 4.1 ~ 4.3 | AI 讲题结构化、FSRS 复习流、学习统计、ReviewTask 任务流。                                | “OCR structured output 和 FSRS 复习闭环是怎么连起来的？”          | `7a1dc6e`、`34b779c`、`c2a57bc`、`f27f054`            |
| 2026-06-15 | Phase 4.4           | 离线评分队列、浏览器验证和复习评分流。                                                   | “ReviewTask 评分为什么需要 clientMutationId 幂等？”               | `332ffa4`、`b15131e`                                  |
| 2026-06-16 | Phase 4.5.1         | 复习计划预览、统计图表、review pressure model 初步规划。                                 | “复习计划预览和学习统计页面怎么计算压力？”                        | `c08ed16`、`031fc90`、`ed55e12`                       |
| 2026-06-17 | Phase 4.5.2 / 5.0   | ReviewPreference、加权压力模型、Phase 5 RAG 规划。                                       | “ReviewPreference 如何影响 7/14 天复习计划？”                     | `1c00f76`、`9294416`                                  |
| 2026-06-18 | Phase 5.1 / 5.2     | RAG 数据模型、知识库上传 API、wrong-question organizer 规划。                            | “RAG 的 Document / Chunk 模型和上传 API 怎么设计？”               | `9d38faf`、`1031872`、`f844b3e`                       |
| 2026-06-19 | Phase 5.3 ~ 5.6     | 文档处理、检索 API、Chat RAG、`/knowledge` 页面、live AI guard、Phase 6 多 Agent 规划。  | “文档解析、分块、embedding、检索和 Chat RAG 是怎么串起来的？”     | `1ec1644`、`2038e6a`、`ae97b49`、`542df8d`、`631c6c1` |

## 当前验证基线

常用全量验证：

```powershell
bun --filter @repo/web lint
bun --filter @repo/web test
bun --filter @repo/web build
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
bun --filter @repo/server readiness:worker
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --cwd packages/fsrs test
```

当前 Phase 7 operator / worker / outbox 方向常用定向验证：

```powershell
bun test packages/types/tests/operator-audit.test.mts
bun --cwd packages/types typecheck
bun --filter @repo/server test -- operator-audit outbox-ops worker-readiness worker-observability env --runInBand
bun --cwd apps/server eslint src/operator-audit src/outbox src/worker-readiness src/worker-observability src/config
bun --filter @repo/server build
git diff --check
```

AI 行为验收规则：

- mock 验工程链路。
- live 小样本验真实输出体验。
- fake embedding 不证明 RAG 语义命中质量。
- 改 Chat prompt、RAG prompt、Tutor 输出或真实模型策略时，必须按 `docs/ai-behavior-acceptance.md` 做 live smoke。
- 纯后台任务、API contract、UI 状态和文档更新不需要 live 模型验收。

## 2026-07-11 — Phase 6.9.1 Agent Evaluation Baseline

### 为什么做

Phase 6.0 ~ 6.8 的 Agent 都是确定性 policy，只有 `/api/chat` 最终回答会调用真实模型。为了避免
后续凭主观感受把所有 Agent 替换为 LLM，先固定统一评测 contract 和当前能力 baseline，让模型
候选必须证明质量收益，同时满足安全、延迟和成本门槛。

### 做了什么

- 新增 deterministic/Mock/Live run、summary 和模型路径启用决策纯函数。
- 新增 `phase-6.9-seed-v1`：Router、Verifier、Memory 各 8 个可执行 case，Orchestrator 8 个
  expectation-only case。
- 当前 deterministic 结果为 21/24，pass rate 87.5%，token/cost 为 0。
- 如实保留 3 个失败：混合“笔记+讲题”路由歧义、短正确片段被判不足、含示例 API key 的
  “以后请记住”被 MemoryAgent 误提取为偏好。其中最后一项是 critical failure。
- 新增 paired eval 报告模板；明确最终 60/40/40/40 数据集在对应 Agent 实施阶段扩充。
- 修复 `@repo/agent lint` 只有脚本却没有 workspace 级 ESLint 依赖和配置的问题，使 Agent 语义 lint 不再隐式借用 web/server 工具链；历史格式差异不在本任务批量重写，本次新增文件另做 Prettier check。
- 独立审查后补 fail-closed：非法指标返回 `invalid_metrics`；baseline 测试锁定 21/24 与失败 case；任意 detail 改为受限结构码 outcome，疑似 prompt/provider 原文统一 redacted。
- 同步 AGENTS、README、roadmap、data-flow 和统一 AI 验收入口。

### 边界

- 本阶段不调用真实模型、不改 Chat 输出、不实现 Orchestrator，也不修饰 baseline 失败结果。
- Critical failure 不会被总体准确率抵消；MemoryAgent 接模型前必须先有确定性敏感信息 guard。
- 后续候选未达到质量、安全、延迟或成本门槛时继续使用 deterministic。
- Phase 6.9.7 收尾时写详细面试学习博客，汇总哪些 Agent 启用模型及其数据依据。

### 验收

- Phase 6.9 contract/baseline、原 Phase 6.7 eval、`@repo/agent` 全套测试、typecheck 和 lint。
- 该任务无真实页面、数据库或模型调用，因此不启动 Docker、浏览器或 Live AI。
- 详细基线：`docs/acceptance/2026-07-11-phase-6-9-1-deterministic-baseline.md`。

### 回顾时可以问

- “Phase 6.9.1 seed baseline 与最终 paired eval 有什么区别？”
- “为什么 Orchestrator 目前只有 expectation-only cases？”
- “为什么模型路径不能只看准确率决定？”
- “MemoryAgent 的敏感凭据 case 为什么是 critical failure？”

## 2026-07-11 — Phase 6.9.2 Shared Model Agent Runtime

### 为什么做

Phase 6.9.1 先固定了 deterministic baseline，但 Router、Verifier、Memory、摘要和 Orchestrator
后续如果各自直接拼装 AI SDK 调用，会重复实现开关、schema 校验、token 预算、timeout、错误脱敏和
Trace，最终很容易出现 Mock 与 Live 行为不一致，或者某条 Agent 路径绕过成本与安全边界。因此先把
“如何安全地调用一次结构化模型”收敛为共享 runtime，再逐个 Agent 做 paired eval 和受控接入。

### 做了什么

- 在 `@repo/ai` 新增共享 `ModelAgentRuntime` contract，统一
  `conversation_summary / router_fallback / knowledge_verification /
memory_candidate_extraction / tool_orchestration` 任务类型。
- Mock responder 与 Live executor 共用同一个 Zod schema、请求、成功/失败结果、usage 和 Trace
  contract；Mock 不再是绕过 schema 的特殊分支。
- 新增单 run 不可变 budget：累计限制 call、预估输入 token 和最大输出 token；每次调用前按
  `maxOutputTokens` 预留，不等待 provider usage 后再扣减，也不退还差额，避免并发重入超卖。
- Live 路径增加 runtime 二次 guard、executor availability、timeout、外部 abort 转发和安全错误分类；
  timeout/abort/provider rejection 不返回原始异常。
- 新增 OpenAI-compatible structured executor adapter；只允许无 credentials/query/hash 的 HTTPS
  base URL。`@repo/ai` 不读取 env，API key 只在 composition root 创建 executor 时进入 closure。
- 删除无人使用且会抛 `Not implemented` 的 AI package 占位 factory/streaming 导出，建立稳定 package
  exports、独立 test/typecheck/lint/format 门禁。
- 更新 Phase 6.9 paired eval 模板，补充 runtime version、max calls、timeout 和 budget reservation
  记录字段。

### 安全与数据边界

- result 与 Trace 只包含结构化 data、固定错误码、runId SHA-256 hash、task、mode、provider、model、
  token、耗时和 degraded 状态；不包含 system/user prompt、完整模型输出、provider 原始错误、API key、
  base URL、response headers 或 stack。
- 调用方仍需先权威解析 `AI_PROVIDER_MODE` 与 `AI_ENABLE_LIVE_CALLS`；runtime 的
  `liveCallsEnabled` 是第二层 guard，不替代 composition root 配置校验。
- 本阶段没有真实模型调用，没有迁移 `/api/chat` streaming，也没有把 RouterAgent、
  KnowledgeVerifierAgent、MemoryAgent 或其他业务 Agent 改为模型路径。
- provider 返回的实际 usage 只用于观测；预算按调用前 reservation 计算，防止并发条件下先调用后超额。
- Phase 6.9.7 的详细面试学习博客继续保留，届时汇总哪些 Agent 最终启用模型及 paired eval 依据。

### 验收

- AI package 覆盖预算、Mock/Live schema、live guard、timeout/abort、provider error 脱敏、usage
  归一化、HTTPS adapter 与 package exports。
- 回归验证 `@repo/agent` 测试和 typecheck，确认新增 AI runtime 没有改变现有 deterministic Agent。
- 该任务无页面、数据库、Docker 或真实模型调用，因此不启动浏览器、Docker 或 Live AI。

### 回顾时可以问

- “为什么 ModelAgentRuntime 不直接读取环境变量？”
- “为什么 budget 要在调用前按 max output 预留，而不是等待 usage 后扣减？”
- “为什么 Phase 6.9.2 不迁移现有 Chat streaming？”
- “Mock 和 Live 如何保证使用同一结构化 contract？”
- “ModelAgentRuntime 如何避免 prompt、provider 错误和 API key 进入 Trace？”

## 2026-07-11 — Phase 6.9.3.1 Conversation Memory Contracts

### 目标与主要内容

- 在 `@repo/types` 固定 strict prepare request/response/public state contract、summary status/trigger reason 与分层 token 观测字段。
- 在 Prisma/PostgreSQL 增加单会话单行 `ConversationSummary` / `ConversationState`，用 `(conversationId, userId)` 复合外键锁定 ownership，并补齐索引、级联删除、summary/hash 上限和 `expiresAt > updatedAt` CHECK。
- public state 不暴露 `pendingActionProposal`、`lastToolNames`、source hash、summary 或模型元数据。

### 边界与验收

- 本 slice 仅完成 contract/database；未实现 prepare API、Redis、摘要模型调用、CAS 或 Chat 注入。
- TDD RED 覆盖缺少 contract module、agent policy 新字段被剔除、Prisma model/migration 缺失；GREEN 覆盖 runtime schema tests、typecheck、Prisma client 生成与 server build。
- main 合并后门禁发现 Windows `core.autocrlf=true` 会把迁移检出为 CRLF；SQL 结构测试已改为按空白语义定位语句，并新增显式 CRLF 回归，避免跨平台误报及负向 mutation 假阳性。
- 下一 slice 是 Phase 6.9.3.2 ConversationState + prepare API。

### 回顾时可以问

- “为什么 public ConversationState 不能直接复用包含内部 action/tool 字段的 Prisma model？”
- “为什么 summary watermark 和 state version/expiry 需要数据库 CHECK，不只依赖 TypeScript？”

## 2026-07-11 — Phase 6.9.3.2 Conversation State + Prepare API

### 做了什么

- 新增鉴权 `POST /conversation-context/prepare`：先确认当前用户拥有 conversation，再处理 state/cache，避免用缓存或状态存在性泄露其他用户会话。
- PostgreSQL 保持 `ConversationState` 权威；客户端只可 patch `activeGoal` / `activeQuestionId`，省略字段表示保留，显式 `null` 表示清空。更新只写显式字段并由数据库原子递增 `stateVersion`，避免并发 patch 用旧快照覆盖未提供字段；首次创建的 P2002 竞态只做一次有界重读，状态变化或过期恢复会把有效期续到 24 小时。
- Redis 使用 `sha256(userId + NUL + conversationId)` key，缓存内容必须通过 strict public state schema，TTL 不超过 86,400 秒；读取、JSON/schema、写入或删除失败仅记录固定错误码并 fail-open 回源。
- Chat history list/sync 增加 optional sanitized state；过期状态不返回，内部 `pendingActionProposal`、`lastToolNames`、summary hash、缓存 key 与 Redis 原始错误均不进入响应。删除会话后 PG state 级联清理，Redis best-effort 删除。

### 验收与边界

- TDD 覆盖 ownership-first、24 小时 TTL、版本变化/不变化、显式 null、Redis miss/error/坏 JSON、哈希 key、Chat history 脱敏恢复与缓存清理。
- e2e 使用两个临时账号覆盖 owner 201、other user 404、内部 state 字段 400、Redis 故障回源与删除级联；全程 Mock，不调用网络模型。
- 本 slice 不生成滚动摘要、不推进 summary 水位、不调用 `ModelAgentRuntime`，也不把 prepare 结果注入 `/api/chat`；这些分别属于 6.9.3.3 与 6.9.3.4。

### 回顾时可以问

- “为什么 prepare 必须先校验 conversation ownership，再读取 Redis 或 PostgreSQL state？”
- “为什么 Redis 不能成为 ConversationState 权威源，缓存坏掉时如何降级？”
- “如何区分 statePatch 字段省略与显式 null，为什么这会影响版本推进？”
- “Chat history 为什么只返回 sanitized state，而不直接序列化 Prisma model？”

## 2026-07-11 — Phase 6.9.3.3 Rolling Conversation Summary + CAS

### 做了什么

- prepare 按 12 条未覆盖消息优先、否则 summary + 未覆盖窗口达到输入预算 70% 触发；已覆盖原文不重复计入 pressure，水位只停在最新完整 assistant 消息。
- `@repo/types` 提供 AI SDK 兼容的 strict summary schema；server composition root 解析 Mock/Live、双开关、provider/model、HTTPS base URL、key、单次调用和 token/timeout 预算。key/base URL 不进入 bundle、结果或 Trace。
- 摘要源显式限定 USER/ASSISTANT；provider 输入先脱敏 bearer/cookie、裸 `sk-*`、client secret/password、AWS access key 与 PEM 私钥，输出再次扫描；credential-like 输出、schema/provider/timeout 错误或超出数据库 CHECK 的 usage 都降级且不推进摘要。
- 模型调用位于 Prisma transaction 外；事务内使用 Serializable 复核目标范围 `sha256:` source hash，并以 summaryVersion + 旧 coveredThroughOrder CAS 写入。first-create P2002、serialization P2034、version/watermark update race 均返回有界状态，不在同一请求重复调用模型。
- Live provider 解析拒绝把 OpenAI key 发送到自定义 DeepSeek 域名；仅保留默认 DeepSeek URL + OpenAI-only 配置到官方 OpenAI URL 的显式兼容改写。
- `@repo/ai` 首次接入 Nest server 时修复内部 `.ts` import/export 的跨 package build 兼容；AI package 70 项回归保持通过。Docker server 明确默认 Mock/Live false，不透传 API key。

### 验收与边界

- 单测覆盖 12 条/70%、安全整数、完整轮次、稳定 hash、凭据双向防护、Mock/Live guard、预算、模型失败、stale、update CAS、first-create race、越界 usage 与 higher-order message。
- PostgreSQL e2e 覆盖 12 条完整消息首次 `generated/version=1/watermark=11`、第二次 `reused`、状态路径、双账号隔离和级联清理；本 slice 不调用真实模型。
- 截至 6.9.3.3，`/api/chat` 当时尚未消费 prepare 结果；该接入随后在 6.9.3.4 完成，受控 Live 摘要体验仍属于 6.9.3.5。

### 回顾时可以问

- “为什么模型调用不能放在 Prisma transaction 里？”
- “source hash 为什么只复核目标水位范围，而允许更高 order 新消息出现？”
- “为什么 token pressure 不能重复计算已经被摘要覆盖的原文？”
- “first-create、stale snapshot 和 version CAS conflict 分别如何处理？”
- “Zod 3 的 AI SDK schema 与 Zod 4 Nest server 如何跨 package 兼容？”

## 2026-07-12 — Phase 6.9.3.4 Web Context Assembler + Dexie Recovery

### 目标与为什么做

Phase 6.9.3.3 已能在 Nest prepare 中安全生成并持久化滚动摘要，但 Web Chat 仍未消费它。直接把 summary、RAG、Agent prompt 和 OCR 拼成一个大 system prompt，会让低优先级资料挤掉当前问题，也无法解释是哪一层被裁。这个 slice 的目标是把 prepare 接入真实 `/api/chat` 编排，用可观测的分层预算保证 base/latest user 和当前 OCR 优先，同时给 24 小时会话状态增加不越权的本地恢复。

### 主要内容与关键决策

- Web request 携带 optional `conversationId`。首轮没有 id 时安全跳过 prepare；ChatMessage sync 返回 id 后，第二轮请求才调用 prepare。这是有意的首轮降级，而不是客户端伪造会话或阻塞首答。
- 顺序固定为 request validate -> provider/live auth -> token+id prepare -> Router/RAG -> assembler -> mandatory 413 -> trace -> mock/live stream。live credential rejection 在 prepare 前完成；prepare 默认 10 秒、限定 1~15 秒并组合 request abort，任何 network/timeout/5xx/schema failure 只产生固定 degraded，不阻断 Mock Chat。
- prepare 保持同步请求而不投 BullMQ，因为它位于单次 Chat 的读时上下文决策路径：调用方需要在本轮 prompt 装配前得到已有 summary/state 或明确 degraded。BullMQ 适合可延后后台任务，不适合让当前回答等待另一个异步任务状态机。
- assembler 把 base/latest user 设为 mandatory；agent guidance、untrusted state guidance、OCR、recent complete turns、safe RAG、summary 分层装配。agent/state 合计最多 10% 且分别记录 token/drop；OCR 当前 question 优先，旧消息只保留完整 user/assistant turn；RAG 不能安全截断时整层 drop 并清空 citations/verifier/safety；summary 仅在确有 history dropped 时考虑。optional layer 只能裁剪或 drop，不能制造 413。
- ConversationState 是短期、可过期、单会话的恢复上下文，不等于长期记忆。它只保存当前目标/题目 id，不代表稳定用户偏好，也不自动写入 `UserMemory`。
- PostgreSQL 保持 state/summary 权威，Redis 只做服务端 public-state cache。Dexie v9 只保存 sanitized state、版本与有效期；不保存 summary，因为摘要有 CAS 水位、服务端凭据防护和跨设备一致性要求，把正文复制到浏览器会扩大泄露面并产生多权威冲突。
- Dexie 写入/读取/clear 按 user 串行，serverVersion 不低于 local 才覆盖；过期、坏 schema、key/user mismatch、logout、unmount、身份变化和迟到旧请求都 fail-safe。activeQuestionId 不能被用来伪造 OCR 全文。
- Mock/live response headers 与 Agent Trace 只包含 summary status/version、bounded dropped-layer codes、实际 conversationId 和 token 计数，不包含 summary、prompt、RAG chunk、state 正文或 raw error。

### RED / GREEN 与审查修复

- RED 先证明 conversationId 缺失、prepare client 缺失、assembler 不存在、Provider request 只靠源码断言、Dexie table/cache/state mapper 缺失；GREEN 后形成可执行 request preparer、authenticated prepare helper、纯 assembler、runtime bridge 和 strict shared contract。
- 审查阶段修复了 optional layer 导致伪 413、OCR 未按实际 remaining 二次裁剪、超长 optional 源在 tokenize 前无硬字符界、`turns.flat()` 临时数组、agent/state guidance 混账、state separator 注入、legacy context policy 兼容、timeout timer/listener cleanup、outer catch raw error、activeContext 浅校验、Trace 空断言、Dexie 并发写/clear 复活、readLatest N+1/sort 与 Provider unmount restore。
- 相关 contract/unit tests、Web lint 和 Next build 已通过；本 slice 没有调用真实模型。尚未完成 Docker 全栈 Mock、受控 Live 或 headed 可见浏览器验收，不能据此宣称真实摘要语义质量已经通过。

### 回顾时可以问

- “分层 context budget 如何保证 summary 或 RAG 不会挤掉 latest user 与当前 OCR？”
- “为什么 prepare 是有界同步读路径，而不是 BullMQ 后台任务？”
- “ConversationState 为什么不是长期记忆，activeQuestionId 为什么不能恢复 OCR 全文？”
- “为什么 Dexie 只存 sanitized state 而不存 summary？”
- “首轮没有 conversationId 时为何选择降级首答，第二轮如何进入 prepare？”

### 可见浏览器 Mock 验收补充

- 本地当前分支以 Web `3200`、API `3001` 运行，使用 headed Chrome 完成真实注册、首轮降级、conversationId 建立、sanitized state 写入、刷新恢复、多轮消息触发摘要与再次刷新复用；安全响应头依次观察到 `generated/version=1` 与 `reused/version=1`。
- IndexedDB `conversationStates` 实际只包含 `id/userId/conversationId/activeGoal/activeQuestionId/stateVersion/expiresAt/updatedAt`；console error 与 page error 均为 0，摘要正文未进入 header、Trace 或结果文件。
- 浏览器验收发现服务器历史回填时的重复 suppress 标志会吞掉刷新后的第一次新增消息 sync。回归测试先失败，再移除冗余 suppress；保留 `lastServerSyncKey/inFlightServerSyncKey` 去重后，原快照不重复上传，而变化后的首条消息可以正常持久化。
- 共精确删除 8 个 `phase6934-* @example.com` 临时账号，清理后剩余 0。该验收仍是本地 Mock，不等同于 Docker 全栈或受控 Live；二者继续留给 Phase 6.9.3.5。

### 回顾时还可以问

- “为什么服务器历史回填的 suppress 标志会吞掉刷新后的第一条消息，signature 去重为何已经足够？”
- “headed Mock 验收如何证明 generated/reused、Dexie 白名单与刷新后继续 sync？”

## 2026-07-12 — Phase 6.9.3.5 Docker Mock / Live Acceptance Closeout

### 目标与为什么做

前四个 slice 已分别证明数据模型、权威状态、滚动摘要和 Web 装配，但仍缺少三个不能由单元测试替代的事实：Docker 运行态是否真的使用当前产物、真实模型能否生成 strict 摘要、验收结束后是否能恢复安全默认并清理数据。本 slice 不再扩展记忆能力，而是把 Phase 6.9.3 从“代码完成”推进为“真实运行证据完整”。

### 主要内容与关键决策

- 恢复 Docker 七服务全栈并给 MinIO 增加 `miniodata:/data` 命名卷。`docker compose down` 会删除容器但不删除命名卷；此前 PostgreSQL 数据仍在，旧 MinIO 容器对象因原配置没有卷而不能承诺恢复。server 不再导入整个根 `.env`，只通过 Compose interpolation allowlist 传入模型、双开关、provider key 与摘要预算，并显式锁定 `NODE_ENV=production`；避免本机无关配置/凭据污染容器。
- `minio-init` 对 `mc alias set` 增加最多 30 次的一秒有界重试。本机 Docker Hub 暂不可达，`minio/mc:latest` 实际是 Phase 7.23.8 离线 `mc-shim`；重试只解决 MinIO readiness race，不隐藏永久错误。
- Docker Desktop 4.81 多服务并行 BuildKit session 会报 `x-docker-expose-session-sharedkey` 非打印字符。本机临时用 `COMPOSE_BAKE=false` 顺序 build，再 `up --no-build`；不把 Docker Desktop 特定绕行写入项目配置。
- Mock API 固定样本验证 12 条触发、`generated -> reused`、跨用户 404、并发 version 2 / stale snapshot 和 credential marker rejection；Docker headed Mock 验证 Trace layer token、Dexie 八字段白名单、刷新恢复、console/page error 0 与无横向溢出。
- 首次 DeepSeek Live 摘要返回固定 `PROVIDER_ERROR`，普通 Chat 同模型可用。根因是 AI SDK `generateObject` 默认对未识别的 OpenAI-compatible model 选择 tool/function calling，而该 DeepSeek 模型需要 JSON response mode。回归测试先要求 provider invocation 带 `mode: 'json'` 并得到 13 pass / 1 fail，再做最小 adapter 修复；没有放宽 strict Zod schema、预算、超时、双开关或错误脱敏。
- 修复后真实摘要一次生成：provider/model/promptVersion 为 `deepseek/deepseek-v4-flash/conversation-summary-v1`，16 条未覆盖消息得到 version 1、watermark 15，provider-reported input/output usage 为 2246/154，约 2383ms；随后 2 条未覆盖消息复用 version 1。调用前 1600 是字符估算预留，不是 provider tokenizer 的硬上限，不能与 usage 或账单混写。
- Agent Trace metadata 把 `layerTokens=m/a/s/o/r/k/y` 放在 bounded preview 之前，避免长 preview 截断重要观测字段；只记录各层 token，不记录摘要、prompt 或 chunk 正文。Live 可见 Chat 最终保留“二次函数判别式”和正确值 1，没有把 49 当正确值，也没有复述 credential marker。
- server 重建后浏览器 access token 恰好过期，失败发生在 Next Chat live auth、provider 调用之前，因此没有模型费用。通过同一可见 Chrome 重新登录后只重试一次；这也验证了真实登录恢复，而不是绕过认证。

### 验收与清理

- `@repo/ai` 71/71，database 7/7，server 76 suites / 693 tests、e2e 17 suites / 58 tests，web 352/352；types/ai typecheck、server/web lint/build、fsrs test 全部通过。
- Docker `postgres/redis/minio/server/worker/web/admin` 运行，worker healthy；Mock 和 Live Chat/Trace 浏览器窗口按用户要求保留用于观察。
- 结束时 base Compose 重建 server/web，`/api/dev/ai-mode` 为 Mock。严格删除 7 个 `phase6935-* @example.com` 合成账号和 4 个会话，级联 User/Conversation/ChatMessage/Summary/State 均为 0，Redis conversation-state key 为 0，两个隔离浏览器 profile 的站点 storage 已清空；没有 reset 数据库或删除原有用户数据。
- 完整证据、token、水位、边界与回顾问题见 `docs/acceptance/2026-07-11-phase-6-9-3-conversation-memory.md`。

### 边界

- Mock 证明工程 contract，单个 Live 样本只证明本次摘要体验，不证明所有学科、语言、provider 或超长对话质量。
- Chat Trace 输入/输出值仍是预算估算，不替代供应商账单；provider-reported summary usage 只记录安全 metadata。
- Phase 6.9.3 只完成短期会话记忆。稳定长期记忆、episodic memory 和 MCP-ready Orchestrator 分别属于后续 6.9.5、6.9.6、6.9.7。

### 回顾时可以问

- “为什么普通 DeepSeek Chat 能用，但结构化摘要必须显式 JSON mode？”
- “Docker down 为什么没有丢 PostgreSQL，却不能承诺恢复旧 MinIO 对象？”
- “`layerTokens=m/a/s/o/r/k/y` 各层是什么，为什么要放在 preview 前？”
- “Mock 与一个受控 Live 样本分别证明什么，为什么不能据此宣布所有摘要质量已通过？”
- “验收清理怎样保证只删合成账号，不 reset 数据库？”

## 2026-07-14 — Phase 6.9.4.3 Structured-output Resilience 零网络 Checkpoint

### 目标与为什么做

Attempt D 已将 Router 真实 strict success 推进到 15/16，但固定 case `router_ambiguous_mixed_chat_16` 仍以 `PROVIDER_ERROR / structured_output` fail-closed。成功 output 为 59~341，没有触及 400，因此不能用盲目重跑或继续加 token 代替工程证据。本 checkpoint 的目标是补齐 Provider schema enforcement、无副作用 Live preflight 和 evidence identity，而不是宣布 controlled-Live 质量完成。

### Task 1 — Schema compatibility compiler（`303b88a`）

- RED 先固定 Router / Verifier 真实 schema 不能直接当作 DeepSeek strict 稳定子集，并覆盖未注册 schema、可选字段、passthrough、多元素 tuple、未知关键字、`z.any()` 与 hostile getter/proxy。
- GREEN 实现 identity-only profile registry、`const -> enum`、单元素 tuple 转普通 `items`、删除 `$schema/minItems/maxItems`、非原地投影与深冻结。Provider projection 不替代 canonical Zod；长度、状态关联与 refinement 仍在本地最终校验。
- 审查补强 hostile accessor 与固定错误语义，最终无 Critical / Important 遗留。

### Task 2 — DeepSeek strict-tool Provider transport（`bdb7cb5`）

- RED 先要求显式区分 `json_object` 和 `deepseek_strict_tool`，拒绝 `/v1`、端口、encoded path、OpenAI provider 与未批准模型，并要求不存在 `response_format/json_schema`。
- GREEN 固定精确 `https://api.deepseek.com/beta`、唯一 forced synthetic function `model_agent_result`、`strict:true`、`maxRetries=0` 和调用前 profile resolve。该 function 没有 handler、业务执行、副作用或 MCP 语义。
- 审查发现 invocation `schema` hostile getter 一度可在 Provider catch 外泄漏 canary；补了先失败测试，再以安全 wrapper 收口为固定 `MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED`，不伪造 provider provenance。

### Task 3 — Paired CLI preflight 与 evidence（`2100e10`）

- RED 先固定 schema 编译/校验必须早于 UUID、evidence fs/reservation、Provider factory 和 runner；返回 `false`、throw、非法注入值或 hostile property/getter/proxy 都必须为 0 side effects。
- 最终审查进一步复现 dependencies/strict executor 本地初始化抛错、malformed/hostile return 与 arm 前同步 attempt callback 曾可在 UUID/evidence 之后落为 `unexpected_runner_error`，其中早期 callback + valid return 还会写入错误 evidence。修复后完整受控 preflight 顺序为 schema 校验 -> 安全 start timestamp -> 本地初始化与权威快照 -> arm callback -> UUID/evidence -> runner/Provider attempt；无效初始化固定 `live_config_invalid`，不泄漏原始异常。
- GREEN 要求只有明确 `true` 继续，新 Live report 使用 `phase-6.9.4.3-runner-v2` + `deepseek_strict_tool_v1`；历史 runner v1 Live 只读兼容，Mock v1/v2 禁止携带 Live transport 字段。
- 审查继续保持 100/28/72、Router 800/400、Verifier 1600/400、global 28 calls / 96,000 input / 11,200 output、单 case 10 秒和 `maxRetries=0`，与批准设计、实施计划和历史 contract 一致。

### 验收、边界与结论

- Fresh gates：AI 151 passed，Agent 344 passed，typecheck/lint 均 exit 0；deterministic baseline 仍 74/100、critical=2；fresh Mock complete，`caseEntries/runtimeInvocations/providerAttempts/strictSuccesses/zeroCallCases = 100/28/0/28/72`。
- zero-call Live config 为 exit 3，evidence 数量 `4 -> 4`。历史 validator 仍为 A exit 3 / `profile_mismatch`，B/C/D exit 0 / `incomplete`；A/B/C/D blob hash 均未改写。
- 本 checkpoint 零网络、零真实模型调用，未读取真实 key，未操作 Docker。Router / Verifier 仍 `enabled=false`，生产继续 deterministic。
- 该 checkpoint 当时的下一步是合并 main 后开独立 controlled-Live；该步骤随后已执行为 Attempt E，结果见下一节。只有 28/28 strict success、72/72 zero-call 与所有质量/安全/权限/延迟/token/usage provenance/成本门槛同时通过，Phase 6.9.4.3 才能完成。

### 回顾时可以问

- “为什么普通 `json_object` 不等于 Provider 级 JSON Schema 保证？”
- “`model_agent_result` 为什么不是业务 Tool，也不会进入 MCP？”
- “为什么 strict tool 后仍要用 canonical Zod 二次校验？”
- “为什么 schema 校验和 strict executor 本地初始化都必须在 UUID/evidence 之前完成？”
- “为什么 151/344 个零网络测试通过仍不能启用 Router / Verifier？”

该节原交接语已由下方 Attempt E 结果取代，不再作为当前下一任务。

## 2026-07-14 — Phase 6.9.4.3 Attempt E Strict-tool Controlled-Live Checkpoint

### 做了什么

- 在 structured-output resilience 分支已合并并推送到 `main@5d964c51a948d4603a1fcff5c52dba66b0581725` 后，从新 main 创建独立 controlled-Live 任务；只在单次 PowerShell 子进程内读取根 `.env` 的 key，结束后恢复 Mock 并移除进程 key。
- 先执行 96/96、845 assertions 的 paired 精确测试、Agent typecheck/lint 和负向 zero-call preflight；随后执行唯一一次 `deepseek_strict_tool_v1` Live。错误的 `bun --env-file=.env` 命令在配置 preflight 阶段被安全拒绝，未产生 UUID/evidence/provider attempt，不算 Live attempt。
- Attempt E 从 100 条 case 开始，在 `router_ambiguous_notes_tutor_01` 首次 Provider attempt 收到 `http_client` 后停止：`observed/notRun=37/63`、`providerAttempts/strictSuccesses=1/0`、usage 0/0、report duration 204ms / failing case 157ms、validator exit 0（合法 incomplete）。完整 JSON 证据为 `docs/acceptance/evidence/phase-6-9-4-3/live-20260714T071444506Z-65042475cbaf.json`，blob hash `368c91f817ad76272a495f77ff1d4d6f90695429`。

### 为什么没有继续调用

- 官方 Chat Completion 文档列出 `deepseek-v4-flash`；独立的 Tool Calls 指南描述通用 strict Beta contract：精确 `https://api.deepseek.com/beta`、函数内 `strict:true`、object 的 properties 全部 required 且 `additionalProperties:false`。Tool Calls 指南没有明确声明该模型的 strict-tool compatibility。
- 零网络 fake-fetch 捕获的实际 SDK wire 是 `POST https://api.deepseek.com/beta/chat/completions`，只含 `model/messages/max_tokens/temperature/tool_choice/tools`；唯一 forced `model_agent_result`、strict schema 和无 `response_format` 均与公开基础约束一致。这只能排除客户端 endpoint/基础字段构造错误，不能排除模型级 feature/provider compatibility。
- 当前安全分类将 401/403 归为 `http_auth`、429 归为 `http_rate_limit`，其余 4xx 归为 `http_client`。Attempt E 只能排除鉴权/限流，不能区分 400、402、422 等具体原因；raw status/body/headers/message/stack 受隐私合同禁止保存，0/0 usage 与 USD 0 也不等于余额或账单结论。
- 重跑不会增加根因信息，反而可能消耗外部配额；下一任务改为零网络 Provider compatibility diagnostics，先设计并验证固定的 4xx 分辨率（例如支付/参数类别）和 SDK wire contract，再申请新的完整 Live。

### 回顾问题

- 为什么本地 wire 符合官方公开基础约束，仍不能宣布模型级 strict-tool compatibility 通过？
- `http_client` 为什么不能直接等同于 422 schema error 或 402 余额不足？
- 为什么一次真实 Provider attempt 的 incomplete evidence 必须保留，却不能与历史 A~D 拼接成 complete？

## 2026-07-14 — Phase 6.9.4.3 JSON-mode Resolution 零网络 Checkpoint

### 做了什么

- 按批准方案停止继续扩展 strict-tool，新的 controlled-Live composition 收敛到 DeepSeek 标准 `https://api.deepseek.com` 与 `response_format=json_object`；请求不携带 tools、tool_choice 或 json_schema，canonical Zod 继续做最终校验。
- evidence identity 升级为 runner-v3 / `deepseek_json_object_v1` / `phase-6.9.4.3-json-mode-v1`，并新增 runner、顶层 promptVersion、candidate entry promptVersion 的一致性约束；历史 v1/v2 evidence 仍只读兼容。
- 删除 paired CLI 不再使用的 strict-tool schema profile 常量，保留 `@repo/ai` strict-tool 能力作为历史/实验 transport，不影响其他调用方。

### 验证结果

- Agent：`345 pass / 0 fail / 3242 assertions`；AI：`151 pass / 0 fail / 817 assertions`。
- Agent/AI typecheck 与 lint exit 0；deterministic baseline `74/100`、critical `2`。
- fresh Mock 为 complete：`100/28/0/28/72`；CLI exit 1 仅表示 paired candidate 仍关闭。tracked 历史 Mock evidence validator exit 0。
- 负 Live preflight 为 `live_config_invalid / exit 3`，没有真实调用或新 evidence。整个 checkpoint 没有读取真实 key、没有启动 Docker 或浏览器。

### 为什么仍未完成

零网络门禁只证明 JSON-mode wire、证据身份与安全边界可执行，不证明 100-case 真实语义质量。下一步必须先 `--no-ff` 合并 main、在 main 复验并推送，再从新 main 创建独立 controlled-Live 分支完整跑一次；如果仍失败，记录终局 fallback 并保持 deterministic，不再引入第三种 transport。

## 2026-07-14 — Phase 6.9.4.3 JSON-mode Controlled-Live Terminal Evidence

### 运行结果

- JSON-mode resolution 已合并到 `main@ec330ce1952ae058d92be941f800e9ae28791b91`，main 上 Agent 345、AI 151、typecheck/lint、baseline、Mock、validator 与负 Live preflight 全部复验后推送远程；local/tracking/remote SHA 相等。
- 从新 main 创建 `codex/phase-6-9-4-3-controlled-live-json-mode`，读取根 `.env` 中的 key 到单次 PowerShell 进程内，显式设置标准 `https://api.deepseek.com` 与 Live 双开关；命令结束后在 finally 中恢复 Mock 并移除 key/base URL/model 变量。
- 唯一完整 run 为 `live-20260714T084632914Z-4145ce0ffea0.json`：`runStatus=complete`、`providerAttempts/strictSuccesses=28/28`、`zeroCallCases=72`、usage `10677/4323`、estimated cost `$0.002842788219846`，strict validator exit 0。

### 终局门槛结论

- Verifier：`enabled=true / quality_gate_passed`，additional P95 `2872ms`。
- Router：`enabled=false / latency_budget_exceeded`，additional P95 `4264ms`；质量、安全、权限、schema、usage 与成本链路没有失败，但固定延迟门槛未通过。
- CLI exit 1 是 paired decision 的固定语义，不是 Provider 或 structured-output 失败。该 run 证明 JSON mode transport 可用，但不能把 Router 接入生产。
- 按批准的终局规则，不重跑、不补 case、不提高 cap、不新增 transport。Router 保持 deterministic terminal fallback；Verifier 通过结论保留为 Phase 6.9.5 后续集成依据，当前生产 Chat 不改动。

## 当时下一步（已由 2026-07-15 Agent-first 路线取代）

1. Phase 6.9.4.3：提交本次 Live evidence 与终局结论，独立审查后合并 main、main 复验并推送；随后从新 main 进入 Phase 6.9.5。
2. Phase 6.9.5 ~ 6.9.7：结构化长期记忆、情景记忆、MCP-ready Orchestrator 与阶段验收。
3. Phase 6.9 完成后进入 Phase 8 性能/PWA，再进入 Phase 9 MCP Tool 体系。

## 参考文档

- `AGENTS.md`：当前协作规范和最新项目快照。
- `README.md`：项目入口和启动说明。
- `docs/roadmap.md`：完整 Phase 路线。
- `docs/data-flow.md`：当前有效数据流和边界。
- `docs/acceptance-checklist.md`：统一验收入口。
- `docs/ai-behavior-acceptance.md`：mock / live / RAG / Agent 验收规范。
- `docs/blogs/phase-7-rag-safety-guard.md`：RAG SafetyGuard 面试复盘。
- `docs/blogs/phase-7-event-observability.md`：后台任务可观测面试复盘。
- `docs/blogs/phase-7-openapi-docs.md`：Swagger / OpenAPI debug docs 面试学习博客。
- `docs/blogs/phase-7-worker-split.md`：API / worker 启动拆分面试学习博客。
- `docs/blogs/phase-7-worker-observability.md`：Worker Observability 面试学习博客。
- `docs/blogs/rag-eval-and-hybrid-retrieval.md`：RAG Eval、Hybrid Retrieval 和真实检索验收面试学习博客。
- `docs/blogs/durable-outbox-worker-observability.md`：Durable Outbox、Dispatcher Runner 和后台观测面试学习博客。
- `docs/blogs/worker-readiness-deployment-checks.md`：Worker Readiness、部署前检查和 CLI 退出码面试学习博客。
- `docs/blogs/admin-console-ops-platform.md`：后台管理、Admin Console、Outbox Ops、审计和控制台总览面试学习博客。
## 2026-07-20 — Phase 6.9.5 V12 real host wiring (offline)

- Replaced the V12 fake default host with a real default-off composition. The
  host performs read-only preflight, reserves durable V12 state, writes a
  private non-secret resource-selector manifest, creates only synthetic
  resources, and delegates the controlled Docker/API/browser/Trace/default-off
  lifecycle to lineage-neutral V8 mechanics.
- Added `review_api_setup / not_started` so a post-reservation setup failure is
  recorded as a recoverable, pre-provider terminal. Recovery can restore
  mock/default-off and clean only the selectors in the V12 manifest.
- Corrected V12 product/recovery script exit codes. No V12 CLI, Docker,
  browser, API, provider or synthetic runtime data was executed or created.
- Fresh focused V11/V12 Jest, native V12 durable ledger, full Server Jest
  (`--runInBand`), server build/lint, Agent/AI/types/Web static gates, Compose
  config and diff check passed. The two independent reviews have no unresolved
  P0/P1; a fresh user authorization remains required before any one-shot V12
  branch command.

### V12 offline safety hardening (same lineage; still no runtime)

- Added an attempt-bound `recovery.json` terminal. It is mutually exclusive
  with success, verifies the failure record against the latest journal
  checkpoint, and can be sealed once only after default-off restore and exact
  cleanup; a later recovery is blocked instead of repeating Docker/DB work.
- Private V12 execution state now contains only a SHA-256 fingerprint of the
  root `DATABASE_URL`, captured before the reusable V8 host reads its Prisma/
  Docker configuration. Product revalidates repo/evidence/default-off/database
  identity after it owns the lock and before reserve; recovery repeats the
  check under a recovery owner and fails closed on drift before any write.
- Closed the Docker half-activation edge: when server recreation succeeded but
  the live container id was not yet recorded, default-off restore uses the
  observed current container. The headed V12 browser evidence window is held
  for 30 seconds before exact cleanup so the operator can inspect it.
- This remains offline: no V12 product/recovery CLI, Docker lifecycle,
  browser, API, provider, synthetic account, trace or test data was executed
  or created. The offline gates and independent contract/operations reviews
  are complete; the next required step is fresh, explicit user authorization.
