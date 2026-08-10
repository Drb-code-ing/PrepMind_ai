# PrepMind AI 学习与开发路线图

## 当前原子阶段：Phase 6.9.8 Schema Recovery SR5 runner/durability（2026-08-10）

功能分支 `drb/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner` 已推送，功能提交 `d077bf9d` 已以
`--no-ff` 合并为 main merge `b2b5b9c9`。上游 SR5 admission 的 strict source/tag/bundle parity、SR3/SR4 identity、
DeepSeek/Qwen data-boundary receipt、source-bound exact authorization、固定预算与 opaque single-use capability，以及本阶段
zero-provider reviewed-Mock runner、pair-serial 单并发、首错 breaker、fsynced hash-chain journal、hard-link artifact、strict
validator 与 crash-only recovery 均已完成。合并后二次 zero-provider 回放通过；approved annotated tag 尚未创建，真实
`git_verified` source gate 与 controlled-Live 保持关闭。

authority=`zero_provider_retriever_final_response_schema_recovery_sr5_runner_durability`、
gate=`schema_recovery_mock_quality_not_evidence`、`qualityAuthority=none`；固定 `8/6/6` 分母、`20` entries、`12`
invocations、预算 `37,600/8,800/0.176 CNY`、最大并发 `1`。focused `25/25`（82 assertions）、typecheck/lint/CLI
help/run smoke 通过；providerCalls、credentialReads、formalEvidence、businessWrites 均为 `0`。不读根 `.env`，不调用
Provider，不启动/清理 Docker/API/browser，不写 Trace/BackgroundJob/Outbox。验收记录见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner-durability-zero-provider.md`。

runner/durability 不等于 controlled-Live，不形成真实模型语义、产品、P95/SLA 或博客 authority。当前 `main` 收口已完成；
下一停止门是重新接受当次 DeepSeek/Qwen 数据边界并取得绑定新 source/tag 的 exact authorization。只有该独立 admission
完成后才可创建 approved tag 并规划唯一 controlled-Live；在此之前不得读取 credential、调用 Provider 或进入产品验收。

### 历史 SR4 reviewed Mock/static checkpoint（已完成）

SR4 已在普通分支完成并以 `--no-ff` 合并；merge=`d5029f90` 是历史合并事实，当前 HEAD 以本节上方的 `82936a95` 为准。
其 authority=`zero_provider_retriever_final_response_schema_recovery_sr4_reviewed_mock / qualityAuthority=none`，
gate=`schema_recovery_mock_quality_not_evidence`，factory SHA=
`sha256:7bc32c8ed68c3c8d76c9c983b40e771f24c0181cda7976cbc97ab1fb4c26d157`。完整生产形状路径与 8/6/6/12/20 固定分母见
SR4 acceptance。

## SR3 历史 checkpoint（已完成）

SR3 的 runner/source admission/durability 已合并到上述基线，旧 authority、manifest/policy SHA 与 zero-provider 证据保持
不可变；详见
`docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr3-zero-provider-runner-durability.md`。

> 历史封存状态（2026-08-09）：Phase 6.9.8 P1 L2 唯一 controlled-Live run
> `ff035203-500f-4744-b33c-3c375ae4c785` 已在 approved source/tag `fa502925...` 上 durable seal，但 gate 为
> `p1_l2_quality_gate_failed / qualityAuthority=none`。8/8 guards zero-call；第二条真实 DeepSeek rewrite 以 bounded
> `schema` failure 打开 breaker，实际 Provider calls=`2/12`、Qwen calls=`0`、usage=`343/40`、aggregate cost=`null`，
> 后续 10 条 lane 未启动。Journal `41`、validator=`bundle_valid`、recovery claim=`null`。该结果不形成 P1 semantic、
> 产品 Docker/API/browser、Trace、SLA 或 `main` 产品 authority，且不得重跑/追加探测。证据/文档已在 `1f3c0d9b` 提交，
> 以 `--no-ff` 生成生产/证据 merge `f4fac048`，文档 parity 再以 `613cc772` 合并，最终完成 `main == origin/main` 的
> zero-provider 回归。P1 L2 已收口，不能重跑或继续追加探测；SR2 功能提交 `2df35873` 已通过合并提交 `17ce07ba`
> 进入并推送到当时的 `main == origin/main == 17ce07ba386f3a54eb4fdfffdf050b561c319754`；当前 HEAD 已继续推进。功能分支
> `drb/phase-6-9-8-retriever-final-response-schema-recovery-sr2` 的 lineage=
> `phase-6.9.8-retriever-final-response-schema-recovery-v1`。SR1 与 SR2 已完成 zero-provider parser/projection 与
> Provider-like robustness；SR2 authority=`zero_provider_retriever_final_response_schema_recovery_robustness /
> qualityAuthority=none`；diagnostic 只在 candidate outcome sidecar，Retriever node 边界丢弃。SR2 只解锁从该 main
> 新开的 SR3，不形成 Provider、产品或 main 产品 authority。验收见
> `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr1-zero-provider-tdd.md` 与
> `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr2-zero-provider-robustness.md` 与
> `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr0-zero-provider-design.md`。历史 P1 L2 验收见
> `docs/acceptance/phase-6-9-8-retriever-final-response-p1-l2-controlled-live-quality-gate-failure.md` 与
> `docs/acceptance/phase-6-9-8-retriever-final-response-p1-l2-main-parity-zero-provider.md`。

> 历史 checkpoint（2026-08-08）：Phase 6.9.8 P1 L2 zero-provider admission contract 已完成并已合并推送；当时
> `main == origin/main`（具体 HEAD 以 `git rev-parse main origin/main` 为准），合并后 zero-provider 回归已通过（Agent `1427/1427`，
> 24263 assertions，178 files；typecheck/lint/diff check 通过）。
> Transport Re-entry V2 L1 唯一 controlled-Live 已完成并 durable seal。
> run `ce0c3257-a5d9-4389-90ec-814d5e9cde34` 在 source `ee3dbf91c863a3a5cd95c810a9c0cec0b26f64c6` 上以
> `transport_reentry_v2_l1_controlled_canary_passed` 收口，`3` slots、Provider calls `3`、usage `145/28/173`、费用
> `0.000573 CNY`、journal `16`、validator `ok=true`；authority 仅为 transport diagnostic、`qualityAuthority=none`。
> 一次性名额已消费，禁止 retry/resume/replay/backfill、recovery/seal 或追加 Provider 探测。
> 新 lineage `phase-6.9.8-retriever-final-response-transport-reentry-v2` 不复用旧 T3 marker/authorization/evidence；C1
> 先完成 root launcher 与 dedicated projection，C2 再将三项 projection 收口为 opaque single-use configuration
> capability，并落地 `rewrite -> qwen -> final_response` 固定三槽、exclusive marker、reservation-before-dispatch、
> fsynced hash-chain journal、hard-link artifact、strict validator 和 crash-only recovery。C2 focused `15/15`、Agent
> full `1387/1387`；真实 `.env`/credential、Provider、formal evidence、Docker/API/browser 与业务写入均为 `0`，
> authority=`zero_provider_transport_reentry_v2_c2 / qualityAuthority=none`。S1 随后已完成三个 bounded synthetic
> first-party adapter、wire/usage/fault matrix 与 reviewed Mock/static；S1 authority 为
> `zero_provider_transport_reentry_v2_s1 / qualityAuthority=none`。S1 source admission 已修复历史 `.tmp` 误计并在
> clean branch/HEAD/upstream/origin 上完成 `git_verified / formalArtifactCount=0` 回放；focused（S1+C2）`22/22`、
> Agent full `1394/1394`。V2 L1 已随后完成并封存；P1 G1、G2 与 S2 已以独立 zero-provider lineage 收口。S2
> focused `4/4`、G1+G2 focused `10/10`、Agent full `1423/1423`，synthetic runner/validator `ok=true`、formal evidence `0`；
> gate=`p1_mock_quality_not_evidence`、`qualityAuthority=none`。S2 验收见
> `docs/acceptance/phase-6-9-8-retriever-final-response-p1-s2-reviewed-mock-static.md`；上述 S2 段落是合并前历史 checkpoint，
> L2 admission contract 已在 `main` 完成二次回归，只形成 zero-provider contract authority；只有在重新接受 DeepSeek/Qwen
> 数据边界并取得新的 exact authorization 后，才可启动唯一 controlled-Live。L2 admission 验收见
> `docs/acceptance/phase-6-9-8-retriever-final-response-p1-l2-admission-zero-provider.md`。
> G2 验收、设计、计划、L1 sealed 与 C1/C2 验收见
> `docs/superpowers/specs/phase-6-9-8-retriever-final-response-transport-reentry-v2-design.md` 与
> `docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-d0-zero-provider-design.md` 与
> `docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-c1-zero-provider-launcher-projection.md` 与
> `docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2-zero-provider-runner-durability.md`。
> S1 验收见 `docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-s1-reviewed-mock-static.md`。
> G2 验收见 `docs/acceptance/phase-6-9-8-retriever-final-response-p1-g2-runner-durability.md`。
> L1 zero-provider implementation 与 root-env diagnosis 验收见
> `docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-implementation-zero-provider.md`。
> `docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-root-env-diagnosis-zero-provider.md`。
> `docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-controlled-live-sealed.md`。
>
> 历史封存结果（2026-08-07）：Phase 6.9.8 Transport Evidence Recovery T3 controlled canary 已按一次性授权执行并失败封存。
> source admission 绑定 branch/HEAD/upstream/origin/approved ref、clean tree、formal artifact=0、T2 gate 与 source
> bundle SHA；三槽位顺序固定为 `rewrite -> qwen -> final_response`，最多 3 slots、预算上限 `0.024096 CNY`、首错
> breaker、fresh proxy nonce 与 exact data-boundary/authorization reader 均已通过 focused `12/12`（49 assertions）。
> Agent full `1360/1360`（23805 expect()，169 files）、typecheck/lint/Prettier/`git diff --check` 通过；唯一 T3 run
> `075e2d5f-682b-426d-847e-f5a6ce5b97c6` 在 late-bound credential gate 以
> `transport_evidence_t3_controlled_canary_failed` 停止，planned/started/completed=`3/0/0`，breaker reason=`configuration`，
> Provider calls=`0`、credential reads=`0`，三个 suffix lane 均为 `not_started_quality_breaker`。Journal `7`、validator
> `ok=true`，report logical SHA=`8d529bb7...4875d1`，physical artifact SHA=`50beb053...7ee9c`，authority=
> `controlled_live_transport_evidence_t3 / qualityAuthority=none`。这是 CLI/configuration 失败，不归因 Provider 根因，
> 不解锁产品 Docker/API/browser 或 main。完整记录见
> `docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t3-controlled-canary-failure.md`。
> 随后 T3-C zero-provider configuration guard 已完成，focused `2/2`；它只防止 package/root `.env` 入口回归，不读取真实
> `.env`、不调用 Provider、不恢复 T3 名额。验收见
> `docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t3-configuration-zero-provider.md`。

> R5 结果（2026-08-06）：唯一 controlled-Live run `34eb99be-bdeb-41e5-85cf-3c651ecefc68` 已 durable seal，但
> `architecture_recovery_quality_gate_failed / qualityAuthority=none`。guards `16/16` zero-call；第二个 rewrite pair
> 的 DeepSeek 在 `provider_dispatch / unknown` 失败，external calls `4`（Qwen `3`、DeepSeek `1`），breaker 后 `59`
> slots 未启动；rewrite strict `1/16`、FinalResponse `0/16`，semantic/P95/verified aggregate 全 `null`。validator
> `ok=true / bundle_valid`，journal `237`，artifact SHA=`423e3f2e...43b1e5`，一次性名额已消费，R6 产品验收继续阻断。
> 该 evidence 不归因 Provider 根因，也不形成产品/main authority。

> R5 实现 checkpoint（已由上方 sealed run 收口）：Retriever / FinalResponse Architecture Recovery R5 已完成实现、独立复审与
> zero-provider 回归。固定 `16 guards + 16 rewrite pairs + 16 FinalResponse =
64 slots`，focused/CLI/Agent 回归分别为 `18/18`、`6/6`、`1329/1329`；citation coverage、固定检索 fixture、
> conservative verifier projection、usage/cost budget 与 crash-only 异常边界均已修复并验证。用户已接受 DeepSeek/Qwen
> 数据边界并授权唯一 R5 controlled-Live；正式 run 已封存，但不形成产品 authority。
> R5 结果无论通过或失败都只封存一次；只有 gate pass 才解锁 R6 产品 Docker/API/可见浏览器验收。详见
> `docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r5-controlled-live.md`。

> Transport Evidence Recovery T0/T1/T2/T3-A 已完成：T0 冻结独立 zero-provider contract，T1/T2 已落地 strict no-raw parser、
> 双 wire 校验、三 family 私有 single-consume capability、30-case/15-classifier matrix 与 synthetic durability；focused
> `11/11`、Agent `1348/1348`、typecheck/lint/Prettier 通过。全程未读取 credential、未调用 Provider、未创建 formal
> evidence，authority=`zero_provider_transport_evidence_t2 / qualityAuthority=none`。T2/T3-A 不解锁 R6/R7/main，也不是
> R5 retry；T3 controlled 已消费一次性名额并在 credential configuration gate 失败封存，禁止重跑或追加探测。补充提交
> `3d903055` 已将受控 package script 绑定仓库根 `.env`，但不改变本次终态。
> T3-C 又以静态 guard 固定该路径与 seal CLI 的无 credential/Provider port 边界，authority=`zero_provider_transport_evidence_t3_configuration_guard`。
> 设计与计划见 `docs/superpowers/specs/phase-6-9-8-retriever-final-response-transport-evidence-recovery-design.md` 与
> `docs/superpowers/plans/phase-6-9-8-retriever-final-response-transport-evidence-recovery.md`。

> 当前状态：Phase 7 核心工程化里程碑已推进至 7.23.8；Phase 7.8.5 RAG runtime parity 补强已完成真实 Docker 验收。Phase 6.9.7 V1--V9 controlled-Live 均已以 `quality_gate_failed` 封存且不得重跑。唯一 V9 R5 run `c530ca02-3ece-4f11-898c-5695c8252bd5` 为 `24/24` guard；pair 0 两条 lane 各 dispatch 一次但均无 Provider response，Tutor 为 `provider_runtime / transport`，Organizer sibling 为 `post_dispatch_abort`，最终 wire `2/2/0/0`、strict `0/48`，正式 semantic/P95/token/CNY 全 `null`。Marker/journal/evidence 已 seal，validator `ok=true/filesChecked=1`，无 recovery claim；V9 当时的 R6/R7/main 与后续阶段被阻断，后续另行进入 Architecture/Schema Recovery 路线。完成 Phase 6.9 全部 Agent 架构后再进入 Phase 6.10 分层记忆，随后依次进入 Phase 8 性能/PWA、Phase 9 MCP Tool 体系。
>
> 以下 `63f8a76b...` 记录属于 Phase 6.9.7 Full-gate Schema Recovery SR5 历史 lineage，不是当前 Phase 6.9.8 Retriever/FinalResponse SR5 admission，也不能作为当前 controlled-Live 授权或质量证据。
>
> 用户已作出独立路线决策：停止继续复制 V10/V11 runner/lineage，先执行 Phase 6.9.7 Architecture Recovery。Recovery R1/R2/R3、proxy preflight、Provider Canary V2 D0/C1/C2/S1/L1、P1/G1/G2/S2、唯一 L2 与 P2/F1/F2/S3 均已按独立边界完成。唯一 Full-gate L3 run `2b0ac3a0-631f-4c7f-9781-ce0cda94149a` 继续以 `full_gate_quality_gate_failed / qualityAuthority=none` 不可变封存。Full-gate Schema Recovery SR0--SR4 随后完成 zero-provider 设计、TDD、robustness、独立 runner/durability 与 reviewed Mock/static；SR4 仍只有 Mock authority。唯一 SR5 controlled-Live run `63f8a76b-1c2a-403d-b774-0235caae04cb` 已得到 guards `24/24`、strict/wire/usage `48/48/48/48`、semantic `0.9736111111/0.9515968407/0.9626039759`、paired P95 `2240ms`、费用 `0.067632 CNY`，并以 `schema_recovery_quality_gate_passed / schema_recovery_full_gate_semantic_gate` durable seal；journal `628`、validator `ok=true`、recovery claim=0。SR6 随后在 `providerCalls=0` 边界完成 Tutor/Organizer Docker/API/可见浏览器/Trace/forced-failure/权限隔离与精确清理；`sr5_sealed_replay` 只绑定 SR5 artifact SHA 并从当前 bounded prompt 生成 deterministic Mock，不重放 Provider response。SR7 又完成 main 合并、远程发布与 default-off Docker/API/可见浏览器/Trace/精确清理；精确 step-check 路由修复后为 `tutor/step_check`，candidate zero-call/0-token/`LIVE_CALLS_DISABLED`。SR5/L3/SR4 authority 均保持不可变。Phase 6.9.7 已完成。Phase 6.9.8 Task 0--8 已依次完成设计、shared strict contracts、canonical principal / Chat access、Retriever original-query baseline、exact-context evidence projector、default-off query rewrite candidate、FinalResponse stream contract、`/api/chat` composition/terminal Trace 与 48-case reviewed Mock/static。Task 8 authority 为 `zero_provider_retriever_final_response_reviewed_mock_static / qualityAuthority=none`，guard/rewrite/FinalResponse 均 `16/16`，rewrite nDCG@5 从专项 original `0.56923614767` 提升至 `1`，FinalResponse grounded/citation/critical notice 均为 `1`；Provider/credential/Qwen 与正式 evidence=0。Task 9A 又以 `zero_provider_qwen_embedding_transport_price_contract` 冻结 Qwen 北京区官方 price/endpoint/usage、1536 维 strict direct transport 与 `262144 tokens / 0.131072 CNY` cap，仍未读取 credential 或调用 Provider。Task 9B 又以 `zero_provider_retriever_final_response_runner_durability` 完成 16 guard + 64-call runner、双 Provider accounting、source admission、durability/validator/CLI；Reviewed Mock 仍为 `task9b_mock_quality_not_evidence / qualityAuthority=none`，Provider/credential/approved tag/正式 evidence=0。唯一 Task 9C run `28b5f92f...` 已以 `task9_quality_gate_failed / qualityAuthority=none` 正常封存：guard `16/16`、Provider `5/64`，第二条 DeepSeek rewrite `schema_invalid / 1/1/0/0` 后其余 59 次 not-started；journal `134`、validator `ok=true`。一次性名额已消费且不得重跑，Task 10/11、产品/main、Phase 6.9.9/6.9.10/6.10 与后续阶段仍阻断。

> Architecture Recovery R0--R4 已完成。R4 reviewed Mock/static 固定 guards `16/16` zero-call、双 wire
> `64/64/64/64`、diagnostic `64 applied`、rewrite/FinalResponse `16/16`，gate 为
> `architecture_recovery_mock_quality_not_evidence / qualityAuthority=none`；Provider、credential、formal evidence
> 与业务写入均为 0。其后唯一 R5 run `34eb99be...` 已以 `quality_gate_failed` 封存，R6/R7、产品
> Docker/API/browser、main 与后续 Phase 继续阻断。

## 项目目标

PrepMind AI 的目标是做成移动端优先的 AI 学习产品，而不只是聊天 Demo。最终链路包括：

- AI 聊天与拍照识题。
- 错题本与间隔复习。
- RAG 知识库。
- LangGraph Agent。
- MCP 工具体系。
- 可观测性与生产化部署。

## 总体路线

| 阶段       | 主题              | 核心技术                                                                                                                                                 | 状态                                               |
| ---------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Phase 0    | 架构设计          | Monorepo, Prisma, Docker                                                                                                                                 | 已完成                                             |
| Phase 1    | 前端 MVP          | Next.js, Dexie, AI SDK, OCR                                                                                                                              | 已完成                                             |
| Phase 2.1  | 后端基础与鉴权    | Bun, NestJS, Prisma, PostgreSQL, JWT                                                                                                                     | 已完成                                             |
| Phase 2.2  | 前端接入后端 Auth | apiClient, TanStack Query, AuthGuard 迁移                                                                                                                | 已完成                                             |
| Phase 2.3  | 业务 API 迁移     | REST API, server state, Dexie 离线缓存                                                                                                                   | 已完成                                             |
| Phase 2.5  | 产品体验补全      | Chat-first UI, Auth UI, 个人中心, 今日任务, 视觉系统                                                                                                     | 已完成                                             |
| Phase 3    | AI 讲题系统       | OCR structured output, Prompt, 多题保存, Tool Action Boundary                                                                                            | 已完成                                             |
| Phase 4    | FSRS 记忆系统     | Card, ReviewLog, ReviewTask, ReviewPreference                                                                                                            | 已完成主线，后续可扩展提醒调度                     |
| Phase 5    | RAG 知识库        | Qwen Embedding, pgvector cosine, PostgreSQL full-text, Hybrid Search                                                                                     | 主线已完成；Phase 7.8.5 runtime parity 已完成      |
| Phase 6    | 多 Agent 系统     | LangGraph, Router, Retriever, Tutor, Verifier, Planner, MemoryAgent, Orchestrator, Agent Eval                                                            | P1 L2 唯一 Live 已 schema 失败封存；semantic/product gate 继续阻断       |
| Phase 6.10 | 分层记忆系统      | 结构化长期记忆注入、Episodic Memory、embedding、混合召回、过期、查看、删除与遗忘                                                                         | 全部 Agent 架构验收后启动                          |
| Phase 7    | 工程化增强        | BullMQ, BackgroundJob, RAG SafetyGuard, EventBus, Swagger, Docker, Worker Observability, Durable Outbox, Worker Readiness, Operator Audit, Admin Console | 核心里程碑至 7.23.8；7.8.5 补强已完成              |
| Phase 8    | 高性能优化        | Web Worker, 虚拟列表, PWA, IndexedDB                                                                                                                     | 规划中                                             |
| Phase 9    | MCP Tool 体系     | JSON-RPC, Tool Registry, Tool Calling                                                                                                                    | 规划中                                             |
| Phase 10   | 生产级部署        | OpenTelemetry, Sentry, Prometheus, k6                                                                                                                    | 规划中                                             |

## 已完成阶段

### Phase 0 — 架构设计

- 建立 monorepo 目录、基础 packages、Prisma schema 初稿和 Docker Compose 基础设施。

### Phase 1 — 前端 MVP

- 完成本地登录、AI 聊天、OCR、错题本、今日任务和 Dexie 本地持久化。
- 建立聊天与 OCR 统一时间线，支持 Markdown、GFM 和数学公式渲染。

### Phase 2.1 — 后端基础与鉴权

- 迁移到 Bun workspace。
- 落地 NestJS Config / Database / Health / Auth / Users 模块。
- Auth 支持注册、登录、`/auth/me`、refresh token rotation、logout。
- 接入 PostgreSQL、Prisma migration、统一响应 envelope、异常过滤器和 requestId。

### Phase 2.2 — 前端接入后端 Auth

- 封装 `apiClient`，接入 TanStack Query。
- 登录/注册、AuthGuard、session 恢复和登出改为调用 NestJS Auth API。
- Dexie 不再作为登录态权威来源，只保留业务离线缓存职责。

### Phase 2.3 — 业务 API 迁移

- WrongQuestion / ChatMessage / OCRRecord API 已迁移到 PostgreSQL。
- 新 OCR 图片通过 MinIO 保存服务端 URL。
- Dexie 降级为本地快速恢复、离线兜底、乐观更新和旧图片预览层。
- WrongQuestion / OCRRecord 写失败进入 Dexie mutationQueue，后续自动补偿同步。
- ChatMessage 使用 `/chat-messages/sync` 的会话快照幂等同步，不进入通用 mutation queue。
- `/api/chat` 加入上下文窗口；有效题目 OCR 生成 `activeStudyContext`，支持围绕当前题目继续追问。
- `/api/chat` 开发默认本地 mock，真实模型调用需要 `AI_PROVIDER_MODE=live` 与 `AI_ENABLE_LIVE_CALLS=true` 双开关，默认使用 `deepseek-v4-flash`，并受输入 / 输出 token 预算保护。

### Phase 2.5 — 产品体验补全

- 保持 Chat-first 主入口，侧边栏作为导航层。
- 统一注册登录页、聊天页、错题本、今日任务和个人中心视觉系统。
- 补齐个人中心、本地学习偏好、今日任务轻学习手账和 CRUD 轻提示。
- 优化 Chat / OCR 渐进 Markdown 渲染和自动滚动交互。

### Phase 3 — AI 讲题系统

目标：把“OCR Markdown 结果 + 前端解析”升级为更稳定的题目结构化识别和可扩展讲题链路。

已完成：

- 新增 `@repo/types/api/ocr-question`，定义 OCR structured output schema。
- `/api/ocr` 改为 display Markdown + structured JSON envelope 输出协议。
- OCRRecord `parsedJson` 保存结构化结果，旧 OCR 历史继续通过 legacy adapter 兜底。
- `activeStudyContext` 从结构化题目生成，支持题目 id、题型、难度和识别提醒。
- 保存错题优先使用结构化字段；多题使用 `sourceGroupId:questionId` 独立防重。
- 前端增加多题卡片、单题保存和批量保存入口。
- `createWrongQuestion` / `searchKnowledge` / `createReviewTask` 已作为 tool action proposal 边界预留，暂不自动执行。

阶段验收：

- AI 输出结构稳定，前端不再依赖脆弱 Markdown 文本解析作为主要数据来源。
- 用户追问能承接 OCR 题目上下文。
- 非题目输入不会显示错题保存入口。
- 多题图片有明确拆题和保存策略。

## 后续阶段摘要

### Phase 4 — FSRS 记忆系统

Phase 4.1 已完成第一轮错题复习闭环：

- `@repo/fsrs` 已实现纯调度器。
- Prisma `Card` 支持 `wrongQuestionId`，`ReviewLog` 记录评分日志。
- NestJS 新增 Review API，支持错题加入复习、今日到期卡片和评分。
- 错题详情可加入复习计划，今日任务可查看答案并提交 Again / Hard / Good / Easy。

Phase 4.2 已完成学习统计：

- 新增 `/reviews/stats` 与 `/reviews/logs`，基于 `Card` / `ReviewLog` / `WrongQuestion` 服务端聚合统计。
- 新增 `/stats` 学习统计页，展示复习总览、趋势、评分分布、卡片状态和最近复习记录。
- 侧边栏和今日任务页已新增学习统计入口。

Phase 4.3 已完成 ReviewTask 数据流：

- 新增持久化 `ReviewTask` 表，记录复习任务 pending / completed / skipped / cancelled 生命周期。
- 新增 `/review-tasks/today`、列表、评分、跳过和恢复 API。
- 今日任务页已迁移到 persisted ReviewTask，评分会完成任务并关联 ReviewLog。
- 跳过和恢复只改变 ReviewTask 状态，`/stats` 仍以 ReviewLog 为统计事实来源。
- `/stats` 复习趋势图已从密集柱状图收敛为稀疏刻度的轻量面积折线图。

Phase 4.4 已完成离线评分队列与提醒摘要：

- `POST /review-tasks/:taskId/rating` 支持 `clientMutationId` 幂等，重复提交同一评分命令不会重复写入 ReviewLog。
- Dexie `mutationQueue` 支持 `reviewTask/rating`，弱网或离线评分可在 session 恢复、online、focus 时自动补偿同步。
- 今日任务页展示本地待同步评分状态，评分按钮和跳过按钮会在待同步期间禁用，避免重复操作。
- 离线评分不本地推进 FSRS、ReviewLog 或统计，服务端同步成功后刷新今日复习和统计。
- 今日任务页新增 in-app 复习提醒摘要：今日待复习、已逾期、下一张和待同步评分。

Phase 4.5.1 已完成复习计划预览与统计图表升级：

- 新增 `GET /review-tasks/plan` 只读接口，基于 `Card.nextReview` 计算未来复习压力，不创建未来 ReviewTask。
- 新增 `/plan` 页面，展示未来 7 天复习压力、每日安排和高峰日提示。
- 今日任务页新增复习计划入口，未来日期只提示“到期后处理”，今日仍跳转 `/today`。
- `/stats` 升级为客户端 ECharts 图表，覆盖复习趋势、评分分布和卡片状态，保留空数据与 fallback 展示。

Phase 4.5.2 已完成复习容量偏好与加权压力模型：

- 新增 `ReviewPreference` 账号级复习偏好，支持每日分钟、每日卡片上限、提醒时间、提醒开关和 7 / 14 天计划窗口。
- 新增 `/review-preferences` 读取与 PATCH API，偏好以 PostgreSQL 为权威来源。
- `/review-tasks/plan` 压力模型升级为 `到期数量 + 逾期惩罚 + 难度权重 + 稳定性权重 + 用户每日容量约束`。
- `/plan` 展示容量偏好、压力分、容量状态、原因标签和 7 / 14 天计划。
- `/today` 展示当天预计复习分钟与容量状态，仍不改变离线评分语义。

Phase 4 后续如继续扩展，可围绕浏览器通知、BullMQ 定时提醒和更细的长期计划策略推进；当前主线已进入 Phase 5。

### Phase 5 — RAG 知识库

Phase 5.0 已完成设计与 Phase 5.1 实施计划：

- 明确 RAG 是 Chat 的增强层，不是阻塞层；无资料、未命中或检索失败时继续普通 AI 回答。
- 第一版资料来源以用户上传 PDF / TXT / Markdown 为主，OCR、错题和聊天沉淀只预留 `sourceType`。
- 复用现有 `Document` / `Chunk` 草案模型，后续以 PostgreSQL + pgvector 为权威来源。
- Phase 5.1 先落地数据模型、pgvector 索引预留和 `@repo/types` knowledge API contract。

Phase 5.1 已完成 RAG 数据模型和共享 contract 基础：

- `Document` 补齐 `sourceType`、`errorMessage`、`contentHash` 和 `processedAt`。
- `Chunk` 补齐 `tokenCount`，`embedding` 固定为 `vector(1536)`。
- 新增 `DocumentSourceType`，第一版以 `UPLOAD` 为主，预留 `NOTE`、`WRONG_QUESTION`、`OCR` 和 `CHAT`。
- 新增 `@repo/types/api/knowledge`，覆盖文档响应、列表查询、列表响应、检索请求和检索响应 schema。
- 新增 pgvector ivfflat 索引迁移，为后续相似度检索预留。

Phase 5.2 已完成文档上传与状态 API：

- `/knowledge/documents` 支持上传、列表、详情和删除。
- 支持 PDF / DOCX / Markdown / TXT，上传原文件保存到 MinIO。
- 服务端创建 `Document(PENDING, sourceType=UPLOAD)`，以 PostgreSQL 为权威来源。
- 所有文档 API 按当前 `userId` 隔离；删除会级联未来 chunks，并尽力删除 MinIO 对象。

Phase 5.3 已完成文档处理与 embedding 入库：

- 新增 `POST /knowledge/documents/:id/process`。
- 支持 TXT / Markdown / DOCX / PDF 基础文本解析。
- 使用 `@repo/rag` 段落感知分块。
- 当前真实 embedding 标准路径为 Qwen `text-embedding-v4` / 1536；production 要求 provider/model 显式配置，Qwen 还要求无凭据 HTTPS base URL 和规范 `QWEN_API_KEY`，不做 provider fallback。`fake` 仅用于非 production 测试。
- `Chunk.embedding vector(1536)` 通过 raw SQL 持久化，写入前校验 document/user ownership。
- `Document` 状态流为 `PENDING -> PROCESSING -> DONE / FAILED`；空文本、零 chunk、解析或 embedding 失败进入 `FAILED`。
- forced reprocess 会先清旧 chunks，避免 stale retrieval。

Phase 5.4 已完成检索 API：

- 新增 `POST /knowledge/search`。
- 当前检索先后召回 pgvector cosine 向量候选与 PostgreSQL full-text 关键词候选两路结果，按 `chunkId` 去重后 hybrid rank；无 reranker。
- 支持 `limit`、`minScore` 和按 `documentId` 过滤。
- 检索结果返回 score、chunk metadata 和 document metadata。

Phase 5.5 已完成 Chat RAG 增强与引用展示：

- `/api/chat` 只有在 access token 已通过 `/auth/me` 并形成 authenticated canonical principal 后才调用 `/knowledge/search`，使用最新用户消息构造检索请求。
- 命中知识库后将 chunks 注入 system prompt，作为回答参考而不是绝对真理。
- 助手消息末尾追加 Markdown “参考资料”，展示文档名、片段序号和相似度。
- 无 token、无资料、无命中、检索失败或 token 预算不足时降级为普通 Chat，不阻塞用户提问。
- 资料可信度评估已在 Phase 6.3 通过 `KnowledgeVerifierAgent` 接入。

Phase 5.6 已完成知识库页面体验打磨：

- 新增 `/knowledge` 学习资料工作台。
- 前端新增 knowledge API client、TanStack Query hooks 和展示 helper。
- 页面支持资料上传、列表读取、处理、替换上传、删除内联确认、状态摘要和检索测试。
- 服务端按同用户 `contentHash` 做轻量去重：重复上传返回已有资料；替换上传保留同一 `Document.id` 并重置为 `PENDING`，并通过快照条件避免并发处理或并发替换覆盖当前资料。
- 文档处理链路在 claim、清 chunk、写 chunk、标记完成/失败时持续校验 `status=PROCESSING + storageKey + contentHash`，chunk 替换事务使用 `SELECT ... FOR UPDATE` 锁定当前 Document 行，避免旧处理流写入新资料 chunks。
- 资料卡片改为右上角三点菜单承载处理、重新上传和删除，点击页面其它区域可收起菜单，已入库资料不再展示主按钮式重新处理。
- 检索测试展示命中文档、片段序号、相似度和内容摘要；无命中时明确提示 Chat 仍可普通回答。
- 侧边栏新增“知识库”入口，保持 Chat-first 主入口不变。
- 页面在线直连 knowledge API，不进入 Dexie `mutationQueue`。

后续拆分：

- Phase 5.1：RAG 数据模型、pgvector 索引预留、knowledge API contract。（已完成）
- Phase 5.2：文档上传与状态 API。（已完成）
- Phase 5.3：解析、分块、embedding 入库。（已完成）
- Phase 5.4：检索 API。（已完成）
- Phase 5.5：Chat RAG 增强和引用展示。（已完成）
- Phase 5.6：知识库页面体验打磨。（已完成）

### Phase 6 — 多 Agent 系统

- Phase 6 是 PrepMind 的核心亮点阶段，目标使用 LangGraph 编排多 Agent，不使用 AutoGen；当前只有 graph descriptor 与分散的 policy/service orchestration，Phase 6.9.10 才完成可执行图。
- 总体 Agent 拆分为 11 个当前逻辑节点：`RouterAgent`、`RetrieverAgent`、`TutorAgent`、`KnowledgeVerifierAgent`、`FinalResponseAgent`、`WrongQuestionOrganizerAgent`、`ReviewAgent`、`PlannerAgent`、`MemoryAgent`、`KnowledgeDedupAgent`、`KnowledgeOrganizerAgent`，外加待实现的 `Tool-Using Orchestrator`。`TutorAgent / AnswerAgent` 是旧能力合称，不重复计数。
- 2026-07-15 路线决策：先完成 12 个 Agent/Orchestrator 的模型路径、通信、权限、可执行 LangGraph 与全链路验收，再进入 Phase 6.10 分层记忆；权威设计见 `docs/superpowers/specs/2026-07-15-phase-6-9-agent-architecture-completion-design.md`。
- Phase 6.0 已完成 Agent Runtime 地基：共享 Agent contract、`AgentState`、`ActionProposal`、RouterAgent、阈值 guard、运行 recorder、graph descriptor 和降级链路。
- Phase 6.1 已完成 Router + Tutor Chat 接入：`/api/chat` 通过 `chat-agent-runtime` adapter 调用 RouterAgent，并保留原有 streaming、RAG、OCR activeStudyContext、mock/live 双开关和 token 预算。
- Phase 6.2 已完成 TutorAgent 策略层：`TutorAgent` 作为确定性 policy 识别 `explain_solution`、`socratic_hint`、`step_check`、`concept_bridge`、`answer_direct` 和 `general_follow_up`，并生成短策略 prompt 与 mock strategy metadata。
- Phase 6.3 已完成 KnowledgeVerifierAgent：`@repo/agent/knowledge-verifier` 作为确定性 policy 在 RAG 命中后评估资料状态为 `trusted / suspicious / conflict / insufficient / skipped`，并向 Chat RAG prompt 注入保守使用规则。
- Phase 6.4 已完成 WrongQuestionOrganizerAgent 的确定性产品能力：`@repo/agent/wrong-question-organizer` 根据错题结构化字段和已有 deck 摘要推荐学科组与专题 deck。Phase 6.9.7 Task 4/6/7 是 V1--V4 legacy 路径，包含允许受限短 topic label 的 candidate、NestJS owner/write fencing 与 server-only default-off runtime/Trace/HTTP abort；四条唯一 Live 均质量失败，仍未进入产品 Docker/API/浏览器验收。V5 R3 另建 no-network `wrong-question-organizer-shortlist-v5`，把模型权限收敛为本地 subject/deck/topic ordinal 选择；当前尚未接回 legacy 产品 composition。
- Phase 6.5 已完成 ReviewAgent / PlannerAgent：`@repo/agent/review` 和 `@repo/agent/planner` 作为确定性 policy，基于当前用户错题、复习日志、ReviewTask 计划和偏好生成只读复习诊断与学习计划建议。
- Phase 6.6 已完成 MemoryAgent：`@repo/agent/memory` 作为确定性 policy，基于当前用户学习信号生成长期记忆候选；`UserMemoryCandidate` 和 `UserMemory` 以 PostgreSQL 为权威来源，候选必须经用户确认后才成为正式记忆。
- Phase 6.7 已完成 Agent Trace / Eval：新增固定 deterministic eval set、`/agent-traces` 在线账号级观测 API、`/api/chat` best-effort trace capture、估算成本看板和 `/agent-trace` 调试台；trace 写入失败不影响 streaming / 流式回答。2026-07-15 补齐默认 Live `deepseek-v4-flash` 的集中 USD 价格快照，新的 Trace 正确标记 `pricingKnown=true`；未知模型保持“未配置单价”，旧 Trace 不回填。
- Phase 6.8 已完成 KnowledgeDedupAgent / KnowledgeOrganizerAgent：`@repo/agent/knowledge-dedup` 和 `@repo/agent/knowledge-organizer` 作为确定性 policy，基于当前用户资料元数据和少量 chunk 摘要判断重复资料、疑似新版、互补资料，并给出集合与标签建议；`GET /knowledge-agent/suggestions` 是认证、用户隔离、只读的在线建议 API，`/knowledge` 页面已展示资料管理建议面板。
- Phase 6.9.1 已完成 Agent 评测基线：统一 deterministic/Mock/Live run、summary 和模型路径启用决策 contract；`phase-6.9-seed-v1` 包含 Router、Verifier、Memory 各 8 个可执行 case 和 Orchestrator 8 个 expectation-only case。当前 deterministic baseline 为 21/24，并记录 1 个 MemoryAgent 敏感凭据 critical failure，作为后续候选模型必须超越的证据。
- Phase 6.9.2 已完成共享 Model Agent Runtime：`@repo/ai` 统一 Mock/Live Zod 结构化输出、不可变 run budget、live guard、超时/取消、安全错误与脱敏 Trace；OpenAI-compatible executor 由 composition root 注入，API key 不进入 package 配置、结果或 Trace。本阶段未迁移 Chat streaming、未模型化业务 Agent、未调用真实模型。
- Phase 6.9.3.3 已完成 rolling summary/CAS：prepare 按 12 条未覆盖消息或 70% token pressure 触发，只覆盖完整 assistant 轮次；ModelAgentRuntime 调用在事务外，Serializable 事务内复核 source hash 并用 summaryVersion CAS 推进。输入/输出凭据、usage 上限、first-create/update/stale race 均 fail-closed。
- Phase 6.9.3.4 已完成 Web context 编排：conversationId 在 sync 后进入后续 request，live auth 先于 token+id prepare；10 秒有界 timeout/request abort 与固定 degraded 允许 Mock Chat 继续。assembler 独立预算 agent/state/OCR/recent/RAG/summary，mandatory 只由 base/latest user 触发 413，optional 不会触发；RAG drop 清引用，summary 仅在 dropped history 时注入，headers/Trace 不含正文。Dexie v9 只缓存 sanitized state，并以用户级串行队列、版本单调、expiry 和身份清理保证恢复安全。
- Phase 6.9.3.5 已完成 Docker Mock/Live 收口：Mock 覆盖 12 条触发、复用、ownership、CAS/stale、Dexie 白名单与安全 Trace；DeepSeek Live 通过共享 executor JSON mode 生成 strict `conversation-summary-v1`，version/watermark 为 `1/15`，最终 Chat 保留二次函数判别式与正确值 `1`。Trace 新增 bounded `layerTokens`，不含正文。结束后恢复 Mock，并严格清理 7 个合成账号、4 个会话、级联 summary/state/cache 和测试浏览器 storage；证据见 `docs/acceptance/2026-07-11-phase-6-9-3-conversation-memory.md`。
- Phase 6.9.4.1 已固定 Router 60 / Verifier 40 的 `phase-6.9-router-verifier-v1`、专项 metrics 和 deterministic CLI。baseline 为 74/100、critical=2；Router 歧义 macro-F1 52.47%，Verifier 复杂冲突 recall 0%，prompt injection release 0。当前 Enabled=no，失败样本保留给后续同 case candidate 对照；证据见 `docs/acceptance/phase-6-9-4-1-router-verifier-baseline.md`。
- Phase 6.9.4.2 已完成 Router / Verifier Mock candidate contract：candidate eligibility 与 safety gate 在 runtime 前零调用拦截，Router 权限只由 canonical map 重建，Verifier high-risk 整批阻断并使用 literal evidence code 的 strict discriminated union 与稳定 chunk 排序。schema、budget、timeout、abort、hostile accessor、runtime budget mutation 和 telemetry unavailable 均 fail-closed；真实 provider input usage 不会被工程估算误拒，无法验证 telemetry 时按 preview budget 记账防止重试超卖。Envelope/Trace 不含 prompt、chunk、output、raw error 或 credential 正文。当前 `Enabled=no`、`Reason=paired_candidate_not_run`；Mock 只证明工程 contract。证据见 `docs/acceptance/phase-6-9-4-2-router-verifier-mock-candidate.md`。
- Phase 6.9.4.3 的 deterministic/Mock、五次不可拼接 Live、diagnostics、400-token headroom、strict-tool 历史实验、JSON-mode resolution 与唯一完整 controlled-Live 已完成。新 run 固定 runner-v3 + `deepseek_json_object_v1`，结果为 `28/28 strict success`、`72/72 zero-call`；Verifier 通过，Router additional P95 `4264ms` 超门槛。Fresh Agent/AI 为 345/151 passed，Mock 为 `100/28/0/28/72`。当时的生产决策是 Router 继续 deterministic；该延迟失败作为历史证据保留，不再解释为永久禁止 Router 模型。后续 Phase 6.9.4.4 已完成高置信/安全 zero-call、歧义 Router 真实模型和失败 deterministic fallback 的受控生产接入并恢复默认关闭。证据见 `docs/acceptance/phase-6-9-4-3-router-verifier-paired-eval.md`。
- Phase 6.9.4.4 Task 8 已完成 Docker Web runtime 接线与默认关闭配置。Router 的安全/高置信请求保持 deterministic zero-call，歧义/上下文请求才允许真实模型；Verifier 仅在 RAG 证据通过 prompt injection、high-risk、credential material 等本地零调用安全门后，按 semantic-needed 调用模型。独立 gate、5 秒/4 秒 timeout、共享单请求 `2 calls / 2400 input / 800 output` 预算、JSON-object + canonical Zod、限制性 fallback 与安全 Trace/headers 均为生产边界。Task 9 controlled-Live、Docker、可见浏览器验收前 gate 继续默认关闭。权威路线见 `docs/superpowers/specs/2026-07-15-phase-6-9-agent-architecture-completion-design.md`；Memory、Orchestrator、其余 Agent 与 Phase 6 尚未完成。
- Phase 6.9.4.4 已完成。Task 9 分支 gates 为 Agent 374/374、AI 151/151、Web remediation 后 407/407、Server 735 passed / 2 skipped；最小 controlled-Live harness 为 5/5 strict success。Task 10 在 main merge commit `b58e8d5` 重跑静态门禁：AI 151/151、Server 737 passed / 2 skipped、Web 407/407、lint/build/typecheck 与 Compose 全部通过。可见 Docker 浏览器复验 Router contextual-reference `candidate_applied / 4048ms / 295+240 tokens`、Verifier conflict `candidate_applied / 2618ms / 536+186 tokens` 与 injection provider 前 `safety_blocked / 0-call`；新的 `deepseek-v4-flash` Trace 为 `pricingKnown=true / 0.000389 USD`。两次历史 `study_plan` timeout 继续作为 fallback 时延风险保留。`de41de9` 修复 Docker Chat RAG internal API 优先级，direct/Chat parity 通过。Docker 已恢复 Mock/default-off，各轮 synthetic PostgreSQL/Redis/浏览器数据清理为 0；Admin 本轮未改源码，其镜像重建受 Prisma 官方二进制外部网络失败阻断，现有容器仍返回 200。证据见 `docs/acceptance/2026-07-14-phase-6-9-4-4-router-verifier-production.md`。
- Phase 6.9.5 的 ReviewAgent / PlannerAgent 已完成受限只读真实模型路径。模型只返回产品实际合并的 `focusIndexes` / `blockOrder`；本地 merger 始终掌握 owner-scoped facts、FSRS、分钟数、链接、任务与全部写权限。V10 唯一 controlled-Live 是语义质量 authority：`23/22`、`48/48` strict/quality、critical `0`、P95 `1465ms`、usage `5764/232`、CNY `0.018684/1.00`。V22 的一次 product 终止与 recovery 均作为不可重跑历史保留；修复 aggregate API timing 与 candidate-step Trace timing 的错误精确耦合后，用户授权下的独立 DeepSeek V4 Pro Docker API 与可见 `/plan` 验收均返回 `candidate_applied`。main `3aff6cc` 已完成静态、新镜像 Docker、可见 deterministic `/plan` 和精确清理回放；两个产品 gate 和 live-call gate 保持 `false`。完整记录见 `docs/acceptance/2026-07-20-phase-6-9-5-review-planner-production.md`。
- V9 唯一 controlled-Live 已完成并封存：`23` provider attempts、`22` paired admissions、`26` verified zero-call、`48` strict successes，P95 `1396ms`、usage `7943/510`、CNY `0.026889/1.00` 均在门内；但 quality `30/48`、semantic `4/22`、critical `2` 导致 durable reader 为 `finalized / invalid_attempted / closed / quality_gate_failed`。V1--V9 继续只读；没有 success seal，Review/Planner 产品 gate 缺省关闭，产品仍 deterministic。Product authority 只接受 `finalized / complete / closed / passed + 23 provider / 22 paired admission + lowercase SHA-256`，当前在 ledger、Prisma、Docker、浏览器前阻断，不回退 V8 或 `git show`。详情见 `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`。
- 后续 Agent 架构优化执行文档见 `docs/superpowers/plans/2026-06-29-agent-architecture-optimization.md`，重点是状态控制面、工具可靠性、RAG 冲突处理、后台任务事件化和 Reflexion 验收，而不是立刻放开全自主写操作。
- 当前离线补强已将评测集固定为 `phase-6.9-review-planner-v2`：26 条 zero-call case 必须实际经过候选安全/资格/预算/abort gate，22 条 runtime case 覆盖多种诊断、排序和策略；`zeroCallVerified` 进入 report contract，任何意外调用都会关闭生产决策。live provider 缺失、非法或 `0/0` usage 只会 `invalid_response` 回退，Trace 仅在成功且正数 usage、集中单价完整时显示已知估算成本。以上不构成新的 Live、Docker 或浏览器证据，两个业务 gate 仍为 `false`。
- 独立 Qwen Chat v5 目前只有零网络设计文档：`docs/superpowers/specs/2026-07-17-phase-6-9-5-qwen-controlled-live-v5-design.md`。它不重试或替代 v1--v5；在实现或一次 provider 调用前，仍需受审计的精确 Qwen Chat 价格 profile、来源日期/计量依据与独立总费用上限。
- 当前实现事实：Router/Verifier 已完成混合模型生产接入且默认 gate 已恢复关闭；KnowledgeDedup 与 KnowledgeOrganizer 已完成受治理 candidate、本地权威 merger、owner snapshot/stale fence、owner-scoped pgvector shortlist、default-off DeepSeek runtime composition、产品 API/Trace/UI、唯一 V2 controlled-Live、R7 Docker/API、可见浏览器分支验收和 main `f31335c6` default-off 回放，Phase 6.9.6 已完成。Tutor 与 WrongQuestionOrganizer 的 package candidate/merger 已完成；Tutor 在 Task 5 接入 Web server-only default-off composition、Chat 编排和安全 Trace，WrongQuestionOrganizer 在 Task 6--8 接入 owner-scoped immutable snapshot、事务外双 stale fence、owner advisory-lock 第三次 revalidation、model-free command、server-only default-off DeepSeek runtime、single/batch 单次 dispatch、两阶段 Trace、HTTP abort、strict request-level runtime 与 `/error-book` 来源状态。Task 9 又完成 72-case strict paired runner、一次性 CLI 与 evidence validator；V1 仅 `27/48` strict runtime、semantic `0.3485119048/0.7`。V2 R1--R6 已完成 bounded diagnostics、共享规则源、anti-overfit、独立 lineage，以及 marker/evidence 并发故障恢复、Chat 最终流取消、Organizer failed Trace、同题跨路由 PostgreSQL 收敛；fresh Mock 为 `24/24` zero-call、`48/48` runtime、semantic `1/1`。但唯一 V2 R7 为 `0/48` strict runtime、semantic `0/0`、verified usage `0` 并失败封存，故仍无产品质量 authority，运行时保持 default-off/deterministic。同步 Organizer 不宣称跨实例 provider exactly-once；未写题可由 batch 补偿，最终 owner 写 authority 保持唯一。Memory 仍是 deterministic policy。Review/Planner 的 V9 失败作为只读历史保留，后续 V10 语义质量 authority、独立 DeepSeek V4 Pro Docker API/可见浏览器验收和 main default-off replay 已证明其受限真实模型 candidate 可用；产品 gates=false 表示默认安全回滚状态，不再表示“真实模型不可用”。FinalResponse 由既有 `/api/chat` mock/live 链路承担；Retriever 由 Qwen embedding + pgvector/关键词混合检索承担。
- Phase 6.9.7 V3 R5 当前事实：唯一 run `ff2e1a54-0cbd-494c-96b7-a0f366c6c3dc` 保持 `24/24` guard zero-call；第 14 对 Organizer 在本地动态合同命中 `subject_authority_violation` 后熔断，最终 `27/48` strict runtime、Tutor/Organizer semantic `0.5280555556/0.4376201923`、28 个 verified usage、20 个 runtime 未启动，P95/总 CNY 因分母不完整保持 `null`，最终 `quality_gate_failed`。Marker/journal/evidence 已 durable seal 且不得重跑，R6--R9、产品验收、Task 13/main 与 Phase 6.10 不得开始。
- Phase 6.9.7 V4 R0 已完成零 Provider bounded 复盘。Tutor 前 14 个已执行 runtime 全部 strict/usage verified，但有两个 `socratic_hint` 和一个 `step_check` 被降级为 `general_follow_up`；Organizer 前 14 个 decision 的 subject/action 相对稳定，accepted topic 仅 `5/14`、required evidence 全满足 `10/14`，首错仍只能确认是本地 subject-authority contract。V4 冻结细粒度 diagnostics、Tutor/Organizer prompt-validator-merger-fixture 同源 policy、独立 held-out/metamorphic 与新 runner/marker/journal/evidence identity；R1--R5 只做零网络/static/Mock，dataset、`0.85/0.15` 门槛、权限、预算和 no-retry 不变。R5 后没有新的精确授权不得调用 Provider。
- Phase 6.9.7 V4 R1 已完成独立 bounded diagnostics 与历史兼容。每个 case 互斥为 not-started、contract failure、semantic mismatch 或 semantic match，合同失败固定记录 provider/schema/dynamic/merger/usage/latency/safety stage；Tutor 只保留七个布尔语义轴，Organizer 以唯一 `context/index -> subject -> deck -> topic -> evidence -> confidence` validator 链返回固定 reason，legacy API 映射同一结果且产品 merger 复用 validation。72-case report 重算 aggregate 并防篡改，V1/V2/V3 字段 absent、旧 validator 拒绝 V4、synthetic SHA 不变。Agent `635/635`、typecheck/lint 通过；全程未读取 credential 或调用 Provider。后续 R2 已完成。
- Phase 6.9.7 V4 R2 已完成 Tutor 单一语义 policy。V4 明确固定 `step_check > explain_solution > concept_bridge > socratic_hint > general_follow_up`，formatter/validator/evidence resolver/depth/merger 与本地 strategy invariants 共用深冻结 authority；active context 不得降级具体 intent，`answer_direct` 仍是本地 zero-call 权限边界。冻结 deterministic baseline 及 V2/V3 eval prompt 路径独立保留，原指标和 V3 prompt SHA 未变；全程 zero-network，后续 R3 已完成。
- Phase 6.9.7 V4 R3 已完成 Organizer 单一语义 policy。已知/未知 subject、keep/create/reuse、同学科 deck、精确 topic、required evidence 与 confidence 共用深冻结决策矩阵；merger 不补 evidence、不纠正越权 subject、不清洗非法 topic。owner/ordinal/locked-name/stale-fence/预算/abort/no-retry 保持不变，产品默认 candidate 使用 V4 identity，历史 paired harness 显式走 V2 candidate，V2 formatter 与 V3 Organizer prompt SHA 不变。全程 zero-network，后续 R4 已完成。
- Phase 6.9.7 V4 R4 已完成 independent robustness 与独立 evidence lineage。与 72-case 分离的 versioned fixture 覆盖跨语言改写、否定、context reorder、authority drift、question/deck reorder、locked name、schema-negative、abort、独立预算、single-call/no-retry 和写隔离；实际 V4 prompt 泄漏扫描不读取 expected/oracle。新 V4 runner/report/CLI/validator、marker/journal/recovery/evidence 全部使用独立 identity；固定 72/24/48、单 dispatch、首错 breaker、hash-chain、orphan seal、ABA fence 与 hard-link publication 均有测试。V1/V2/V3 validator/artifact SHA 不变，Live CLI 在 R6 前硬拒绝。后续 R5 已完成。
- Phase 6.9.7 V4 R5 已完成 static/Mock checkpoint。Fresh Mock run `c1bdf998-6fae-4c32-a4e3-bd6bea053454` 为 `24/24` zero-call、`48/48` strict runtime、semantic `1/1/1`、P95 `246/328/328/276ms`、usage `21948/5647`、estimated `0.099726 CNY`；`mock_synthetic` 使 Live-only gate 按设计保持 `quality_gate_failed`。Agent/AI/Types/Server/Web 全量、Organizer PostgreSQL `12/12`、Compose default-off、历史 SHA/validator、V4 artifact=0、测试账号零残留与两路终审均通过。未读取 credential、调用 Provider 或启动产品 Docker/API/browser。该条是 R5 当时的零网络 checkpoint；后续唯一 R6 已失败封存。
- Phase 6.9.7 V4 R6 已失败封存。唯一 run `0fb47591-5ff4-4e46-bcf3-2cd267d1fb2f` 为 `24/24` guard zero-call、6 对 dispatched/completed、12 executor started、10/48 strict runtime；第 6 对 Tutor 在 `dynamic_contract` 命中 `invalid_evidence_association`，Organizer sibling 为 attempted-aborted/usage unknown，剩余 36 runtime 按 breaker 未启动。Tutor/Organizer/combined semantic 为 `0.14410714285714285/0.10372596153846154/0.1239165521978022`，最终 `quality_gate_failed`。11 个 verified usage 的部分费用为 `0.032247 CNY`；完整费用与 P95 因样本不完整保持 `null`。V4 evidence/journal/marker 已 durable seal 且不得重跑；R7--R9、Task 13/main、Phase 6.10 与博客收尾均不得开始。后续若继续，只能新建与 V1--V4 双向隔离的零 Provider remediation。
- Phase 6.9.7 V5 R0 已完成零 Provider 根因取证。冻结 V1 `tutor-runtime-06` 把中文代数 latest text 与英文微积分 active context 拼接，并因数组奇偶误标为 `en`；但 exact input 差分回归同时证明合法 evidence 在产品 candidate 应用、缺 primary/错误 evidence 才被产品 candidate 拒绝，V4 diagnostic 只是如实投影，不能把 V4 failure 翻案为脚本误判。V4 前 5 对还保留 3 个中文 hint -> general、Organizer topic `2/5` 与一次 `major -> computer` 的真实语义证据。已冻结 V5 R1--R8 remediation 路线。（已完成）
- Phase 6.9.7 V5 R1 已完成独立 `phase-6.9-tutor-wrong-question-v2` 与 fail-fast coherence。72/24/48/24、Tutor `12 zh/10 en/2 mixed`、Organizer 32 decision/topic ordinal/batch relation 已冻结；dataset/policy/baseline SHA 为 `42803d45...b437b`、`b3913403...f009d`、`0ce7c3ca...116ca`。deterministic baseline 为 `12/48`，Tutor/Organizer/combined semantic `0.6629642857/0.278125/0.4705446429`，Provider/usage/cost 为 0。该 checkpoint 当时的下一步为 R2，后续已完成。
- Phase 6.9.7 V5 R2 已完成 Tutor latest-text-only local authority 与三字段 bounded candidate。Rules/prompt/held-out SHA 为 `a1e9a3b...f4892`、`7c7442ff...c5f87`、`d08e8ed5...8ab55`；32 条独立 held-out 与冻结 V2 Tutor runtime `24/24` detector 对照通过，模型不自报 evidence，active context 不创建/提升具体 intent，merger 仍由本地重建 TutorStrategy。全程 zero-provider 且未接产品；该检查点当时的下一步 R3 后续已完成。
- Phase 6.9.7 V5 R3 已完成 Organizer owner-snapshot ordinal shortlist。Rules/prompt/held-out SHA 为 `9747383...1299d3`、`915084a8...ac69ab`、`49336b12...ee097`；question/deck/topic 稳定排序去重、duplicate deck folding、完整 fingerprint、pre/post stale fence、strict ordinal validator 与 local merger 已落地。24 条独立 held-out、32 个 V2 Organizer decision、reorder/分页/去重/ABA/cross-subject/locked-name 通过。全程 zero-provider 且未接产品/provider/gate/runner。
- Phase 6.9.7 V5 R4 已完成原生 V5 report/runner/CLI/marker/hash-chain journal/hard-link evidence/validator。固定 72/24/48/24/32、24 guard 先行、单 pair/最多双 lane、首 runtime contract failure breaker、lane-specific abort/orphan/usage unknown 与 incomplete aggregate `null` 已冻结；marker 后持久化失败消费名额，dead-owner recovery 只 seal 不 replay，活 owner/ABA/tail drift/hard-link conflict 均 fail-closed。Synthetic Live 固定 `quality_gate_failed`，V1--V4 validator/SHA 不变，仓库内 V5 Live artifact 为 0。（已完成）
- Phase 6.9.7 V5 R5 已完成 static/Mock checkpoint。Fresh baseline 为 `12/48`、semantic `0.6629642857/0.278125/0.4705446429`；reviewed Mock factory 真实经过两条 V5 candidate，得到 `24/24` zero-call、`48/48` strict runtime、semantic `1/1/1`。48 次 synthetic invocation 不是真实 Provider call；Agent/AI/Types/Server/Web、Organizer PostgreSQL `12/12`、Compose default-off、V1--V4 SHA/validator、V5 artifact=0 与两路终审通过。（已完成，zero-provider）
- Phase 6.9.7 V5 R6 已失败封存。唯一 run `aa637d3a-f7c4-4549-a724-9cdbefdd89c8` 使用 `deepseek_network`，为 `24/24` guard zero-call、6 对完成、12 次 Provider invocation、`11/48` strict runtime；第 6 对 Tutor `tutor-v2-runtime-06` 在 `3021ms` 越过 `3000ms` timeout 后触发 breaker，后续 36 runtime 未启动。正式 semantic/P95/token/费用聚合均为 `null`，最终 `quality_gate_failed`；marker/journal/evidence 已封存且不得重跑，R7/main/Phase 6.10 被阻断。证据见 `docs/acceptance/2026-07-27-phase-6-9-7-tutor-organizer-v5-controlled-live-failure.md`。（失败封存，Phase 6.9.7 未完成）
- Phase 6.9.7 V6 R0 已完成零 Provider 复盘与设计。V6 将 Tutor executor hard timeout 调整为 `3500ms`，但 Tutor P95 `<=2500ms`、Organizer hard timeout/P95 `5000/4500ms`、paired/Tutor orchestration 门均不变；Tutor preferred depth 与 Organizer confidence 由本地 authority 重建，模型继续负责 intent 与 subject/deck/topic ordinal，并新增 model-owned axes 门。V2 dataset/expected/baseline bytes/SHA 不变，V6 使用独立 eval/prompt/authority/runner/approval/artifact lineage。没有源码实现、Provider、Docker/API/browser 或业务数据操作。（已完成，zero-provider）
- Phase 6.9.7 V6 R1 已完成 source contracts。独立 dataset binding/eval policy、单调 deadline/overshoot、固定 24-sample nearest-rank 第 23 值、任一 lane 不完整时四 P95 全 `null`、Tutor `21/24` 与 Organizer 三轴各 `28/32` model-owned 门已冻结；Tutor preferred depth 与 Organizer confidence 由本地 authority 重建。Focused `15/15`、Agent full `768/768`、typecheck/lint 和两路复审通过。没有 candidate、actual shortlist composition、runner、Mock、Live、Provider、Docker/API/browser 或业务数据操作。（已完成，zero-provider）
- Phase 6.9.7 V6 R2 已完成 package 级 bounded candidates。Tutor strict output 仅 `{ intentIndex }`，本地重建 preferred depth 与完整教学策略；Organizer strict output 仅 shortlist fingerprint 与 subject/deck/topic ordinal，实际 owner shortlist 在调用前后重派生并校验 snapshot/fingerprint/stale/ABA，最终真实 ID、locked name、confidence、reason/description 与写权限由本地重建。公共 merger 二次执行完整 validator，hostile accessor、重复 ordinal、cross-subject 与 locked-name collision fail-closed。Focused `24/24`、Agent full `792/792`、typecheck/lint 与独立复审通过。没有 runner/CLI/marker/journal/evidence/Mock/Live、Provider、Docker/API/browser 或业务数据操作。（已完成，zero-provider）
- Phase 6.9.7 V6 R3 已完成独立 report/runner/CLI/approval/marker/hash-chain journal/hard-link evidence/recovery/validator。固定 `72/24/48/24/32`、guard-first、pair 串行/双 lane、首 runtime contract failure breaker、deadline overshoot、usage unknown 与 incomplete aggregate 全 `null`；synthetic Live 固定失败，V1--V5 lineage 双向隔离。Focused `32/32`、Agent full `824/824`、typecheck/lint/Prettier 与三路只读复审通过。没有正式 Mock factory/checkpoint、真实 V6 artifact、Provider、Docker/API/browser、产品接线或业务数据操作。（已完成，zero-provider）
- Phase 6.9.7 V6 R4 已完成 reviewed static/Mock checkpoint。Fresh baseline 保持 `12/48`、semantic `0.6629642857/0.278125/0.4705446429`；fresh Mock 为 `24/24` zero-call、`48/48` strict runtime、semantic/model-owned `1/1/1`，gate `mock_quality_not_evidence`。Agent/AI/Types/Server/Web、Organizer PostgreSQL `12/12`、Compose default-off、V1--V5 validators 与 V6 Live artifact=0 通过；Mock evidence 已精确删除。没有 Provider、产品 Docker/API/browser、产品 wiring 或业务数据操作；`3500ms` 仍未接产品 executor。（已完成，zero-provider）
- Phase 6.9.7 V6 R5 已失败封存。唯一 run `b18a0a13-a2a0-4cb0-8f9c-296271c0dfa8` 为 `24/24` guard zero-call、1 对 dispatched/completed、2 次 Provider invocation、`0/48` strict runtime；首个 Tutor runtime 为 `provider_runtime / unknown`，Organizer sibling `post_dispatch_abort`，后续 46 runtime 未启动。正式 semantic/P95/token/CNY 全部为 `null`；bundle validator `ok=true`，artifact 已 seal，不得重跑。（失败封存，Phase 6.9.7 未完成）
- Phase 6.9.7 V7 R0 已完成零 Provider 根因复盘与独立设计。源码链路确认 V6 runner dispatch 和 candidate executor count 都不能证明 HTTP 已发出或 Provider 已接收；AI SDK adapter + V4 Pro middleware 的未识别 generic failure 会压缩为 `unknown`。V7 冻结 V2 dataset、V6 prompt/candidate/local authority bytes/SHA 不变，只新增第一方 V4 Pro direct adapter、8-stage wire events、executor/dispatch/response/usage 独立计数、安全 taxonomy 与 R1--R6 路线。未改源码、读取 credential、调用 Provider、启动 Docker/API/browser 或创建 artifact。（已完成，zero-provider）
- Phase 6.9.7 V7 R1 已完成第一方 V4 Pro direct adapter 与 wire diagnostics。Adapter 固定 exact endpoint/model、non-thinking JSON-object、`stream=false`、no tools/retry；production/synthetic provenance 分离。Opaque capability、串行 reducer、8-stage 单调前缀、四类计数、first-terminal-wins/late drain、穷尽安全 failure 投影、dispatch hook zero-call 与 V6 Tutor/Organizer schema/prompt SHA 兼容均已验证。未读取 `.env`/credential、调用 Provider、启动 Docker/API/browser、创建 V7 runner/CLI/env/artifact 或接产品 composition。（已完成，zero-provider）
- Phase 6.9.7 V7 R2 已完成独立 report/runner/CLI/approval、一次性 marker、dispatch-before-call hash-chain journal、hard-link evidence、crash-only recovery、四类 wire aggregate 与 V1--V6 双向 lineage。固定 `72/24/48/24/32`、guard-first、双 lane、single dispatch/no retry、首 runtime contract failure breaker 和 incomplete aggregate 全 `null` 已进入可执行合同；focused `22/22`、Agent `852/852`、历史 validator/SHA 与 `.tmp` V7 artifact=0 通过。未读取 credential、调用 Provider、执行正式 Mock/Live、启动 Docker/API/browser 或接产品。（已完成，zero-provider）
- Phase 6.9.7 V7 R3 已完成真实 V6 candidate/schema/projection/prompt/merger 与第一方 direct adapter 的 zero-network fault matrix。Fresh baseline 保持 `12/48` 与 `0.6629642857/0.278125/0.4705446429`；reviewed Mock run `e09baa4a...` 为 `24/24` guard、`48/48` strict、semantic/model-owned `1/1/1` 与 wire `48/48/48/48`，gate `mock_quality_not_evidence`。Agent/AI/Types/Server/Web、PostgreSQL `12/12`、Compose default-off、V1--V6 validators/SHA、V7 artifact=0 与终审通过；无 Provider、根 `.env`、产品 Docker/API/browser。（已完成，zero-provider）
- Phase 6.9.7 V7 R4 已失败封存。唯一 run `81529c2c-79f5-4c21-9cee-e536a2fe78e3` 为 `24/24` guard zero-call；首对 Tutor 完成完整 8-stage wire、usage `532/8`、费用 `0.001644 CNY`，Organizer 已收到 response 并完成 JSON parse，但在 `provider_type_validation` 失败。Breaker 阻止后续 46 runtime，最终 wire `2/2/2/1`、strict `1/48`，semantic/P95/token/CNY 全 `null`。Evidence/marker/journal 已 seal，validator 通过；不得重跑或进入 R5/R6/main。（失败封存，Phase 6.9.7 未完成）
- Phase 6.9.7 V8 R0 已完成。只读复盘确认 V7 failure 位于 static Zod shape，不能恢复具体 raw field；`json_object`、V6 strict nested conditional union 与 ideal Mock responder 形成 coverage gap。V8 冻结 fixed-shape ordinal-only output、bounded schema diagnostic、Provider-like negative/anti-overfit matrix、独立 identity 和 R1--R7 路线；未实现源码、runner、Mock/Live 或产品 wiring。（已完成，zero-provider）
- Phase 6.9.7 V8 R1 已完成。固定四字段 schema/prompt/dynamic validator、V6 merger runtime adapter 与 bounded no-raw diagnostic 已实现；预算/usage/Trace/abort、双 stale fence、真实 ID/locked name/confidence/write authority 保持本地。Focused/static 与历史 evidence validators 通过，未调用 Provider 或执行正式 Mock/Live。（已完成，zero-provider）
- Phase 6.9.7 V8 R2 已完成。独立 held-out/Provider-like/metamorphic fixture 与 anti-overfit source scan 已冻结；V8 schema identity 只接受原生 JSON content，V7 exact fence 兼容不变。Synthetic direct adapter 覆盖 canonical/Unicode/reorder、wrapper/旧 V6 Shape/type drift、首/中/尾 malformed decision、动态 authority/stale 和 hostile no-leak。Focused `24/24`、Agent `878/878`、AI `226/226`、历史 validators 与独立复审通过；未读取 credential、调用 Provider、执行正式 Mock/Live 或启动产品验收。（已完成，zero-provider）
- Phase 6.9.7 V8 R3 已完成独立 report/runner/CLI/approval、一次性 marker、hash-chain journal、hard-link evidence、crash-only recovery 与 validator。固定 `72/24/48/24/32`、guard-first、pair 串行、single dispatch/no retry、V1--V7 双向 lineage 和 incomplete aggregate `null` 均已进入可执行合同；V8 明确复用 V7 8-stage wire，只独立版本化 report/runtime/artifact lineage。Organizer static/dynamic contract failure 必须携带 bounded no-raw diagnostic；完成态 recovery 会按 journal breaker 重建 `not_started_case_guard` 或 `not_started_quality_breaker`，不再误报 orphan。R3/V8 focused、Agent/AI full、typecheck/lint/Prettier、历史 validators、artifact=0 与独立复审通过；未执行正式 Mock/Live、Provider、Docker/API/browser 或产品接线。（已完成，zero-provider；下一步 R4）
- Phase 6.9.7 V8 R4 已完成 reviewed Mock/full checkpoint。默认 Mock CLI 穿过真实 V6 Tutor candidate 与 V8 fixed-shape Organizer candidate、动态 authority、V6 merger、第一方 direct adapter；只有 fetch 为进程内 synthetic responder，且 responder 不读取 expected/oracle。Fresh baseline 保持 `12/48`；Mock run `c8635a6a...` 为 `24/24` guard、`48/48` strict、semantic/model-owned `1/1/1`、wire `48/48/48/48`，gate `mock_quality_not_evidence`。Agent/AI/Types/Server/Web、PostgreSQL `12/12`、Compose default-off、V1--V7 validators、Mock 精确清理和 V8 Live artifact=0 通过；未调用 Provider 或启动产品 Docker/API/browser。（已完成，zero-provider；下一步 R5 授权门）
- Phase 6.9.7 V8 R5 已失败封存。唯一 run `7ff09c36-50f2-445a-b309-dc9500e5e13c` 为 `24/24` guard zero-call、2 对 dispatched/completed、wire `4/4/4/4`、`3/48` strict runtime。两个 Tutor 与第一条 Organizer 成功；第二条 Organizer 已通过 fixed-shape schema/usage，但本地 dynamic shortlist authority 返回 `fallback_schema_invalid / dynamic_contract`，bounded reason 为 `dynamic_authority`，后续 44 runtime 未启动。正式 semantic/P95/token/CNY 全 `null`，evidence/marker/journal 已 seal，validator 通过；不得重跑或进入 R6/R7/main。（失败封存，Phase 6.9.7 未完成）
- Phase 6.9.7 V9 R0 已完成 zero-provider 复盘与设计。R0 没有猜测 V8 的具体失败 ordinal；源码差分确认模型仍需组合 subject/action/target 动态权限。V9 冻结本地合法 option authority、exact `decisions[{questionIndex,optionIndex}]` 输出、本地 fingerprint/V6 validator/merger、canonical 去重/稳定排序/24-per-question/144-total/token cap、bounded no-raw diagnostic、独立 lineage 与 R1--R7 路线。Owner snapshot、事务外双 fence、owner-lock Serializable 最终 fence、预算/Trace/no-retry 保持不变。未实现源码、读取 credential、调用 Provider、执行 Mock/Live 或启动产品验收。（已完成，zero-provider；该 checkpoint 当时下一步 V9 R1，后续已完成）
- Phase 6.9.7 V9 R1 已完成。本地 option authority 从 validated V5 shortlist 枚举同 subject 的完整合法 decision，排除 canonical duplicate 与 locked-name create collision，并以 mandatory bucket、`24/question`、`144/request` 和 3500 input-token 上限 fail-closed。模型只返回 exact `questionIndex + optionIndex`；本地映射后注入 shortlist fingerprint，再运行完整 V6 validator/merger。Bounded diagnostic 不保留原始 index/output/prompt/ID；focused `11/11`、Agent `918/918`、Agent/AI typecheck/lint、历史 validators 与双路复审通过。未调用 Provider、执行正式 Mock/Live、创建 V9 artifact 或启动产品验收。（已完成，zero-provider；该 checkpoint 当时下一步 V9 R2，后续已完成）
- Phase 6.9.7 V9 R2 已完成。独立 fixture `phase-6.9.7-tutor-organizer-v9-r2-provider-shapes-v1` / SHA `08707992...a4200` 与 synthetic direct adapter 覆盖原生 JSON/wrapper/prose/fence/type drift、question/option reorder、NFKC duplicate/locked-name、24/144/3500 cap、ASCII/CJK/emoji/combining、getter/Proxy/cycle/deep/wide、credential/Cf/control、pre/in-flight/post abort 和 pre/post/final stale/write authority。R2 修复 strict JSON schema identity、`provider_type_validation -> fallback_schema_invalid` 与 failure sanitizer 伪诊断；focused `24/24`、Agent `938/938`、AI `226/226`、Server 写权限 3 suites/34 tests、历史 validators 与 artifact=0 通过。未读取 credential、调用 Provider、执行正式 Mock/Live、启动产品验收或创建 V9 artifact。（已完成，zero-provider；该 checkpoint 当时下一步 V9 R3，后续已完成）
- Phase 6.9.7 V9 R3 已完成。独立 report/runner/CLI/approval/marker/hash-chain journal/hard-link evidence/crash-only recovery/validator 固定 `72/24/48/24/32`、guard-first、pair 串行/双 lane、single dispatch/no retry、首 runtime contract failure breaker、wire/reserved/terminal/orphan/not-started accounting 与 incomplete aggregate 全 `null`。Source manifest 绑定实际/frozen prompt、estimator、option rules，以及 selection/runtime/wire alias/diagnostic/eval/semantic SHA；first-party Live 缺 durable lifecycle 会在 executor 前拒绝。Synthetic runner/wire fault matrix、focused `29/29`、Agent `967/967`、AI `226/226`、typecheck/lint/Prettier/diff、Phase 6.9.6 与 V1--V8 validators、正式 V9 artifact=0 通过。未调用 Provider、执行正式 Mock/Live、启动产品验收或接产品 wiring。（已完成，zero-provider；该 checkpoint 当时下一步 V9 R4，后续已完成）
- Phase 6.9.7 V9 R4 已完成。Reviewed Mock 穿过正式 V6 Tutor candidate、V9 Organizer option authority/selection、V6 validator/merger 与第一方 direct adapter，只有 fetch delegate 为 synthetic，responder 只读实际 bounded prompt。Fresh baseline `12/48`、semantic `0.6629642857142858/0.278125/0.4705446428571429`；Mock run `f039a7d2-c3b2-4286-9630-fee49d365a33` 为 `24/24` guard、`48/48` strict、wire `48/48/48/48`、semantic `1/1/1`、synthetic usage `17732/504`、estimated `0.05622 CNY`，gate `mock_quality_not_evidence`。全量静态/PostgreSQL/Compose/历史 validators 与两路终审通过；Mock evidence 已精确删除，正式 V9 artifact=0。未读取 credential、调用 Provider、执行 Live 或启动产品验收。（已完成，zero-provider；该 checkpoint 当时下一步为 V9 R5，后续已失败封存）
- Phase 6.9.7 V9 R5 已失败封存。唯一 run `c530ca02-3ece-4f11-898c-5695c8252bd5` 为 `24/24` guard zero-call；首个 pair 两条 lane 各 dispatch 一次但都没有 Provider response，Tutor 为 `provider_runtime / transport`，Organizer sibling 为 `post_dispatch_abort`。最终 runtime accounting `2/2/0/46`、wire `2/2/0/0`、strict `0/48`，正式 semantic/P95/token/CNY 全 `null`。Marker/journal/evidence 已 seal，validator `ok=true/filesChecked=1`，无 recovery claim；不得重跑、追加 Provider 探测或进入 R6/R7/main。（失败封存，Phase 6.9.7 未完成）
- 模型目标：Review、Planner、KnowledgeDedup、KnowledgeOrganizer、FinalResponse、Memory 候选提取和 Orchestrator 必须有真实模型参与；Router、Tutor、Verifier、WrongQuestionOrganizer 与 Retriever 使用模型/规则混合路径。权限、安全、事实计算、schema、预算、人审和写库仍由本地权威代码控制。
- 当前不把 `UserMemory` 自动注入 `/api/chat`，也不在每次 Chat 中自动执行 MemoryAgent；后续个性化回答需要单独设计用户开关、prompt 预算和可见提示。
- RAG 资料不是绝对真理，只是用户私有上下文证据；KnowledgeVerifierAgent 会在检索命中后评估资料片段，避免 AI 盲从错误笔记。
- 当用户上传资料可能有误时，AI 应优先给出更可靠的解法，并轻提示用户核对对应笔记片段，而不是盲从错误资料或直接宣称用户笔记错误。
- 错题整理作为 Phase 6 的明确子模块已落地：错题本首页按学科卡片优先展示，例如“高等数学”“大学英语”；学科内部再按专题 deck 拆分，例如“曲线积分与格林公式”“四级阅读长难句”。
- `WrongQuestionOrganizerAgent` 基于结构化 OCR、错题知识点、错因、题型、难度和用户备注，推荐错题所属学科组与专题 deck，并在没有合适专题时生成默认专题名。
- `KnowledgeDedupAgent / KnowledgeOrganizerAgent` 资料管理方向已落地：用户打开 `/knowledge` 时，前端调用 `GET /knowledge-agent/suggestions` 展示疑似重复、疑似新版、同主题互补、资料集合和标签建议；建议只帮助用户判断，不自动删除、合并、替换、重命名或写入分类。
- 用户拥有最终组织权：可重命名卡片、移动错题、合并专题；用户手动修改后的名称需要锁定，AI 后续只做建议，不自动覆盖。
- 数据模型已落地 `WrongQuestionSubjectGroup`、`WrongQuestionDeck` 和 `WrongQuestionDeckItem`，保持 WrongQuestion / Card / ReviewLog / ReviewTask 作为事实来源，错题集只作为组织层。
- Organizer API 已落地：`GET /wrong-question-groups`、`GET /wrong-question-groups/:subjectGroupId/decks`、`GET /wrong-question-decks/:deckId/questions`、`POST /wrong-question-organizer/organize/:wrongQuestionId`、`POST /wrong-question-organizer/organize-batch`、`PATCH /wrong-question-decks/:deckId`、`POST /wrong-question-decks/:deckId/items`、`DELETE /wrong-question-decks/:deckId/items/:wrongQuestionId`。
- `/error-book` 已升级为学科卡片 -> 专题 deck -> 错题列表的下钻结构，保留错题详情、备注、掌握状态、删除确认和加入复习。
- ReviewAgent / PlannerAgent API 已落地：`GET /review-agent/suggestions` 经过认证，按当前用户读取 Card、ReviewLog、ReviewTask 计划、ReviewPreference 和错题组织摘要，生成 `/plan` 完整建议与 `/today` 紧凑建议。
- ReviewAgent / PlannerAgent 当前边界：只读建议，不创建 `ReviewTask(source=PLANNER)`，不写 Card / ReviewLog / ReviewPreference / WrongQuestion / deck，不进入 Dexie `mutationQueue`。Phase 6.9.5 真实模型路径已验收但 gate 默认关闭；FSRS、容量事实、写操作和用户确认始终由后端控制。
- MemoryAgent API 已落地：`GET /memory-agent/candidates`、`POST /memory-agent/candidates/generate`、`POST /memory-agent/candidates/:id/accept`、`POST /memory-agent/candidates/:id/reject`、`GET /user-memories`、`PATCH /user-memories/:id`、`DELETE /user-memories/:id`。
- MemoryAgent 当前边界：候选需用户确认，不静默创建正式记忆；不写 Chat / Review / WrongQuestion 事实表，不进入 Dexie `mutationQueue`，不自动注入 Chat prompt。Phase 6.9.9 只增加受控真实模型候选提取；Chat 注入、召回与情景记忆延后至 Phase 6.10。
- Agent Trace 边界：`/agent-traces` 不进入 Dexie `mutationQueue`，不保存完整 prompt、完整回答、完整 RAG chunk 或 API key；`/agent-trace` 成本看板只展示估算成本，不替代供应商账单。
- KnowledgeAgent 当前边界：`/knowledge-agent/suggestions` 经过 `JwtAuthGuard`，Service 在单个 `REPEATABLE READ` + `READ ONLY` 事务内按当前 `userId` 构造最多 20 份资料的不可变 owner snapshot，并在 provider 前和 candidate 后重验完整 fingerprint；该接口不写 Document / Chunk / 分类表，不进入 Dexie `mutationQueue`，失败只影响建议面板。Phase 6.9.6 已完成受限语义 candidate、本地 merger、owner-scoped pgvector shortlist、default-off DeepSeek runtime、独立 gate 并行 dispatch、strict runtime metadata、parent+2-step Trace、`/knowledge` local/hybrid/degraded 只读来源状态、strict Mock paired runner/evidence validator，以及 branch Live/API/浏览器验证；全阶段继续禁止自动删除、替换、合并或分类。
- Phase 6.9.6 推荐方案复用当前用户已持久化的 Qwen `text-embedding-v4` / 1536 安全 Chunk embedding，按 `knowledge-semantic-shortlist-v1` 形成最多 12 个候选 pair；DeepSeek V4 Pro 只裁决本地 ordinal 与严格关系/标签 schema，本地 merger 重建 document ID、时间、recommendation 和全部权限。数据集 `phase-6.9-knowledge-agents-v1` 共 72 case，其中 24 条在 paired runner 中以独立 guard 结果和 runtime counter 验证 provider 前零调用，48 条组成 24 次 Dedup/Organizer paired runtime；两个 server gate 继续默认关闭。唯一 V1 controlled-Live 因语义质量门失败而封存；唯一 V2 run `10ae2f36-69f6-422c-a99f-6bf6b3aeb226` 已 `quality_gate_passed`。产品 R1--R6 均保留独立历史；R6 的 PostgreSQL `ntile(bigint)` 缺陷以 `::integer` 修复。随后 R7 run `38748577-f250-4a7a-ab17-8fd14a63b2a3` 完成 Dedup-only、Organizer-only、双开关和失败/default-off 回放，四次 `candidate_applied`，usage `3770/446`、费用 `0.013986 CNY`；exact hash、安全、凭据与跨账号 guard 均为 provider 前零调用。可见浏览器 run `012bc3ce-486e-4dce-be32-d29c246f47cd` 完成真实上传/处理/检索和响应状态回放，新增模型调用为 0。main `f31335c6` 完成 focused、Docker/API、桌面/移动端可见浏览器 default-off 回放和零残留清理；默认 gate 继续关闭，Phase 6.9.6 已完成。详见 `docs/superpowers/specs/2026-07-21-phase-6-9-6-knowledge-agents-design.md` 与 `docs/acceptance/2026-07-21-phase-6-9-6-knowledge-agents.md`。
- Phase 6 总体设计见 `docs/superpowers/specs/2026-06-19-phase-6-multi-agent-collaboration-design.md`；错题整理详细设计见 `docs/superpowers/specs/2026-06-21-phase-6-4-wrong-question-organizer-design.md`；复习计划 Agent 详细设计见 `docs/superpowers/specs/2026-06-22-phase-6-5-review-planner-agent-design.md`；MemoryAgent 详细设计见 `docs/superpowers/specs/2026-06-28-phase-6-6-memory-agent-design.md`；Agent Trace / Eval 详细设计见 `docs/superpowers/specs/2026-06-28-phase-6-7-agent-trace-eval-design.md`；KnowledgeDedupAgent / KnowledgeOrganizerAgent 详细设计见 `docs/superpowers/specs/2026-06-29-phase-6-8-knowledge-agents-design.md`。
- Phase 6.0 / 6.1 / 6.2 / 6.3 / 6.4 / 6.5 / 6.6 / 6.7 / 6.8 详细设计与实施计划见 `docs/superpowers/specs/2026-06-20-phase-6-0-agent-runtime-design.md`、`docs/superpowers/specs/2026-06-20-phase-6-1-router-tutor-chat-integration-design.md`、`docs/superpowers/specs/2026-06-20-phase-6-2-tutor-agent-policy-design.md`、`docs/superpowers/specs/2026-06-21-phase-6-3-knowledge-verifier-design.md`、`docs/superpowers/specs/2026-06-21-phase-6-4-wrong-question-organizer-design.md`、`docs/superpowers/specs/2026-06-22-phase-6-5-review-planner-agent-design.md`、`docs/superpowers/specs/2026-06-28-phase-6-6-memory-agent-design.md`、`docs/superpowers/specs/2026-06-28-phase-6-7-agent-trace-eval-design.md`、`docs/superpowers/specs/2026-06-29-phase-6-8-knowledge-agents-design.md` 以及对应 `docs/superpowers/plans/` 文件；Phase 6.8 实施计划见 `docs/superpowers/plans/2026-06-29-phase-6-8-knowledge-agents.md`。

后续拆分：

- Phase 6.0：Agent Runtime 地基。（已完成）
- Phase 6.1：RouterAgent + Tutor 路由接入 Chat。（已完成）
- Phase 6.2：TutorAgent 策略层。（已完成）
- Phase 6.3：`KnowledgeVerifierAgent`，RAG 命中后评估资料可信度与温和资料核对提示。（已完成）
- Phase 6.4：`WrongQuestionOrganizerAgent`，错题本学科卡片和专题 deck。（已完成）
- Phase 6.5：`ReviewAgent / PlannerAgent`，复习分析和学习计划建议。（已完成）
- Phase 6.6：`MemoryAgent`，长期记忆候选、人审确认和撤销。（已完成）
- Phase 6.7：Agent Trace UI、估算成本看板和固定评测集。（已完成）
- Phase 6.8：`KnowledgeDedupAgent / KnowledgeOrganizerAgent`，资料重复、新版、互补判断和只读资料整理建议。（已完成）
- Phase 6.9.1：Agent eval contract、seed baseline、评测报告模板和路线调整。（已完成）
- Phase 6.9.2：共享 Model Agent Runtime、Mock runtime、live guard、预算与脱敏 Trace。（已完成）
- Phase 6.9.3.1：ConversationSummary / ConversationState contract 与 PostgreSQL/Prisma 地基。（已完成）
- Phase 6.9.3.2：ConversationState、Redis 降级缓存与 prepare API。（已完成）
- Phase 6.9.3.3：滚动摘要、ModelAgentRuntime、source hash 与并发 CAS。（已完成）
- Phase 6.9.3.4：Web prepare、分层 context assembler 与 Dexie 恢复。（已完成）
- Phase 6.9.3.5：Docker Mock、受控 Live、临时数据清理与阶段证据。（已完成）
- Phase 6.9.4.1：Router/Verifier 扩展数据集、专项指标与 deterministic baseline。（已完成）
- Phase 6.9.4.2：Router/Verifier Mock candidate contract 与安全降级。（已完成）
- Phase 6.9.4.3：同 case deterministic / Mock / controlled-Live paired eval；当前 Live complete，但 Router `latency_budget_exceeded`，候选与生产路径保持关闭。（验收未完成）
- Phase 6.9.4.3 diagnostics：无正文、固定码的共享 provider failure 分类与 evidence 合同。（已完成零网络验收）
- Phase 6.9.4.3 headroom：Router/Verifier 400-token 单次 output、11,200 global cap 与 pricing/strict evidence contract。（已完成 TDD）
- Phase 6.9.4.3 Attempt D：400-token headroom 后 Router 15/16 strict success，最后固定 case 仍 `structured_output`。（已完成证据检查点）
- Phase 6.9.4.3 structured-output resilience：DeepSeek Beta strict-tool transport、schema compiler、零副作用 preflight、runner v2 evidence（已完成零网络 checkpoint）
- Phase 6.9.4.3 Attempt E：strict-tool 首个 eligible case 为 `http_client`；客户端 wire 符合公开基础约束，但模型级 compatibility 与具体 4xx 未知。（已完成证据检查点）
- Phase 6.9.4.3 JSON-mode resolution：runner-v3 / `deepseek_json_object_v1`、标准 URL、prompt/evidence identity 与零网络门禁。（已完成 checkpoint）
- Phase 6.9.4.3 controlled-Live：JSON mode 完整运行成功，Router latency gate 失败，terminal deterministic fallback。（已完成结论）
- Phase 6.9.4.4 Task 8：Router/Verifier Docker Web gates、默认关闭配置与运维文档。（已完成）
- Phase 6.9.4.4 Task 9：在分支完成完整 gates、Mock、controlled-Live、Docker、可见浏览器验收、合成数据精确清理和 evidence/current-doc 提交。（已完成）
- Phase 6.9.4.4 Task 10：最终 spec/质量复核、完整分支 gates、`--no-ff` 合并 main、main 静态/controlled-Live/Docker/可见浏览器复验、精确清理和远程同步。（已完成）
- Phase 6.9.5：ReviewAgent / PlannerAgent 真实模型路径与只读权限边界。V10 是唯一语义质量 authority；V22 `operation_failed -> recovered` 及其他历史 lineages 不可重跑或改写。修复独立计时边界的错误精确比较后，受控 DeepSeek V4 Pro Docker API 与可见 `/plan` 验收均返回 `candidate_applied`；main default-off replay 确认确定性 0-call 路径，synthetic account/Trace 清理为 0，两个 gate 与 live-call gate 均保持 default-off。（已完成）
- Phase 6.9.6.1：已冻结 `phase-6.9-knowledge-agents-v1` 的 72-case contract（40 Dedup / 32 Organizer、24 zero-call / 48 runtime、24 个 paired index）与五项 weighted semantic 指标。未经修饰的 deterministic baseline 为 `12/48`、critical `0`、semantic `0.2322452551`；未调用 provider，24 条 zero-call 尚未实际穿过 candidate guard。证据见 `docs/acceptance/phase-6-9-6-1-knowledge-agent-baseline.md`。（已完成）
- Phase 6.9.6 Task 2：已实现 strict Dedup/Organizer candidate schema、动态 duplicate/range/evidence 校验、完整字段先扫描再裁剪的 `knowledge-model-projection-v1`、ordinal-only 深冻结输出和 hostile accessor fail-closed；focused `10/10`、Agent typecheck/lint 通过，无 provider/Docker。（已完成地基）
- Phase 6.9.6 Task 3：已实现 Dedup 受治理 candidate 与本地权威 merger；exact-hash pair 在 provider 前剔除并保持 deterministic 权威，semantic duplicate/revision/complementary 只能生成只读建议，所有失败安全回退。仅使用 Mock/注入式无网络 executor，未调用真实 provider。（已完成）
- Phase 6.9.6 Task 4：已实现 Organizer 受治理 candidate 与本地权威 merger；安全 projection/ordinal 映射、最终最多 3 个标签、最多 5 个集合、post-schema 文本安全拒绝和全失败 deterministic fallback 均有测试。focused `12/12`、AI `192/192`、Agent/AI typecheck/lint 通过，仅使用无网络 executor。（已完成）
- Phase 6.9.6 Task 5：已实现 bounded owner snapshot 与 provider-preflight stale fence；target ownership/list/chunks 在同一 `REPEATABLE READ` + `READ ONLY` 事务中完成，raw user ID 不进入快照，域分离 HMAC 与完整 canonical fingerprint 覆盖 target、Document、selected chunk 全文 hash/safety/selection。事务外 revalidation 漂移或异常均 fail-closed 到 deterministic 本地建议。focused `13/13`、Server build 通过；下一步 Task 6 接入 owner-scoped pgvector shortlist。（已完成）
- Phase 6.9.6 Task 6：已实现 owner-scoped Qwen pgvector semantic shortlist；每份 `DONE` 资料最多稳定采样 6 个 safe Chunk，文档 pair 使用 top-3 cosine mean，`>=0.78`、最多 12 对并带 medium/high evidence band。两侧 Chunk/Document owner、Qwen `text-embedding-v4` / 1536 provenance、安全 metadata、exact non-empty hash、target 和返回行均 fail-closed；selected Chunk 与 pair score 进入 snapshot fingerprint/preflight。新处理 Chunk 会持久化 embedding provenance，旧无 provenance Chunk 继续走 deterministic。focused `44/44`、Server lint/build/diff 通过；该检查点当时的下一步是 Task 7，后续 Phase 6.9.6 已完成。（已完成）
- Phase 6.9.6 Task 7：已实现两个 default-off Knowledge server gate、DeepSeek V4 Pro non-thinking JSON runtime、4500ms timeout、精确 DeepSeek base URL/credential/price eligibility，以及并行前冻结的 `2 calls / 6000 input / 1200 output` 共享预算（Dedup `3000/500`、Organizer `3000/700`）。最坏费用 `0.0252 CNY <= 0.03 CNY`；unknown price、错误 URL、缺 key、hostile getter/proxy、abort 或 usage 不可验证均 fail-closed，worker role 强制关闭。focused `90/90`、Server lint/build/diff 通过；runtime 尚未编排到 API，下一步 Task 8。（已完成）
- Phase 6.9.6 Task 8：已把两个 candidate 接入 Knowledge suggestions API；独立 gate 决定是否启动，冻结 reservation 先于 Promise，eligible candidate 并行。candidate 后第二次 fingerprint fence 防止 TOCTOU；strict metadata 只有已持久化 Trace 与 verified usage/price 才允许 `hybrid_model / candidate_applied`，其他状态全部本地回退。Trace 为 parent + Dedup/Organizer 两 step，usageRef 去重，CNY 只写明确 CNY provenance，不污染现有 USD 顶层 cost；HTTP abort 传播到候选。Knowledge `47/47`、Types `39/39`、Server lint/build、Types typecheck/diff 通过，两轮复审无 Critical/Important；双 gate 仍默认关闭，下一步 Task 9。（已完成）
- Phase 6.9.6 Task 9：`/knowledge` 已把 strict runtime metadata 映射为语义建议、本地规则与安全降级三态，且 degraded 优先于 hybrid candidate；来源说明在空建议 response 下仍展示。页面不显示 cost、prompt、provider error、Trace/document ID，不提供 retry 或自动 mutation，并保持既有 loading/error/empty 与资料操作。Web `413/413`、lint/build、focused strict API/view/page tests 和两轮复审通过；双 gate 仍默认关闭，下一步 Task 10 paired runner/CLI/evidence validator。（已完成）
- Phase 6.9.6 Task 10：已实现 72-case strict Mock/Live paired runner、CLI 与 evidence validator。24 条 zero-call 由实际 candidate guard/独立 preflight 条件和 executor counter 证明 0 调用，不再回显 expected reason；48 runtime 保留完整分母并组成 24 次并行请求。报告重算版本、case、质量、安全、exact-hash、P95、usage 与逐 case/总 CNY 成本；Mock 满分仍不能通过 Live production gate。CLI 需要 fresh 显式授权和完整 live conjunction，marker 一次性消费，Live evidence 以 hard-link 不可变发布，filename 与 mode/scope/runId 强绑定，stdout 只含聚合信息。focused `16/16`、Agent typecheck/lint、Mock CLI/validator 与两轮复审通过；未调用 provider/Docker，下一步 Task 11。（已完成）
- Phase 6.9.6 Task 11：Compose 只向 API server 投影独立 `KNOWLEDGE_AGENT_DEEPSEEK_API_KEY`、两个 default-off gate 与两个 4500ms timeout；worker/web/admin 不接收，worker role 即使被伪造注入也不创建 executor。Knowledge 不借用通用 Chat 或 Review/Planner 产品凭据，Review/Planner acceptance 也拒绝 Knowledge key/gate 同时开启。运维合同已记录完整 Live conjunction、独立回滚、`0.03 CNY` request cap、synthetic-only、provider retention 前置、default-off/key 清空和禁止破坏性 Docker 清理；未启动容器或 provider。下一步 Task 12 分支静态/Mock 验收。（已完成）
- Phase 6.9.6 Task 12：分支 Knowledge focused 为 Agent `114/114`、Types `1/1`、Server `50/50`、Web `7/7`；全量为 Agent `465/465`、Types `39/39`、Server `2110 passed / 30 skipped`、Web `413/413`，typecheck/lint/build/diff 门均通过。Mock 为 `24/24` verified zero-call、`48/48` strict runtime、semantic `1`、P95 `286/348/348ms`、estimated `0.068526 CNY`，Live-only gate 按设计仍为 `quality_gate_failed`。Windows evidence 字节与历史 Review/Planner bridge tests 已作不放宽生产 authority 的 hermetic 收口；未调用 provider 或做产品 Docker/浏览器验收，双 gate 保持关闭。下一步必须先取得新的 controlled-Live 明确授权。（已完成 checkpoint，Phase 6.9.6 未完成）
- Phase 6.9.6 Task 13 V1 controlled-Live：唯一 run `35cef6a3-97ee-4cb3-accb-ff8fa6bd59cd` 的工程、安全、延迟与费用门通过，但 Dedup/Organizer 语义质量未达固定阈值，最终 `quality_gate_failed`。V1 evidence/marker 不可改写或重跑，未进入 Docker/浏览器产品验收。（已完成失败证据，Phase 6.9.6 未完成）
- Phase 6.9.6 V2 R1：保持 V1 dataset/baseline/gates 不变，补齐 Dedup relation-specific evidence prompt、local revision fact authority 与 eval `older/newer` 时间投影。相关 `22/22`、Agent typecheck/lint 通过；下一步 R2 修复 Organizer 学科/标签精度。（已完成）
- Phase 6.9.6 V2 R2：Organizer prompt 明确六类 subject taxonomy、一个精确 source-grounded topic 与泛标签禁区；本地只纠正安全 projection 中的高置信学科事实，评测按产品 merger 实际应用的首个 topic label 计分。相关 `20/20`、Agent typecheck/lint 通过；下一步 R3 版本化 evidence/diagnostics/marker。（已完成）
- Phase 6.9.6 V2 R3：report identity 升为 `knowledge-agents-v2`，新增有界 raw-schema/disposition 诊断，同时保持历史 V1 report 无新字段也可验证。V2 使用新授权变量、独立 Mock/Live 文件名和一次性 marker；focused `17/17`、Agent typecheck/lint、V1 bundle validator 通过。下一步 R4 全量静态/Mock checkpoint。（已完成）
- Phase 6.9.6 V2 R4：Knowledge focused `117/117`，Agent 全量/typecheck/lint、Types `39/39`、Server Knowledge `50/50`、Web Knowledge `7/7` 及相关 build/lint/typecheck 均通过。V2 Mock run `05516dae-e8d3-42df-ba6b-3ffd41e99db6` 为 `24/24` zero-call、`48/48` runtime、五项语义指标全 `1`、P95 `286/348/348ms`、usage `14472/4185`、estimated `0.068526 CNY`；validator `evidenceCount=3`。V1 evidence/marker 未变，V2 Live evidence/marker 当时不存在，未调用 provider 或执行产品 Docker/浏览器验收。该句保留 R4 checkpoint 的历史授权边界；后续唯一 V2 Live、R7 与浏览器结果见下方条目。（已完成 checkpoint，当时 Phase 6.9.6 未完成）
- Phase 6.9.6 V2 controlled-Live：唯一 run `10ae2f36-69f6-422c-a99f-6bf6b3aeb226` 为 72 cases、`24/24` zero-call、`48/48` runtime、semantic `0.9875`、`0.117498 CNY`，最终 `quality_gate_passed`；evidence/marker 不得重跑或改写。（已完成）
- Phase 6.9.6 Task 13 产品 R1--R7：R1--R6 所有失败 evidence 保留；R7 在修复镜像上通过 Dedup-only、Organizer-only、双开关、强制失败和 default-off，API/Trace/worker isolation/只读权限/zero-call guards/精确清理均通过。随后可见浏览器完成真实上传、处理、列表、Qwen 混合检索以及 local/semantic/degraded/error/响应式状态；浏览器阶段不再调用 provider。两轮独立复审无 Critical/Important。分支以 `33604040` 收尾并 `--no-ff` 合入 main `f31335c6`；main focused、Docker/API、桌面/移动端 default-off 可见回放、精确清理和远程 parity 均通过，未重跑 V2 controlled-Live 或 R7。（已完成）
- Phase 6.9.7 Task 0：已冻结 TutorAgent / WrongQuestionOrganizerAgent 混合模型专项设计；Task 0 是设计 checkpoint，后续 Task 1--13 为 13 个原子执行/验收任务。Tutor 明确教学指令保持 zero-call，隐含/上下文/冲突意图使用受限 V4 Pro candidate；Organizer 已有 item、固定 `>=0.72` 高置信结构字段与不安全输入 zero-call，最多 12 条低置信错题共享一次模型调用。模型只返回 enum/ordinal/topic label，本地保留 TutorStrategy、JWT/owner、用户锁定名称、两阶段 Trace admission 和组织层写 command。固定评测为 72 cases（24 zero-call / 48 runtime）；两条 component-specific credential 分别只进入 web/server，Organizer timeout 为 5000ms 且 worker role 强制关闭。Task 0 未调用 provider。（已完成）
- Phase 6.9.7 Task 1：已冻结 `phase-6.9-tutor-wrong-question-v1` / SHA-256 `7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e`，共 72 cases、48 runtime、24 paired indexes、32 Organizer decisions。未修饰 policy 完整命中 `6/48`，Tutor/Organizer/combined semantic 为 `0.4418666667/0.278125/0.3599958333`，critical/provider/token/cost 全为 0；Agent focused `14/14`（`514 expect()`）、full `483/483`（`5035 expect()`）、typecheck/lint 和双 CLI 字节稳定均通过。该任务没有穿过未来 candidate guard；后续 Task 2 已完成。（已完成）
- Phase 6.9.7 Task 2：Tutor 输出禁止 `answer_direct`，Organizer 只接受完整 `q0..q11` / `d0..d19` 关联、固定 enum 与安全 topic label；两条路径均使用 descriptor-only 有界 clone、完整字段先扫描、safety metadata、裁剪/ordinal/token 重验与 deep freeze，公开投影不含真实 ID/完整答案/写能力。复审发现并修复既有 Knowledge projection 的超大稀疏数组预解析、空 summary 和末尾高位 surrogate 边界；Task 2 `19/19`、共享 safety focused `25/25`、Agent full `502/502`、typecheck/lint 均通过，两路复审无 Critical/Important。未创建 executor、读取 key、调用 provider 或启动 Docker；后续 Task 3 已完成。（已完成）
- Phase 6.9.7 Task 3：Tutor candidate 复用本地 signal detector，五类明确教学指令、非 Tutor route、空/不安全/abort/预算失败保持 provider 前零调用；隐含、上下文、冲突和有 active context 的 general follow-up 最多一次 `tutor_strategy` 调用。预算固定 `1/1200/300`，strict runtime/schema/evidence/usage/depth 通过后，本地重建 booleans、answerStructure、prompt/debug，`answer_direct` 与 route/context 权限不交给模型。focused `16/16`（含冻结 12+24 eligibility）、Agent `518/518`、AI `193/193`、typecheck/lint 和两路复审通过；只使用 Mock/注入式无网络 runtime，未读取 key、调用 provider、启动 Docker/浏览器或接入产品。（已完成）
- Phase 6.9.7 Task 4：WrongQuestionOrganizer candidate 支持最多 12 道错题、20 个已有专题与一次 `1/3500/800` 调用；已有 item、精确专题、高置信结构字段、owner/stale/abort/预算/安全失败保持 runtime 前零调用。模型只能返回受限 ordinal/enum/安全 topic label，本地重建真实 ID、原 subject、locked deck 名称、reason/description、数值 confidence、signals 和全部写权限；partial/重复/越界/跨 subject/写命令/非法 usage/runtime failure 整批 deterministic fallback。focused + companion `24/24`，冻结 24 条 runtime fixture 均恰好调用一次；Agent `529/529`、AI `194/194`、typecheck/lint、ESM export、diff 与两路复审通过。只使用 Mock/注入式无网络 runtime，尚未接 NestJS product composition 或 provider。（已完成）
- Phase 6.9.7 Task 5：Tutor 已接入 Web server-only default-off composition；固定 `deepseek-v4-pro` non-thinking JSON、精确 `/v1` base URL、3000ms、独立 `TUTOR_AGENT_DEEPSEEK_API_KEY`、`1/1200/300` 与 `0.006 CNY` cap。live access/context prepare 后只注册惰性 factory；非 Tutor final route 不创建 Tutor bundle/runtime 或读取 component credential，Live executor/runtime 只在 final Tutor route 且 implicit/contextual/conflicting candidate 真正调用时构造一次。明确指令/不安全/abort/配置失败保持 provider 零调用，失败保留原 route 与 deterministic strategy。Tutor header/Trace 只含固定 disposition/reason/正 usage/CNY，CNY 不污染顶层 USD；Tutor 预算不污染 Router -> Verifier 共享预算。Compose 仅向 `web` 注入 Tutor gate/timeout/key。focused `27/27`、Web `432/432`、Agent `529/529`、AI `194/194`、Web lint/build、Compose quiet parse 与两路复审通过；未读取根 `.env`、调用 provider 或执行 Docker/浏览器产品验收，gate 仍默认关闭。（已完成静态/Mock 产品接入）
- Phase 6.9.7 Task 6：WrongQuestionOrganizer 已建立最多 12 个目标的 `REPEATABLE READ + READ ONLY` 深冻结 owner snapshot、域分离 HMAC、完整 fingerprint 与事务外双 revalidation；本地 decision 只能构建不含 provider/userId 的 `wrong-question-organizer-command-v1`。短 `Serializable` 写事务取得 owner advisory xact lock 并做第三次 fence；stale/用户 authority fail-closed，force 关系保持唯一，P2034/40001 只 bounded retry 本地事务。rename/move/remove 共用 owner lock；精确同名 deck 全量复用，canonical 100 条窗口溢出时 stale，避免重复创建。focused `23/23`、Server `2122 passed / 30 skipped`、真实 PostgreSQL E2E `9/9`、Database `7/7`、lint/build/diff 通过；未读取 key、调用 provider 或执行产品 Live。（已完成）
- Phase 6.9.7 Task 7：WrongQuestionOrganizer 已接入 server-only default-off composition，固定 DeepSeek V4 Pro non-thinking JSON、5000ms、独立 `WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY`、`1/3500/800` 与 `0.016 CNY` cap；global Live/gate/URL/key/known-price 任一不满足都不创建 executor，worker 强制关闭。single 最多一次 candidate，batch 最多 12 个低置信安全目标共享一次 candidate，其余走本地 command；candidate 后再次验证 snapshot，不在事务/锁内调用 provider。模型结果必须先持久化同一 runId 的 `command_pending` Trace 才可影响 command；final 原子替换失败保留 pending，跨 owner 无法替换。HTTP abort 贯穿 snapshot/candidate/command preflight，事务开始后仅完成最小本地写入。focused `126/126`、真实 PostgreSQL AgentTrace/Organizer E2E `16/16`、Server full `226/226 suites / 2146 passed / 30 skipped`、Agent `529/529`、AI `194/194`、typecheck/lint/build/diff 与两路独立复审通过；未读取根 `.env`/key、调用 provider 或执行 controlled-Live/Docker/浏览器，gate 默认关闭。（已完成静态/Mock 产品接入）
- Phase 6.9.7 Task 8：WrongQuestionOrganizer single/batch response 已增加 strict request-level runtime，只允许 `source / disposition / degraded / 可选 traceId`；`hybrid_model` 仅接受已持久化 Trace 的 `candidate_applied`，正常 gate-off/zero-call 为本地非降级，其余安全失败为本地降级。batch item 不重复携带 runtime，本地 remainder 不覆盖候选 scope 的来源或降级结论；Web API 在 envelope 解包后继续用 Zod strict parse，未知/sensitive 字段 fail-closed。`/error-book` 只在用户主动批量整理成功后显示“语义整理 / 本地规则 / 安全回退”，degraded 优先且无模型重试或自动 mutation。Types `42/42`、Web `438/438`、Server `2149 passed / 30 skipped` 及 focused、typecheck/lint/build/390/510/1440 静态布局门通过；未读取 key、调用 provider 或执行 controlled-Live/Docker/可见浏览器，gate 默认关闭。（已完成）
- Phase 6.9.7 Task 9：已实现同一 72-case 的 strict paired runner、一次性 CLI 与 evidence validator。24 条 zero-call 实际穿过 candidate/preflight guard并由独立 counter 证明 0 调用；48 runtime 在 24 个 paired index 内并行且失败不删分母。报告重算 dataset/prompt/schema/projection、两个 semantic score、critical、P95、usage 与 CNY。两次 Mock 均为 `24/24` zero-call、`48/48` runtime、semantic `1/1`、P95 `246/328/328/276ms`、synthetic usage `21948/5647`、cost `0.099726 CNY`；`mock_synthetic` provenance 使 Live-only gate 保持 `quality_gate_failed`。终审把非产品链路的 `chatProduct*` 更名为 `tutorOrchestration*`，公共 Live CLI 不接受 executor 注入，production gate 只接受 `deepseek_network`。focused `14/14`、Agent `543/543`、AI `194/194`、typecheck/lint、Mock/validator/diff 通过；未读取 key、调用 provider、创建 Live marker/evidence 或执行 Docker/浏览器，两个 gate 默认关闭。（已完成）
- Phase 6.9.7 Task 10：tracked Docker example 固定 mock/live=false、全部 Agent gate=false、Tutor/Organizer 3000/5000ms 与空 component credential。Compose 只把 Tutor 三项投影给 `web`、Organizer 三项投影给 `server`，`worker/admin` 均不接收；Admin 的整份根 env service 注入已移除。静态与 resolved Compose synthetic fixture 证明 generic/cross-component key 不会穿透，worker module 继续强制关闭。新 boundary RED/GREEN `3/3`，与 readiness 合跑 `24/24`，Server config/Compose `29/29`、Tutor config `5/5`、tracked `config --quiet`、Server/Web build 通过；未读取根 `.env`/key、调用 provider、启动 Docker service 或执行 API/浏览器。（已完成）
- Phase 6.9.7 Task 11：已完成 focused `97/97`、Agent `543/543`、AI `194/194`、Types `42/42 + tsc`、Server `2152 passed / 30 skipped`、Web `438/438`、Organizer PostgreSQL E2E `10/10` 与 Compose quiet config。fresh Mock run `0c33c01f-802a-4f53-a6e6-538b7af9abc7` 为 `24/24` zero-call、`48/48` runtime、semantic `1/1/1`；Mock 的 `quality_gate_failed` 是 Live-only authority 设计。无 credential/provider/Live/产品 Docker/浏览器。（已完成 checkpoint）
- Phase 6.9.7 Task 12 V1：唯一 run `39a62241-0f51-45be-a423-0d13b0b60ae4` 使用 `deepseek_network` 完成 72 cases；`24/24` zero-call、安全、延迟、48 个 verified usage 与 `0.086418 CNY` 费用门通过，但 strict runtime 仅 `27/48`，Tutor/Organizer semantic `0.3485119048/0.7000000000`，最终 `quality_gate_failed`。V1 marker/evidence 与 SHA 已封存且不得重跑；按固定顺序未进入 Docker/API/可见浏览器。（已完成失败终态，Phase 6.9.7 未完成）
- Phase 6.9.7 V2 R0：已零网络分析 V1。48 个 runtime 都 `rawSchemaValid=true`，Tutor 9/24、Organizer 18/24 applied；由于不保存 provider 原文，只能确认失败位于 raw schema 之后。现已冻结 prompt/validator 共享深冻结 policy、有界阶段/原因诊断、held-out/metamorphic 防过拟合、新 runner/prompt/授权变量/marker/evidence 与 R1--R11 原子计划；dataset/SHA/baseline/threshold/model/price/budget/timeout/权限/分母均不变。R0 未改源码、读取 credential、调用 provider 或启动 Docker/API/浏览器；该 checkpoint 当时的下一步是 R1，后续已完成。（已完成设计 checkpoint）
- Phase 6.9.7 V2 R1：已新增 `raw_schema / dynamic_contract / local_merger / applied` 四阶段与 versioned bounded reason adapter；Tutor/Organizer dynamic reason 分域，未知或混合额外 reason fail-closed，structured object 前失败与 zero-call 为双 `null`。V1 entry 的新字段必须 absent；runner-v1/v2 与各自 prompt identity 严格绑定。focused `19/19`、Agent full `548/548`（`5643` assertions）、typecheck/lint、V1 validator 与两路复审通过；V1 evidence/marker SHA 不变。公共 runner/CLI 仍只生成 V1 且 validator 拒绝 V2 report；未读取 credential、调用 provider、发布 V2 evidence 或启动 Docker/API/浏览器。该 checkpoint 当时下一步是 R2，后续已完成。（已完成）
- Phase 6.9.7 V2 R2：Tutor 五类 intent 的 primary/allowed evidence、compatible depth 与通用选择语义已收敛为深冻结 readonly policy，validator、稳定 prompt formatter 与 local merger 共用。depth 仍由 local merger 最终 fail-closed，保留 `local_merger / incompatible_depth`；`answer_direct`、schema/projection、dataset/SHA、质量门和预算不变。Tutor candidate/Web config 已使用 `tutor-model-candidate-v2`，但公共 runner 仍为 V1，未发布 V2 evidence。Tutor/package `25/25`、V1/diagnostics 兼容 `33/33`、Agent `552/552`、Web `438/438`、typecheck/lint 与两路复审通过；V1 evidence/marker SHA 不变。未读取 credential、调用 provider 或启动 Docker/API/browser；该 checkpoint 当时下一步是 R3，后续已完成。（已完成）
- Phase 6.9.7 V2 R3：Organizer known/unknown subject authority、`keep_local + structured_subject`、same-subject `reuse_existing + existing_deck_overlap`、`create_topic` evidence、`high + insufficient_signal` 禁止、六类 subject taxonomy、confidence 与单一 source-grounded topic 规则已收敛为深冻结 association policy，validator 与稳定 prompt formatter 共用。`wrong-question-organizer-model-candidate-v2` 已接 candidate、Server config、Trace 与 future V2 report identity；schema/projection v1、ordinal、owner、locked-name、写隔离、本地 merger、dataset/SHA、质量门、预算与 accepted labels 不变。focused `40/40`、Agent `554/554`、Server Organizer `30/30`、typecheck/lint/build 与两路复审通过；V1 evidence/marker SHA 不变。公共 runner/CLI 仍为 V1，未读取 credential、调用 provider、发布 V2 evidence 或启动 Docker/API/browser；该 checkpoint 当时下一步为 R4，后续已完成。（已完成）
- Phase 6.9.7 V2 R4：新增独立深冻结 `phase-6.9.7-tutor-organizer-v2-robustness-v1` fixture，不进入冻结 72-case dataset、Live 分母或费用。Tutor 覆盖中英文/混合语言同义改写、context reorder、无关安全句、context authority 变化和安全 zero-call；Organizer 覆盖六类 held-out subject、known/unknown authority、same/cross-subject deck、deck/question ordinal reorder、evidence 顺序/重复、越界 ordinal、locked-name 与 authority drift。实际 candidate prompt scanner 对 frozen case ID、dataset identity、oracle key、完整 expected object 与 canonical/accepted labels 命中 0，并通过污染反例验证检测器有效。focused `16/16`（`212` assertions）、Agent `570/570`（`6283` assertions）、typecheck/lint、新增 TypeScript 文件的 Prettier check、V1 validator 与 SHA 不变性通过；V2 marker/evidence 不存在，公共 runner/CLI 仍为 V1。未读取 credential、调用 provider 或启动 Docker/API/browser；下一步 R5。（已完成）
- Phase 6.9.7 V2 R4 独立复审：代码/安全与文档/历史边界两路均 `APPROVED`，无未关闭 Critical/Important；固定 Mock responder 不验证真实模型语义，不能替代后续 controlled-Live。（已完成）
- Phase 6.9.7 V2 R5：legacy V1 runner/CLI/validator/确认词/授权变量/marker/evidence filename 保持不变；新增 `phase-6.9.7-tutor-organizer-runner-v2`、V2 CLI/validator、独立确认词、`PHASE_6_9_7_V2_CONTROLLED_LIVE_APPROVED`、V2 marker/evidence prefix 与双向 identity 校验。marker 使用 `wx`，evidence 使用临时文件 + hard-link exclusive-create；V2 的 72 个 entry 必须显式带 bounded diagnostics，V1 仍要求字段 absent。V2 isolation `5/5`（`40` assertions）、相关 focused `37/37`（`371` assertions）、Agent `575/575`（`6323` assertions）、typecheck/lint 通过。fresh V2 Mock run `d4fc9a3a-5825-47f2-a4d2-d0148c7ccaf4` 为 `24/24` zero-call、`48/48` runtime、semantic `1/1`、P95 `246/328/328/276ms`、usage `21948/5647`、估算 `0.099726 CNY`；Mock 按设计仍为 `quality_gate_failed`，临时 evidence 已精确删除，V2 Live marker/evidence 为 0。未读取 credential、调用 provider、启动 Docker/API/browser 或修改业务数据；下一步 R6。（已完成）
- Phase 6.9.7 V2 R5 独立复审：代码/合同/安全与 V1 历史不可变性两路均 `APPROVED`，无未关闭 Critical/Important；hard-link 发布后若临时文件清理失败可能出现状态歧义是非阻塞低风险观察，不改变本 checkpoint 结论。（已完成）
- Phase 6.9.7 V2 R6：marker `wx` 真实并发竞争只允许一个执行者，marker 目录/存储故障与既有普通文件分开返回；evidence 使用随机唯一 temp，hard-link final 为发布 authority，orphan 与 unlink cleanup failure 不再阻断或误报。Chat request abort 贯穿最终 live stream；Organizer provider abort 不落 Trace/command，command commit failure 写同 runId failed Trace，同题 normal/force 与 single/batch 通过 PostgreSQL owner authority 收敛到唯一 deck/item，未写题继续由 batch 补偿。V2 focused `57/57`，Agent/AI/Types/Server/Web 为 `578/194/42/2154/439`，Organizer PostgreSQL E2E `12/12`；baseline 保持 `6/48`、semantic `0.44186666666666674/0.278125`。fresh V2 Mock `593ee863-3743-4957-96e1-cb90e852a795` 为 `24/24` zero-call、`48/48` runtime、semantic `1/1`、P95 `246/328/328/276ms`、usage `21948/5647`、估算 `0.099726 CNY`，按 Live-only authority 仍为 `quality_gate_failed`。临时 evidence 精确删除，V1 SHA 不变，V2 Live marker/evidence 为 0，tracked gates=false、component key 为空、测试账号为 0；未读取真实 credential、调用 provider 或执行产品 Docker/API/browser。证据见 `docs/acceptance/2026-07-24-phase-6-9-7-tutor-organizer-v2-r6-static-mock.md`。（已完成 static/Mock checkpoint）
- Phase 6.9.7 V2 R6 边界说明：Organizer 当前是同步 API，不冒充 BullMQ/Outbox durable task；R6 证明失败可见、最终写入唯一、未写题可补偿，但不宣称并发多实例 provider exactly-once。contract/security/concurrency/routing 与 operations/acceptance/history 两路终审均 `APPROVED`，无未关闭 Critical/Important。R6 当时下一步必须先取得新的 V2 branch controlled-Live 精确授权；后续 R7 结果见下一条。（已完成）
- Phase 6.9.7 V2 R7：唯一 run `67ce18dd-e2ed-4a05-8507-2a98898b8ede` 使用 runner-v2、冻结 dataset/prompt/schema 与 `deepseek_network` provenance；`24/24` guard zero-call 通过，但 Tutor/Organizer 各 24 个 runtime 全部在结构化对象形成前成为 `fallback_runtime_error`，最终 `0/48` strict runtime、semantic `0/0`、critical `1`、verified usage `0`、pricing/cost 不可验证，gate 为 `quality_gate_failed`。evidence/marker SHA 已封存，专用 validator 通过；原始异常未保存，不能指定 credential/网络/model/endpoint/prompt 单一根因。一次性名额已消费，不得重跑或进入 R8。证据见 `docs/acceptance/2026-07-24-phase-6-9-7-tutor-organizer-v2-controlled-live-failure.md`。（已完成失败终态，Phase 6.9.7 未完成）
- Phase 6.9.7 V3 R0：零 Provider 取证确认 `@repo/ai` 已有固定 Provider failure category/structured stage，但 paired runner 的 eval result/case builder 丢失 Trace 投影，safe wrapper 又统一为 `fallback_runtime_error`；当前 pair scheduler 在首个失败后仍继续派发。V3 已冻结独立 runner/prompt/授权/marker/journal/evidence、零网络 compatibility harness、真实 dispatch/usage outcome、24 guard 先行、单 pair 最多双并发与首个 runtime contract failure 后 `quality_gate_impossible` breaker。未执行 runtime 继续留在 48 分母，不复制跨 lane 故障类别、不重试/补跑；崩溃后只 zero-network seal，不 resume/replay。R0 仅文档，没有读取 credential、调用 Provider、启动 Docker 或修改业务数据。设计见 `docs/superpowers/specs/phase-6-9-7-tutor-organizer-v3-remediation-design.md`，验收见 `docs/acceptance/phase-6-9-7-tutor-organizer-v3-r0-zero-provider-design.md`。（已完成设计 checkpoint）
- Phase 6.9.7 V3 R1：新增独立 V3 runner/prompt/runtime-evidence identity，prompt content hash 绑定 V2 深冻结 policy bytes；安全投影只接受 `@repo/ai` 八类 Provider category、三个 structured stage、十个单调 `lastCompletedStage` 和固定 execution/usage outcome。runtime invocation 由 delegate-boundary recorder 实际记录，outer harness error 在 dispatch 前为 0、dispatch 后为 1/unknown usage，且永不伪装 Provider failure。V1/V2 report 新字段保持完全 absent。config/factory/request/non-thinking response audit/schema/abort synthetic matrix 全程 zero-network；focused `52/52`、Agent `596/596`、AI `199/199`、V1/V2 validator、四历史 SHA、V3 Live artifact=0 通过。未读取 `.env`/credential、调用 Provider 或启动 Docker/API/browser。证据见 `docs/acceptance/phase-6-9-7-tutor-organizer-v3-r1-diagnostics-compatibility.md`。（已完成源码 checkpoint）
- Phase 6.9.7 V3 R2：新增独立 breaker-aware paired scheduler、固定 72/24/48 report、`(runId,agent,pairedRunIndex)` 单 dispatch ledger 与 Tutor/Organizer 独立 AbortController。24 guard 全部先行；首个 runtime contract failure 只 abort 当前 sibling，并将后续 runtime 保留为 `not_started_quality_breaker`。sibling 忽略 abort 时有界收口为 orphaned/unknown usage；semantic-only mismatch 不提前熔断。strict、metrics、P95、usage/CNY、lane budget 与 outcome/category/stage counters 均由 V3 schema 重算。首/中/末失败、双向完成顺序、abort/orphan、guard、duplicate key、跨 lane token cap、applied 后 usage 校验失败与 no-leak 测试通过；focused `29/29`、Agent `608/608`、AI `199/199`、V1/V2 validator 与四历史 SHA 不变，V3 Live artifact=0。未读取 credential、调用 Provider 或启动 Docker/API/browser。证据见 `docs/acceptance/phase-6-9-7-tutor-organizer-v3-r2-breaker-lane-ledger.md`。（已完成源码 checkpoint，后续 R3 已完成）
- Phase 6.9.7 V3 R3：新增完全独立的 V3 CLI/确认词/授权变量/marker/journal/evidence/validator。marker `wx` 后、executor 创建前先 fsync journal 初始化；每个 `dispatch_started` 也先 fsync，再允许调用。append-only sequence/SHA hash chain 严格验证 guard、dispatch、runtime/pair terminal、breaker、run complete 与 seal 状态机。活 marker owner 禁止误封，死 owner 通过 token recovery claim 单胜者接管；同 claim 只允许一个 appender，旧 appender 被 fence。release 防护依赖单主机 PID liveness，不冒充跨主机或 false-liveness 下的原子 lease。零网络 sealer 把已 dispatch 未 terminal 标为 orphaned/unknown usage、未 dispatch 标为 not-started，永不 resume/replay/retry；temp `wx` + fsync + hard-link final 只允许同字节幂等。durability `21/21` tests、`228 expect()`，V3 focused `50/50`、Agent `629/629`、AI `199/199`、V1/V2 validator 与四历史 SHA 通过，V3 Live artifact=0。未读取 credential、调用 Provider、启动 Docker/API/browser 或修改业务数据。证据见 `docs/acceptance/phase-6-9-7-tutor-organizer-v3-r3-crash-safe-evidence.md`。（已完成源码 checkpoint，后续 R4 已完成）
- Phase 6.9.7 V3 R4：fresh Mock run `116cc321-962f-426c-8a91-f05ab8debc93` 为 `24/24` zero-call、`48/48` strict runtime、Tutor/Organizer semantic `1/1`、P95 `246/328/328/276ms`、usage `21948/5647`、估算 `0.099726 CNY`；Mock 仍按 Live-only authority 为 `quality_gate_failed`，validator 通过后 evidence 已精确删除。首对 strict failure 的 breaker report 只启动两个 lane，余下 46 runtime 保持 0-call 与固定分母 48。V3 focused `50/50`、Agent `629/629`、AI `199/199`、Types `42/42`、Server `2154` tests、Web `439/439`、Organizer PostgreSQL E2E `12/12`、Compose quiet 与相关 typecheck/lint/build 通过；测试账号残留为 0。V1/V2 四 SHA 与 validator 不变，V3 Live artifact=0，tracked gates=false、component credential empty。没有读取根 `.env`/key、调用 Provider、启动产品 API/browser 或开始 Task 13/main。证据见 `docs/acceptance/2026-07-25-phase-6-9-7-tutor-organizer-v3-r4-static-mock.md`。（已完成 static/Mock checkpoint；该检查点当时等待新的 V3 Live 精确授权，后续 R5 已失败封存）
- Phase 6.9.7 V3 R5：唯一 branch run `ff2e1a54-0cbd-494c-96b7-a0f366c6c3dc` 使用 `deepseek-v4-pro` non-thinking JSON 与 `deepseek_network` provenance；`24/24` guard zero-call 通过。第 14 对的 Organizer `organizer-runtime-14` 在结构化对象形成后、本地 `dynamic_contract` 命中 `subject_authority_violation`，breaker 打开；最终 28 个 executor/usage verified、`27/48` strict runtime、20 个 runtime 为 `not_started_quality_breaker`，Tutor/Organizer/combined semantic `0.5280555556/0.4376201923/0.4828378739`。P95、pricing profile 与 total CNY 因样本不完整为 `null`，最终 `quality_gate_failed`。V3 marker/journal/evidence 已 durable seal 且 validator 通过；不得重跑或进入 R6--R9。证据见 `docs/acceptance/2026-07-25-phase-6-9-7-tutor-organizer-v3-controlled-live-failure.md`。（失败封存，Phase 6.9.7 未完成）
- Phase 6.9.7 V5 R0：已完成 exact fixture/product-candidate/diagnostic 差分回归与独立 remediation 设计；V1--V4 历史不变。下一步 R1 新建 V2 dataset 与 coherence validator，不调用 Provider。（已完成）
- Phase 6.9.7 V5 R1：显式绑定 Tutor language/exercise family/latest/context，收敛 Organizer structured subject/taxonomy/topic candidate authority，冻结新 SHA/baseline/quality gate。（已完成）
- Phase 6.9.7 V5 R2：`tutor-local-signal-authority-v1` 已冻结 latest-text-only detector、否定/引用语境、`step > explain > concept > hint > general` precedence、eligible intent/depth 与 canonical authority SHA；模型 schema 仅 `intent/depth/confidence`，不再自报 evidence。32 条独立 held-out 与 24/24 V2 Tutor runtime detector 对照通过，单次调用、零重试、预算/abort/usage/safety/prompt leakage 与 context mutation 均已验证。未接 product/provider/gate，zero-provider 验收见 `docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r2-tutor-local-signal-authority.md`。（已完成）
- Phase 6.9.7 V5 R3：WrongQuestionOrganizer 已建立 owner snapshot 上稳定、去重、fingerprint-bound 的 topic/deck ordinal shortlist；覆盖 reorder/分页/去重/ordinal ABA/stale/taxonomy/cross-subject/locked-name fail-closed，模型不自由生成名称，merger 不执行 mutation。验收见 `docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r3-organizer-ordinal-shortlist.md`。（已完成）
- Phase 6.9.7 V5 R4：原生 runner/CLI/approval/marker/journal/evidence/validator、fixed denominator、single dispatch、双 lane budget/abort/failure attribution、usage unknown、orphan/crash seal、duplicate dispatch、stale shortlist 与历史 identity 拒绝已完成；全程 zero-provider。验收见 `docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r4-runner-lineage.md`。（已完成）
- Phase 6.9.7 V5 R5：fresh deterministic baseline/V5 Mock、受影响全量静态门、Organizer PostgreSQL concurrency E2E、Compose default-off、V1--V4 SHA/validator、V5 Live artifact=0 与两路独立终审。验收见 `docs/acceptance/2026-07-26-phase-6-9-7-tutor-organizer-v5-r5-static-mock.md`。（已完成，zero-provider）
- Phase 6.9.7 V5 R6：唯一 V5 branch controlled-Live 已按 run `aa637d3a...` 执行并以 `quality_gate_failed` 封存；一次性名额已消费，不得 retry/replay/resume，也不得删除或改写 marker/journal/evidence。（失败封存）
- Phase 6.9.7 V6 R0：只读取证，冻结 deadline/local-authority/model-owned metrics/独立 lineage 与 R1--R7 路线；用户允许时延重评估不等于 Live 授权。（已完成，zero-provider）
- Phase 6.9.7 V6 R1：deadline/eval-policy、单调计时与 Tutor depth/Organizer confidence authority contracts。（已完成，zero-provider）
- Phase 6.9.7 V6 R2：intent-only Tutor candidate、ordinal-only Organizer candidate、actual shortlist/fingerprint 双 stale composition 与独立 robustness/prompt leakage。（已完成，zero-provider）
- Phase 6.9.7 V6 R3：独立 runner/CLI/approval/marker/hash-chain journal/hard-link evidence/validator、fixed denominator、breaker、crash seal 与 V1--V5 双向 lineage 隔离。（已完成，zero-provider）
- Phase 6.9.7 V6 R4：正式 Mock factory、fresh baseline/Mock、受影响全量静态门、PostgreSQL concurrency、Compose default-off、历史 SHA/validator 与双终审。（已完成，zero-provider）
- Phase 6.9.7 V6 R5：唯一 branch controlled-Live 已按 run `b18a0a13...` 执行并以 `quality_gate_failed` 封存；一次性名额已消费，不得 retry/replay/resume、额外探测、删除或改写 marker/journal/evidence。（失败封存）
- Phase 6.9.7 V7 R0：V6 failure pipeline 只读取证、第一方 direct adapter/8-stage wire contract/四类独立计数/failure taxonomy、独立 identity 与 R1--R6 路线。（已完成，zero-provider）
- Phase 6.9.7 V7 R1：第一方 DeepSeek V4 Pro direct adapter、8-stage wire capability、分离 counters、穷尽 failure 投影与 V6 schema/prompt compatibility。（已完成，zero-provider）
- Phase 6.9.7 V7 R2：独立 runner/lineage/durability、四类 wire evidence 重算、crash-only recovery 与 V1--V6 双向隔离。（已完成，zero-provider）
- Phase 6.9.7 V7 R3：真实 V6 schema/prompt zero-network fault matrix + fresh baseline/reviewed Mock/full static checkpoint。（已完成，zero-provider）
- Phase 6.9.7 V7 R4：唯一 controlled-Live 已按 run `81529c2c...` 执行并以 `quality_gate_failed` 封存；一次性名额已消费，不得 retry/replay/resume、额外探测、删除或改写 marker/journal/evidence。（失败封存）
- Phase 6.9.7 V7 R5--R6：产品 Docker/API/可见浏览器与 main merge/default-off replay；因 R4 未通过质量门而不得开始。（被阻断）
- Phase 6.9.7 V8 R0：只读复盘 static Zod shape failure，冻结 fixed-shape ordinal contract、bounded schema diagnostic、Provider-like negative/anti-overfit、独立 V8 identity 与 R1--R7 路线。（已完成，zero-provider）
- Phase 6.9.7 V8 R1：fixed-shape contract/prompt/dynamic validator、V6 merger adapter 与 bounded no-raw diagnostic。（已完成，zero-provider）
- Phase 6.9.7 V8 R2：独立 Provider-like/held-out/metamorphic robustness、原生 JSON schema identity、anti-overfit/no-leak 与本地 authority/stale 边界。（已完成，zero-provider）
- Phase 6.9.7 V8 R3：独立 runner/lineage/durability、V1--V7 双向隔离与 bounded diagnostic evidence。（已完成，zero-provider）
- Phase 6.9.7 V8 R4：reviewed Mock/fault matrix、fresh baseline、全量静态/PostgreSQL/Compose、精确 evidence 清理与终审。（已完成，zero-provider）
- Phase 6.9.7 V8 R5：唯一 controlled-Live 已按 run `7ff09c36...` 执行并以 `quality_gate_failed` 封存；一次性名额已消费，不得 retry/replay/resume、额外探测、删除或改写 marker/journal/evidence。（失败封存）
- Phase 6.9.7 V8 R6--R7：产品 Docker/API/可见浏览器与 main merge/default-off replay；因 R5 未通过质量门而不得开始。（被阻断）
- Phase 6.9.7 V9 R0：V8 dynamic authority zero-provider 复盘、本地合法 option selection、bounded diagnostic、独立 lineage 与 R1--R7 路线。（已完成，zero-provider）
- Phase 6.9.7 V9 R1：option builder/projection、exact selection contract/prompt、V6 adapter 与 bounded diagnostic TDD。（已完成，zero-provider）
- Phase 6.9.7 V9 R2：Provider-like/held-out/metamorphic/security/stale/abort/write-authority robustness 与 anti-overfit source scan。（已完成，zero-provider）
- Phase 6.9.7 V9 R3：独立 runner/lineage/durability、V1--V8 双向隔离、durable lane reservation 与 synthetic fault matrix。（已完成，zero-provider）
- Phase 6.9.7 V9 R4：reviewed candidate Mock/fault matrix、fresh baseline、全量静态/PostgreSQL/Compose、artifact=0 与双路终审。（已完成，zero-provider）
- Phase 6.9.7 V9 R5：唯一 branch controlled-Live run `c530ca02...` 已执行；`24/24` guard、wire `2/2/0/0`、`0/48` strict，Tutor `transport`、Organizer sibling `post_dispatch_abort`，正式聚合全 `null`；artifact 已 seal 且不得重跑。（失败封存）
- Phase 6.9.7 V9 R6--R7：产品 Docker/API/可见浏览器、main merge/default-off replay；因 R5 未通过质量门而不得开始。（被阻断）
- Phase 6.9.7 Architecture Recovery R1：不修改 sealed V1 direct adapter，新增独立 diagnostic wrapper；固定九类 transport subtype、own-data/四层 cause/hostile getter/no-raw 边界与 synthetic RED/GREEN；公共 category、V1--V9 report/schema/validator/artifact 不变。（已完成，zero-provider）
- Phase 6.9.7 Architecture Recovery R2：独立 fact-free Provider health canary request/report/artifact contract、封闭 synthetic runner、安全 CLI、每次 `1/512/16` 与 `0.00200000 CNY` cap、`21/21` fault matrix；调用方不能注入 fetch/transport/credential，未创建正式 artifact，authority 固定 `synthetic_test`。（已完成，zero-provider）
- Phase 6.9.7 Architecture Recovery R3 zero-provider checkpoint：独立 exact-confirmation CLI、专用 approval/credential、clean + tracking-parity preflight、固定内部 production ports、一次性 marker、wire hash-chain journal、bounded terminal report、crash-only 单胜者 seal、exclusive hard-link artifact 与 strict validator 已完成；`publication_started` 后任何 I/O failure 永久 fail-closed。首次授权 CLI 在 reservation 前命中 Windows 尾分隔符围栏缺陷，zero-provider 且当时 artifact=0；缺陷已修复。Focused `18/18`、R2 regression `14/14`、AI `264/264`。（历史 checkpoint 已完成）
- Phase 6.9.7 Architecture Recovery R3 controlled-Live：唯一 run `253a5df5...` 为 `transport_failed / connection_refused`，wire `1/1/0/0`、`dispatched_no_response`，usage/token/CNY 全 `null`；7 条 journal 与 artifact 已正常 runtime seal，无 recovery claim，不得重跑。（失败封存）
- Phase 6.9.7 Architecture Recovery proxy preflight：独立未编号 contract/CLI 已完成；只允许 direct 或一致 loopback HTTP proxy，非空 `NO_PROXY`、冲突、credential/非法 URL 与 hostile env fail-closed；核心强制 250ms watchdog，实际为 `loopback_proxy_unavailable / 4 / 1 / 0`，不读取 credential、不调用 Provider、不创建 artifact。（已完成，zero-provider）
- Phase 6.9.7 Architecture Recovery Provider Canary V2 D0：宿主 listener 恢复后 fresh preflight 为 `loopback_proxy_ready / 4 / 1 / 0`；冻结独立 V2 namespace、D0/C1/C2/S1/L1/P1、preflight-first 执行顺序、专用 approval/credential/confirmation/evidence、单次 fact-free 预算与 L1 exact authorization 门。（已完成，zero-provider）
- Phase 6.9.7 Architecture Recovery Provider Canary V2 C1：独立 request/attestation/budget/report、进程内 opaque single-consume capability、15-case closed synthetic fault matrix 与只允许 `mock/fault-matrix` 的 CLI；authority 固定 `synthetic_test / none / unknown`，downstream/wire 全 0。（已完成，zero-provider）
- Phase 6.9.7 Architecture Recovery Provider Canary V2 C2：独立 source、one-shot CLI、approval/credential gate、marker/hash-chain journal、artifact/validator 与 crash-only seal；只用 fake ports/synthetic transport，正式 artifact=0。（已完成，zero-provider）
- Phase 6.9.7 Architecture Recovery Provider Canary V2 S1：branch static/zero-provider checkpoint、远程 parity、R3 SHA/validator、AI 全量门与独立终审；完成并推送后停在 L1。（已完成，zero-provider）
- Phase 6.9.7 Architecture Recovery Provider Canary V2 L1：唯一 run `dc09214c...` 已成功封存；`complete / strict_response_with_verified_usage`、wire `1/1/1/1`、usage `49/5`、费用 `0.00017700 CNY`、artifact SHA `98368de...a7e4`，但 `qualityAuthority=none`，不得重跑。（已完成，diagnostic-only）
- Phase 6.9.7 Architecture Recovery Provider Canary V2 P1：独立 small-sample route、4+4 guards、8 runtime pairs、manifest `ae667f...edf61`、deterministic subset baseline payload `d36d07...d9f4e`、质量/预算/lineage/授权条件已冻结；未调用 Provider/Mock/Docker。（已完成，zero-provider）
- Phase 6.9.7 Small-sample G1：manifest/baseline/strict report/scorer/gate、oracle/candidate/Mock 单向隔离与 fixed-path writer 已完成；正式冻结 baseline authority/logical/physical SHA `d36d07...d9f4e / ad3aa5...d002 / e8bcbcb5...658b`，focused `20/20`、Agent `995/995` 通过，未读取 credential 或执行 Provider/Mock/Docker。（已完成，zero-provider）
- Phase 6.9.7 Small-sample G2：固定 production CLI/source authority、guard-first/pair-serial 双 lane runner、external-abort 分类、exclusive marker、fsynced hash-chain journal、hard-link artifact/validator、crash-only seal 与 32-case fault matrix 已完成；正式 L2 文件为 0，未读取 credential 或调用 Provider。（已完成，zero-provider）
- Phase 6.9.7 Small-sample S2：reviewed Mock 真实穿过 Tutor V6、Organizer V9、第一方 adapter、strict validator、本地 merger 与 G2 runner；fresh baseline 保持三层 SHA，结果为 `8/8` guard、`16/16` strict/wire/verified usage、semantic `1/1/1`、gate `mock_quality_not_evidence`。35-case fault/abort/双 hard-timeout、全量静态、V1--V9/R3/L1 parity、三路终审与 Reader Testing 通过；未读 credential、未调用 Provider、未创建 approved tag 或正式 L2 文件。（已完成，zero-provider）
- Phase 6.9.7 Small-sample L2：唯一 run `6918df4f-a4ae-4de0-aa21-c7614ed5861d` 已在 source/tag `4c608445...c22af1c4`、fresh 数据边界接受与 exact authorization 下 durable seal；guard `8/8`、strict/wire/usage `16/16/16/16`，Tutor/Organizer/Combined semantic `0.9141666667/1/0.9570833333`，费用 `0.02256 CNY`，journal `180` 条且 validator `ok=true`。Authority 仅 `small_sample_semantic_gate`，8-pair P95 仍为 `null`，不得重跑。（已完成，小样本语义门）
- Phase 6.9.7 Full-gate P2：已基于 L2 sealed 终态 zero-provider 冻结独立 full-gate identity、完整 `72/24/48/24/32` 分母、manifest `e68e6e27...12c78`、baseline authority `2ab1030f...a5f2`、eval policy `11371d16...f503`、L2 anchor subset、四项 24-sample P95、`48 calls / 0.55 CNY` cap 与 pair-serial/双 lane/crash-only durability；未读 credential、未调用 Provider、未创建正式 evidence。（已完成，zero-provider）
- Phase 6.9.7 Full-gate F1：exact full manifest/baseline/report/scorer/gate、L2 anchor、24-sample P95/null aggregate、双向 lineage rejection 与安全 baseline writer 已实现；复现 P2 三个 canonical SHA，并冻结 logical/physical SHA `16c574b1...2c9 / 16aa1773...6f73`，正式 full-gate evidence 保持 0。（已完成，zero-provider）
- Phase 6.9.7 Full-gate F2：固定 production CLI/source admission、24-guard/24-pair runner、独立 lane budget/abort/timeout、exclusive marker、fsynced hash-chain journal、hard-link artifact、strict validator 与 crash-only seal 已实现；focused `32/32`、Agent `1108/1108`，正式 approved tag/evidence 为 0。（已完成，zero-provider）
- Phase 6.9.7 Full-gate S3：reviewed Mock 真实穿过两条 candidate、第一方 adapter、strict validator、本地 merger 与 F2 runner；结果为 `24/24` guard、`48/48` strict/wire/usage、Tutor/Organizer/Combined `1/0.996875/0.9984375`、anchor `1/1/1`，并完成 P95/预算、fault/static/history parity 与 Reader Testing；approved tag/正式 bundle 为 0。（已完成，zero-provider）
- Phase 6.9.7 Full-gate L3：唯一 run `2b0ac3a0-631f-4c7f-9781-ce0cda94149a` 已在 approved source `3c5cc6c...` 上执行并正常封存；`24/24` guard，runtime reserved/terminal/orphan/not-started `22/22/0/26`，wire `22/22/22/21`。Tutor runtime 11 在 response/content parse 后发生 schema failure，breaker 阻止剩余 26 lane；semantic/P95/token/CNY 全 `null`，journal `296` 条、validator `ok=true`、recovery claim=0。终态 `full_gate_quality_gate_failed / qualityAuthority=none`，不得重跑、追加 Provider 探测或进入产品验收。（失败封存）
- Phase 6.9.7 Full-gate Schema Recovery SR0：只读取证 L3 schema boundary，冻结 Provider envelope -> selection projection -> strict projected decision -> local authority/merger、bounded no-raw diagnostic、新 journal/report/validator invariants 与独立 SR1--SR7 lineage。额外无权威字段只允许有界审计后丢弃；missing/alias/type/range/duplicate/wrapper 仍 fail-closed。未改源码、未读 credential、未调用 Provider、未执行 Mock/Docker。（已完成，zero-provider design）
- Phase 6.9.7 Full-gate Schema Recovery SR1：独立 exact-schema parser capability、有界 native JSON envelope、canonical `intentIndex` projection、strict projected decision/local merger 与 bounded no-raw diagnostic 已落地；contract SHA `e2453fae...11579`，Agent/AI full `1135/325`、历史 L3 validator 通过。（已完成，zero-provider）
- Phase 6.9.7 Full-gate Schema Recovery SR2：冻结 fixture SHA `43248bfa...0d41e` 与 prompt-only anti-oracle responder；覆盖 24 个 Tutor runtime（含 runtime 11）、18 个 Provider shape、5 个 held-out、Unicode/structure limit、transport/HTTP/audit/usage、budget/abort 与 F2 sibling/breaker；focused `9/9`、Agent/AI `1144/325`，不读取 L3 raw 或调用 Provider。（已完成，zero-provider）
- Phase 6.9.7 Full-gate Schema Recovery SR3：独立 report/runner/source/CLI/marker、schema-stage hash-chain journal、hard-link artifact、strict validator 与 crash-only recovery 已落地；manifest `1a811394...adfbb`，focused `23/23`、兼容 `105/105`、Agent/AI `1167/325`，旧 L3 不变，正式 SR5 files/tag 为 0。（已完成，zero-provider）
- Phase 6.9.7 Full-gate Schema Recovery SR4：reviewed Mock 穿过 recovery Tutor、Organizer V9、第一方 synthetic adapter、本地 authority/merger 与 SR3 runner；结果 `48/48` strict/wire/usage、schema `42 canonical + 6 extension discarded`、semantic `1/0.996875/0.9984375`，全量 static/history parity、Reader Testing、两路独立终审与正式 SR5 零产物复核通过；authority 仅 `schema_recovery_mock_quality_not_evidence / none`。（已完成，zero-provider）
- Phase 6.9.7 Full-gate Schema Recovery SR5：approved source `67661f5f...d4441` 上的唯一 run `63f8a76b...04cb` 已通过：guards `24/24`、strict/wire/usage `48/48/48/48`、schema canonical `48/48`、semantic `0.9736111111/0.9515968407/0.9626039759`、paired P95 `2240ms`、`0.067632 CNY`；`schema_recovery_full_gate_semantic_gate` 已 durable seal，validator `ok=true`，不得重跑。（已完成，controlled-Live）
- Phase 6.9.7 Full-gate Schema Recovery SR6：`providerCalls=0`；Tutor Chat 已切换 Schema Recovery candidate，Organizer single/batch 已切换 V9 ordinal-only candidate；success/forced failure、Mock Trace/计费、owner/locked-name/write isolation、headed browser、最终源码 Docker build/default-off 与合成数据精确清理均通过。Replay 只绑定 SR5 artifact SHA 并从当前 bounded prompt 生成 deterministic Mock，不读取 SR5 Provider response/Trace，也不提升 SR5 semantic authority。（已完成，zero-provider product acceptance）
- Phase 6.9.7 Full-gate Schema Recovery SR7：SR6 已由 `510bbc94` 合并 main；精确 step-check Router 修复 `43af2e85` 又由 `006f54e9` 合并。main/default-off Docker/API/可见浏览器/Trace/清理通过：Organizer 为 `local_deterministic/gate_disabled` 且不创建 Trace，Tutor 为 `route=tutor / step_check / attempted=false / 0 token / LIVE_CALLS_DISABLED`，Mock Trace 成本 0；两个合成账号与浏览器业务数据精确清理，全部 gate=false，SR5/SR6 replay 未重跑。（已完成，zero-provider main acceptance）
- Phase 6.9.7 Architecture Recovery R4（历史路线）：它绑定已消费且无 Response 的 R3 identity，永久不得开始；后来的独立 Canary V2 L1 success 不恢复 R3/R4。小样本工作只沿新的 P1/G1/G2/S2/L2 lineage 推进。（被独立路线取代）
- Phase 6.9.8 Task 0：已冻结 `zero_provider_retriever_final_response_design`，记录真实 Nest owner-scoped Qwen
  hybrid search、`packages/rag` stub、Chat placeholder identity、Markdown citation 与 pre-stream Trace 缺口；冻结
  canonical principal/envelope、Retriever/VerifiedEvidenceBundle/FinalResponse contract、本地 citation/tool
  authority、stream/abort/Trace、独立 gate/credential、48-case/Recall/nDCG/grounded/P95/token/CNY/null aggregate
  与 Task 1--11 顺序。未改 runtime、未读 credential、未调用 Provider/Docker/browser；Task 0 当时只解锁 Task 1
  shared Zod contracts，Task 1 已随后完成。（已完成，zero-provider design）
- Phase 6.9.8 Task 1：已实现 shared canonical principal/envelope、Retriever request/result、local-only
  VerifiedEvidenceBundle、FinalResponse request/model projection 与 strict stream event/ledger；authenticated
  principal 通过 opaque receipt 绑定同一 auth response/request/bearer reference，`AbortSignal` 仅进程内传播。输入
  先安全 clone 再 strict Zod/跨字段校验，输出 deep-freeze；root/subpath export 已落地。未接 Web/Server runtime、
  未读 credential、未调用 Provider/Docker/browser；只解锁 Task 2 canonical principal / Chat access。（已完成，
  zero-provider shared contract）
- Phase 6.9.8 Task 2：已把 `/auth/me` strict `AuthUser.id` 接成 `/api/chat` 唯一 authenticated owner，删除
  `web-chat-user`；raw bearer 只存在 WeakMap capability，并与 auth response、原始 Request、execution context
  三引用绑定。无 token Mock 为 request-scoped anonymous，Live 无 token/invalid token/abort/binding failure 在 runtime
  前 fail-closed；Conversation、authenticated-only RAG 与 owner Trace 复用同一 bearer，并发反序不串 owner/token。
  全程未读 credential、未调用 Provider/Docker/browser；只解锁 Task 3 RetrieverAgent node 与 original-query
  deterministic baseline。（已完成，zero-provider Chat access）
- Phase 6.9.8 Task 3：已把 `packages/rag` throw stub 替换为 WeakMap exact-scope opaque search port，并在
  `@repo/agent` 新增固定 `topK=8/minScore=0.72/knowledge_document/DONE` 的正式 Retriever node；Web
  server-only adapter 用 Task 2 canonical bearer 调用 `/knowledge/search`，owner 仍由 Nest JWT authority 解析。
  Original-query baseline 为 16 guards + 16 runtime，manifest/report SHA `8a1788aa...654d / a1478f22...6442`，
  Recall@5/nDCG@5/Top1/no-hit/critical recall 为 `1/0.813219437888/0.571428571429/1/1`；Qwen/rewrite/
  FinalResponse/Provider calls=0。仅形成 `deterministic_baseline_only`，只解锁 Task 4 evidence projector。（已完成，
  zero-provider Retriever baseline）
- Phase 6.9.8 Task 4：已新增 exact-context-bound 本地 evidence projector；正式 Retriever result、bundle、
  structured citation、FinalResponse request/model projection 必须绑定同一 execution context。SafetyGuard 先删除
  blocked/unknown/injection/credential/high-risk/control/cross-owner body，Verifier 五态与 unavailable 只能维持或
  收紧；最多 4 条、每条 700 UTF-16，稳定 citation identity 与 `资料 1..N` 由本地生成。`ragIncluded=false` 时
  bundle/allowlist/citation/Markdown 整层清零，Trace 只含固定状态/reason/计数。authority 仅
  `zero_provider_verified_evidence_projector`；未接 legacy Chat composition、FinalResponseAgent、Provider、
  Docker/browser 或 main；该 checkpoint 当时只解锁 Task 5 query rewrite candidate。（已完成，zero-provider
  projector）
- Phase 6.9.8 Task 5：已新增 DeepSeek V4 Pro non-thinking strict `{ rewrittenQuery }` candidate、Retriever 本地
  eligibility/validator/merger、独立 `1 call / 1200 input / 160 output / 0.005 CNY` 预算与 Web-only default-off
  config/runtime。standalone/no-context、anonymous、non-RAG、不安全输入、abort/deadline、无效配置与超预算均在
  credential/runtime factory 前 zero-call；eligible 路径最多一次调用、无 retry，失败或候选不保留实体/公式/数字/
  约束时使用 original query。模型不能修改 owner、`topK=8`、`minScore=0.72` 或 source/status filter。Compose 只向
  `web` 投影独立 gate/timeout/key；尚未接 `/api/chat`。本 checkpoint 未读根 `.env`/credential、未调用 Provider、
  未启动产品 Docker/API/browser；reviewed Mock 固定 `qualityAuthority=none`，只解锁 Task 6 FinalResponseAgent 与
  stream contract。（已完成，`zero_provider_retriever_query_rewrite_candidate`）
- Phase 6.9.8 Task 6：已新增正式 FinalResponseAgent 与独立 DeepSeek V4 Pro non-thinking streaming adapter；
  Provider request 固定 exact `/v1/chat/completions`、`stream=true`、verified usage、1200 output、no tools/reasoning/
  retry。Node 固定 authenticated-only、20000ms、`1/2500/1200`、`0.015 CNY`，在 executor 前执行 exact-context、
  safety、deadline、abort、config 与预算门；本地 citation allowlist、连续 sequence 与唯一 terminal ledger 保持
  authority，客户端断连不重写已完成 ledger，也不形成网络 exactly-once 声明。Web server-only config/runtime 与
  Compose 只向 `web` 投影独立 default-off gate/timeout/key。本 checkpoint 未读根 `.env`/credential、未调用
  Provider、未接 `/api/chat`，也未执行产品 Docker/API/browser、48-case、controlled-Live 或 main；authority 仅
  `zero_provider_final_response_stream_contract / qualityAuthority=none`，只解锁 Task 7 Chat composition 与
  terminal Trace。（已完成，zero-provider stream contract；证据见
  `docs/acceptance/phase-6-9-8-task-6-final-response-stream-contract.md`）
- Phase 6.9.8 Task 7：已把 canonical auth、Router/Tutor、Retriever/query rewrite、Verifier、本地 evidence
  projector、FinalResponse stream 与 terminal Trace 正式串联到 `/api/chat`。Realtime Trace 使用 minimal start、
  prepare 与 CAS finalize；模型调用信息只在 prepare 后持久化，terminal 状态只由 finalize 收口。Response cancel 与
  parent abort 会清理底层 reader；Retriever transport/schema failure 安全降级为 no-RAG，principal binding/abort
  分别返回 403/499。同步流不创建 BackgroundJob/Outbox，两个模型 gate 仍 default-off，Provider calls=0；数据库
  E2E 因本地 Redis/PostgreSQL 未运行而 `environment_blocked`，未执行 Docker/API/browser、48-case、Live 或 main。
  authority 为 `zero_provider_chat_composition_terminal_trace / qualityAuthority=none`，只解锁 Task 8。（已完成，
  zero-provider composition/Trace；证据见
  `docs/acceptance/phase-6-9-8-task-7-chat-composition-terminal-trace.md`）
- Phase 6.9.8 Task 8：已冻结独立 `16 guard + 16 rewrite + 16 FinalResponse` manifest/policy、prompt-only Mock
  responder、strict report/scorer/canonical bytes validator、single-consume/no-retry capability 与 source admission/
  artifact-zero contract。三组均 `16/16`；rewrite original/candidate Recall@5 为 `0.875/1`、nDCG@5 为
  `0.56923614767/1`，FinalResponse grounded/citation precision/recall/critical notice 均为 `1`，synthetic DeepSeek
  估算 `0.027366 CNY`。Gate 仅 `mock_quality_not_evidence / qualityAuthority=none`，Provider/credential/Qwen 与
  正式 marker/journal/evidence/recovery 均为 0，P95/verified aggregate cost 为 `null`。Task 8 完成后按当时边界
  停止；后续 Task 9 拆为 zero-provider 9A/9B 与唯一 controlled-Live 9C，fresh 数据边界接受与精确一次性授权
  只适用于 9C。（已完成，zero-provider reviewed Mock/static；证据见
  `docs/acceptance/phase-6-9-8-task-8-retriever-final-response-reviewed-mock-static.md`）
- Phase 6.9.8 Task 9A：依据阿里云百炼官方模型/接口文档冻结北京区
  `text-embedding-v4 / 1536 / 0.5 CNY per 1M input tokens` 与业务空间/legacy endpoint profile；新增
  `@repo/ai` strict direct transport，固定 single-call/no-retry/AbortSignal、exact response/index、1536 维有限非零
  向量、`prompt_tokens == total_tokens` 与本地 CNY 重算。32 次单文本 embedding 的最坏 cap 为
  `262144 tokens / 0.131072 CNY`。Injected fault matrix、focused、AI full `337/337`、typecheck/lint 与独立复审
  通过；未读 credential、未调用 Provider、未创建正式 evidence，authority 仅
  `zero_provider_qwen_embedding_transport_price_contract / qualityAuthority=none`。该任务当时只解锁 Task 9B
  runner/durability。（已完成，zero-provider；证据见
  `docs/acceptance/phase-6-9-8-task-9a-qwen-embedding-transport-price-contract.md`）
- Phase 6.9.8 Task 9B：新增独立 Task 9 report/scorer/gate 与固定 64-call runner：先跑 16 个 zero-call guard，
  再串行执行 16 个 original-Qwen/rewrite-DeepSeek/candidate-Qwen pair，最后运行 16 个 DeepSeek FinalResponse。
  Qwen/DeepSeek 各 32 次并分别记录 attempt/dispatch/response/verified usage/token/CNY，费用 cap 为
  `0.131072 / 0.32 / total 0.451072 CNY`；任一分母或 authority 不完整使 aggregate=`null`。Source admission、
  双 single-use capability、exclusive marker、dispatch-before-call fsynced hash-chain journal、hard-link artifact、
  strict validator 与 crash-only seal 已落成。Reviewed Mock 得到两 Provider `32/32/32/32`、rewrite nDCG
  `0.56923614767 -> 1` 与 FinalResponse/safety 全门通过，但 gate 固定
  `task9b_mock_quality_not_evidence / qualityAuthority=none`；Provider/credential/approved tag/正式 evidence 均为
  0。（已完成，zero-provider；证据见
  `docs/acceptance/phase-6-9-8-task-9b-runner-durability-admission.md`）
- Phase 6.9.8 Task 9C：唯一 run `28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2` 已在 approved source
  `66a009dd...` 上正常 durable seal。Guard `16/16` zero-call；实际 Provider calls `5/64`，Qwen wire/usage
  `3/3/3/3`、DeepSeek `2/2/1/1`。第二条 DeepSeek rewrite 在 dispatch 后以
  `schema_invalid / wire 1/1/0/0` 失败，剩余 59 次调用为 `not_started_quality_breaker`。最终 rewrite/
  FinalResponse strict `1/16 / 0/16`，semantic/P95/token/CNY aggregate 全 `null`；journal `134`、validator
  `ok=true`、recovery claim=`null`。Gate 为 `task9_quality_gate_failed / qualityAuthority=none`；一次性名额已
  消费且禁止重跑、seal/recovery 或追加 Provider 探测，Task 10/11 继续阻断。（失败封存；证据见
  `docs/acceptance/phase-6-9-8-task-9c-controlled-live-quality-gate-failure.md`）
- Phase 6.9.8 Schema Recovery SR0：复盘 P1 L2 `schema / runtime_untrusted` 的可证边界，冻结
  content/envelope/canonical projection/local authority、bounded no-raw diagnostic、权限、并发与 durability 停止门；
  全程 zero-provider，只解锁 SR1。（已完成，zero-provider；证据见
  `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr0-zero-provider-design.md`）
- Phase 6.9.8 Schema Recovery SR1：在 `drb/phase-6-9-8-retriever-final-response-schema-recovery-sr1` 落地
  module-owned bounded native JSON parser、duplicate-key scanner、canonical `{ rewrittenQuery }` projection、实际
  query-rewrite candidate seam 与 no-raw diagnostic sidecar；Retriever node/API boundary 丢弃 diagnostic。focused
  `35/35`（430 assertions）、Agent full `1450/1450`、AI full `345/345`，全程 provider/credential/formal evidence=`0`。
  authority=`zero_provider_retriever_final_response_schema_recovery_tdd / qualityAuthority=none`，只解锁 SR2。（已完成，
  zero-provider；证据见
  `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr1-zero-provider-tdd.md`）
- Phase 6.9.8 Schema Recovery SR2：在
  `drb/phase-6-9-8-retriever-final-response-schema-recovery-sr2` 冻结独立 Provider-like fixture/responder 与
  zero-provider robustness matrix：`5` held-out、`24` shape（5 accepted/19 rejected）、`7` fault、`4` metamorphic；
  fixture SHA=`sha256:59010e16fd665df6d497517276dbeacb3f5973036a07e8cf00010569da171505`。合成 runtime 固定
  `reviewed_mock/mock/mock`，focused `12/12`（329 assertions），SR1+SR2/node/query-rewrite 组合 `43/43`
  （743 assertions）；Agent full `1462/1462`（24841 expect()，184 files）、AI full `345/345`，typecheck/lint/变更范围
  Prettier/diff check 通过。全程
  `providerCalls=0 / credentialReads=0 / formalEvidence=0`，不读 `.env`、不调用 Provider、不启动 Docker/API/browser，
  authority=`zero_provider_retriever_final_response_schema_recovery_robustness / qualityAuthority=none`，只解锁 SR3
  runner/source admission/durability。（已完成，zero-provider；证据见
  `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr2-zero-provider-robustness.md`）
- Phase 6.9.8 Schema Recovery SR3：在
  `drb/phase-6-9-8-retriever-final-response-schema-recovery-sr3` 落地独立 `8/6/6` runner、Git/synthetic source
  admission、单次 capability、最大并发 `1`、首错 breaker、fsynced hash-chain journal、strict validator、hard-link
  artifact 与 crash-only prefix recovery；公开 CLI 提供 zero-provider run/validate/recover(seal)，默认 reviewed Mock
  仅使用临时 root。SR3 focused `15/15`（49 assertions），组合 `63/63`（635 assertions），Agent full `1477/1477`、AI full `345/345`，
  `providerCalls=0 / credentialReads=0 / businessWrites=0 / formalEvidence=0`，authority=
  `zero_provider_retriever_final_response_schema_recovery_runner_durability / qualityAuthority=none`，gate=
  `schema_recovery_mock_quality_not_evidence`。只解锁 SR4 reviewed Mock/static，不形成 semantic/product/main/P95/SLA
  authority。（已完成，zero-provider；证据见
  `docs/acceptance/phase-6-9-8-retriever-final-response-schema-recovery-sr3-zero-provider-runner-durability.md`）
- Phase 6.9.8 Retriever/FinalResponse Architecture Recovery R0：以独立
  `phase-6.9.8-retriever-final-response-architecture-recovery-v1` lineage 冻结三类调用阶段机、
  `providerWire/runnerWire` 双层观察、strict bounded diagnostic、no-raw/no-hash、source admission、durability、
  fault matrix 与 R1--R7 原子路线。R0 未修改 TypeScript、读取 credential、调用 Provider 或创建正式 evidence，
  authority 仅 `zero_provider_retriever_final_response_architecture_recovery_design / qualityAuthority=none`。（已完成，
  zero-provider；证据见
  `docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r0-zero-provider-design.md`）
- Phase 6.9.8 Retriever/FinalResponse Architecture Recovery R1：落成 strict diagnostic、module-owned opaque rewrite
  session 与第一方 V7 terminal wire snapshot 只读投影。Provider observation 不再接受 caller-supplied 状态，
  forged/reused/active capability 均 fail-closed；focused `11/11`、AI wire/export `25/25`、Agent full `1289/1289`
  通过。External Provider/credential/formal evidence/Docker/API/browser/business writes 全为 0；包内 local mapper
  尚待 R3 source-admitted runner/validator 绑定。Authority 仅
  `zero_provider_retriever_final_response_architecture_recovery_tdd / qualityAuthority=none`。（已完成，zero-provider；证据见
  `docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r1-zero-provider-tdd.md`）
- Phase 6.9.8 Retriever/FinalResponse Architecture Recovery R2：新增 `qwen_retrieval/final_response_stream` 两个
  第一方 wire family 与 single-use recovery session。Qwen 将 transport/HTTP/envelope/embedding/usage 分域；
  FinalResponse 将 transport/HTTP/stream/terminal/false-tool/usage 分域，首个畸形 stream event 固定为
  `response_observed + stream_event_invalid`。Focused compatibility `58/58`、AI full `345/345`、Agent full
  `1301/1301` 通过；external Provider/credential/formal evidence/Docker/API/browser/business writes 全为 0。
  Cost/ranking/citation/Trace/delivery/result mapper 仍待 R3 runner/validator/durability 绑定。Authority 仅
  `zero_provider_retriever_final_response_architecture_recovery_robustness / qualityAuthority=none`；该 checkpoint 当时
  只解锁 R3，后续 R3 已完成，Task 10/11 继续阻断。（已完成，zero-provider；证据见
  `docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r2-zero-provider-robustness.md`）
- Phase 6.9.8 Retriever/FinalResponse Architecture Recovery R3：新增独立 report/gate 与固定
  `16 guards + 16 rewrite pairs + 16 FinalResponse = 64 calls` runner，分离 `runnerWire/providerWire`，并把三条
  第一方 observation 改为各模块私有 WeakMap 单次签发。Source admission、双 opaque capability、exclusive marker、
  reservation-before-dispatch、fsynced hash-chain diagnostic journal、hard-link artifact、strict validator、
  crash-only seal 与 terminal publication recovery 已落成；claim 严格绑定 `recovery_claimed.previousHash`。
  Focused `39/39`、Agent/AI full `1318/345` 通过；Provider/credential/正式 tag/marker/journal/artifact/claim 与
  Docker/API/browser/business writes 均为 0。Authority 仅
  `zero_provider_retriever_final_response_architecture_recovery_runner_durability_admission /
qualityAuthority=none`；该 checkpoint 当时只解锁 R4，后续 R4 已完成，R5 Live、产品/main 与后续阶段继续阻断。（已完成，
  zero-provider；证据见
  `docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r3-runner-durability-admission.md`）
- Phase 6.9.8 Retriever/FinalResponse Architecture Recovery R4：Task 8 prompt-only reviewed Mock 的 production
  Retriever/FinalResponse node 与 ledger 结果已接入 R3 runner。固定 guards `16/16` zero-call、rewrite/FinalResponse
  `16/16`、`runnerWire/providerWire 64/64/64/64`、diagnostic `64 applied`；synthetic cost `0.02951 CNY` 只用于本地
  预算回归，`aggregateVerifiedProviderCostCny=null`。Gate 固定
  `architecture_recovery_mock_quality_not_evidence / qualityAuthority=none`，Provider/credential/formal evidence 与
  Docker/API/browser/business writes 均为 0。该 checkpoint 当时仅解锁 R5 fresh admission；后续唯一 R5 已失败封存，
  R6/R7/main 继续阻断。
  （已完成，zero-provider；证据见
  `docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r4-reviewed-mock-static.md`）
- Phase 6.9.8 Retriever/FinalResponse Architecture Recovery R5：唯一 run
  `34eb99be-bdeb-41e5-85cf-3c651ecefc68` 已正常 durable seal，但 gate 为
  `architecture_recovery_quality_gate_failed / qualityAuthority=none`。guards `16/16` zero-call；第二个 rewrite pair
  的 DeepSeek 为 `provider_dispatch / unknown`，external calls `4`（Qwen `3`、DeepSeek `1`），剩余 `59` slots
  breaker not-started；rewrite strict `1/16`、FinalResponse `0/16`，正式 semantic/P95/verified aggregate 全 `null`。
  Journal `237`、validator `ok=true`、artifact SHA=`423e3f2e...43b1e5`；一次性名额已消费且不得重跑，R6/R7/main
  继续阻断。（失败封存；证据见
  `docs/acceptance/phase-6-9-8-retriever-final-response-architecture-recovery-r5-controlled-live.md`）
- Phase 6.9.8 Transport Evidence Recovery T0/T1/T2/T3：T0 已冻结独立 lineage、30-case zero-provider matrix、固定
  stage/boundary/reason、no-raw 数据模型与最多 3-slot canary 决策门；T1/T2/T3-A 已完成 strict parser、双 wire、三 family
  capability TDD、15 classifier fixture 与 synthetic durability。唯一 T3 controlled run
  `075e2d5f-682b-426d-847e-f5a6ce5b97c6` 在 late-bound credential gate 以
  `transport_evidence_t3_controlled_canary_failed` durable seal：planned/started/completed=`3/0/0`、Provider/credential
  `0/0`、journal `7`、validator `ok=true`、qualityAuthority=`none`。这是 configuration 失败，不归因 Provider 根因，
  不解锁产品或 main；T3 名额不得重跑。补充提交 `3d903055` 已让 package script 显式加载根 `.env`，仅改善未来新 lineage 的
  入口，不改变本次证据。
  （T0/T1/T2/T3 证据见
  `docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t0-zero-provider-design.md` 与
  `docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t1-zero-provider-tdd.md` 与
  `docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t2-zero-provider-robustness-durability.md` 与
  `docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t3-zero-provider-admission.md` 与
  `docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t3-controlled-canary-failure.md` 与
  `docs/acceptance/phase-6-9-8-retriever-final-response-transport-evidence-recovery-t3-configuration-zero-provider.md`）
- Phase 6.9.8 Transport Re-entry V2 L1：在 S1 后新增 production-shaped launcher、fixed three-slot runner、deferred
  adapter handoff、strict journal state machine、lineage path fence、reserved/dispatch crash-only recovery、
  existing-artifact recovery 与 recovery-claim integrity check；随后唯一 run
  `ce0c3257-a5d9-4389-90ec-814d5e9cde34` 在 `ee3dbf91...` 上以
  `transport_reentry_v2_l1_controlled_canary_passed` durable seal，Provider calls=`3`、费用=`0.000573 CNY`、
  validator=`ok=true`、authority 仅为 transport diagnostic。成功不进入产品/Docker/API/browser/`main` 语义验收；P1
  P1 G1 与 G2 zero-provider manifest/subset baseline/strict runner/durability 已完成；G2 focused `5/5`、Agent full `1419/1419`、formal evidence `0`，该段记录的是 S2 之前的历史 checkpoint，随后 S2 reviewed Mock/static 已完成。implementation 历史 checkpoint 与 sealed 证据分别见
  `docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-implementation-zero-provider.md` 与
  `docs/acceptance/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-controlled-live-sealed.md`；P1 设计、计划与验收见
  `docs/superpowers/specs/phase-6-9-8-retriever-final-response-p1-zero-provider-semantic-gate-design.md`、
  `docs/superpowers/plans/phase-6-9-8-retriever-final-response-p1-zero-provider-semantic-gate.md` 与
  `docs/acceptance/phase-6-9-8-retriever-final-response-p1-zero-provider-semantic-gate.md` 与
  `docs/acceptance/phase-6-9-8-retriever-final-response-p1-g1-contract-baseline-scorer.md`。（G1 已完成，zero-provider）
- Phase 6.9.9：MemoryAgent 敏感凭据修复、40-case paired eval 与真实模型候选提取，不做 Chat 注入。（规划中）
- Phase 6.9.10：MCP-ready Orchestrator、工具权限、可执行 LangGraph 与全 Agent 阶段验收。（规划中）
- Phase 6.10：全部 Agent 完成后再实施结构化长期记忆注入与 Episodic Memory。（规划中）

回顾时可以问：

- “为什么 TutorAgent 不是最终回答模型，Task 5 接入产品 composition 后也还不能声称真实模型验收完成？”
- “为什么明确教学指令保持 zero-call，只有隐含、上下文或冲突意图才调用 candidate？”
- “为什么 candidate 先预检预算，而共享 runtime 仍要做唯一权威 reservation？”
- “为什么 Tutor 使用独立预算，而不能复用 Router -> Verifier 的共享预算？”
- “为什么 Organizer package candidate 完成后，owner snapshot、Trace admission 和写事务仍不能省略？”
- “owner snapshot、事务外双 fence 和写事务内第三次 fence 分别防什么？”
- “为什么 canonical deck 扫描超过有界窗口时必须 stale，而不是冒险创建？”
- “为什么 model-influenced write 必须先持久化 command_pending Trace，final Trace 失败又不能回滚已授权业务写入？”
- “为什么 Organizer batch 只返回一个 request-level runtime，而不是给每道错题附带模型细节？”
- “为什么 `/error-book` 必须让安全回退优先于语义整理显示？”
- “为什么 Task 9 的 Tutor orchestration P95 不是 Router/API/最终流式 Chat 产品 P95？”
- “为什么 synthetic Live executor 即使满分也不能通过 production gate？”
- “为什么 held-out/metamorphic 测试只能排除显式答案表，不能替代 controlled-Live？”
- “为什么 deck/question reorder 必须按本地 ID authority 重映射，而不能记住固定 ordinal？”
- “为什么应用层已有 worker-off，Compose 仍必须做 service allowlist？”
- “为什么 `--env-file .env` 不等于把整份 env 注入每个容器？”
- “为什么 `config --quiet` 通过仍不能声称 Docker/真实模型验收完成？”
- “为什么 R3 的 `connection_refused` 与无监听 loopback 高度相关，仍不能写成唯一根因？”
- “为什么 proxy preflight 必须在 credential、marker 和 reservation 之前，而且 ready 仍不等于 Provider health？”
- “为什么核心 runner 必须自己强制 250ms watchdog，而不能只相信 listener probe 的 timeout 参数？”
- “为什么现有 Qwen hybrid search 可用，RetrieverAgent 仍需要正式 contract 与 canonical principal？”
- “为什么 original-query Recall@5=1 仍不能证明 query rewrite uplift、真实 Qwen 或产品质量门通过？”
- “为什么 owner 不进入 Retriever search body，opaque port 仍要绑定 exact execution context？”
- “为什么 FinalResponse model 看不到真实 documentId/chunkId，citation event 必须由本地 renderer 生成？”
- “为什么同步 stream 当前不写 Outbox，未来异步化时又必须把 BackgroundJob/Outbox 一起设计？”
- “为什么 Task 9C 的 runner response=0 不能直接证明 Provider response=0？”
- “为什么 bounded diagnostic 需要覆盖 Qwen、rewrite、FinalResponse 三条链路，而且不能保存 raw hash？”
- “为什么第一条畸形 FinalResponse stream event 是 response observed，而不是 response missing？”
- “为什么 R2 的本地 mapper 通过后仍须 R3 runner/validator 才能形成 durability 与数值 authority？”
- “为什么三类 runner observation 必须由各模块私有签发，而不能使用共享可调用 issuer？”
- “为什么 `run_terminal` 后崩溃只恢复 publication，仍不能继续任何 Provider call？”

V2 R7、V3 R5、V4 R6、V5 R6、V6 R5、V7 R4、V8 R5 与 V9 R5 均已失败封存，各自一次性授权已经消费且不得重跑。V8 fixed-shape 已通过真实 Provider static schema，但本地 dynamic authority 仍失败；V9 本地合法 option selection 与 reviewed Mock 工程合同已完成，但唯一 Live 在首个 pair 的 response 前 transport/sibling abort 终止，不能形成真实模型或产品可用性结论。后续独立 Architecture/Schema Recovery 已按自身 lineage 完成 SR5 semantic gate、SR6 分支产品验收与 SR7 main/default-off 验收；它们不改写上述失败历史。Phase 6.9.8 Task 0--9B 工程地基已完成，唯一 Task 9C run `28b5f92f...` 又以 `task9_quality_gate_failed / qualityAuthority=none` 封存：第二条 DeepSeek rewrite 在 dispatch 后未满足本地 strict schema/contract，正式语义、P95 与完整费用 authority 均未形成。Task 9C 一次性授权已经消费且禁止重跑。独立 Architecture Recovery R0--R4 现已完成三链路/双 wire/no-raw/no-hash 设计、diagnostic robustness、runner/durability/admission 与 reviewed Mock/static；R4 仅形成 `architecture_recovery_mock_quality_not_evidence / qualityAuthority=none`。R4 的 Provider/credential/formal evidence 均为 0；其后唯一 R5 run `34eb99be...` 已以 `quality_gate_failed` 封存，产品/main、Phase 6.9.9/6.9.10/6.10、Phase 8/9 与博客收尾仍不得开始；不得补跑或追加 Provider 探测。

Architecture Recovery 是 V9 之后的新产品路线，不是 V9 retry 或 artifact recovery。R1 只建立未来 canary 可消费的 bounded in-memory transport subtype；它不能反向恢复 V9 raw error，也不解除产品验收与 main 阻断。R2 已用模块内 closed synthetic responder 关闭 canary contract、per-invocation 预算、no-secret artifact schema、取消竞态与 CLI fail-closed。R3 又把未来唯一真实 canary 的授权、专用凭据、source preflight、单次 durable reservation、wire terminal、不可重放 crash seal、独占发布和 validator 固定下来，但本 checkpoint 没有读取 credential 或执行 Live。R1--R3 的成功只能解释为工程合同通过，不能解释为 DeepSeek 或本机 Provider 出站健康。

### 2026-07-20 Phase 6.9.5 V12 host-wiring correction

V12's earlier fake default host has been replaced with a real default-off host
composition. It performs read-only preflight, reserves and writes V12-only
non-secret resource selectors before creating synthetic resources, and then
uses lineage-neutral V8 Docker/API/browser/Trace/default-off/cleanup
mechanics. `review_api_setup / not_started` preserves a recoverable terminal
when setup fails before provider dispatch. No V12 product/recovery CLI,
Docker, browser, API or provider operation has run; the two gates remain
`false`. Refreshed independent contract and operations reviews have no
unresolved P0/P1; fresh user authorization is still required before the
single V12 branch product command.

The V12 hardening pass adds attempt/checkpoint-bound failure evidence,
one-time recovered terminal semantics, `DATABASE_URL` fingerprint continuity,
owner-after-preflight revalidation, default-off recovery after a half-recorded
activation, and a 30-second headed-browser observation boundary. These are
offline controls, not product evidence.

### Phase 7 — 工程化增强

Phase 7.0 / 7.1 已完成知识库后台处理地基：

- 新增 `BackgroundJob` 数据模型和 `@repo/types/api/background-job` contract，用于记录后台任务状态、资源类型、资源 id、时间戳、错误摘要和脱敏 metadata。
- 新增 `GET /background-jobs` 与 `GET /background-jobs/:id`，均经过 `JwtAuthGuard`，按当前 `userId` 隔离读取账号级后台任务。
- 知识库文档处理从 controller 中拆出 `DocumentProcessingService`，inline 和 worker 共用同一套解析、分块、embedding、snapshot 校验和 chunk 写入逻辑。
- `KNOWLEDGE_PROCESSING_MODE=inline | queue` 控制文档处理模式；默认 `inline` 不投递 BullMQ，作为本地和降级 fallback。
- `KNOWLEDGE_PROCESSING_MODE=queue` 时，`POST /knowledge/documents/:id/process` 会创建 `BackgroundJob` 并投递 BullMQ；`SERVER_ROLE=api | worker | both` 用于拆分进程职责：`api` 只提供 HTTP、不消费队列，`worker` 只运行 application context 并消费队列，`both` 用于本地一体化开发。Redis 是 queue 处理链路的必需依赖。
- `PROCESSING` 中的资料禁止替换；worker 处理时持续校验 `status + storageKey + contentHash` 快照，快照变化时标记 `STALE_SKIPPED`，不写入旧 chunks。
- `/knowledge` 页面已展示后台处理状态；文档处于 `PROCESSING` 或本地刚触发处理时短轮询，静态 `PENDING` 不无限轮询。
- 队列 smoke 验证的是 RAG 上传、解析、分块、embedding 入库和后台任务可靠性，不替代 Chat live 模型回答质量验收。

### Phase 7.2 — RAG SafetyGuard（已完成）

- 用户上传资料被视为低信任证据，不再默认等同于可执行的系统、开发者或工具调用指令。
- `@repo/rag` 提供 deterministic chunk safety classifier，文档处理时把 `riskLevel`、`categories`、`matchedPatterns` 和 `safeForPrompt` 写入 `Chunk.metadata.safety`。
- `/knowledge/search` 返回 safety metadata；Chat RAG prompt assembly 会在模型调用前过滤高风险 chunk，中风险 chunk 仅作为可疑原文引用，安全 chunk 可回填 prompt 槽位。
- `KnowledgeVerifierAgent` 会把高风险或 `safeForPrompt=false` 的检索证据转成 `suspicious` guidance，明确要求不要执行检索片段中的指令。
- `/knowledge` 检索结果展示简短安全标记，但 SafetyGuard 不自动删除、隔离、重写或替换用户资料。
- fixed mock / e2e 覆盖了 prompt injection 样本；如果后续改动最终 Chat 输出体验，仍需按 `docs/ai-behavior-acceptance.md` 做 live smoke。
- 执行计划与实现背景见 `docs/superpowers/plans/2026-06-30-phase-7-rag-safety-guard.md`，学习博客见 `docs/blogs/phase-7-rag-safety-guard.md`。

### Phase 7.3 — Event Observability（已完成）

- `InProcessEventBus.publish()` 返回 `{ delivered, failed }`，单个 handler 抛错不会阻断后续 handler；失败会记录只含事件类型与计数的脱敏 warning，不打印完整 payload。
- `GET /background-jobs/summary` 已接入 `JwtAuthGuard`，按当前 `userId` 隔离，返回账号级 active count、最近 50 条任务窗口内的失败/跳过/成功摘要和 latest job。
- `/knowledge` 页面新增后台任务摘要提示：有 active job 时继续短轮询；没有处理中文档且没有 active job 时停止轮询，避免静态页面无限请求。
- Phase 7.3 仍不改变 Chat prompt、RAG citation 或真实模型调用链路，因此验收重点是 mock / 单元 / build / 浏览器工程链路，不要求 live 模型 smoke。
- 设计与执行计划见 `docs/superpowers/specs/2026-07-02-phase-7-3-event-observability-design.md` 和 `docs/superpowers/plans/2026-07-02-phase-7-3-event-observability.md`；面试复盘博客见 `docs/blogs/phase-7-event-observability.md`。

### Phase 7.4 — Swagger / OpenAPI debug docs（已完成）

- Phase 7.4 adds Swagger / OpenAPI debug docs，用于本地联调、接口发现和面试展示，不替代共享 contract。
- `/api-docs` 提供 Swagger UI，`/api-docs-json` 提供 OpenAPI JSON；两者默认在非 production 开启。
- production 默认关闭 Swagger；只有显式 `SWAGGER_ENABLED=true` 时才暴露，且只适合受控环境、内网或临时诊断。
- 接入 Swagger 不放宽 `JwtAuthGuard`，受保护接口仍按现有登录态、access token 和服务端 userId 隔离规则执行。
- `@repo/types` Zod schemas remain source of truth；Swagger 是调试/展示层，不反向驱动前端 contract 或替代前后端共享 schema。
- Swagger 文档说明全局 response envelope：成功响应为 `{ success, data, requestId }`，错误响应为 `{ success, error, requestId }`，避免读者误以为 Controller 直接返回裸业务对象。
- 本阶段不改 Chat prompt、RAG prompt、模型路由或流式输出，因此不需要 live 模型 smoke；验收重点是 OpenAPI JSON 可生成、核心 tags 可发现、文档不泄露敏感内容。
- 设计背景见 `docs/superpowers/specs/2026-07-02-phase-7-4-openapi-docs-design.md`；面试学习博客见 `docs/blogs/phase-7-openapi-docs.md`。

### Phase 7.5 — OpenAPI 中文说明与 request body 示例（已完成）

- 为核心写接口补充中文 `summary`、`description` 和成功响应说明，方便本地调试和面试讲解。
- 为 `POST /auth/register`、`POST /auth/login`、`POST /knowledge/documents/:id/process`、`POST /knowledge/search`、`POST /review-tasks/:taskId/rating`、`POST /agent-traces` 补充 JSON request body 示例。
- 为 `POST /knowledge/documents` 和 `PUT /knowledge/documents/:id/file` 补充 `multipart/form-data` 与 `file` 字段说明。
- 示例只使用安全占位值，不写入真实 token、cookie、API key、完整 prompt、完整回答、完整 RAG chunk 或真实用户内容。
- `@repo/types` Zod schemas 仍是字段约束与运行时校验的事实源；Swagger 示例只是展示层，不反向驱动前端 contract。
- 验收重点是 OpenAPI JSON 中 request body 可发现、multipart 上传结构可见、敏感示例继续被测试拦截。
- 设计背景见 `docs/superpowers/specs/2026-07-02-phase-7-5-openapi-request-bodies-design.md`；执行计划见 `docs/superpowers/plans/2026-07-02-phase-7-5-openapi-request-bodies.md`。

### Phase 7.6 — API / worker 启动拆分（已完成）

- `main.ts` 已收敛为 `bootstrapServer()`，启动角色判断进入可测试 helper。
- `SERVER_ROLE=api` 创建 Nest HTTP app，提供 REST API、`/health` 和 Swagger，不注册 BullMQ worker processor。
- `SERVER_ROLE=worker` 使用 `NestFactory.createApplicationContext(AppModule)`，只初始化模块和 worker processor，不调用 `listen()`，不占用 HTTP 端口。
- `SERVER_ROLE=both` 保留本地一体化开发模式，同进程提供 HTTP 和 worker。
- Docker Compose 新增 `worker` profile；默认开发仍可使用 `both + inline`，拆分验证时使用 server `api + queue` 搭配 worker service。
- worker-only 第一版没有 HTTP `/health`，健康判断依赖进程存活、日志、BullMQ 和 BackgroundJob 状态；后续如果容器编排需要 readiness，再补 CLI health check 或 metrics。
- 本阶段不改 Chat prompt、RAG prompt、模型路由或真实模型调用链路，因此不需要 live 模型 smoke。
- 设计背景见 `docs/superpowers/specs/phase-7-worker-split-design.md`；执行计划见 `docs/superpowers/plans/phase-7-worker-split.md`；学习博客见 `docs/blogs/phase-7-worker-split.md`。

### Phase 7.7 — Worker Observability（已完成）

- 新增 `@repo/types/api/worker-observability` contract，统一描述 server role、processing mode、queue counts、worker heartbeat、BackgroundJob summary 和综合健康信号。
- 新增 `WorkerHeartbeatService`：仅 `SERVER_ROLE=worker | both` 写 Redis 短 TTL heartbeat，复用 BullMQ Redis 连接。
- 新增 `GET /worker-observability/summary`，经过 `JwtAuthGuard` 且受 `WORKER_OBSERVABILITY_ENABLED` 控制；默认非 production 开启、production 关闭。
- summary 聚合系统级 BullMQ `knowledge-document-processing` queue counts、worker heartbeat 和当前账号 BackgroundJob summary；三者语义互补，不互相替代。
- `/knowledge` 页面新增健康状态条，展示 worker 在线、等待/处理中/失败数量和 `healthy / degraded / attention / idle` 提示；当 summary 自身仍有队列活动、active job 或异常信号时继续短轮询，避免状态陈旧。
- heartbeat 只保存不含 hostname / pid 的 opaque worker id、role、队列名、startedAt 和 lastSeenAt，不保存文件内容、prompt、RAG chunk、API key、token 或用户输入。
- 本阶段不改 Chat prompt、RAG prompt、模型路由或真实模型调用链路，因此不需要 live 模型 smoke。
- 设计背景见 `docs/superpowers/specs/phase-7-worker-observability-design.md`；执行计划见 `docs/superpowers/plans/phase-7-worker-observability.md`；学习博客见 `docs/blogs/phase-7-worker-observability.md`。

### Phase 7.8 — RAG Eval / Hybrid Retrieval / Smoke

- Phase 7.8.1 新增固定 RAG 检索评估集和纯函数 runner，用 `recall@k`、`top1Accuracy`、`safetyPassRate`、`noHitPassRate` 衡量检索质量。
- Phase 7.8.2 将 `/knowledge/search` 升级为 Hybrid Retrieval：向量候选 + PostgreSQL full-text keyword 候选，按 chunk 去重后融合排序。
- Phase 7.8.3 新增 `bun --filter @repo/server smoke:rag-eval`，串联注册、上传合成 TXT、处理、轮询、检索和 eval。
- Phase 7.8.4 增加必需 case id guard，避免评估集改名或缺失时误报 PASS；新增 `RAG_EVAL_SMOKE_KEEP_DATA=true`，便于本地保留合成资料到 `/knowledge` 页面复查。
- Phase 7.8.5 完成 RAG runtime parity 实施：当前真实路径统一为 Qwen `text-embedding-v4` / 1536；production provider/model 显式且 provider-aware fail-closed，Qwen 要求无凭据 HTTPS base URL 与规范 `QWEN_API_KEY`，无 provider fallback；Docker server/worker 共用 RAG allowlist，宿主 key 别名仅作兼容输入并在容器内规范化。
- Phase 7.8.5 同步加固 queue smoke：必须显式 `KNOWLEDGE_PROCESSING_MODE=queue`，轮询 `BackgroundJob=SUCCEEDED`，验证 `keywordScore` / `vectorScore`、`mode=hybrid` 与无重复 `chunkId`。真实 Docker 验收使用 Qwen `text-embedding-v4` / 1536 通过 3/3，`BackgroundJob=SUCCEEDED`，缺 provider/key/base URL 的启动检查均在 provider 调用前 fail-closed；证据见 `docs/acceptance/2026-07-14-rag-runtime-parity.md`。
- fake eval 只能证明工程回归，不证明真实语义质量。当前检索为 pgvector cosine + PostgreSQL full-text 两路候选、`chunkId` 去重 hybrid rank，无 reranker。
- 设计与执行计划见 `docs/superpowers/plans/phase-7-8-rag-eval-baseline.md`、`docs/superpowers/plans/phase-7-8-hybrid-retrieval.md`、`docs/superpowers/plans/phase-7-8-rag-eval-smoke.md`、`docs/superpowers/plans/phase-7-8-4-rag-eval-hardening.md`；面试博客见 `docs/blogs/rag-eval-and-hybrid-retrieval.md`。

### Phase 7.9 — Durable Outbox / Dispatcher / Metrics（已完成）

- Phase 7.9.1 新增 `OutboxEvent`、`OutboxService` 和 enqueue / claim / success / retry / dead-letter 状态机，用于持久化内部事件的脱敏 metadata、payload hash、幂等键、attempts 和锁定信息。
- Phase 7.9.2 新增 `OutboxDispatcherService` 和显式 handler registry，先注册 `knowledge.document.processing.requested`，并在 BullMQ enqueue 成功后 best-effort 写入 requested outbox event。
- Phase 7.9.3 新增 `OutboxDispatcherRunnerService`，只在 `SERVER_ROLE=worker | both` 且 `OUTBOX_DISPATCHER_ENABLED=true` 时受控运行；production 默认关闭，避免未经确认消费历史事件。
- Phase 7.9.4 新增 `OutboxMetricsService`，读取系统级状态计数、backlog、最老 pending 年龄和最近错误摘要，并接入 `/worker-observability/summary`。
- Durable Outbox 不替换 BullMQ、BackgroundJob 或 in-process EventBus；payload 和 lastError 只能保存安全元数据或脱敏错误摘要。
- 设计与执行计划见 `docs/superpowers/plans/phase-7-9-durable-outbox.md`、`docs/superpowers/plans/phase-7-9-outbox-dispatcher.md`、`docs/superpowers/plans/phase-7-9-outbox-dispatcher-runner.md`、`docs/superpowers/plans/phase-7-9-outbox-summary-metrics.md`；面试博客见 `docs/blogs/durable-outbox-worker-observability.md`。

### Phase 7.10 — Outbox Ops（已完成）

- 新增 `@repo/types/api/outbox` contract，统一 outbox 列表、详情和 requeue 请求/响应 schema。
- 新增 `OUTBOX_OPS_ENABLED`，默认非 production 开启、production 关闭；关闭时通过 feature gate 在认证前返回 404。
- 新增 `GET /outbox-events`、`GET /outbox-events/:id` 和 `POST /outbox-events/:id/requeue`，接口经过 feature gate、`JwtAuthGuard` 和后续 OperatorGuard 保护。
- 列表和详情只返回脱敏 DTO，不返回 payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token 或 cookie。
- requeue 使用条件 `updateMany` 做 compare-and-swap，只允许 `FAILED / DEAD -> PENDING`，不直接执行 handler，不支持删除、强制成功、跳过、payload 编辑或直接 dispatch。
- 设计与执行计划见 `docs/superpowers/specs/phase-7-10-outbox-ops-design.md` 和 `docs/superpowers/plans/phase-7-10-outbox-ops.md`。

### Phase 7.11 — Worker Readiness（已完成）

- 新增 `@repo/types/api/worker-readiness` contract，定义 `ready / degraded / not_ready`、Redis / BullMQ / heartbeat / outbox 检查项和 issues。
- 新增 `GET /worker-readiness`，默认非 production 开启、production 关闭；HTTP 入口受 feature gate、`JwtAuthGuard` 和后续 OperatorGuard 保护。
- 新增 `bun --filter @repo/server readiness:worker` CLI，使用最小只读 Nest module，不导入 `AppModule`，不启动 HTTP API、worker processor、heartbeat 或 outbox dispatcher。
- CLI 退出码语义：ready 为 `0`，degraded / not ready 为 `1`，异常、配置错误或超时为 `2`。
- Readiness 和 `/health`、`/worker-observability/summary` 分工不同：`/health` 是 API liveness，observability 是开发者诊断面，readiness 是机器友好的部署前结论。
- 设计与执行计划见 `docs/superpowers/specs/phase-7-11-worker-readiness-design.md` 和 `docs/superpowers/plans/phase-7-11-worker-readiness.md`；面试博客见 `docs/blogs/worker-readiness-deployment-checks.md`。

### Phase 7.12 — Docker Worker Healthcheck（已完成）

- `docker/docker-compose.dev.yml` 的 `worker` service 新增 healthcheck，容器内执行 `bun apps/server/dist/scripts/worker-readiness.js`。
- `worker` service 新增 `WORKER_READINESS_CLI_TIMEOUT_MS`，并配置 healthcheck interval、timeout、retries 和 start_period。
- 新增 docker compose readiness 回归测试，确保 worker service 必须配置 readiness healthcheck。
- 修复 server Dockerfile 的 Bun workspace runtime 布局，保留根 `node_modules`、`apps/server/node_modules` 和 `packages`，避免容器内解析内部 `@repo/*` 失败。
- 本阶段只接入本地 Docker Compose worker healthcheck，不引入 Kubernetes readiness probe、Prometheus 指标或生产部署平台配置。

### Phase 7.13 — Docker Web / Full Stack Compose（已完成）

- `docker/Dockerfile.web` 从旧 pnpm 写法迁移到 Bun workspace，使用完整 workspace manifests、`bun install --frozen-lockfile` 和 `bun --filter @repo/web build`。
- `apps/web/next.config.ts` 开启 `output: 'standalone'` 并设置 monorepo tracing root，保证 Docker runner 能复制 Next standalone 产物。
- Compose dev 栈可拉起 `postgres / redis / minio / server / worker / web`，并完成浏览器注册到 `/chat` 的全栈验收。
- Compose dev 额外设置 `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true` 与 `AI_DEV_MODE_SWITCH_ENABLED=true`，让本地 Docker Web 容器也能展示 mock / live 开关；该能力不得用于生产部署。
- 本阶段是本地 Docker Compose 全栈验收，不引入 Kubernetes、生产域名、TLS、CI 镜像推送或云部署。

### Phase 7.14 — Operator 权限与操作审计（已完成到 7.14.6）

- Phase 7.14.1 完成 operator 权限与操作审计设计文档，明确诊断写操作需要权限、审计、脱敏和受控查询边界。
- Phase 7.14.2 新增 `OperatorGuard`，把 Outbox Ops、Worker Observability 和 HTTP Worker Readiness 升级为 admin/operator-only；guard 顺序统一为 feature gate -> JWT -> Operator。
- Phase 7.14.3 新增 `OperatorAuditLog`、`OperatorAuditService` 和 `OperatorAuditModule`，审计记录只保存 actor、action、status、target、reason、requestId、IP/User-Agent hash、错误 code 和脱敏错误预览。
- Phase 7.14.4 把 `POST /outbox-events/:id/requeue` 接入 `OUTBOX_REQUEUE` 成功/失败审计；审计写入失败只记录脱敏 warning，不影响 requeue 主操作。
- Phase 7.14.5 新增 `GET /operator-audit-logs` admin-only 脱敏查询 API，并新增 `OPERATOR_AUDIT_ENABLED`，默认非 production 开启、production 关闭。
- Phase 7.14.6 新增前端页面 `/operator-audit`；管理员侧边栏显示“审计”入口，可按 action、status、targetType、targetId、actorUserId 筛选脱敏审计记录，普通用户不显示入口且页面不会主动请求审计 API。
- Operator Audit 不返回 `metadata`、payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、access token、refresh token、cookie、原始 IP 或原始 User-Agent。
- 设计与执行计划见 `docs/superpowers/specs/phase-7-14-operator-access-audit-design.md` 和 `docs/superpowers/plans/phase-7-14-operator-audit-query.md`。

### Phase 7.15 — Operator Audit 真实运行验收与本地诊断收口（已完成）

- 本地 Docker dev compose 显式开启 `OUTBOX_OPS_ENABLED`、`OPERATOR_AUDIT_ENABLED`、`WORKER_READINESS_ENABLED` 和 `WORKER_OBSERVABILITY_ENABLED`，避免 server 镜像 `NODE_ENV=production` 时本地诊断入口被默认隐藏为 404。
- `apps/web/next.config.ts` 允许 `127.0.0.1` 作为 Next dev origin，修复按本地文档访问 `127.0.0.1:3000` 时 SSR 页面可见但 React 事件未 hydration 的问题。
- 通过真实测试账号完成前后端验收：普通用户不显示“审计”入口，直达 `/operator-audit` 只显示无权限且不请求审计 API；管理员侧边栏显示“审计”，进入页面后可读取脱敏审计列表。
- 通过真实 `POST /outbox-events/:id/requeue` 写入 `OUTBOX_REQUEUE / SUCCEEDED` 审计记录，并在 `/operator-audit` 最近记录中展示 target、reason、requestId、IP/User-Agent hash 等脱敏字段。
- 本阶段不新增审计详情、导出、保留周期、批量操作或更细 operator role；后续继续评估 Operator Audit 产品化边界。

### Phase 7.16 — 桌面端 Admin Console 第一版（已完成）

- 新增独立 Next.js workspace `@repo/admin`，默认端口 `3100`，根命令 `bun run dev:admin` 等价于 `bun --filter @repo/admin dev`。
- 管理员后台第一版包含 `Outbox Ops`、`操作审计` 和 `Worker Readiness` 三个页面，复用既有后端 admin-only API：`/outbox-events`、`/operator-audit-logs`、`/worker-readiness`。
- `Outbox Ops` 支持状态/类型筛选、脱敏详情、错误处理建议、操作原因和显式确认后 requeue；遇到 unknown handler 类错误时提示先修代码，不鼓励盲目重试。
- 学习端保留移动端 `/operator-audit`；ADMIN 用户侧边栏新增“后台管理”入口，移动端和桌面端都会显示，默认跳到 `http://127.0.0.1:3100`，普通用户不可见；后台应用当前仍是桌面优先布局。
- 本阶段不新增独立 Docker `admin` service、不新增后端权限模型、不做批量 requeue / 删除 / payload 编辑；后端 `JwtAuthGuard + OperatorGuard` 仍是真正安全边界。
- 设计与执行计划见 `docs/superpowers/plans/phase-7-16-admin-console.md`；启动命令见 `docs/dev-start.md` 的“管理员后台（桌面端）启动命令”。

### Phase 7.17 — Docker Admin Console Service（已完成）

- 新增 `docker/Dockerfile.admin`，使用 Bun workspace + Next standalone 构建 `@repo/admin`，运行端口固定为 `3100`。
- `docker/docker-compose.dev.yml` 新增 `admin` service；本地完整栈可用 `docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin` 一次性启动。
- Docker `web` service 新增 `NEXT_PUBLIC_ADMIN_CONSOLE_URL=http://127.0.0.1:3100`，学习端 ADMIN 侧边栏“后台管理”默认跳转到 Docker 管理员后台。
- Docker `server` CORS 默认允许 `http://localhost:3100` 与 `http://127.0.0.1:3100`，避免管理员后台能加载但浏览器 API 被 CORS 拦截。
- 修复 `Dockerfile.web` 和 `Dockerfile.server` 的 Bun workspace manifest 契约：根 workspace 是 `apps/*`，因此 web/server 镜像依赖层也必须复制 `apps/admin/package.json`，否则 `bun install --frozen-lockfile` 会认为 lockfile 需要变化。
- 完成 Docker 全栈验收：`web` 暴露 `3000`、`admin` 暴露 `3100`、`server` 暴露 `3001`、`worker` healthcheck 为 healthy；浏览器验证学习端、管理员后台、Outbox Ops、操作审计、Worker Readiness 和普通用户 403 拦截。
- 本阶段不新增新后台页面、不新增后端权限模型、不做生产域名/TLS/反向代理；管理员后台仍是体验层，真正安全边界仍是后端 `JwtAuthGuard + OperatorGuard`。
- 设计文档见 `docs/superpowers/specs/phase-7-17-admin-docker-design.md`；执行计划见 `docs/superpowers/plans/phase-7-17-admin-docker.md`；启动命令见 `docs/dev-start.md`。

### Phase 7.17.1 — 管理员后台返回学习端登录态修复（已完成）

- 修复管理员后台“返回学习端”硬编码 `127.0.0.1:3000` 导致的本机 loopback host 混用问题。
- 后台返回学习端时默认跟随当前 hostname：`localhost:3100` 回到 `localhost:3000`，`127.0.0.1:3100` 回到 `127.0.0.1:3000`；仍支持 `NEXT_PUBLIC_LEARNING_APP_URL` 显式覆盖。
- 学习端和管理员后台的浏览器 API base 在本机 `localhost` / `127.0.0.1` 场景下自动对齐当前 hostname，减少 refresh cookie / session recovery 因 host 不一致而失败。
- 补充回归测试和 `docs/dev-start.md` 排障说明，明确这类问题通常不是后端鉴权失效，而是本机浏览器 host 不一致导致登录态恢复不稳定。
- 本阶段不改变后端鉴权模型、不改变 cookie 策略、不放宽 CORS 或 `OperatorGuard`。

### Phase 7.18 — Admin Outbox Ops 产品化（已完成）

- `/outbox` 详情视图按生命周期、事件身份、诊断建议、重新入队操作和后续验证分区，让管理员先理解事件状态和失败原因，再决定是否操作。
- requeue 文案明确它只做 `FAILED / DEAD -> PENDING` 状态流转，不立即执行 handler，不改写事件数据，也不改写事件结果。
- handler missing、invalid payload、依赖超时和未知错误会给出不同操作建议，避免把所有失败都误当成“重试一下”。
- 页面继续只展示脱敏 DTO 和 `payloadHash`，不展示完整 payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token 或 cookie。
- 页面不提供批量 requeue、删除事件、跳过事件、立即 dispatch 或 payload 修改等高风险入口；真正安全边界仍由后端 feature gate、`JwtAuthGuard`、`OperatorGuard` 和 operator audit 保证。
- requeue 成功后会刷新 outbox、audit 和 worker readiness 查询缓存，后续验证入口直接跳到 `/worker` 与 `/audit`。
- 浏览器验收覆盖 Redis timeout 型失败事件重新入队、审计记录写入、Worker Readiness 恢复为 `Ready`，并清理验收测试数据。

### Phase 7.19 — Admin Console 控制台数据化（已完成）

- `/` 管理员控制台从静态入口页升级为真实运维总览，读取 `GET /worker-readiness`、`GET /outbox-events` 和 `GET /operator-audit-logs`。
- 控制台展示 Worker readiness、FAILED / DEAD Outbox 数量、最近 requeue 审计数量和综合关注项，按 `healthy / attention / danger / read error` 语义生成顶部状态。
- 最近关注区按风险优先提示 DEAD / FAILED 事件、readiness issue 和最近审计结果，入口继续跳到 `/outbox`、`/worker`、`/audit` 详情页。
- 控制台数据读取失败时明确提示检查后端服务、诊断开关和管理员权限，不使用假数据兜底。
- 后台壳层保持固定侧边栏 + 独立工作区滚动；主工作区隐藏粗原生滚动条，Outbox 列表和详情仍保持独立滚动。
- 本阶段不新增后端 API、不放宽 `JwtAuthGuard + OperatorGuard`、不暴露 payload 或敏感元数据，也不新增批量 requeue 等高风险操作。
- 面试学习博客见 `docs/blogs/admin-console-ops-platform.md`。

### Phase 7.20 — Operator Audit 详情闭环（已完成）

- 新增 `operatorAuditLogDetailResponseSchema` 与 `GET /operator-audit-logs/:id`，复用脱敏审计 DTO，只返回单条审计上下文，不返回 `metadata`、payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token、cookie、原始 IP 或原始 User-Agent。
- `OperatorAuditService.getDetail()` 使用显式 `select` 排除 `metadata`，不存在时返回 `OPERATOR_AUDIT_LOG_NOT_FOUND`。
- Admin Console `/audit` 从纯列表升级为列表 + 详情双栏；点击审计记录后右侧展示操作上下文、目标对象、来源指纹和错误摘要。
- 审计详情面板保留独立滚动，列表选中态使用 `aria-pressed` 和左侧强调条，避免只靠颜色识别。
- 本阶段不新增审计导出、保留周期配置、更细 operator role、批量操作或敏感原始字段展示；真正安全边界仍是后端 feature gate、`JwtAuthGuard` 和 `OperatorGuard`。
- `docs/blogs/admin-console-ops-platform.md` 已补充“审计详情为什么重要”。

### Phase 7.21 — Admin Ops 交互收口（已完成）

- 新增 `AdminFilterSelect`，在 Admin Console `/outbox` 与 `/audit` 替代浏览器原生 `select`，避免系统蓝色高亮、粗边框和割裂的下拉体验。
- 自定义筛选控件保留 `role="combobox"`、`role="listbox"`、`role="option"`、label 关联、`aria-selected`、`aria-activedescendant`、上下键切换和可滚动列表，不把审美优化做成不可访问的假控件。
- `/outbox` requeue 前端操作从“原因可选 + 确认”收紧为“原因必填 + 显式确认”，并在切换事件或筛选条件时清空 reason，减少管理员事后无法复盘为什么重试或 reason 跨事件残留的风险。
- 继续保持边界：不新增后端 API、不新增批量 requeue、不允许删除 / 跳过 / 立即 dispatch / payload 编辑；真正安全边界仍是后端 feature gate、`JwtAuthGuard`、`OperatorGuard` 和服务层状态机。
- 补充静态 contract test，防止 `/outbox` 和 `/audit` 回退到原生 `<select>`，并防止 requeue 操作绕过 reason guard。

### Phase 7.22 — Docker Admin Ops 真实验收收口（已完成）

- 使用 Docker Compose dev 全栈验收 `postgres / redis / minio / server / worker / web / admin`，真实访问 `http://127.0.0.1:3100` 管理员后台和 `http://127.0.0.1:3001` API。
- 通过真实 ADMIN 账号完成 `/outbox -> requeue -> /audit -> /worker` 闭环：确认自定义筛选控件未回退原生 `<select>`、requeue 必须填写 reason 并勾选确认、审计记录可查看详情、worker readiness 能反映并恢复 outbox backlog。
- 使用临时普通账号验证 admin-only 后端边界：携带普通用户 token 访问 `GET /outbox-events?status=FAILED` 返回 `403`，说明安全边界不依赖前端隐藏入口。
- 验收后清理临时 OutboxEvent、OperatorAuditLog、RefreshToken 和测试账号，容器内 `worker-readiness` CLI 恢复 `ready`，避免测试数据长期污染本地环境。
- 新增 Admin Console `favicon.svg` 和 `metadata.icons`，减少后台浏览器调试时的 favicon 404 噪声。

### Phase 7.23 — Operator Audit 保留周期与证据包导出（已完成）

- Phase 7.23.1 已完成正式设计：`docs/superpowers/specs/phase-7-23-operator-audit-retention-export-design.md`。
- Phase 7.23.2 ~ 7.23.8 已按 `docs/superpowers/plans/phase-7-23-operator-audit-retention-export.md` 完成 contract/schema、事务投递、fenced ZIP Worker、retention maintenance、查询下载 API、Admin UI 与 Docker 真实验收。
- 默认保留 `OperatorAuditLog` 180 天；证据包定位为事故排障交接，最多覆盖 31 天和 50,000 条脱敏记录。
- Phase 7.23.2 已固定 strict contract，以及 `OperatorAuditExport` / maintenance schema；safe DTO 严格排除 object key、request hash、processing token、payload 与 metadata。requester 删除时 `requestedByUserId` 置空，export 与唯一 `backgroundJobId` 保留。
- `BackgroundJob` 通过数据库 CHECK 区分 ACCOUNT/SYSTEM：ACCOUNT 继续随 user 级联删除，SYSTEM 必须 `userId=null` 并独立存活；账号 service 所有 create/find/count/update/list/summary，以及知识库 direct count/create/find/failure-update 路径，都显式限制 `scope=ACCOUNT`。
- 为什么 / 怎么做：导出执行跨越请求人生命周期，所以先用 FK/CHECK/唯一索引固定事实所有权，再用 strict contract 固定安全边界；contract、env/service 和真实 PostgreSQL e2e 分别执行 RED/GREEN。
- 配置已固定 180 天、24 小时、31 天、50,000 条、64 MiB、配额/并发/lease/lock/stale/query timeout 默认值及相对约束；export 与 maintenance 在所有环境默认关闭，production 显式开启 Operator Audit、Outbox Ops 或 audit export 任一路径都必须提供 trim 后至少 32 字符的 fingerprint secret。Phase 7.23.3 已使用该 secret 把来源指纹升级为 HMAC，不保存 secret 或原始 IP/User-Agent。
- Phase 7.23.3 让 `POST /operator-audit-exports` 的 PostgreSQL commit 成为 202 成功边界：Serializable 事务先取得 retention/quota advisory locks 与 database clock，校验 range/retention/future/idempotency/quota，再原子写入 Export、SYSTEM BackgroundJob、OutboxEvent 与 strict `AUDIT_EXPORT_REQUEST`。首条 lock 等待会固定 Serializable snapshot，因此对 P2034/raw 40001/明确 export 幂等复合 P2002 做最多 5 次 whole-transaction retry，每次重新取锁/DB clock且不产生事务外副作用。
- API request path 不直接调用 BullMQ；Outbox Dispatcher 是唯一 Redis bridge。`operator.audit.export.requested` payload 只有 export/job id，handler 复核 linked SYSTEM facts、用 BackgroundJob id 作为 Bull job id，并把 Redis 失败交回既有 retry/dead-letter 状态机。
- Dispatcher 状态采用白名单：FAILED/EXPIRED 终态 no-op，PROCESSING/READY + ACTIVE/SUCCEEDED 视为已投递，只有 QUEUED+QUEUED 可投递，其余组合按 invalid payload 失败。
- 申请审计 fail-closed/strict；既有 Outbox requeue audit 仍 best-effort。DEAD 在 24 小时设计恢复窗口内可经既有受审计 requeue 恢复，知识库 queue-first + best-effort observer 边界不变。
- controller 将 shared Zod 失败转换为安全领域 400，将 strict request-audit 失败转换为回滚后的安全领域 503；Swagger 显式描述 strict body 并禁止 additional properties。真实 PostgreSQL 并发 e2e 通过 blocker lock + `pg_locks/pg_stat_activity` 条件轮询覆盖同 hash、不同请求与 quota 最后一槽，实际捕获 P2034 后均满足事实计数与配额。
- Phase 7.23.4 新增只在 `worker|both` 且 export、Outbox Dispatcher、maintenance 三个 gate 全部显式开启时注册的 processor。本地 concurrency 固定为 1，Worker 以 `autorun=false` 注册，bootstrap 先设置 BullMQ queue global concurrency=1 再启动消费，因此多副本也不能突破单并发。状态仓库用 database clock、processing token、lease renewal 和双表事务 CAS 同步 Export/SYSTEM BackgroundJob；live lease 或失败状态 CAS 结果不确定时使用 `moveToDelayed + DelayedError`，真实 BullMQ 5.79.2/Redis 验证 delayed 不增加失败 attempt。
- 归档在只读 REPEATABLE READ 快照内先 count、再按 `(createdAt,id)` 每页 1,000 条流式读取，pre-count/stream 同时限制 50,000 条且 select 显式排除 metadata。CSV 固定 13 列、UTF-8 BOM/CRLF，secret sanitizer 后先检测公式前缀再清控制字符；ZIP 只包含 `records.csv/manifest.json` 并保存 CSV / archive SHA-256。
- MinIO key 使用 `operator-audit-exports/<exportId>/attempts/<processingToken>.zip`；只有当前 token 的数据库 CAS 能选择 object key。`markReady` commit 后 ACK 丢失时会用 Export + SYSTEM BackgroundJob 双事实 reconciliation：已选择同 key 则保留并成功，明确未选择才删除；结果不确定时保留对象并 delayed，未选 orphan 留给 Phase 7.23.5 维护回收。`0700/0600` 仅在 POSIX/Linux 容器形成权限保证，Windows 本地沿用 temp ACL；`expiresAt` 固定为 ready 后 24 小时，但到期对象自动删除仍属于 Phase 7.23.5。
- 导出申请和下载采用 fail-closed audit；CSV 必须防 formula injection，下载不暴露 MinIO object key。
- 维护任务使用活跃导出水位保护临近 180 天边界的数据，并分批清理到期对象、历史审计和导出元数据。
- Phase 7.23.6 已提供系统级 ADMIN list/detail 与 `POST /operator-audit-exports/:id/download`：列表使用 `(createdAt,id)` 稳定游标与每响应一次 DB clock，DTO 通过显式 mapper + strict schema 排除存储/fencing/internal 字段；下载使用服务端安全文件名、`no-store, private`、长度与 SHA-256 headers，Nest `StreamableFile` 绕过全局 JSON envelope。DB archiveSize 必须为正数且不超过配置上限，打开对象流后还必须与 MinIO stat size 完全一致；size mismatch 或 strict audit 失败都先销毁流，confirmed missing 才 CAS 为 `FAILED/EXPORT_FILE_MISSING`。相关异常只写固定安全 warning。成功下载审计只表示服务端已授权并准备流，不保证浏览器持久化全部字节。
- Phase 7.23.7 将 Admin Console `/audit` 升级为可键盘操作的“审计记录 / 证据包”tabs，共享 filters 作为申请默认条件；网络/5xx 仅在完整表单未变化时复用 `clientRequestId`，只对 QUEUED/PROCESSING 轮询，READY 且 `canDownload` 才提供 authenticated Blob 下载与 hash 复制。
- Headless Chromium 在 1440×900 与 1024×768 确定性模拟 QUEUED→PROCESSING→READY，覆盖 tabs 键盘、错误关联、固定轨道、零 console/page error 与横向溢出；不冒充真实后端验收。
- Phase 7.23.8 将 Compose server 默认角色收口为 `api`，独立 worker 独占 Dispatcher/export/maintenance processor；镜像用户与 192 MiB `0700` tmpfs 对齐为 `1001:1001`。确定性 smoke 真实覆盖 ADMIN/STUDENT 权限、申请→READY→ZIP 下载、CSV/manifest/hash、REQUEST/DOWNLOAD 审计、过期 410、维护删除与精确 cleanup；Docker 浏览器路线同时覆盖 Admin UI 和普通用户拦截。
- 真实验收发现并修复 Compose 重复 processor 风险、`minio-init` shell 参数被 Compose 拆分、worker/tmpfs UID/GID 不一致、smoke 遗漏 BullMQ `prepmind` prefix，以及 Outbox Ops e2e 的过期权限 fixture。离线 `minio/mc` 兼容镜像只用于本机断网验收，未提交且不属于生产方案。
- 当前边界：production gates 仍关闭；不提供 presigned URL、legal hold、WORM、数字签名/不可抵赖或法律级数据库快照。SHA-256 只做完整性校验，来源指纹仍是关联数据。运行手册与验收清单见 `docs/dev-start.md`、`docs/acceptance-checklist.md`，面试复盘见 `docs/blogs/operator-audit-retention-export.md`。
- Phase 7.23.5 已实现每小时 strict maintenance scheduler/processor：processor 本地 `concurrency=1`，worker/both 启动 bootstrap 再把 maintenance queue 的 BullMQ global concurrency 固定为 1，跨 worker replica 仍保持系统级单并发；真实 Redis 双 Worker/双 job 阻塞验证最大 active 为 1。24h READY 逻辑过期后先清 MinIO selected object 与严格 prefix，再 CAS EXPIRED；FAILED/EXPIRED orphan、DEAD 满 24h delivery、过期 lease 且 Bull job 非 active 的 stale PROCESSING、180 天审计和终态 export metadata 都进入有界修复/清理。每个 1,000 条审计批次在新短事务中重新取得 retention advisory lock、database clock 与 active-export 水位，单次最多 20 批；真实 PostgreSQL 交错验证 request commit watermark 前不会被删。
- Phase 7.23.5 同时新增严格 crash janitor、`os.tmpdir()/prepmind-audit-exports` 0700/192MiB tmpfs 明文边界、三队列 heartbeat/readiness/observability/CLI/Admin Worker 卡片与两小时 maintenance freshness。192 MiB 为严格 `free > 2 * 64 MiB` preflight 留出余量；PROCESSING orphan 清理会保护当前 token exact key/objectKey，并在 list 后删除前复核 DB/Bull 状态，stale repair 最终 CAS 同时限定 token、startedAt 和 lease cutoff。Local Compose 的 `minio-init` 导入 2 天 expiration/noncurrent、1 天 incomplete multipart 和 delete-marker lifecycle；24h 是逻辑失效、小时任务是正常物理清理、48h 是异常兜底。production versioned bucket 仍需独立验证 delete-marker 清理。
- Phase 7.23.8 已完成 Docker 真实验收、后端下载全链路与博客。
- 回顾时可以问：为什么下载必须在打开对象流之后、返回字节之前 fail-closed 写审计？
- 回顾时可以问：前端为什么要在网络失败后复用 clientRequestId，而不是每次点击都生成新 UUID？

回顾时可以问：

- “活跃导出水位如何避免 180 天清理与长时间导出互相踩踏？”
- “为什么 ACCOUNT BackgroundJob 保留 `ON DELETE CASCADE`，SYSTEM job 却要求 `userId=null`？”
- “为什么 export 与 background job 用唯一 id 关联但不建外键？”
- “strict response schema 如何防止内部存储/投递字段被未来 API 意外暴露？”
- “为什么 Phase 7.23.2 落了配置却仍让 export/maintenance 在所有环境默认关闭？”
- “事务型 Outbox 如何消除 PostgreSQL 成功但 Redis enqueue 失败的双写窗口？”
- “processing token 如何阻止失去 lease 的旧 Worker 覆盖新证据包？”
- “为什么 Serializable + advisory lock 仍需要 bounded whole-transaction retry？”
- “为什么 request audit 必须 strict，而 Outbox requeue audit 仍保持 best-effort？”
- “领域 400/503 如何避免验证细节和原始数据库错误泄露？”

### Phase 7 后续方向

- 后台管理产品化边界：Phase 7.23 已完成审计保留周期与证据包导出；后续再评估更细 operator role 和更多运维页面。
- 更多后台任务生产化：OCR 批处理、批量 embedding、PDF 解析、复习提醒调度等。
- Worker 观测增强：按部署形态补 BullMQ metrics、Prometheus 指标、队列延迟和告警阈值。
- Outbox 生产化：更多业务事件接入、dead-letter 修复工作流、生产开关流程和审计查询体验。

### Phase 8 — 高性能优化

- Web Worker、虚拟列表、IndexedDB 离线策略、PWA 完整体验。

### Phase 9 — MCP Tool 体系

- Tool Registry、JSON-RPC、Search/OCR/FSRS/Plan/Memory tools。

### Phase 10 — 生产级部署

- OpenTelemetry、Sentry、Prometheus / Grafana、k6、CI/CD。
